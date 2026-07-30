"use client";

type Props = {
  objectUrl: string | null;
};

export function RecordingPlayback({ objectUrl }: Props) {
  if (!objectUrl) return null;

  return (
    <div className="space-y-2 rounded-2xl bg-gradient-to-br from-accent-soft to-white p-3">
      <p className="text-sm font-bold">Playback</p>
      <audio controls src={objectUrl} className="w-full" preload="metadata">
        Your browser does not support audio playback.
      </audio>
      <p className="text-xs text-muted">
        This recording stays in memory on this device and is discarded when you
        reload the page.
      </p>
    </div>
  );
}
