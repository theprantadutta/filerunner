// Colour identity for projects and file types. Colours come from the validated
// categorical spectrum (--c1..--c8) and follow the entity: a project keeps its colour
// however the list is sorted or filtered.
import type { CSSProperties } from "react";
import { create } from "zustand";
import {
  FileArchive,
  FileAudio2,
  FileCode2,
  FileImage,
  FileText,
  FileVideo2,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";

const SLOTS = 8;

/**
 * Project colours are assigned in creation order, so the first eight projects never
 * share a colour. The assignment is refreshed whenever the project list loads.
 */
interface SlotState {
  slots: Record<string, number>;
  assign: (projects: { id: string; created_at: string }[]) => void;
}

export const useProjectSlots = create<SlotState>((set) => ({
  slots: {},
  assign: (projects) =>
    set({
      slots: Object.fromEntries(
        [...projects]
          .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at) || a.id.localeCompare(b.id))
          .map((p, i) => [p.id, (i % SLOTS) + 1])
      ),
    }),
}));

/** Returns a function giving a project's tone style; re-renders when colours are assigned */
export function useProjectTone() {
  const slots = useProjectSlots((s) => s.slots);
  return (projectId: string) => toneStyle(slots[projectId] ?? hashSlot(projectId));
}

/** Fallback before the project list has loaded: a stable slot derived from the ID */
function hashSlot(projectId: string): number {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % SLOTS) + 1;
}

/** CSS variable reference for a slot, e.g. "var(--c3)" (an RGB triple) */
export function slotVar(slot: number): string {
  return `var(--c${slot})`;
}

/** Inline style that sets --tone for the tone-* utilities */
export function toneStyle(slot: number): CSSProperties {
  return { ["--tone" as string]: slotVar(slot) } as CSSProperties;
}

export type FileCategory =
  | "images"
  | "video"
  | "audio"
  | "documents"
  | "archives"
  | "code"
  | "other";

interface CategoryInfo {
  label: string;
  slot: number;
  icon: LucideIcon;
}

// Fixed assignment, matching the backend's /api/stats categories
export const CATEGORIES: Record<FileCategory, CategoryInfo> = {
  images: { label: "Images", slot: 5, icon: FileImage },
  video: { label: "Video", slot: 2, icon: FileVideo2 },
  audio: { label: "Audio", slot: 7, icon: FileAudio2 },
  documents: { label: "Documents", slot: 1, icon: FileText },
  archives: { label: "Archives", slot: 4, icon: FileArchive },
  code: { label: "Code", slot: 3, icon: FileCode2 },
  other: { label: "Other", slot: 0, icon: FileIcon },
};

/** Same grouping as the backend's CASE expression in handlers/stats.rs */
export function categoryOf(mimeType: string): FileCategory {
  const m = mimeType.toLowerCase();
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (/(zip|rar|tar|gzip|7z|compressed)/.test(m)) return "archives";
  if (
    m === "application/pdf" ||
    m.startsWith("text/") ||
    /(document|msword|spreadsheet|presentation|excel|powerpoint)/.test(m)
  )
    return "documents";
  if (/(javascript|json|xml|html|css)/.test(m)) return "code";
  return "other";
}

/** Tone style for a category; "other" uses neutral ink */
export function categoryTone(category: FileCategory): CSSProperties {
  const slot = CATEGORIES[category].slot;
  return slot === 0
    ? ({ ["--tone" as string]: "var(--ink-3)" } as CSSProperties)
    : toneStyle(slot);
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
}
