import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCameraErrorMessage,
  getCameraListErrorMessage,
  CAMERA_ERROR_MESSAGES,
} from '../src/lib/camera-errors.js';

test('maps NotAllowedError / permission denial to the permission message', () => {
  assert.equal(
    getCameraErrorMessage({ name: 'NotAllowedError', message: 'Permission denied' }),
    CAMERA_ERROR_MESSAGES.PERMISSION_DENIED,
  );
  assert.equal(
    getCameraErrorMessage(new Error('User denied access to camera')),
    CAMERA_ERROR_MESSAGES.PERMISSION_DENIED,
  );
});

test('maps a missing camera to the no-camera message', () => {
  assert.equal(
    getCameraErrorMessage({ name: 'NotFoundError', message: 'Requested device not found' }),
    CAMERA_ERROR_MESSAGES.NO_CAMERA,
  );
  assert.equal(
    getCameraListErrorMessage(new Error('no devices'), []),
    CAMERA_ERROR_MESSAGES.NO_CAMERA,
  );
});

test('maps a busy camera (NotReadableError / TrackStartError) to the busy message', () => {
  assert.equal(
    getCameraErrorMessage({ name: 'NotReadableError', message: 'Could not start video source' }),
    CAMERA_ERROR_MESSAGES.CAMERA_BUSY,
  );
  assert.equal(
    getCameraErrorMessage({ name: 'TrackStartError', message: 'hardware error' }),
    CAMERA_ERROR_MESSAGES.CAMERA_BUSY,
  );
});

test('maps overconstrained constraints to the overconstrained message', () => {
  assert.equal(
    getCameraErrorMessage({ name: 'OverconstrainedError', message: 'constraint deviceId' }),
    CAMERA_ERROR_MESSAGES.OVERCONSTRAINED,
  );
});

test('maps insecure contexts to the secure-context message', () => {
  assert.equal(
    getCameraErrorMessage(new Error('getUserMedia must be used in a secure context (HTTPS)')),
    CAMERA_ERROR_MESSAGES.INSECURE_CONTEXT,
  );
});

test('keeps a useful backend message when the error is unrecognised', () => {
  assert.equal(
    getCameraErrorMessage(new Error('كاميرا خارجية غير مدعومة')),
    'كاميرا خارجية غير مدعومة',
  );
});

test('falls back to the generic message for empty/garbage input', () => {
  assert.equal(getCameraErrorMessage(null), CAMERA_ERROR_MESSAGES.GENERIC);
  assert.equal(getCameraErrorMessage(undefined), CAMERA_ERROR_MESSAGES.GENERIC);
  assert.equal(getCameraErrorMessage(''), CAMERA_ERROR_MESSAGES.GENERIC);
});

test('never throws on exotic error shapes', () => {
  for (const weird of [42, true, { code: 5 }, Object.create(null)]) {
    assert.equal(typeof getCameraErrorMessage(weird), 'string');
  }
});
