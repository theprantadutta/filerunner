"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, RotateCw, X, AlertCircle, UploadCloud } from "lucide-react";
import { useUploads, type UploadItem } from "@/lib/uploads";
import { useProjectTone } from "@/lib/spectrum";
import { cn, formatBytes } from "@/lib/utils";

function ItemRow({ item }: { item: UploadItem }) {
  const { cancel, retry } = useUploads();
  const projectTone = useProjectTone();
  const pct = item.file.size ? Math.min(100, Math.round((item.loaded / item.file.size) * 100)) : 100;
  const active = item.status === "uploading" || item.status === "queued";

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span style={projectTone(item.projectId)} className="tone-solid h-2 w-2 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-ink" title={item.file.name}>
            {item.file.name}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs font-medium tabular",
              item.status === "failed" ? "text-bad" : item.status === "done" ? "text-good" : "text-ink-3"
            )}
          >
            {item.status === "uploading" && `${pct}%`}
            {item.status === "queued" && "Waiting"}
            {item.status === "done" && formatBytes(item.file.size)}
            {item.status === "cancelled" && "Cancelled"}
            {item.status === "failed" && (item.error ?? "Failed")}
          </span>
        </div>
        {active && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
            <div
              style={{ ...projectTone(item.projectId), width: `${pct}%` }}
              className="tone-solid h-full rounded-full transition-[width] duration-300"
            />
          </div>
        )}
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => cancel(item.id)}
          aria-label={`Cancel ${item.file.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      ) : item.status === "failed" || item.status === "cancelled" ? (
        <button
          type="button"
          onClick={() => retry(item.id)}
          aria-label={`Retry ${item.file.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-good/10 text-good">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
    </li>
  );
}

/** Live progress for every upload, docked at the bottom corner */
export function UploadTray() {
  const { items, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);

  const running = items.filter((i) => i.status === "uploading" || i.status === "queued");
  const failed = items.filter((i) => i.status === "failed").length;
  const totalBytes = running.reduce((acc, i) => acc + i.file.size, 0);
  const loadedBytes = running.reduce((acc, i) => acc + i.loaded, 0);
  const pct = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 100;

  // Leaving the page would cancel uploads in flight
  useEffect(() => {
    if (running.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running.length]);

  if (items.length === 0) return null;

  const title =
    running.length > 0
      ? `Uploading ${running.length} ${running.length === 1 ? "file" : "files"}`
      : failed > 0
        ? `${failed} ${failed === 1 ? "upload" : "uploads"} failed`
        : "Uploads complete";

  return (
    <section
      aria-label="Uploads"
      className="fixed bottom-[104px] right-3 z-40 w-[calc(100%-1.5rem)] max-w-sm animate-rise overflow-hidden rounded-3xl border border-line bg-surface shadow-pop lg:bottom-5 lg:right-5"
    >
      <header className="flex items-center gap-3 px-4 py-3.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            running.length > 0 ? "bg-brand-soft text-brand" : failed > 0 ? "bg-bad/10 text-bad" : "bg-good/10 text-good"
          )}
        >
          {running.length > 0 ? (
            <UploadCloud className="h-[18px] w-[18px]" />
          ) : failed > 0 ? (
            <AlertCircle className="h-[18px] w-[18px]" />
          ) : (
            <Check className="h-[18px] w-[18px]" strokeWidth={3} />
          )}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-sm font-bold text-ink">{title}</p>
          {running.length > 0 && (
            <p className="text-xs tabular text-ink-3">
              {pct}% of {formatBytes(totalBytes)}
            </p>
          )}
        </div>
        {running.length === 0 && (
          <button
            type="button"
            onClick={clearFinished}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-sunken hover:text-ink"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show uploads" : "Hide uploads"}
          aria-expanded={!collapsed}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </header>
      {running.length > 0 && (
        <div className="h-0.5 bg-sunken">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}
      {!collapsed && (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto px-4">
          {[...items].reverse().map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
