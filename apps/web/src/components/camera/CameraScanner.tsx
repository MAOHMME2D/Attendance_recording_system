'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { attendanceApi } from '@/lib/api';
import { playScanSuccess, playScanDuplicate, playScanError } from '@/lib/sounds';

interface CameraScannerProps {
  lectureId: string;
  isActive: boolean;
  onStudentScanned?: (result: {
    studentName: string;
    studentCode?: string;
    alreadyRegistered: boolean;
    switchedFromAbsent?: boolean;
    message?: string;
  }) => void;
  className?: string;
}

export function CameraScanner({
  lectureId,
  isActive,
  onStudentScanned,
  className = '',
}: CameraScannerProps) {
  const containerId = 'interactive-camera-qr-reader';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Subtle border flash feedback (WITHOUT covering or blocking the camera view)
  const [scanFlash, setScanFlash] = useState<'success' | 'duplicate' | 'error' | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Status banner text (small bottom indicator, does not block camera)
  const [lastScanInfo, setLastScanInfo] = useState<{
    name: string;
    code: string;
    status: 'success' | 'duplicate' | 'error';
    message: string;
  } | null>(null);
  const scanInfoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Always keep latest props in refs to prevent camera restart cycles
  const lectureIdRef = useRef(lectureId);
  lectureIdRef.current = lectureId;

  const onStudentScannedRef = useRef(onStudentScanned);
  onStudentScannedRef.current = onStudentScanned;

  const isProcessingRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastCodeTimeRef = useRef<number>(0);

  // Hardware or digital zoom
  const applyZoom = useCallback(async (zoom: number) => {
    setZoomLevel(zoom);
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (capabilities.zoom) {
          try {
            await (videoTrack as any).applyConstraints({
              advanced: [{ zoom: Math.min(Math.max(zoom, capabilities.zoom.min || 1), capabilities.zoom.max || 3) }],
            });
            return;
          } catch (e) {
            // Hardware zoom failed, fall through to digital zoom
          }
        }
      }
    }
    // Digital zoom fallback via CSS transform on video element
    const container = document.getElementById(containerId);
    const video = container?.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      video.style.transform = `scale(${zoom})`;
      video.style.transformOrigin = 'center center';
      video.style.transition = 'transform 0.2s ease-out';
    }
  }, []);

  // Trigger brief border flash (0.7s) to notify the user of scan result without blocking the camera
  const triggerBorderFlash = (type: 'success' | 'duplicate' | 'error') => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setScanFlash(type);
    flashTimeoutRef.current = setTimeout(() => {
      setScanFlash(null);
    }, 700);
  };

  // Handle barcode scan with ultra-fast execution
  const handleScanSuccess = useCallback(async (decodedText: string) => {
    const trimmed = decodedText.trim();
    if (!trimmed) return;

    const now = Date.now();
    // Rapid duplicate debounce: 1.5 seconds for exact same code
    if (lastCodeRef.current === trimmed && now - lastCodeTimeRef.current < 1500) {
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastCodeRef.current = trimmed;
    lastCodeTimeRef.current = now;

    try {
      const result = await attendanceApi.scanStudent(lectureIdRef.current, trimmed);

      if (result.alreadyRegistered && !result.switchedFromAbsent) {
        playScanDuplicate();
        triggerBorderFlash('duplicate');
        setLastScanInfo({
          name: result.studentName,
          code: trimmed,
          status: 'duplicate',
          message: 'تم تسجيل الحضور مسبقاً لهذه المحاضرة',
        });
      } else {
        playScanSuccess();
        triggerBorderFlash('success');
        setLastScanInfo({
          name: result.studentName,
          code: trimmed,
          status: 'success',
          message: result.switchedFromAbsent ? 'تم تعديل الحالة من غائب إلى حاضر' : 'تم تسجيل الحضور بنجاح',
        });
      }

      onStudentScannedRef.current?.({
        studentName: result.studentName,
        studentCode: trimmed,
        alreadyRegistered: result.alreadyRegistered,
        switchedFromAbsent: result.switchedFromAbsent,
        message: result.message,
      });
    } catch (err: any) {
      playScanError();
      triggerBorderFlash('error');
      setLastScanInfo({
        name: 'غير مسجل',
        code: trimmed,
        status: 'error',
        message: err?.message || 'رمز الباركود غير مسجل في النظام',
      });
    } finally {
      // Clear banner after 2.5 seconds
      if (scanInfoTimeoutRef.current) clearTimeout(scanInfoTimeoutRef.current);
      scanInfoTimeoutRef.current = setTimeout(() => {
        setLastScanInfo(null);
      }, 2500);

      // Re-enable processing almost instantly
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 350);
    }
  }, []);

  // Fetch available cameras once on mount
  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          const preferred = devices.find((d) => /hd|wide|webcam/i.test(d.label)) || devices[0];
          setSelectedCameraId(preferred.id);
        } else {
          setCameraError('لم يتم العثور على أي كاميرا متصلة بالجهاز.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error fetching cameras:', err);
        setCameraError('تعذر الوصول إلى الكاميرا. يرجى منح الإذن للمتصفح.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Start Camera - Stable, does not restart on re-renders
  const startCamera = useCallback(async () => {
    if (!selectedCameraId) return;

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      return;
    }

    try {
      setCameraError(null);

      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      html5QrCodeRef.current = html5QrCode;

      // Scan full area for lightning fast detection at any angle and distance
      const config = {
        fps: 30, // 30 FPS for instant responsiveness
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          return {
            width: Math.floor(viewfinderWidth * 0.96),
            height: Math.floor(viewfinderHeight * 0.96),
          };
        },
        aspectRatio: 1.777778,
        videoConstraints: {
          deviceId: { exact: selectedCameraId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        } as any,
      };

      await html5QrCode.start(
        selectedCameraId,
        config,
        (decodedText) => handleScanSuccess(decodedText),
        () => {}, // silent on non-detection frame
      );

      try {
        const videoElem = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
        if (videoElem && videoElem.srcObject) {
          mediaStreamRef.current = videoElem.srcObject as MediaStream;
        }
      } catch {
        // ignore
      }

      setIsScanning(true);
      applyZoom(zoomLevel);
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError(err?.message || 'تعذر تشغيل الكاميرا. تأكد من إعطاء الصلاحيات.');
      setIsScanning(false);
    }
  }, [selectedCameraId, handleScanSuccess, applyZoom, zoomLevel]);

  // Stop Camera
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Failed to stop camera:', err);
      }
      html5QrCodeRef.current = null;
      mediaStreamRef.current = null;
      setIsScanning(false);
    }
  }, []);

  // Effect to manage camera lifecycle ONLY when isActive or selectedCameraId changes
  useEffect(() => {
    if (isActive && selectedCameraId) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (scanInfoTimeoutRef.current) clearTimeout(scanInfoTimeoutRef.current);
    };
  }, [isActive, selectedCameraId, startCamera, stopCamera]);

  return (
    <div
      className={`glass-card overflow-hidden ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: scanFlash === 'success'
          ? '2px solid #10B981'
          : scanFlash === 'duplicate'
          ? '2px solid #F59E0B'
          : scanFlash === 'error'
          ? '2px solid #EF4444'
          : '1px solid var(--border)',
        boxShadow: scanFlash === 'success'
          ? '0 0 25px rgba(16, 185, 129, 0.4)'
          : scanFlash === 'duplicate'
          ? '0 0 25px rgba(245, 158, 11, 0.4)'
          : scanFlash === 'error'
          ? '0 0 25px rgba(239, 68, 68, 0.4)'
          : '0 8px 30px rgba(0,0,0,0.06)',
        background: '#FFFFFF',
        position: 'relative',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 18px',
          background: '#0A0A0A',
          color: '#FFFFFF',
          borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isScanning ? '#10B981' : '#6B7280',
              boxShadow: isScanning ? '0 0 8px #10B981' : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '0.3px' }}>
            قارئ الباركود التلقائي
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '6px',
              background: isScanning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              color: isScanning ? '#34D399' : '#9CA3AF',
              fontWeight: '600',
            }}
          >
            {isScanning ? 'متصل ومستعد للقراءة' : 'متوقف'}
          </span>
        </div>

        {/* Controls: Zoom & Camera selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Zoom controls for far scanning */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '2px',
            }}
          >
            <span style={{ padding: '0 6px', color: '#9CA3AF', fontSize: '11px' }}>التقريب:</span>
            {[
              { label: '1x', val: 1 },
              { label: '1.4x', val: 1.4 },
              { label: '1.8x', val: 1.8 },
              { label: '2.3x', val: 2.3 },
            ].map((z) => (
              <button
                key={z.val}
                type="button"
                onClick={() => applyZoom(z.val)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  fontSize: '11px',
                  border: 'none',
                  cursor: 'pointer',
                  background: zoomLevel === z.val ? 'var(--gold)' : 'transparent',
                  color: zoomLevel === z.val ? '#0A0A0A' : '#E5E7EB',
                  transition: 'all 0.15s',
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                background: '#1F2937',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid #374151',
                maxWidth: '150px',
              }}
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `كاميرا ${cam.id.slice(0, 5)}`}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={isScanning ? stopCamera : startCamera}
            disabled={!isActive}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: isActive ? 'pointer' : 'not-allowed',
              background: isScanning ? '#27272A' : 'var(--gold)',
              color: isScanning ? '#FFFFFF' : '#0A0A0A',
              transition: 'all 0.2s',
            }}
          >
            {isScanning ? 'إيقاف' : 'تشغيل'}
          </button>
        </div>
      </div>

      {/* Camera Viewport (Completely unobscured, video stays 100% active) */}
      <div
        style={{
          position: 'relative',
          background: '#0A0A0A',
          minHeight: '380px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          id={containerId}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '380px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {/* Laser scanner target indicator (completely transparent, pointerEvents: none) */}
        {isScanning && (
          <div
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '88%',
                maxWidth: '430px',
                height: '75%',
                maxHeight: '320px',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Corner brackets */}
              <span style={{ position: 'absolute', top: 0, left: 0, width: '24px', height: '24px', borderTop: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37', borderTopLeftRadius: '10px' }} />
              <span style={{ position: 'absolute', top: 0, right: 0, width: '24px', height: '24px', borderTop: '3px solid #D4AF37', borderRight: '3px solid #D4AF37', borderTopRightRadius: '10px' }} />
              <span style={{ position: 'absolute', bottom: 0, left: 0, width: '24px', height: '24px', borderBottom: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37', borderBottomLeftRadius: '10px' }} />
              <span style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderBottom: '3px solid #D4AF37', borderRight: '3px solid #D4AF37', borderBottomRightRadius: '10px' }} />

              <div
                className="animate-laser-sweep"
                style={{
                  position: 'absolute',
                  left: '8px',
                  right: '8px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
                  boxShadow: '0 0 10px #D4AF37',
                }}
              />
            </div>
          </div>
        )}

        {/* Small Discreet Floating Badge at top-right (DOES NOT block camera, disappears in 2.5s) */}
        {lastScanInfo && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              zIndex: 25,
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div
              style={{
                background: lastScanInfo.status === 'success'
                  ? 'rgba(6, 95, 70, 0.92)'
                  : lastScanInfo.status === 'duplicate'
                  ? 'rgba(146, 64, 14, 0.92)'
                  : 'rgba(153, 27, 27, 0.92)',
                backdropFilter: 'blur(8px)',
                color: '#FFFFFF',
                borderRadius: '12px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '14px',
                  }}
                >
                  {lastScanInfo.status === 'success' ? '✓' : '!'}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', lineHeight: 1.2 }}>
                    {lastScanInfo.name}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                    {lastScanInfo.message}
                  </div>
                </div>
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', background: 'rgba(0,0,0,0.25)', padding: '3px 8px', borderRadius: '6px' }}>
                {lastScanInfo.code}
              </div>
            </div>
          </div>
        )}

        {/* Fallback overlay only when NOT scanning */}
        {!isScanning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              background: 'rgba(10, 10, 10, 0.95)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: '#18181B',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
                marginBottom: '16px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <h4 style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF', marginBottom: '6px' }}>
              قارئ الباركود متوقف
            </h4>
            <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '340px', marginBottom: '20px', lineHeight: 1.5 }}>
              {isActive
                ? 'انقر على تشغيل لبدء قراءة باركود وبطاقات الطلاب فوراً.'
                : 'يرجى بدء المحاضرة أولاً لتفعيل خاصية قراءة الباركود.'}
            </p>
            {isActive && (
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-primary"
                style={{ padding: '8px 22px', fontSize: '13px' }}
              >
                تشغيل الكاميرا الآن
              </button>
            )}
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              right: '14px',
              zIndex: 20,
              background: '#7F1D1D',
              border: '1px solid #DC2626',
              color: '#FEE2E2',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{cameraError}</span>
            <button
              onClick={startCamera}
              style={{
                fontSize: '11px',
                background: '#991B1B',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>

      {/* Subtle bottom indicator */}
      <div
        style={{
          padding: '10px 18px',
          background: '#FAFAFA',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#6B7280',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isScanning ? '#10B981' : '#9CA3AF',
            }}
          />
          {isScanning ? 'وجه باركود الطالب نحو الكاميرا لتسجيله فوراً وبدون توقف' : 'الكاميرا في وضع الاستعداد'}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#9CA3AF' }}>
          Real-Time Continuous Scanner
        </span>
      </div>
    </div>
  );
}

export default CameraScanner;
