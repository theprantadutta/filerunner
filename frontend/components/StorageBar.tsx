"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectResponse } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

// Named projects get a categorical slot in size order; the rest fold into "Other"
const SLOTS = 5;
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

interface Segment {
  key: string;
  label: string;
  size: number;
  color: string;
}

function buildSegments(projects: ProjectResponse[]): Segment[] {
  const sized = projects
    .filter((p) => (p.total_size || 0) > 0)
    .sort((a, b) => (b.total_size || 0) - (a.total_size || 0));

  const named = sized.slice(0, SLOTS).map((p, i) => ({
    key: p.id,
    label: p.name,
    size: p.total_size || 0,
    color: SERIES[i],
  }));

  const rest = sized.slice(SLOTS);
  if (rest.length > 0) {
    named.push({
      key: "other",
      label: `${rest.length} other project${rest.length > 1 ? "s" : ""}`,
      size: rest.reduce((acc, p) => acc + (p.total_size || 0), 0),
      color: "var(--series-other)",
    });
  }
  return named;
}

function percent(part: number, whole: number) {
  const value = (part / whole) * 100;
  return value < 1 ? "<1%" : `${Math.round(value)}%`;
}

export function StorageBar({ projects }: { projects: ProjectResponse[] }) {
  const segments = buildSegments(projects);
  const total = segments.reduce((acc, s) => acc + s.size, 0);

  if (total === 0) {
    return (
      <div>
        <div className="h-2.5 rounded-[4px] bg-muted" />
        <p className="mt-3 text-[13px] text-muted-foreground">
          Nothing stored yet. Upload files to a project to see how storage splits up.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Storage by project: ${segments
          .map((s) => `${s.label} ${formatBytes(s.size)}`)
          .join(", ")}`}
        className="flex h-2.5 origin-left animate-grow-x gap-[2px] overflow-hidden rounded-[4px]"
      >
        {segments.map((segment) => (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              {/* Taller invisible hit area than the 10px mark */}
              <div
                className="relative h-full min-w-[3px] transition-opacity hover:opacity-80"
                style={{
                  flexGrow: segment.size,
                  flexBasis: 0,
                  background: segment.color,
                }}
              >
                <span className="absolute -inset-y-2 inset-x-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-semibold">{segment.label}</span>
              <span className="ml-2 tabular opacity-80">
                {formatBytes(segment.size)} · {percent(segment.size, total)}
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment) => (
          <li key={segment.key} className="flex min-w-0 items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: segment.color }}
            />
            <span className="truncate">{segment.label}</span>
            <span className="ml-auto shrink-0 tabular text-muted-foreground sm:ml-0">
              {formatBytes(segment.size)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
