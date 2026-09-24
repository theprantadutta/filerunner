"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProjectResponse } from "@/lib/api";
import { useProjectTone } from "@/lib/spectrum";
import { VisibilityChip } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes, formatDate, pluralize } from "@/lib/utils";

/**
 * A project as a card in its own colour. The bar shows its share of all stored bytes,
 * so the tiles read as a comparison when laid out together.
 */
export function ProjectTile({
  project,
  largestSize,
  index = 0,
}: {
  project: ProjectResponse;
  largestSize: number;
  index?: number;
}) {
  const projectTone = useProjectTone();
  const size = project.total_size ?? 0;
  const share = largestSize > 0 ? Math.max(size > 0 ? 4 : 0, (size / largestSize) * 100) : 0;

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      style={{ ...projectTone(project.id), animationDelay: `${index * 45}ms` }}
      className="group relative flex min-h-[196px] animate-rise flex-col overflow-hidden rounded-3xl border border-line bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
    >
      {/* Colour field in the corner, echoing the logo's stacked tiles */}
      <span aria-hidden="true" className="tone-bg absolute -right-8 -top-8 h-32 w-32 rounded-[28px] transition-transform duration-300 group-hover:scale-110" />
      <span aria-hidden="true" className="tone-solid absolute right-5 top-5 h-10 w-10 rounded-[12px]" />

      <div className="relative min-w-0 pr-14">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.02em] text-ink">{project.name}</h3>
        <p className="mt-1 text-[13px] font-medium text-ink-3">Created {formatDate(project.created_at)}</p>
      </div>

      <div className="relative mt-auto pt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[28px] font-bold leading-none tracking-[-0.03em] tabular text-ink">
              {formatBytes(size)}
            </p>
            <p className="mt-1.5 text-[13px] font-medium text-ink-2">{pluralize(project.file_count ?? 0, "file")}</p>
          </div>
          <VisibilityChip isPublic={project.is_public} />
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="tone-solid h-full rounded-full transition-[width] duration-500" style={{ width: `${share}%` }} />
        </div>
      </div>

      <ArrowUpRight className="absolute bottom-5 right-5 h-5 w-5 translate-y-1 text-ink-3 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 max-sm:hidden" />
    </Link>
  );
}

export function ProjectTileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[196px] flex-col rounded-3xl border border-line bg-surface p-5", className)}>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <Skeleton className="mt-auto h-8 w-24" />
      <Skeleton className="mt-4 h-1.5 w-full" />
    </div>
  );
}
