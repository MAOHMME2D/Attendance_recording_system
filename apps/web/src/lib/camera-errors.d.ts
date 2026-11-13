// Type declarations for camera-errors.js (allowJs is enabled, these keep the
// call sites fully typed without a build step).
export declare function getCameraErrorMessage(error: unknown): string;
export declare function getCameraListErrorMessage(
  error?: unknown,
  devices?: unknown[] | null,
): string;
export declare const CAMERA_ERROR_MESSAGES: Readonly<{
  NO_CAMERA: string;
  PERMISSION_DENIED: string;
  CAMERA_BUSY: string;
  OVERCONSTRAINED: string;
  INSECURE_CONTEXT: string;
  GENERIC: string;
}>;
