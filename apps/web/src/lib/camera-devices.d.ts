// Type declarations for camera-devices.js (allowJs is enabled, these keep the
// call sites fully typed without a build step).

export interface CameraDevice {
  id: string;
  label: string;
}

export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export declare function normalizeCameraDevices(
  devices: ArrayLike<unknown> | null | undefined,
): CameraDevice[];

export declare function pickPreferredCamera(
  cameras: CameraDevice[] | null | undefined,
  preferredId?: string | null,
): CameraDevice | null;

export declare function orderCameraCandidates(
  cameras: CameraDevice[] | null | undefined,
  preferredId?: string | null,
): CameraDevice[];

export declare function buildVideoConstraints(
  deviceId?: string | null,
): MediaTrackConstraints;

export declare function isFatalCameraError(error: unknown): boolean;

export declare function stopMediaStream(stream: unknown): void;

export declare function getCameraPermissionState(
  permissions: unknown,
): Promise<CameraPermissionState>;

export declare function listVideoInputDevices(
  mediaDevices: unknown,
  options?: {
    requestPermission?: boolean;
    permissionState?: CameraPermissionState | string;
  },
): Promise<CameraDevice[]>;
