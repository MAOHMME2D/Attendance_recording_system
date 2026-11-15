// Pure mapping from camera / getUserMedia / html5-qrcode failures to Arabic
// user-facing messages. Kept dependency-free and side-effect free so it can be
// unit-tested with node --test (see apps/web/test/camera-errors.test.mjs).
//
// The camera is never trusted by the UI: Backend stays the sole authority for
// whether a scanned token is valid; these messages only explain *why the
// camera could not start or enumerate devices*.

const NO_CAMERA = 'لم يتم العثور على أي كاميرا متصلة بالجهاز.';
const PERMISSION_DENIED = 'تعذر الوصول إلى الكاميرا. يرجى منح الإذن للمتصفح.';
const CAMERA_BUSY = 'تعذر تشغيل الكاميرا. قد تكون قيد الاستخدام من تطبيق آخر.';
const OVERCONSTRAINED = 'إعدادات الكاميرا المطلوبة غير مدعومة على هذا الجهاز.';
const INSECURE_CONTEXT = 'تتطلب الكاميرا اتصالاً آمناً (HTTPS أو localhost).';
const GENERIC = 'تعذر تشغيل الكاميرا. تأكد من إعطاء الصلاحيات.';

/**
 * @param {unknown} error Anything thrown by getUserMedia / html5-qrcode.
 * @returns {string} Arabic message safe to show in the UI.
 */
export function getCameraErrorMessage(error) {
  let primitive = '';
  try {
    primitive = String(error ?? '');
  } catch {
    primitive = '';
  }

  const name =
    error && typeof error === 'object' && typeof error.name === 'string'
      ? error.name
      : '';
  const code =
    error && typeof error === 'object' && typeof error.code === 'number'
      ? error.code
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && typeof error.message === 'string'
        ? error.message
        : primitive;

  const haystack = `${name} ${message}`.toLowerCase();

  // Permission / access denied (NotAllowedError, PermissionDeniedError, legacy code 0xFFFFFF... )
  if (
    /notallowederror|permissiondeniederror|permission.*deni|accessdenied|denied|(^|\s)0x800703e3/.test(
      haystack,
    ) ||
    code === 0xffffffff
  ) {
    return PERMISSION_DENIED;
  }

  // No camera attached / device not found
  if (/notfounderror|devicesnotfounderror|no camera|no video|requested device not found|0x8007000d/.test(haystack)) {
    return NO_CAMERA;
  }

  // Camera busy or hardware failure (NotReadableError / TrackStartError)
  if (/notreadableerror|trackstarterror|could not start video|hardware|not supported by system|aborterror/.test(haystack)) {
    return CAMERA_BUSY;
  }

  // Overconstrained deviceId / constraints cannot be satisfied
  if (/overconstrainederror|constraint|deviceid/.test(haystack)) {
    return OVERCONSTRAINED;
  }

  // Insecure context: getUserMedia requires HTTPS or localhost
  if (/insecure|getusermedia|is not available|secure context|0x80004005/.test(haystack) && /https|secure|context|available/.test(haystack)) {
    return INSECURE_CONTEXT;
  }

  // Keep a useful backend-provided message when we have one, otherwise generic.
  if (message && message.trim() !== '' && message.length < 200) {
    return message;
  }
  return GENERIC;
}

/**
 * Classify a failure of Html5Qrcode.getCameras(): either an explicit empty
 * device list (no camera attached) or an error acquiring the device list.
 * @param {unknown} [error]
 * @param {Array<unknown>} [devices]
 * @returns {string}
 */
export function getCameraListErrorMessage(error, devices) {
  if (Array.isArray(devices) && devices.length === 0) {
    return NO_CAMERA;
  }
  return getCameraErrorMessage(error ?? NO_CAMERA);
}

export const CAMERA_ERROR_MESSAGES = Object.freeze({
  NO_CAMERA,
  PERMISSION_DENIED,
  CAMERA_BUSY,
  OVERCONSTRAINED,
  INSECURE_CONTEXT,
  GENERIC,
});
