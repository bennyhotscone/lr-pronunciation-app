"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderError =
  | "permission-denied"
  | "no-device"
  | "unsupported"
  | "unknown";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "ready"
  | "error";

const MAX_MS = 3000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      setObjectUrl(null);
    }
    blobRef.current = null;
    setBlob(null);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const cleanupRecordingSession = useCallback(() => {
    clearTimers();
    stopTracks();
    mediaRecorderRef.current = null;
  }, [clearTimers, stopTracks]);

  useEffect(() => {
    return () => {
      cleanupRecordingSession();
      revokeUrl();
    };
  }, [cleanupRecordingSession, revokeUrl]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    clearTimers();
  }, [clearTimers]);

  const start = useCallback(async () => {
    setError(null);
    revokeUrl();
    setElapsedMs(0);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("unsupported");
      setStatus("error");
      return;
    }

    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        cleanupRecordingSession();
        setError("unknown");
        setStatus("error");
      };

      recorder.onstop = () => {
        clearTimers();
        const nextBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stopTracks();
        mediaRecorderRef.current = null;

        if (nextBlob.size === 0) {
          setError("unknown");
          setStatus("error");
          return;
        }

        const url = URL.createObjectURL(nextBlob);
        objectUrlRef.current = url;
        blobRef.current = nextBlob;
        setObjectUrl(url);
        setBlob(nextBlob);
        setStatus("ready");
        setElapsedMs(0);
      };

      recorder.start();
      setStatus("recording");
      const startedAt = Date.now();

      tickRef.current = window.setInterval(() => {
        setElapsedMs(Math.min(MAX_MS, Date.now() - startedAt));
      }, 100);

      timerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_MS);
    } catch (err) {
      cleanupRecordingSession();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("permission-denied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("no-device");
      } else if (name === "NotSupportedError") {
        setError("unsupported");
      } else {
        setError("unknown");
      }
      setStatus("error");
    }
  }, [cleanupRecordingSession, clearTimers, revokeUrl, stopTracks]);

  const clear = useCallback(() => {
    cleanupRecordingSession();
    revokeUrl();
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [cleanupRecordingSession, revokeUrl]);

  return {
    status,
    error,
    objectUrl,
    blob,
    elapsedMs,
    maxMs: MAX_MS,
    start,
    stop,
    clear,
    isRecording: status === "recording",
  };
}
