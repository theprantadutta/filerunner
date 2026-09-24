"use client";

import { useState } from "react";
import { CATEGORIES, type FileCategory, slotVar } from "@/lib/spectrum";
import { formatBytes, pluralize } from "@/lib/utils";

export interface CategoryDatum {
  category: FileCategory;
  files: number;
  size: number;
}

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Surface-coloured gap between segments, in px of arc length
const GAP = 3;

function colorOf(category: FileCategory) {
  const slot = CATEGORIES[category].slot;
  return slot === 0 ? "rgb(var(--ink-3))" : `rgb(${slotVar(slot)})`;
}

/** Storage by file type: a ring chart with a legend that doubles as the data table */
export function TypeDonut({ data, total }: { data: CategoryDatum[]; total: number }) {
  const [active, setActive] = useState<FileCategory | null>(null);
  const segments = data.filter((d) => d.size > 0);
  const focused = segments.find((d) => d.category === active);

  // Each segment starts where the previous ones end
  const lengths = segments.map((d) => (d.size / total) * CIRCUMFERENCE);
  const arcs = segments.map((d, i) => ({
    ...d,
    dash: Math.max(lengths[i] - GAP, 1.5),
    offset: lengths.slice(0, i).reduce((acc, len) => acc + len, 0),
  }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" role="img" aria-label="Storage by file type">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgb(var(--sunken))" strokeWidth={STROKE} />
          {arcs.map((arc) => (
            <circle
              key={arc.category}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={colorOf(arc.category)}
              strokeWidth={active === arc.category ? STROKE + 6 : STROKE}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={-arc.offset}
              className="cursor-pointer transition-[stroke-width,opacity] duration-200"
              style={{ opacity: active && active !== arc.category ? 0.35 : 1 }}
              onMouseEnter={() => setActive(arc.category)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-2xl font-bold tracking-[-0.03em] tabular text-ink">
            {formatBytes(focused ? focused.size : total)}
          </span>
          <span className="mt-0.5 text-xs font-semibold text-ink-3">
            {focused ? CATEGORIES[focused.category].label : "in total"}
          </span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-1">
        {segments.map((d) => (
          <li
            key={d.category}
            onMouseEnter={() => setActive(d.category)}
            onMouseLeave={() => setActive(null)}
            className="flex min-w-0 cursor-default items-center gap-2.5"
          >
            <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: colorOf(d.category) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{CATEGORIES[d.category].label}</span>
              <span className="block text-xs tabular text-ink-3">
                {formatBytes(d.size)} in {pluralize(d.files, "file")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
