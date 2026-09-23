"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectResponse } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StorageBar } from "@/components/StorageBar";
import {
  Plus,
  FolderOpen,
  Folder,
  Lock,
  Globe,
  Search,
  X,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
  RotateCw,
  Loader2,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import Link from "next/link";

type Visibility = "all" | "public" | "private";
type SortKey = "newest" | "oldest" | "name" | "size" | "files";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name",
  size: "Largest",
  files: "Most files",
};

const sorters: Record<SortKey, (a: ProjectResponse, b: ProjectResponse) => number> = {
  newest: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  oldest: (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  name: (a, b) => a.name.localeCompare(b.name),
  size: (a, b) => (b.total_size || 0) - (a.total_size || 0),
  files: (a, b) => (b.file_count || 0) - (a.file_count || 0),
};

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Shared column template so header and rows stay aligned
const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_96px_80px_104px_120px_20px] md:items-center md:gap-4";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const {
    data: projects,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await projectsApi.list();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create(newProjectName.trim(), isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast.success(`Created project "${newProjectName.trim()}"`);
      setNewProjectName("");
      setIsPublic(false);
      setDialogOpen(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to create project";
      showToast.error(message);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      showToast.error("Project name is required");
      return;
    }
    createMutation.mutate();
  };

  const counts = useMemo(
    () => ({
      all: projects?.length ?? 0,
      public: projects?.filter((p) => p.is_public).length ?? 0,
      private: projects?.filter((p) => !p.is_public).length ?? 0,
    }),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => p.name.toLowerCase().includes(query))
      .filter((p) =>
        visibility === "all" ? true : visibility === "public" ? p.is_public : !p.is_public
      )
      .sort(sorters[sortKey]);
  }, [projects, searchQuery, visibility, sortKey]);

  const totalFiles = projects?.reduce((acc, p) => acc + (p.file_count || 0), 0) || 0;
  const totalSize = projects?.reduce((acc, p) => acc + (p.total_size || 0), 0) || 0;
  const hasProjects = !!projects && projects.length > 0;
  const isFiltered = searchQuery.trim() !== "" || visibility !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setVisibility("all");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[28px] sm:leading-9">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project has its own API key, files, and access setting.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      {/* Overview */}
      {isLoading ? (
        <Card className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-2.5 w-full" />
        </Card>
      ) : hasProjects ? (
        <Card className="animate-rise-in p-5 sm:p-6">
          <dl className="grid grid-cols-3 divide-x">
            <Figure label="Projects" value={projects.length.toLocaleString()} />
            <Figure label="Files" value={totalFiles.toLocaleString()} />
            <Figure label="Storage used" value={formatBytes(totalSize)} />
          </dl>
          <div className="mt-6 border-t pt-5">
            <h2 className="mb-3 text-[13px] font-medium text-muted-foreground">
              Storage by project
            </h2>
            <StorageBar projects={projects} />
          </div>
        </Card>
      ) : null}

      {/* Project list */}
      <section aria-labelledby="project-list-heading" className="space-y-3">
        <h2 id="project-list-heading" className="sr-only">
          Project list
        </h2>

        {hasProjects && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects"
                aria-label="Search projects"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Filter by access"
                className="inline-flex h-9 items-center rounded-md border bg-card p-0.5 shadow-panel"
              >
                {(["all", "public", "private"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={visibility === value}
                    onClick={() => setVisibility(value)}
                    className={cn(
                      "inline-flex h-full items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium capitalize transition-colors",
                      visibility === value
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {value}
                    <span className="tabular text-xs text-muted-foreground">
                      {counts[value]}
                    </span>
                  </button>
                ))}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-auto sm:ml-0">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">{SORT_LABELS[sortKey]}</span>
                    <span className="sm:hidden">Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={sortKey}
                    onValueChange={(v) => setSortKey(v as SortKey)}
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        {SORT_LABELS[key]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {isLoading ? (
          <Card className="divide-y overflow-hidden" aria-busy="true" aria-label="Loading projects">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-24 md:hidden" />
                </div>
                <Skeleton className="hidden h-4 w-16 md:block" />
                <Skeleton className="hidden h-4 w-20 md:block" />
              </div>
            ))}
          </Card>
        ) : isError ? (
          <Card>
            <EmptyState
              tone="error"
              icon={AlertTriangle}
              title="Couldn't load projects"
              description={
                (error as any)?.response?.data?.error ||
                "The server didn't respond. Check that the backend is running, then try again."
              }
              action={
                <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                  {isRefetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Try again
                </Button>
              }
            />
          </Card>
        ) : !hasProjects ? (
          <Card className="border-dashed shadow-none">
            <EmptyState
              icon={FolderOpen}
              title="Create your first project"
              description="A project holds your files and gives you an API key for uploading them from your apps."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New project
                </Button>
              }
            />
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <EmptyState
              icon={Search}
              title="No matching projects"
              description={
                searchQuery.trim()
                  ? `No ${visibility === "all" ? "" : visibility + " "}projects match "${searchQuery.trim()}".`
                  : `You don't have any ${visibility} projects.`
              }
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div
              className={cn(
                "hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground",
                ROW_GRID
              )}
            >
              <span>Name</span>
              <span>Access</span>
              <span className="text-right">Files</span>
              <span className="text-right">Size</span>
              <span>Created</span>
              <span />
            </div>
            <ul className="divide-y">
              {filteredProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-inset focus-visible:ring-offset-0",
                      ROW_GRID
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-colors group-hover:text-primary">
                        <Folder className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground md:hidden">
                          <span className="tabular">
                            {(project.file_count || 0).toLocaleString()} files
                          </span>
                          <span aria-hidden="true" className="h-3 w-px bg-border" />
                          <span className="tabular">{formatBytes(project.total_size || 0)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <AccessBadge isPublic={project.is_public} />
                    </div>
                    <span className="hidden text-right text-sm tabular md:block">
                      {(project.file_count || 0).toLocaleString()}
                    </span>
                    <span className="hidden text-right text-sm tabular md:block">
                      {formatBytes(project.total_size || 0)}
                    </span>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {formatShortDate(project.created_at)}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
            {isFiltered && (
              <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  Showing {filteredProjects.length} of {projects.length} projects
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-foreground hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </Card>
        )}
      </section>

      {/* Create project dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && !createMutation.isPending) {
            setNewProjectName("");
            setIsPublic(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreate} className="space-y-5">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Projects keep files separate. Each one gets its own API key for uploads.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. marketing-site"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 text-[13px] font-medium">Access</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <AccessOption
                  checked={!isPublic}
                  onSelect={() => setIsPublic(false)}
                  icon={<Lock />}
                  title="Private"
                  description="Files need the project's API key."
                />
                <AccessOption
                  checked={isPublic}
                  onSelect={() => setIsPublic(true)}
                  icon={<Globe />}
                  title="Public"
                  description="Anyone with a file's link can open it."
                />
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newProjectName.trim()}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {createMutation.isPending ? "Creating project" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-6">
      <dt className="truncate text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] tabular sm:text-[26px] sm:leading-8">
        {value}
      </dd>
    </div>
  );
}

function AccessBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <Badge variant="success">
      <Globe />
      Public
    </Badge>
  ) : (
    <Badge variant="secondary">
      <Lock />
      Private
    </Badge>
  );
}

function AccessOption({
  checked,
  onSelect,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-primary bg-primary/5" : "hover:bg-accent/50"
      )}
    >
      <input
        type="radio"
        name="project-access"
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-0.5 [&_svg]:h-4 [&_svg]:w-4",
          checked ? "text-primary" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
