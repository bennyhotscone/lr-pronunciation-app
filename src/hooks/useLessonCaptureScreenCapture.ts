"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const CAPTURE_INTERVAL_MS = 60_000;

type ScreenCaptureContextValue = {
  sessionId: string;
  capturing: boolean;
  framesUploaded: number;
  pendingUploads: number;
  nextInSec: number;
  error: string | null;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
};

const ScreenCaptureContext = createContext<ScreenCaptureContextValue | null>(null);

export function useLessonCaptureScreenCapture() {
  const ctx = useContext(ScreenCaptureContext);
  if (!ctx) {
    throw new Error("useLessonCaptureScreenCapture must be used within ScreenCaptureProvider");
  }
  return ctx;
}

export function ScreenCaptureProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIndexRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const uploadingRef = useRef(0);

  const [capturing, setCapturing] = useState(false);
  const [framesUploaded, setFramesUploaded] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [nextInSec, setNextInSec] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturing(false);
  }, []);

  const uploadFrame = useCallback(
    async (blob: Blob) => {
      const idx = frameIndexRef.current++;
      uploadingRef.current += 1;
      setPendingUploads(uploadingRef.current);
      try {
        const fd = new FormData();
        fd.set("frameIndex", String(idx));
        fd.set("file", blob, `frame-${idx}.webp`);
        const res = await fetch(`/api/teacher/lesson-capture/${sessionId}/frames`, {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setFramesUploaded(idx + 1);
        setNextInSec(60);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        uploadingRef.current -= 1;
        setPendingUploads(uploadingRef.current);
      }
    },
    [sessionId],
  );

  const snap = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (blob) await uploadFrame(blob);
  }, [uploadFrame]);

  const startCapture = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      stream.getVideoTracks()[0]?.addEventListener("ended", stopCapture);
      setCapturing(true);
      await snap();
      intervalRef.current = window.setInterval(() => void snap(), CAPTURE_INTERVAL_MS);
    } catch {
      setError("Screen share denied or unavailable.");
      stopCapture();
    }
  }, [snap, stopCapture]);

  useEffect(() => {
    void fetch(`/api/teacher/lesson-capture/${sessionId}/frames`)
      .then((r) => r.json())
      .then((d: { frameCount?: number }) => {
        const n = Number(d.frameCount) || 0;
        frameIndexRef.current = n;
        setFramesUploaded(n);
      })
      .catch(() => {});
    return () => stopCapture();
  }, [sessionId, stopCapture]);

  useEffect(() => {
    if (!capturing) return;
    const id = window.setInterval(() => setNextInSec((s) => (s <= 1 ? 60 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [capturing]);

  const value: ScreenCaptureContextValue = {
    sessionId,
    capturing,
    framesUploaded,
    pendingUploads,
    nextInSec,
    error,
    startCapture,
    stopCapture,
  };

  return createElement(ScreenCaptureContext.Provider, { value }, children);
}