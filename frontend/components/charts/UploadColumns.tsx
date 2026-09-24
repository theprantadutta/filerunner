"use client";

import { useState } from "react";
import { formatBytes, pluralize } from "@/lib/utils";

export interface DayDatum {
  day: string;
  files: number;
  size: number;
}

function label(day: string, opts: Intl.DateTimeFormatOptions) {
  // Days arrive as YYYY-MM-DD in UTC; format without shifting the date
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** Files uploaded per day over the last 30 days, one hue, with a hover readout */
export function UploadColumns({ data }: { data: DayDatum[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.files));
  const totalFiles = data.reduce((acc, d) => acc + d.files, 0);
  const focus = active !== null ? data[active] : null;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[32px] font-bold leading-none tracking-[-0.03em] tabular text-ink">
            {(focus ? focus.files : totalFiles).toLocaleString()}
          </p>
          <p className="mt-1.5 text-sm font-medium text-ink-3">
            {focus
              ? `${pluralize(focus.files, "file")} (${formatBytes(focus.size)}) on ${label(focus.day, { weekday: "short", month: "short", day: "numeric" })}`
              : "files uploaded in the last 30 days"}
          </p>
        </div>
      </div>

      <div
        className="flex h-36 items-end gap-[3px]"
        role="img"
        aria-label={`Uploads per day for the last 30 days, ${pluralize(totalFiles, "file")} in total`}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => {
          const height = d.files === 0 ? 3 : Math.max(8, (d.files / max) * 100);
          return (
            <button
              key={d.day}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className="block w-full origin-bottom animate-bar-in rounded-t-[4px] transition-colors duration-150"
                style={{
                  height: `${height}%`,
                  animationDelay: `${i * 18}ms`,
                  background:
                    d.files === 0
                      ? "rgb(var(--line))"
                      : active === i
                        ? "rgb(var(--ink))"
                        : "rgb(var(--brand))",
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-between text-xs font-medium text-ink-3">
        <span>{data[0] && label(data[0].day, { month: "short", day: "numeric" })}</span>
        <span>Today</span>
      </div>

      <table className="sr-only">
        <caption>Uploads per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Files</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.files}</td>
              <td>{formatBytes(d.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
