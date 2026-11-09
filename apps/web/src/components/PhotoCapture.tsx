import { Camera, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui';

interface Props {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
}

/** Takes a visitor photo with the front camera. Optional: the guard can skip it. */
export function PhotoCapture({ value, onChange }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
      stream.current = s;
      setActive(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setError('The camera could not be opened. Allow camera access or skip the photo.');
    }
  };

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas');
    const out = Math.min(size, 720);
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, out, out);
    canvas.toBlob((b) => b && onChange(b), 'image/jpeg', 0.82);
    stop();
  };

  if (preview) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-sunken p-3">
        <img src={preview} alt="Visitor" className="size-20 rounded-2xl object-cover" />
        <div className="flex-1">
          <p className="text-[15px] font-semibold">Photo ready</p>
          <p className="text-sm text-soft">It is saved with the check-in.</p>
        </div>
        <Button variant="soft" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => { onChange(null); void start(); }}>
          Retake
        </Button>
        <button onClick={() => onChange(null)} aria-label="Remove photo" className="flex size-9 items-center justify-center rounded-full text-soft hover:bg-line">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (active) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#1c1410]">
          <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" />
        </div>
        <div className="flex gap-2">
          <Button variant="accent" className="flex-1" icon={<Camera className="size-5" />} onClick={snap}>
            Take photo
          </Button>
          <Button variant="soft" onClick={stop}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button variant="soft" className="w-full" icon={<Camera className="size-5" />} onClick={start}>
        Take visitor photo
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
