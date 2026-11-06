import { useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';

export default function MemberInviteScanner({ onScan, onClose }) {
  const [video, setVideo] = useState(null);
  const [message, setMessage] = useState('Starting camera…');

  useEffect(() => {
    if (!video) return undefined;
    let stopped = false;
    let stream;
    let frameId;
    let busy = false;

    const stop = () => {
      stopped = true;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach(track => track.stop());
    };

    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setMessage('QR scanning is not supported by this browser. Enter the invitation details manually.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage('Camera access is unavailable. Enter the invitation details manually.');
        return;
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setMessage('Point your camera at the member invitation QR code.');

        const scan = async () => {
          if (stopped) return;
          frameId = requestAnimationFrame(scan);
          if (busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          busy = true;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              stop();
              onScan(codes[0].rawValue);
            }
          } catch {
            setMessage('Could not read that QR code. Adjust the camera and try again.');
          } finally {
            busy = false;
          }
        };
        scan();
      } catch (error) {
        setMessage(error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Enter the invitation details manually.'
          : 'Could not start the camera. Enter the invitation details manually.');
      }
    };

    start();
    return stop;
  }, [video, onScan]);

  return (
    <div className="invite-scan-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="invite-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-scan-title">
        <div className="invite-scan-heading"><div><span className="quick-auth-kicker"><Camera size={14} /> MEMBER PORTAL</span><h2 id="invite-scan-title">Scan Your Invitation</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close scanner"><X size={18} /></button></div>
        <video ref={setVideo} className="invite-scan-video" muted playsInline />
        <p className="invite-scan-message" role="status">{message}</p>
        <button type="button" className="btn btn-secondary invite-scan-close" onClick={onClose}>Enter details manually</button>
      </section>
    </div>
  );
}
