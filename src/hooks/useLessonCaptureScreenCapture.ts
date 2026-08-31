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
/** Keep uploads under Vercel body limits and OCR-friendly size. */
const MAX_FRAME_WIDTH = 1920;

function formatFrameUploadError(
  err: unknown,
  status?: number,
  serverError?: string,
): string {
  if (serverError?.trim()) return serverError.trim();
  if (status === 401) return "Session expired — refresh the page and log in again.";
  if (status === 403) return "You don't have access to upload frames for this session.";
  if (status === 404) return "Lesson Capture session not found.";
  if (status === 400) return "Invalid frame upload — try stopping and restarting screen capture.";
  if (status === 413) return "Screenshot too large — reduce screen resolution or zoom level.";
  if (status === 503) {
    return (
      "Lesson Capture frame uploads require Vercel Blob. In the Vercel dashboard: Storage → Blob, " +
      "ensure BLOB_READ_WRITE_TOKEN is set for Production, then redeploy."
    );
  }

  const msg = err instanceof Error ? err.message : "Upload failed";
  if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
    return (
      "Frame upload could not reach the server (network error). " +
      "On production, confirm BLOB_READ_WRITE_TOKEN is set in Vercel (Storage → Blob) and redeploy."
    );
  }
  return msg;
}

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
          credentials: "same-origin",
        });
        let serverError: string | undefined;
        const text = await res.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as { error?: string };
            serverError = parsed.error;
          } catch {
            if (!res.ok) serverError = text.slice(0, 240);
          }
        }
        if (!res.ok) {
          throw new Error(formatFrameUploadError(null, res.status, serverError));
        }
        setFramesUploaded(idx + 1);
        setNextInSec(60);
      } catch (e) {
        setError(formatFrameUploadError(e));
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
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX_FRAME_WIDTH) {
      h = Math.round(h * (MAX_FRAME_WIDTH / w));
      w = MAX_FRAME_WIDTH;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
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
    void fetch(`/api/teacher/lesson-capture/${sessionId}/frames`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        const d = (await r.json()) as {
          frameCount?: number;
          storageReady?: boolean;
          storageError?: string | null;
          error?: string;
        };
        if (!r.ok) {
          setError(formatFrameUploadError(null, r.status, d.error));
          return;
        }
        const n = Number(d.frameCount) || 0;
        frameIndexRef.current = n;
        setFramesUploaded(n);
        if (d.storageReady === false && d.storageError) {
          setError(d.storageError);
        }
      })
      .catch((e) => {
        setError(formatFrameUploadError(e));
      });
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