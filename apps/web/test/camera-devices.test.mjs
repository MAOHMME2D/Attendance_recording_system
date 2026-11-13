import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCameraDevices,
  pickPreferredCamera,
  orderCameraCandidates,
  buildVideoConstraints,
  isFatalCameraError,
  stopMediaStream,
  getCameraPermissionState,
  listVideoInputDevices,
} from '../src/lib/camera-devices.js';
import { getCameraErrorMessage, CAMERA_ERROR_MESSAGES } from '../src/lib/camera-errors.js';

function fakeDevice(deviceId, label, kind = 'videoinput') {
  return { deviceId, label, kind, groupId: 'group' };
}

test('normalizeCameraDevices keeps video inputs, trims labels, drops empty ids and duplicates', () => {
  const cameras = normalizeCameraDevices([
    fakeDevice('a', '  Integrated Camera  '),
    fakeDevice('a', 'Duplicate id'),
    fakeDevice('', 'No id before permission'),
    fakeDevice('b', 'USB Camera', 'audioinput'),
    null,
    { kind: 'videoinput', deviceId: 'c' },
  ]);

  assert.deepEqual(cameras, [
    { id: 'a', label: 'Integrated Camera' },
    { id: 'c', label: '' },
  ]);
});

test('normalizeCameraDevices tolerates missing or invalid input', () => {
  assert.deepEqual(normalizeCameraDevices(null), []);
  assert.deepEqual(normalizeCameraDevices(undefined), []);
  assert.deepEqual(normalizeCameraDevices({}), []);
  assert.deepEqual(normalizeCameraDevices([]), []);
});

test('pickPreferredCamera keeps a still-attached previous camera', () => {
  const cameras = [
    { id: 'front', label: 'Front Camera' },
    { id: 'usb', label: 'USB HD Webcam' },
  ];
  assert.equal(pickPreferredCamera(cameras, 'front').id, 'front');
});

test('pickPreferredCamera prefers rear/external cameras over front ones', () => {
  const cameras = [
    { id: 'front', label: 'Front Camera (User)' },
    { id: 'rear', label: 'Back Camera (Environment)' },
  ];
  assert.equal(pickPreferredCamera(cameras, '').id, 'rear');
  assert.equal(pickPreferredCamera(cameras, 'missing-id').id, 'rear');

  const unlabeled = [{ id: 'one', label: '' }, { id: 'two', label: '' }];
  assert.equal(pickPreferredCamera(unlabeled, null).id, 'one');
  assert.equal(pickPreferredCamera([], 'one'), null);
});

test('orderCameraCandidates puts the preferred camera first without duplicates', () => {
  const cameras = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];

  assert.deepEqual(
    orderCameraCandidates(cameras, 'b').map((camera) => camera.id),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(
    orderCameraCandidates(cameras, 'missing').map((camera) => camera.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(orderCameraCandidates(null, 'a'), []);
});

test('buildVideoConstraints never uses min constraints (OverconstrainedError regression)', () => {
  const withDevice = buildVideoConstraints('camera-1');
  assert.deepEqual(withDevice.deviceId, { ideal: 'camera-1' });
  assert.equal(JSON.stringify(withDevice).includes('"min"'), false);

  const withoutDevice = buildVideoConstraints('');
  assert.deepEqual(withoutDevice.facingMode, { ideal: 'environment' });
  assert.equal(withoutDevice.deviceId, undefined);
  assert.equal(JSON.stringify(withoutDevice).includes('"min"'), false);
});

test('isFatalCameraError only flags permission and insecure-context failures', () => {
  assert.equal(isFatalCameraError({ name: 'NotAllowedError', message: 'denied' }), true);
  assert.equal(
    isFatalCameraError(new Error('getUserMedia requires a secure context (HTTPS)')),
    true,
  );
  assert.equal(isFatalCameraError({ name: 'OverconstrainedError', message: 'constraint' }), false);
  assert.equal(isFatalCameraError({ name: 'NotReadableError', message: 'busy' }), false);
  assert.equal(isFatalCameraError({ name: 'NotFoundError', message: 'not found' }), false);
});

test('stopMediaStream stops every track and ignores invalid streams', () => {
  let stopped = 0;
  const stream = {
    getTracks: () => [
      { stop: () => { stopped += 1; } },
      { stop: () => { stopped += 1; } },
      { stop: () => { throw new Error('already stopped'); } },
    ],
  };

  stopMediaStream(stream);
  assert.equal(stopped, 2);
  assert.doesNotThrow(() => stopMediaStream(null));
  assert.doesNotThrow(() => stopMediaStream({}));
});

test('getCameraPermissionState reads the browser permission without throwing', async () => {
  const granted = await getCameraPermissionState({
    query: async () => ({ state: 'granted' }),
  });
  assert.equal(granted, 'granted');

  const denied = await getCameraPermissionState({
    query: async () => ({ state: 'denied' }),
  });
  assert.equal(denied, 'denied');

  const unsupported = await getCameraPermissionState({
    query: async () => {
      throw new TypeError('camera is not a valid permission name');
    },
  });
  assert.equal(unsupported, 'unknown');

  assert.equal(await getCameraPermissionState(null), 'unknown');
  assert.equal(await getCameraPermissionState({}), 'unknown');
});

test('listVideoInputDevices skips getUserMedia when permission is already granted', async () => {
  let gumCalls = 0;
  const cameras = await listVideoInputDevices(
    {
      getUserMedia: async () => {
        gumCalls += 1;
        return { getTracks: () => [] };
      },
      enumerateDevices: async () => [
        fakeDevice('a', 'Integrated Camera'),
        fakeDevice('b', 'USB Camera'),
      ],
    },
    { permissionState: 'granted' },
  );

  assert.equal(gumCalls, 0);
  assert.deepEqual(cameras.map((camera) => camera.id), ['a', 'b']);
});

test('listVideoInputDevices prompts once, stops the temporary stream, then enumerates', async () => {
  let stopped = 0;
  let gumConstraints = null;
  const cameras = await listVideoInputDevices({
    getUserMedia: async (constraints) => {
      gumConstraints = constraints;
      return {
        getTracks: () => [{ stop: () => { stopped += 1; } }],
      };
    },
    enumerateDevices: async () => [fakeDevice('a', 'Camera')],
  });

  assert.deepEqual(gumConstraints, { audio: false, video: true });
  assert.equal(stopped, 1);
  assert.deepEqual(cameras, [{ id: 'a', label: 'Camera' }]);
});

test('listVideoInputDevices still lists cameras when the default camera is busy', async () => {
  const busy = Object.assign(new Error('Could not start video source'), {
    name: 'NotReadableError',
  });

  const cameras = await listVideoInputDevices({
    getUserMedia: async () => {
      throw busy;
    },
    enumerateDevices: async () => [
      fakeDevice('busy', 'Default Camera'),
      fakeDevice('free', 'USB Camera'),
    ],
  });

  assert.deepEqual(cameras.map((camera) => camera.id), ['busy', 'free']);
});

test('listVideoInputDevices surfaces permission denial instead of an empty list', async () => {
  const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

  await assert.rejects(
    listVideoInputDevices({
      getUserMedia: async () => {
        throw denied;
      },
      enumerateDevices: async () => [],
    }),
    (error) => {
      assert.equal(
        getCameraErrorMessage(error),
        CAMERA_ERROR_MESSAGES.PERMISSION_DENIED,
      );
      return true;
    },
  );

  await assert.rejects(
    listVideoInputDevices(
      {
        enumerateDevices: async () => [fakeDevice('a', 'Camera')],
      },
      { permissionState: 'denied' },
    ),
    (error) => error.name === 'NotAllowedError',
  );
});

test('listVideoInputDevices explains a missing/insecure mediaDevices API', async () => {
  await assert.rejects(listVideoInputDevices(null), (error) => {
    assert.equal(getCameraErrorMessage(error), CAMERA_ERROR_MESSAGES.INSECURE_CONTEXT);
    return true;
  });
});
