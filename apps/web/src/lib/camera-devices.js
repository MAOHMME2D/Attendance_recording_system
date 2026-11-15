// Pure helpers for enumerating, ranking and selecting video input devices.
// Kept dependency-light and side-effect free (except the explicit media-device
// helpers) so they can be unit-tested with node --test.
//
// Why this module exists:
// - Html5Qrcode.getCameras() opens the default camera before enumerating, and
//   fails entirely when that default camera is busy. Enumerating through
//   navigator.mediaDevices lets us recover and try every attached camera.
// - Labels are empty until camera permission is granted, so we request it once
//   (or rely on an already-granted permission) before ranking devices.
// - Camera order and names differ per browser/OS, so selection must be
//   heuristic and must always fall back to another attached camera.

import { CAMERA_ERROR_MESSAGES, getCameraErrorMessage } from './camera-errors.js';

const REAR_CAMERA_PATTERN = /back|rear|environment|world|outside|خلف/i;
const FRONT_CAMERA_PATTERN = /front|user|face|selfie|أمام|وجه/i;
const PREFERRED_CAMERA_PATTERN = /hd|wide|webcam|usb|external|4k|1080|720|مصدر|خارجي/i;

/** @typedef {{ id: string, label: string }} CameraDevice */

function permissionDeniedError() {
  const error = new Error('Camera permission denied');
  error.name = 'NotAllowedError';
  return error;
}

function unsupportedMediaError() {
  return new Error(
    'getUserMedia is not available; a secure context (HTTPS or localhost) is required',
  );
}

/**
 * Turn MediaDeviceInfo entries into a clean, de-duplicated camera list.
 * Entries without a usable deviceId are dropped: they cannot be started and
 * only appear before permission is granted.
 * @param {ArrayLike<unknown> | null | undefined} devices
 * @returns {CameraDevice[]}
 */
export function normalizeCameraDevices(devices) {
  if (!devices || typeof devices.length !== 'number') return [];

  const seen = new Set();
  const cameras = [];

  for (let i = 0; i < devices.length; i += 1) {
    const device = devices[i];
    if (!device || typeof device !== 'object') continue;
    if (device.kind !== 'videoinput') continue;

    const id = typeof device.deviceId === 'string' ? device.deviceId : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const rawLabel = typeof device.label === 'string' ? device.label.trim() : '';
    cameras.push({ id, label: rawLabel });
  }

  return cameras;
}

/**
 * Rank a camera by its label. Higher is better; labels are best-effort because
 * browsers may expose empty or localized names.
 * @param {CameraDevice} camera
 * @returns {number}
 */
function cameraScore(camera) {
  const label = camera && typeof camera.label === 'string' ? camera.label : '';
  let score = 0;
  if (REAR_CAMERA_PATTERN.test(label)) score += 4;
  if (PREFERRED_CAMERA_PATTERN.test(label)) score += 2;
  if (FRONT_CAMERA_PATTERN.test(label)) score -= 2;
  return score;
}

/**
 * Pick the camera to try first: the previously chosen one when it still
 * exists, otherwise the best-ranked attached camera.
 * @param {CameraDevice[] | null | undefined} cameras
 * @param {string | null | undefined} preferredId
 * @returns {CameraDevice | null}
 */
export function pickPreferredCamera(cameras, preferredId) {
  if (!Array.isArray(cameras) || cameras.length === 0) return null;

  if (preferredId) {
    const previous = cameras.find((camera) => camera && camera.id === preferredId);
    if (previous) return previous;
  }

  let best = cameras[0];
  let bestScore = cameraScore(best);
  for (let i = 1; i < cameras.length; i += 1) {
    const candidate = cameras[i];
    const score = cameraScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Build the attempt order: preferred camera first, then every other camera.
 * @param {CameraDevice[] | null | undefined} cameras
 * @param {string | null | undefined} preferredId
 * @returns {CameraDevice[]}
 */
export function orderCameraCandidates(cameras, preferredId) {
  if (!Array.isArray(cameras)) return [];

  const list = cameras.filter((camera) => camera && typeof camera.id === 'string' && camera.id);
  const preferred = pickPreferredCamera(list, preferredId);
  if (!preferred) return list;

  return [preferred, ...list.filter((camera) => camera.id !== preferred.id)];
}

/**
 * Video constraints for html5-qrcode. Only `ideal` values are used: `min`
 * constraints throw OverconstrainedError on low-end, virtual or front cameras
 * that cannot deliver 1280x720, which used to make the scanner unusable on
 * perfectly valid cameras.
 * @param {string | null | undefined} deviceId
 * @returns {MediaTrackConstraints}
 */
export function buildVideoConstraints(deviceId) {
  /** @type {MediaTrackConstraints} */
  const constraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  if (deviceId) {
    constraints.deviceId = { ideal: deviceId };
  } else {
    constraints.facingMode = { ideal: 'environment' };
  }

  return constraints;
}

/**
 * Errors that retrying another camera cannot fix (permission / secure context).
 * @param {unknown} error
 * @returns {boolean}
 */
export function isFatalCameraError(error) {
  const message = getCameraErrorMessage(error);
  return (
    message === CAMERA_ERROR_MESSAGES.PERMISSION_DENIED ||
    message === CAMERA_ERROR_MESSAGES.INSECURE_CONTEXT
  );
}

/**
 * Stop every track of a MediaStream, ignoring already-ended tracks.
 * @param {unknown} stream
 */
export function stopMediaStream(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return;
  let tracks = [];
  try {
    tracks = stream.getTracks();
  } catch {
    return;
  }
  for (const track of tracks) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

/**
 * Read the current camera permission without prompting.
 * @param {unknown} permissions navigator.permissions (may be missing).
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>}
 */
export async function getCameraPermissionState(permissions) {
  try {
    if (!permissions || typeof permissions.query !== 'function') return 'unknown';
    const status = await permissions.query({ name: 'camera' });
    const state = status && typeof status.state === 'string' ? status.state : '';
    if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Enumerate every attached video input device.
 *
 * Requests camera permission once (unless it is already granted) so that
 * device labels are populated, then stops the temporary stream. If the
 * temporary stream fails because a camera is busy, enumeration still runs so
 * the user can pick another camera.
 *
 * @param {unknown} mediaDevices navigator.mediaDevices
 * @param {{ requestPermission?: boolean, permissionState?: string }} [options]
 * @returns {Promise<CameraDevice[]>}
 */
export async function listVideoInputDevices(mediaDevices, options = {}) {
  const { requestPermission = true, permissionState = 'unknown' } = options;

  if (
    !mediaDevices ||
    typeof mediaDevices !== 'object' ||
    typeof mediaDevices.enumerateDevices !== 'function'
  ) {
    throw unsupportedMediaError();
  }

  if (permissionState === 'denied') {
    throw permissionDeniedError();
  }

  /** @type {unknown} */
  let permissionError = null;

  if (requestPermission && permissionState !== 'granted') {
    if (typeof mediaDevices.getUserMedia !== 'function') {
      throw unsupportedMediaError();
    }
    /** @type {unknown} */
    let stream = null;
    try {
      stream = await mediaDevices.getUserMedia({ audio: false, video: true });
    } catch (error) {
      permissionError = error;
    } finally {
      stopMediaStream(stream);
    }
  }

  const devices = await mediaDevices.enumerateDevices();
  const cameras = normalizeCameraDevices(devices);

  // Permission errors are fatal; a busy camera is not (other cameras may work).
  if (permissionError && (isFatalCameraError(permissionError) || cameras.length === 0)) {
    throw permissionError;
  }

  return cameras;
}
