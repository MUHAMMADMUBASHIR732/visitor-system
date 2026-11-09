import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff, ImageUp, Loader2, ScanLine, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './ui';

interface Props {
  onScan: (text: string) => void;
  /** Pause reading (for example while a result is being shown). */
  paused?: boolean;
  /** Start the camera straight away instead of waiting for the Scan button. */
  autoStart?: boolean;
  /** Called with a message when an uploaded image has no readable QR code. */
  onError?: (message: string) => void;
}

type State = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';

/**
 * QR reader with its own Scan button. Scans live from the camera, or from a photo or screenshot
 * of a pass. Cameras need HTTPS (localhost is fine for development).
 */
export function QrScanner({ onScan, paused, autoStart, onError }: Props) {
  const id = useId().replace(/:/g, '');
  const [wanted, setWanted] = useState(Boolean(autoStart));
  const [state, setState] = useState<State>(autoStart ? 'starting' : 'idle');
  const [attempt, setAttempt] = useState(0);
  const [reading, setReading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    if (!wanted) {
      setState('idle');
      return;
    }
    let cancelled = false;
    const scanner = new Html5Qrcode(id, { verbose: false });
    scannerRef.current = scanner;
    setState('starting');

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.78), height: Math.floor(Math.min(w, h) * 0.78) }), aspectRatio: 1 },
        (text) => {
          if (pausedRef.current) return;
          const now = Date.now();
          // Cameras report the same code many times a second; accept it once per 3 seconds.
          if (text === lastRef.current.text && now - lastRef.current.at < 3000) return;
          lastRef.current = { text, at: now };
          if (navigator.vibrate) navigator.vibrate(60);
          onScanRef.current(text);
        },
        () => undefined,
      )
      .then(() => !cancelled && setState('running'))
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = String(err);
        setState(/NotAllowed|Permission|denied/i.test(msg) ? 'denied' : 'unavailable');
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void (async () => {
          try {
            if (s.isScanning) await s.stop();
            s.clear();
          } catch {
            /* camera already released */
          }
        })();
      }
    };
  }, [id, attempt, wanted]);

  const readFile = async (file: File) => {
    setReading(true);
    try {
      // A separate reader on a hidden element, so it works whether or not the camera is on.
      const reader = new Html5Qrcode(`${id}-file`, { verbose: false });
      const text = await reader.scanFile(file, false);
      reader.clear();
      if (navigator.vibrate) navigator.vibrate(60);
      onScanRef.current(text);
    } catch {
      onError?.('No QR code was found in that image. Try a sharper photo, or type the 6-digit code.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const failed = state === 'denied' || state === 'unavailable';

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-[#1c1410]">
        <div id={id} className="size-full [&_video]:!size-full [&_video]:!object-cover" />
        <div id={`${id}-file`} className="hidden" />

        {state === 'running' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="relative size-[78%]">
              {['top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'].map((c) => (
                <span key={c} className={`absolute size-9 border-[#B9784D] ${c}`} />
              ))}
              <span className="absolute inset-x-3 top-0 h-0.5 animate-[scan-line_2.4s_ease-in-out_infinite] rounded-full bg-[#B9784D] shadow-[0_0_14px_2px_#B9784D]" />
            </div>
          </div>
        )}

        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#2D211B] to-[#1c1410] p-8 text-center text-[#E7D7C2]">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-20 items-center justify-center rounded-3xl bg-[#B9784D] text-[#2D211B] shadow-[0_18px_40px_-14px_#B9784D]">
              <ScanLine className="size-10" />
            </motion.div>
            <div>
              <p className="font-display text-2xl font-bold text-[#F8F1E8]">Scan a visitor pass</p>
              <p className="mt-1.5 text-[15px]">Point the camera at the QR code on their phone or printout.</p>
            </div>
            <Button size="lg" variant="accent" icon={<ScanLine className="size-5" />} onClick={() => setWanted(true)}>
              Scan QR code
            </Button>
          </div>
        )}

        {state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#E7D7C2]">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-[15px]">Starting the camera</p>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1c1410] p-8 text-center text-[#E7D7C2]">
            <CameraOff className="size-9 text-[#B9784D]" />
            <p className="text-lg font-semibold text-[#F8F1E8]">{state === 'denied' ? 'Camera access is blocked' : 'No camera found'}</p>
            <p className="max-w-xs text-[15px]">
              {state === 'denied'
                ? 'Allow the camera for this site in your browser settings, then try again. You can also upload a photo of the pass or type the 6-digit code.'
                : 'Cameras need a secure (https) page and a camera. You can upload a photo of the pass or type the 6-digit code instead.'}
            </p>
            <Button variant="accent" size="sm" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {wanted && !failed ? (
          <Button size="sm" variant="soft" icon={<Square className="size-3.5 fill-current" />} onClick={() => setWanted(false)}>
            Stop camera
          </Button>
        ) : (
          !wanted && (
            <Button size="sm" variant="soft" icon={<ScanLine className="size-4" />} onClick={() => setWanted(true)}>
              Start camera
            </Button>
          )
        )}
        <Button size="sm" variant="soft" icon={<ImageUp className="size-4" />} loading={reading} onClick={() => fileRef.current?.click()}>
          Upload a QR photo
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
      </div>
    </div>
  );
}
