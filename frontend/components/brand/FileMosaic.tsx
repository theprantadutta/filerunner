"use client";

import { useMemo } from "react";
import {
  FileArchive,
  FileAudio2,
  FileCode2,
  FileImage,
  FileText,
  FileVideo2,
  type LucideIcon,
} from "lucide-react";
import { slotVar } from "@/lib/spectrum";

const GLYPHS: { icon: LucideIcon; ext: string; slot: number }[] = [
  { icon: FileImage, ext: "png", slot: 5 },
  { icon: FileVideo2, ext: "mp4", slot: 2 },
  { icon: FileText, ext: "pdf", slot: 1 },
  { icon: FileArchive, ext: "zip", slot: 4 },
  { icon: FileCode2, ext: "json", slot: 3 },
  { icon: FileAudio2, ext: "mp3", slot: 7 },
  { icon: FileImage, ext: "svg", slot: 8 },
  { icon: FileText, ext: "md", slot: 6 },
];

// Deterministic pseudo-random so server and client render the same grid
function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * The sign-in backdrop: a wall of colour-coded files. Some tiles are solid, most are
 * quiet outlines, and a few breathe on staggered timers so the wall feels alive.
 */
export function FileMosaic({ columns = 7, rows = 9 }: { columns?: number; rows?: number }) {
  const tiles = useMemo(
    () =>
      Array.from({ length: columns * rows }, (_, i) => {
        const r = seeded(i + 1);
        const glyph = GLYPHS[Math.floor(seeded(i + 101) * GLYPHS.length)];
        return {
          glyph,
          filled: r > 0.62,
          animated: r > 0.86,
          delay: seeded(i + 7) * 6,
        };
      }),
    [columns, rows]
  );

  return (
    <div
      aria-hidden="true"
      className="grid h-full w-full gap-3 p-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map(({ glyph, filled, animated, delay }, i) => {
        const Icon = glyph.icon;
        const tone = slotVar(glyph.slot);
        return (
          <div
            key={i}
            className={animated ? "animate-tile-shift" : undefined}
            style={{
              animationDelay: `${delay}s`,
              aspectRatio: "1",
              borderRadius: 18,
              background: filled ? `rgb(${tone})` : "rgb(255 255 255 / 0.04)",
              border: filled ? "none" : "1px solid rgb(255 255 255 / 0.07)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 12,
              color: filled ? "rgb(255 255 255 / 0.92)" : `rgb(${tone} / 0.8)`,
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="font-mono text-[11px] font-medium opacity-80">
              .{glyph.ext}
            </span>
          </div>
        );
      })}
    </div>
  );
}
