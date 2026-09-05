"use client";

import { useEffect, useRef, useState } from "react";

interface LoadingOverlayProps {
  /** true while the thing being waited on is still in progress */
  active: boolean;
  label?: string;
  /** minimum time to stay visible once shown, so fast connections don't just flash */
  minDurationMs?: number;
}

const CANVAS_SIZE = 480;

export default function LoadingOverlay({
  active,
  label = "Loading...",
  minDurationMs = 600,
}: LoadingOverlayProps) {
  const [shown, setShown] = useState(true);
  const shownAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (active) {
      if (shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      }
      if (!shown) {
        const t = setTimeout(() => setShown(true), 0);
        return () => clearTimeout(t);
      }
      return;
    }

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : minDurationMs;
    const remaining = Math.max(0, minDurationMs - elapsed);
    const t = setTimeout(() => setShown(false), remaining);
    return () => clearTimeout(t);
  }, [active, shown, minDurationMs]);

  // Real-time luminance-to-alpha compositing: each video frame is drawn to a
  // canvas, then every pixel's alpha is set from its own brightness (black
  // background -> alpha 0, bright neon glow -> alpha high). This makes the
  // background genuinely disappear in every browser, unlike CSS
  // mix-blend-mode on <video> (compositor layer quirks make it unreliable)
  // or alpha-channel WebM (inconsistent encoder/muxer/decoder support).
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let rafId: number;
    let running = true;

    video.play().catch(() => {
      // Autoplay can be blocked in rare cases; muted+playsInline should
      // avoid that, but this keeps the draw loop from throwing if it happens.
    });

        function draw() {
      if (running) {
        if (video && !video.paused && !video.ended && video.readyState >= 2) {
          // Source video is already a square (480x480) at native resolution,
          // so this is a straight draw with no cropping or scaling distortion.
          ctx!.drawImage(video, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
          const frame = ctx!.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          const data = frame.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i + 3] = Math.max(data[i], data[i + 1], data[i + 2]);
          }
          ctx!.putImageData(frame, 0, 0);
        }
        rafId = requestAnimationFrame(draw);
      }
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 transition-opacity duration-500 ${
        shown ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <video
        ref={videoRef}
        src="/loading-animation.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute opacity-0 pointer-events-none w-px h-px overflow-hidden"
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
                className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40"
      />
      <p className="mt-4 text-xs tracking-wide text-neutral-500 uppercase">{label}</p>
    </div>
  );
}