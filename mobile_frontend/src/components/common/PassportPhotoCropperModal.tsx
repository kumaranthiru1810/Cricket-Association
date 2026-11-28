/**
 * mobile_frontend/src/components/common/PassportPhotoCropperModal.tsx
 * Interactive Passport Photo Cropper with:
 * - Gallery file upload & live camera capture (getUserMedia / expo-image-picker)
 * - Automatic printed-photo rectangular boundary detection
 * - Manual 4-corner perspective adjustment & fine rotation/tilt correction
 * - 600x770 (7:9 portrait) preview before final submission
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator
} from 'react-native';
import {
  QuadCorners,
  detectPrintedPhotoBoundary,
  getDefaultPortraitQuad,
  loadHtmlImage,
  readFileAsDataUri,
  validateCroppedPassportPhoto,
  warpQuadToPassport600x770,
  PassportPhotoValidationResult
} from '../../utils/passportPhotoValidator';

interface PassportPhotoCropperModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: PassportPhotoValidationResult) => void;
}

export const PassportPhotoCropperModal: React.FC<PassportPhotoCropperModalProps> = ({
  visible,
  onClose,
  onConfirm
}) => {
  const [sourceUri, setSourceUri] = useState<string>('');
  const [corners, setCorners] = useState<QuadCorners | null>(null);
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [autoDetected, setAutoDetected] = useState<boolean>(false);
  const [previewUri, setPreviewUri] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!visible) {
      stopCamera();
      setSourceUri('');
      setPreviewUri('');
      setCorners(null);
      setRotationDeg(0);
      setErrorMsg('');
      setStatusMsg('');
    }
  }, [visible]);

  const loadImageIntoEditor = async (uri: string) => {
    setErrorMsg('');
    setStatusMsg('Detecting printed passport photo boundary...');
    try {
      const img = await loadHtmlImage(uri);
      imgRef.current = img;
      setSourceUri(uri);
      setRotationDeg(0);
      const detected = detectPrintedPhotoBoundary(img);
      setCorners(detected.corners);
      setAutoDetected(detected.autoDetected);
      setStatusMsg(
        detected.autoDetected
          ? '✓ Printed passport photo boundary auto-detected. Drag corners if needed.'
          : 'Drag the 4 golden corners onto the printed passport photo edges.'
      );
      const cropped = warpQuadToPassport600x770(img, detected.corners, 0);
      setPreviewUri(cropped);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load image.');
    }
  };

  // Re-render interactive canvas & 600x770 preview whenever corners or rotation change
  useEffect(() => {
    if (Platform.OS !== 'web' || !sourceUri || !corners || !imgRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = 380;
    const maxH = 320;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const rad = (rotationDeg * Math.PI) / 180;
    const rotW = Math.abs(natW * Math.cos(rad)) + Math.abs(natH * Math.sin(rad));
    const rotH = Math.abs(natW * Math.sin(rad)) + Math.abs(natH * Math.cos(rad));
    const scale = Math.min(maxW / rotW, maxH / rotH, 1);

    canvas.width = Math.round(rotW * scale);
    canvas.height = Math.round(rotH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, (-natW * scale) / 2, (-natH * scale) / 2, natW * scale, natH * scale);
    ctx.restore();

    // Dim outside quad
    const pts = corners.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();

    // Draw golden quad border & corner handles
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.stroke();

    pts.forEach((pt) => {
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#0f2452';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    try {
      const cropped = warpQuadToPassport600x770(img, corners, rotationDeg);
      setPreviewUri(cropped);
    } catch (_e) {}
  }, [sourceUri, corners, rotationDeg]);

  const handleWebFilePick = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const type = String(file.type || '').toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(type)) {
      setErrorMsg('Only JPG, JPEG, and PNG images are allowed.');
      return;
    }
    const uri = await readFileAsDataUri(file);
    await loadImageIntoEditor(uri);
  };

  const handleStartWebCamera = async () => {
    setErrorMsg('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Live camera is not supported in this browser. Please choose a photo file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (_err) {
      setErrorMsg('Camera permission denied or unavailable. Use "Choose Photo" to select or take a photo.');
    }
  };

  const handleCaptureFromCamera = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const dataUri = c.toDataURL('image/jpeg', 0.94);
    stopCamera();
    await loadImageIntoEditor(dataUri);
  };

  const handlePointerDown = (e: any) => {
    if (!canvasRef.current || !corners) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    let bestIdx = -1;
    let bestDist = 0.08;
    corners.forEach((p, idx) => {
      const d = Math.hypot(p.x - nx, p.y - ny);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) dragIdxRef.current = bestIdx;
  };

  const handlePointerMove = (e: any) => {
    if (dragIdxRef.current === null || !canvasRef.current || !corners) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.min(0.99, Math.max(0.01, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(0.99, Math.max(0.01, (e.clientY - rect.top) / rect.height));
    const idx = dragIdxRef.current;
    setCorners((prev) => {
      if (!prev) return prev;
      const next = [...prev] as QuadCorners;
      next[idx] = { x: nx, y: ny };
      return next;
    });
  };

  const handlePointerUp = () => {
    dragIdxRef.current = null;
  };

  const handleConfirmCropped = async () => {
    if (!previewUri) return;
    setProcessing(true);
    setErrorMsg('');
    try {
      const res = await validateCroppedPassportPhoto(previewUri);
      if (!res.valid) {
        setErrorMsg(res.error || 'Cropped photo failed validation.');
        setProcessing(false);
        return;
      }
      onConfirm(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Validation failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>📸 Passport Photo Crop & Perspective Tool</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.guideText}>
              Tip: If photographing a printed passport photo, frame only the photo inside the golden corners so cloth, table, and white borders are cropped out (600×770 portrait).
            </Text>

            {Platform.OS === 'web' && (
              <View style={styles.actionRow}>
                <label style={webFileBtnStyle}>
                  📁 Choose Photo / Gallery
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    style={{ display: 'none' }}
                    onChange={handleWebFilePick}
                  />
                </label>
                <TouchableOpacity style={styles.camBtn} onPress={cameraActive ? stopCamera : handleStartWebCamera}>
                  <Text style={styles.camBtnText}>{cameraActive ? 'Stop Camera' : '📷 Live Camera'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {cameraActive && Platform.OS === 'web' && (
              <View style={styles.cameraBox}>
                <video
                  ref={videoRef as any}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', maxHeight: 260, borderRadius: 8, backgroundColor: '#000' }}
                />
                <TouchableOpacity style={styles.captureBtn} onPress={handleCaptureFromCamera}>
                  <Text style={styles.captureBtnText}>📸 Capture Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {Boolean(sourceUri) && Platform.OS === 'web' && (
              <View style={styles.editorRow}>
                <View style={styles.canvasWrap}>
                  <Text style={styles.subLabel}>
                    {autoDetected ? '✓ Auto-Detected Boundary (Drag corners to refine)' : 'Drag 4 Corners onto Printed Photo'}
                  </Text>
                  <canvas
                    ref={canvasRef as any}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{ borderRadius: 8, border: '1px solid #cbd5e1', touchAction: 'none', cursor: 'crosshair' }}
                  />
                  <View style={styles.rotateRow}>
                    <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg((r) => r - 90)}>
                      <Text style={styles.rotBtnText}>↺ -90°</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg((r) => r - 2)}>
                      <Text style={styles.rotBtnText}>-2°</Text>
                    </TouchableOpacity>
                    <Text style={styles.rotVal}>{rotationDeg}°</Text>
                    <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg((r) => r + 2)}>
                      <Text style={styles.rotBtnText}>+2°</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rotBtn} onPress={() => setRotationDeg((r) => r + 90)}>
                      <Text style={styles.rotBtnText}>↻ +90°</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rotBtn}
                      onPress={() => {
                        if (imgRef.current) {
                          setRotationDeg(0);
                          setCorners(getDefaultPortraitQuad(imgRef.current.naturalWidth, imgRef.current.naturalHeight));
                        }
                      }}
                    >
                      <Text style={styles.rotBtnText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {Boolean(previewUri) && (
                  <View style={styles.previewWrap}>
                    <Text style={styles.subLabel}>Final Preview (600×770)</Text>
                    <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="cover" />
                    <Text style={styles.previewMeta}>7:9 Passport Portrait</Text>
                  </View>
                )}
              </View>
            )}

            {Boolean(statusMsg) && !errorMsg && <Text style={styles.statusTxt}>{statusMsg}</Text>}
            {Boolean(errorMsg) && <Text style={styles.errorTxt}>⚠️ {errorMsg}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!previewUri || processing) && { opacity: 0.5 }]}
              disabled={!previewUri || processing}
              onPress={handleConfirmCropped}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmTxt}>✓ Use Cropped Photo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const webFileBtnStyle: React.CSSProperties = {
  backgroundColor: '#0f2452',
  color: '#ffffff',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-block'
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, width: '96%', maxWidth: 700, maxHeight: '92%', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  title: { fontSize: 14.5, fontWeight: '800', color: '#0f2452' },
  closeTxt: { fontSize: 18, color: '#64748b', fontWeight: '700', paddingHorizontal: 6 },
  body: { padding: 14, gap: 12 },
  guideText: { fontSize: 12, color: '#475569', backgroundColor: '#eff6ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  camBtn: { backgroundColor: '#b45309', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  camBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  cameraBox: { gap: 8, alignItems: 'center' },
  captureBtn: { backgroundColor: '#16a34a', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  captureBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  editorRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' },
  canvasWrap: { alignItems: 'center', gap: 8 },
  subLabel: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  rotateRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  rotBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  rotBtnText: { fontSize: 11.5, fontWeight: '700', color: '#0f172a' },
  rotVal: { fontSize: 12, fontWeight: '800', color: '#0f2452', minWidth: 32, textAlign: 'center' },
  previewWrap: { alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  previewImg: { width: 130, height: 167, borderRadius: 6, borderWidth: 1.5, borderColor: '#0f2452' },
  previewMeta: { fontSize: 11, fontWeight: '700', color: '#166534' },
  statusTxt: { fontSize: 12, fontWeight: '700', color: '#166534' },
  errorTxt: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  cancelTxt: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  confirmBtn: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  confirmTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff' }
});

