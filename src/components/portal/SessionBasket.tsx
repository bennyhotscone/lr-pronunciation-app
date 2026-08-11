"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BasketItem = {
  id: string;
  filename: string;
  blobPath: string;
  blobUrl: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: string;
};

type BasketState = {
  dateKey: string;
  enabled: boolean;
  items: BasketItem[];
};

type BasketContextValue = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  items: BasketItem[];
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  uploading: boolean;
  error: string | null;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeItem: (id: string) => void;
  clearBasket: () => void;
  selectedItems: BasketItem[];
};

const BasketCtx = createContext<BasketContextValue | null>(null);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storageKey(userId: string) {
  return `lr-session-basket-v1:${userId}`;
}

function loadState(userId: string): BasketState {
  const dateKey = todayKey();
  if (typeof window === "undefined") {
    return { dateKey, enabled: false, items: [] };
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { dateKey, enabled: false, items: [] };
    const parsed = JSON.parse(raw) as BasketState;
    if (parsed.dateKey !== dateKey) {
      return { dateKey, enabled: false, items: [] };
    }
    return {
      dateKey,
      enabled: Boolean(parsed.enabled),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { dateKey, enabled: false, items: [] };
  }
}

export function SessionBasketProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [enabled, setEnabledState] = useState(false);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadState(userId);
    setEnabledState(s.enabled);
    setItems(s.items);
    setSelectedIds(new Set(s.items.map((i) => i.id)));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: BasketState = {
      dateKey: todayKey(),
      enabled,
      items,
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  }, [userId, enabled, items, hydrated]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/portal/session-basket", {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          item?: BasketItem;
        };
        if (!res.ok || !data.item) {
          throw new Error(data.error || "Upload failed");
        }
        setItems((prev) => [...prev, data.item!]);
        setSelectedIds((prev) => new Set(prev).add(data.item!.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearBasket = useCallback(() => {
    setItems([]);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const value: BasketContextValue = {
    enabled,
    setEnabled,
    items,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    uploading,
    error,
    addFiles,
    removeItem,
    clearBasket,
    selectedItems,
  };

  return <BasketCtx.Provider value={value}>{children}</BasketCtx.Provider>;
}

export function useSessionBasket() {
  const ctx = useContext(BasketCtx);
  if (!ctx) {
    throw new Error("useSessionBasket must be used within SessionBasketProvider");
  }
  return ctx;
}

export function SessionBasketPanel() {
  const {
    enabled,
    setEnabled,
    items,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    uploading,
    error,
    addFiles,
    removeItem,
    clearBasket,
  } = useSessionBasket();
  const [dragOver, setDragOver] = useState(false);

  return (
    <section className="card rounded-2xl border border-sand-border/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Session basket
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Drop files here during the session. Auto-catching all computer downloads
            needs a helper app later — this web MVP only stores what you drop or pick.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Basket {enabled ? "ON" : "OFF"}
        </label>
      </div>

      {enabled ? (
        <>
          <div
            className={`mt-4 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragOver
                ? "border-sand-accent bg-sand-accent/10"
                : "border-border bg-background/40"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
          >
            <p className="text-sm font-semibold text-foreground">
              {uploading ? "Uploading…" : "Drag & drop files into the basket"}
            </p>
            <label className="mt-3 inline-flex cursor-pointer text-sm font-bold text-sand-accent underline-offset-2 hover:underline">
              Or browse…
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

          {items.length ? (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
                <button type="button" onClick={selectAll} className="underline-offset-2 hover:underline">
                  Select all
                </button>
                <button type="button" onClick={clearSelection} className="underline-offset-2 hover:underline">
                  Clear selection
                </button>
                <button type="button" onClick={clearBasket} className="text-danger underline-offset-2 hover:underline">
                  Empty basket
                </button>
              </div>
              <ul className="divide-y divide-border/70">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.filename}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-semibold text-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Checked items attach when you save a lesson or class post.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Basket is empty for today&apos;s session.</p>
          )}
        </>
      ) : null}
    </section>
  );
}

/** Hidden fields to attach selected basket files when creating a class post. */
export function BasketAttachFields() {
  const { selectedItems } = useSessionBasket();
  return (
    <input
      type="hidden"
      name="basketItems"
      value={JSON.stringify(
        selectedItems.map((i) => ({
          filename: i.filename,
          blobPath: i.blobPath,
          blobUrl: i.blobUrl,
          mimeType: i.mimeType,
          sizeBytes: i.sizeBytes,
        })),
      )}
    />
  );
}

/** Hidden field listing blob paths for lesson resource attach. */
export function BasketLessonAttachField() {
  const { selectedItems } = useSessionBasket();
  return (
    <input
      type="hidden"
      name="basketBlobPaths"
      value={selectedItems.map((i) => i.blobPath).join("|")}
    />
  );
}
