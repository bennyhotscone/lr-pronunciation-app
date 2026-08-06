export const STUDIO_SAVE_KEY = "lr-mandarin-studio-v1";
export const STUDIO_AUTH_KEY = "lr-mandarin-studio-auth-v1";
/** Session-only password so Studio can call permanent upload API after unlock. */
export const STUDIO_PASSWORD_SESSION_KEY = "lr-mandarin-studio-pw-v1";

/** Fallback if MANDARIN_STUDIO_PASSWORD env is unset. Change before sharing widely. */
export const STUDIO_PASSWORD_FALLBACK = "lrmastery-studio";

export type StudioVerifyStatus = "unchecked" | "ok" | "needs_addressing";

export type StudioRankNote = {
  status: StudioVerifyStatus;
  note: string;
  updatedAt: string;
};

export type StudioNotesFile = {
  version: 1;
  exportedAt: string;
  ranks: Record<string, StudioRankNote>;
};

export function loadStudioNotes(): Record<string, StudioRankNote> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STUDIO_SAVE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StudioNotesFile | Record<string, StudioRankNote>;
    if (parsed && typeof parsed === "object" && "ranks" in parsed) {
      return (parsed as StudioNotesFile).ranks ?? {};
    }
    return parsed as Record<string, StudioRankNote>;
  } catch {
    return {};
  }
}

export function saveStudioNotes(ranks: Record<string, StudioRankNote>): void {
  if (typeof window === "undefined") return;
  const payload: StudioNotesFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ranks,
  };
  localStorage.setItem(STUDIO_SAVE_KEY, JSON.stringify(payload));
}

export function isStudioAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STUDIO_AUTH_KEY) === "1";
}

export function setStudioAuthed(ok: boolean, password?: string): void {
  if (typeof window === "undefined") return;
  if (ok) {
    sessionStorage.setItem(STUDIO_AUTH_KEY, "1");
    if (typeof password === "string" && password.length > 0) {
      sessionStorage.setItem(STUDIO_PASSWORD_SESSION_KEY, password);
    }
  } else {
    sessionStorage.removeItem(STUDIO_AUTH_KEY);
    sessionStorage.removeItem(STUDIO_PASSWORD_SESSION_KEY);
  }
}

export function getStudioSessionPassword(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STUDIO_PASSWORD_SESSION_KEY);
}
