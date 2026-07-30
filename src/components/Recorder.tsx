"use client";

import { useEffect, useRef } from "react";
import { RecordingPlayback } from "@/components/RecordingPlayback";
import { StatusLiveRegion } from "@/components/StatusLiveRegion";
import {
  useAudioRecorder,
  type RecorderError,
} from "@/hooks/useAudioRecorder";

type Props = {
  disabled?: boolean;
  onRecorded?: (blob: Blob) => void;
  onCleared?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

function errorMessage(error: RecorderError): string {
  switch (error) {
    case "permission-denied":
      return "Microphone permission denied. Enable the mic in your browser settings to practise speaking.";
    case "no-device":
      return "No microphone was found on this device.";
    case "unsupported":
      return "Recording is not supported in this browser.";
    default:
      return "Something went wrong while recording. Try again.";
  }
}

export function Recorder({
  disabled,
  onRecorded,
  onCleared,
  onBusyChange,
}: Props) {
  const {
    status,
    error,
    objectUrl,
    blob,
    elapsedMs,
    maxMs,
    start,
    stop,
    clear,
    isRecording,
  } = useAudioRecorder();

  const onRecordedRef = useRef(onRecorded);
  const onClearedRef = useRef(onCleared);
  const onBusyChangeRef = useRef(onBusyChange);
  const countedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onClearedRef.current = onCleared;
    onBusyChangeRef.current = onBusyChange;
  }, [onRecorded, onCleared, onBusyChange]);

  useEffect(() => {
    const busy = status === "requesting" || status === "recording";
    onBusyChangeRef.current?.(busy);
  }, [status]);

  useEffect(() => {
    if (
      status === "ready" &&
      objectUrl &&
      blob &&
      countedUrlRef.current !== objectUrl
    ) {
      countedUrlRef.current = objectUrl;
      onRecordedRef.current?.(blob);
    }
    if (status === "idle") {
      countedUrlRef.current = null;
    }
  }, [status, objectUrl, blob]);

  const remaining = Math.max(0, Math.ceil((maxMs - elapsedMs) / 1000));
  const liveMessage = isRecording
    ? `Recording. ${remaining} seconds remaining.`
    : error
      ? errorMessage(error)
      : status === "ready"
        ? "Recording ready. Checking pronunciation…"
        : "";

  return (
    <div className="space-y-3">
      <StatusLiveRegion message={liveMessage} />
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">🎙️</span> Record yourself
      </h2>
      <p className="rounded-2xl bg-accent-soft/70 px-3 py-2 text-sm text-foreground">
        Privacy: recordings stay on this device. Nothing is uploaded. Audio is
        not saved after you reload. After you record, the app reuses that same
        clip for the on-device check — you only speak once.
      </p>

      <div className="flex flex-wrap gap-2">
        {!isRecording ? (
          <button
            type="button"
            className="btn-primary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-50"
            disabled={disabled || status === "requesting"}
            onClick={() => {
              void start();
            }}
          >
            {status === "requesting" ? "Requesting mic…" : "● Record"}
          </button>
        ) : (
          <button
            type="button"
            className="touch-target flex-1 rounded-2xl border-2 border-danger bg-danger/10 px-4 py-3 font-bold text-danger"
            onClick={stop}
          >
            Stop early
          </button>
        )}
        <button
          type="button"
          className="btn-secondary touch-target rounded-2xl px-4 py-3 font-bold disabled:opacity-50"
          disabled={status === "idle" || isRecording}
          onClick={() => {
            clear();
            onClearedRef.current?.();
          }}
        >
          Clear
        </button>
      </div>

      {isRecording ? (
        <p
          className="rounded-2xl bg-coral/15 px-3 py-2 text-sm font-bold text-coral"
          role="status"
        >
          Recording… auto-stops in {remaining}s
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {errorMessage(error)}
        </p>
      ) : null}

      <RecordingPlayback objectUrl={objectUrl} />
    </div>
  );
}
