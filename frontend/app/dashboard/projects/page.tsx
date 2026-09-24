"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Boxes, Plus, Search, X } from "lucide-react";
import { projectsApi, type ProjectResponse } from "@/lib/api";
import { useUi } from "@/lib/ui-store";
import { formatBytes, pluralize } from "@/lib/utils";
import { Page, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyPanel, ErrorPanel } from "@/components/states";
import { ProjectTile, ProjectTileSkeleton } from "@/components/projects/ProjectTile";

type Access = "all" | "public" | "private";
type Sort = "newest" | "oldest" | "name" | "size" | "files";

const SORTS: Record<Sort, { label: string; compare: (a: ProjectResponse, b: ProjectResponse) => number }> = {
  newest: { label: "Newest", compare: (a, b) => +new Date(b.created_at) - +new Date(a.created_at) },
  oldest: { label: "Oldest", compare: (a, b) => +new Date(a.created_at) - +new Date(b.created_at) },
  name: { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
  size: { label: "Largest", compare: (a, b) => (b.total_size ?? 0) - (a.total_size ?? 0) },
  files: { label: "Most files", compare: (a, b) => (b.file_count ?? 0) - (a.file_count ?? 0) },
};

export default function ProjectsPage() {
  const setNewProjectOpen = useUi((s) => s.setNewProjectOpen);
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<Access>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await projectsApi.list()).data,
  });
  const list = useMemo(() => projects.data ?? [], [projects.data]);

  const counts = useMemo(
    () => ({
      all: list.length,
      public: list.filter((p) => p.is_public).length,
      private: list.filter((p) => !p.is_public).length,
    }),
    [list]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((p) => p.name.toLowerCase().includes(q))
      .filter((p) => (access === "all" ? true : access === "public" ? p.is_public : !p.is_public))
      .sort(SORTS[sort].compare);
  }, [list, query, access, sort]);

  const largest = Math.max(0, ...list.map((p) => p.total_size ?? 0));
  const totalSize = list.reduce((acc, p) => acc + (p.total_size ?? 0), 0);

  return (
    <Page>
      <PageHeader
        title="Projects"
        description={
          list.length > 0
            ? `${pluralize(list.length, "project")} holding ${formatBytes(totalSize)}. Each has its own keys and access setting.`
            : "Each project has its own keys and access setting."
        }
        actions={
          <Button onClick={() => setNewProjectOpen(true)}>
            <Plus />
            New project
          </Button>
        }
      />

      {list.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project"
              aria-label="Find a project"
              className="rounded-full pl-10 pr-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented<Access>
              label="Filter by access"
              value={access}
              onChange={setAccess}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "public", label: "Public", count: counts.public },
                { value: "private", label: "Private", count: counts.private },
              ]}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto md:ml-0">
                  <ArrowDownUp />
                  {SORTS[sort].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
                  {(Object.keys(SORTS) as Sort[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {SORTS[key].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="mt-6">
        {projects.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <ProjectTileSkeleton key={i} />
            ))}
          </div>
        ) : projects.isError ? (
          <ErrorPanel
            icon={Boxes}
            title="Couldn't load your projects"
            error={projects.error}
            onRetry={() => projects.refetch()}
            retrying={projects.isRefetching}
            className="rounded-3xl border border-line bg-surface"
          />
        ) : list.length === 0 ? (
          <EmptyPanel
            icon={Boxes}
            title="No projects yet"
            description="Create one to get an upload key and a place for your files."
            action={
              <Button onClick={() => setNewProjectOpen(true)}>
                <Plus />
                New project
              </Button>
            }
            className="rounded-3xl border border-dashed border-line-strong"
          />
        ) : visible.length === 0 ? (
          <EmptyPanel
            icon={Search}
            title="No matching projects"
            description={query.trim() ? `Nothing is called "${query.trim()}" with this filter.` : `You have no ${access} projects.`}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setAccess("all");
                }}
              >
                Clear filters
              </Button>
            }
            className="rounded-3xl border border-dashed border-line-strong"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p, i) => (
              <ProjectTile key={p.id} project={p} largestSize={largest} index={i} />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
