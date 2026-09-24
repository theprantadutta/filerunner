"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Download,
  FolderPlus,
  FolderSearch,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  Settings2,
  Trash2,
  X,
  Files as FilesIcon,
  Link2,
} from "lucide-react";
import { fileUrl, filesApi, projectsApi, publicFileUrl, readKeyFileUrl, type FileMetadata } from "@/lib/api";
import { useProjectTone } from "@/lib/spectrum";
import { useUploads } from "@/lib/uploads";
import { showToast } from "@/lib/toast";
import { apiError, cn, copyToClipboard, formatBytes, formatDate, pluralize, timeAgo } from "@/lib/utils";
import { Page } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/controls";
import { VisibilityChip } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogActions, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { EmptyPanel, ErrorPanel } from "@/components/states";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileThumb } from "@/components/files/FileThumb";
import { FilePreview } from "@/components/files/FilePreview";
import { ProjectSettings } from "@/components/projects/ProjectSettings";

const PAGE_SIZE = 48;
// Signed links last two hours; refresh the list well before they expire
const SIGNED_LINK_REFRESH_MS = 45 * 60 * 1000;
const ROOT = "";

type View = "grid" | "list";
type Tab = "files" | "settings";

function isValidFolder(path: string) {
  return (
    path.length > 0 &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    !path.includes("//") &&
    !path.startsWith(".") &&
    !path.includes("/.") &&
    /^[\p{L}\p{N}_\-./]+$/u.test(path)
  );
}

function Check3({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-colors",
        checked ? "border-brand bg-brand text-white" : "border-white/80 bg-black/20 backdrop-blur-sm"
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
    </span>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const projectId = params.id as string;
  const addUploads = useUploads((s) => s.add);
  const projectTone = useProjectTone();

  const [tab, setTab] = useState<Tab>("files");
  // Remembered per device. Pages render only in the browser (after runtime config loads).
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem("filerunner:view");
      return saved === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null); // null = all files
  const [pendingFolders, setPendingFolders] = useState<string[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(searchParams.get("file"));
  const [toDelete, setToDelete] = useState<FileMetadata | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [folderDeleteOpen, setFolderDeleteOpen] = useState(false);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem("filerunner:view", next);
    } catch {}
  };

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await projectsApi.get(projectId)).data,
  });
  const files = useQuery({
    queryKey: ["files", projectId],
    queryFn: async () => (await projectsApi.listFiles(projectId)).data,
    refetchInterval: SIGNED_LINK_REFRESH_MS,
  });

  const p = project.data;

  // Name the tab after the project
  useEffect(() => {
    if (!p?.name) return;
    const previous = document.title;
    document.title = `${p.name} – FileRunner`;
    return () => {
      document.title = previous;
    };
  }, [p?.name]);

  const allFiles = useMemo(() => files.data ?? [], [files.data]);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    allFiles.forEach((f) => {
      const key = f.folder_path ?? ROOT;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    pendingFolders.forEach((f) => counts.has(f) || counts.set(f, 0));
    return [...counts.entries()].sort(([a], [b]) => (a === ROOT ? -1 : b === ROOT ? 1 : a.localeCompare(b)));
  }, [allFiles, pendingFolders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allFiles.filter(
      (f) =>
        (folder === null || (f.folder_path ?? ROOT) === folder) &&
        (!q || f.original_name.toLowerCase().includes(q) || (f.folder_path ?? "").toLowerCase().includes(q))
    );
  }, [allFiles, folder, query]);
  const shown = visible.slice(0, limit);
  const previewFile = allFiles.find((f) => f.id === previewId) ?? null;

  // Upload destination follows the selected folder
  const uploadFolder = folder && folder !== ROOT ? folder : undefined;
  const requestFolderDelete = () => {
    if (!uploadFolder) return;
    if (folderTreeCount > 0) {
      setFolderDeleteOpen(true);
      return;
    }
    // A folder with no files yet exists only in this page; just forget it
    setPendingFolders((prev) => prev.filter((f) => f !== uploadFolder));
    setFolder(null);
  };
  // Files in the selected folder and everything nested under it
  const folderTreeCount = uploadFolder
    ? allFiles.filter((f) => f.folder_path === uploadFolder || (f.folder_path ?? "").startsWith(`${uploadFolder}/`)).length
    : 0;
  const startUpload = useCallback(
    (accepted: File[]) => {
      if (!p || accepted.length === 0) return;
      addUploads(accepted, { projectId: p.id, projectName: p.name, apiKey: p.api_key, folderPath: uploadFolder });
      showToast.info(
        `Uploading ${pluralize(accepted.length, "file")}${uploadFolder ? ` to ${uploadFolder}` : ""}`
      );
    },
    [p, addUploads, uploadFolder]
  );

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: startUpload,
    noClick: true,
    noKeyboard: true,
    disabled: !p || tab !== "files",
  });

  const invalidate = () => {
    ["files", "project"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k, projectId] }));
    ["projects", "stats", "recent"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const deleteOne = useMutation({
    mutationFn: (file: FileMetadata) => filesApi.delete(file.id),
    onSuccess: (_, file) => {
      invalidate();
      setToDelete(null);
      if (previewId === file.id) setPreviewId(null);
      showToast.success(`Deleted ${file.original_name}`);
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't delete the file")),
  });

  const deleteFolder = useMutation({
    mutationFn: (path: string) => projectsApi.deleteFolder(projectId, path),
    onSuccess: ({ data }, path) => {
      invalidate();
      setFolderDeleteOpen(false);
      setFolder(null);
      setSelected(new Set());
      setPendingFolders((prev) => prev.filter((f) => f !== path && !f.startsWith(`${path}/`)));
      showToast.success(`Deleted ${path} and ${pluralize(data.deleted_count, "file")}`);
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't delete the folder")),
  });

  const deleteMany = useMutation({
    mutationFn: (ids: string[]) => filesApi.bulkDelete(ids),
    onSuccess: ({ data }) => {
      invalidate();
      setSelected(new Set());
      setBulkOpen(false);
      showToast.success(`Deleted ${pluralize(data.deleted_count, "file")}`);
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't delete the files")),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selecting = selected.size > 0;

  const copyLink = async (file: FileMetadata) => {
    if (!p) return;
    await copyToClipboard(p.is_public ? publicFileUrl(file) : readKeyFileUrl(file, p.read_key));
    showToast.success(p.is_public ? "Link copied" : "Link with read-only key copied");
  };

  const closePreview = () => {
    setPreviewId(null);
    if (searchParams.get("file")) router.replace(`/dashboard/projects/${projectId}`, { scroll: false });
  };

  // ------------------------------------------------------------------ states
  if (project.isLoading) {
    return (
      <Page>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-6 h-[188px] w-full rounded-3xl" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      </Page>
    );
  }

  if (!p) {
    const status = (project.error as { response?: { status?: number } } | null)?.response?.status;
    const missing = !project.isError || status === 404;
    return (
      <Page>
        {missing ? (
          <EmptyPanel
            icon={FolderSearch}
            title="This project doesn't exist"
            description="It may have been deleted, or it belongs to another account."
            action={
              <Link href="/dashboard/projects">
                <Button tabIndex={-1}>
                  <ArrowLeft />
                  All projects
                </Button>
              </Link>
            }
            className="mt-10"
          />
        ) : (
          <ErrorPanel
            icon={FolderSearch}
            title="Couldn't load this project"
            error={project.error}
            onRetry={() => project.refetch()}
            retrying={project.isRefetching}
            className="mt-10"
          />
        )}
      </Page>
    );
  }

  // ------------------------------------------------------------------ page
  return (
    <div {...getRootProps({ className: "relative min-h-dvh outline-none" })}>
      <input {...getInputProps()} aria-label="Choose files to upload" />

      {isDragActive && (
        <div
          style={projectTone(p.id)}
          className="pointer-events-none fixed inset-0 z-50 flex animate-fade items-center justify-center bg-rail/60 p-6 backdrop-blur-sm lg:pl-[76px]"
        >
          <div className="tone-solid flex w-full max-w-xl flex-col items-center rounded-[36px] px-8 py-14 text-center text-white shadow-pop">
            <CloudUpload className="h-14 w-14" strokeWidth={1.5} />
            <p className="mt-5 font-display text-3xl font-bold tracking-[-0.03em]">Drop to upload</p>
            <p className="mt-2 text-white/85">
              Into {p.name}
              {uploadFolder ? `, folder ${uploadFolder}` : ""}
            </p>
          </div>
        </div>
      )}

      <Page>
        <Link href="/dashboard/projects" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Projects
        </Link>

        {/* Banner in the project's colour */}
        <header
          style={projectTone(p.id)}
          className="tone-bg relative mt-4 animate-rise overflow-hidden rounded-[32px] p-6 sm:p-8"
        >
          <div aria-hidden="true" className="absolute -right-6 -top-10 hidden h-56 w-72 sm:block">
            <div className="tone-solid absolute right-16 top-16 h-28 w-28 rotate-12 rounded-[28px] opacity-40" />
            <div className="tone-solid absolute right-4 top-6 h-32 w-32 -rotate-6 rounded-[30px] opacity-70" />
            <div className="tone-solid absolute right-28 top-3 h-20 w-20 rotate-[20deg] rounded-[22px]" />
          </div>
          <div className="relative max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <VisibilityChip isPublic={p.is_public} className="bg-surface/80" />
              <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold text-ink-2">
                Created {formatDate(p.created_at)}
              </span>
            </div>
            <h1 className="mt-4 break-words font-display text-[36px] font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[52px]">
              {p.name}
            </h1>
            <p className="mt-3 text-[15px] font-medium text-ink-2">
              {pluralize(p.file_count ?? 0, "file")}, {formatBytes(p.total_size ?? 0)} stored
            </p>
          </div>
          <div className="relative mt-6 flex flex-wrap items-center gap-2.5">
            <Button onClick={openPicker}>
              <CloudUpload />
              Upload files
            </Button>
            <Segmented<Tab>
              label="Section"
              value={tab}
              onChange={setTab}
              className="bg-surface/70"
              options={[
                { value: "files", label: <><FilesIcon />Files</> },
                { value: "settings", label: <><Settings2 />Settings</> },
              ]}
            />
          </div>
        </header>

        {tab === "settings" ? (
          <div className="mt-6 animate-fade">
            <ProjectSettings key={`${p.api_key}-${p.read_key}-${p.name}`} project={p} />
          </div>
        ) : (
          <div className="mt-6 animate-fade">
            {/* Folder chips */}
            {(folders.length > 1 || pendingFolders.length > 0 || (folders.length === 1 && folders[0][0] !== ROOT)) && (
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {[[null, allFiles.length] as [string | null, number], ...folders].map(([path, count]) => {
                  const active = folder === path;
                  return (
                    <button
                      key={path ?? "__all"}
                      type="button"
                      onClick={() => {
                        setFolder(path);
                        setLimit(PAGE_SIZE);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                        active ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink hover:ring-line-strong"
                      )}
                    >
                      <span className={path && path !== ROOT ? "font-mono text-xs" : undefined}>
                        {path === null ? "All files" : path === ROOT ? "Top level" : path}
                      </span>
                      <span className={cn("tabular text-xs", active ? "text-canvas/60" : "text-ink-3")}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Toolbar */}
            {allFiles.length > 0 && (
              <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative sm:w-80">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setLimit(PAGE_SIZE);
                    }}
                    placeholder="Find a file"
                    aria-label="Find a file"
                    className="rounded-full pl-10"
                  />
                </div>
                <div className="flex items-center gap-2.5 sm:ml-auto">
                  <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
                    <FolderPlus />
                    New folder
                  </Button>
                  <Segmented<View>
                    label="Layout"
                    value={view}
                    onChange={changeView}
                    className="ml-auto sm:ml-0"
                    options={[
                      { value: "grid", label: <LayoutGrid />, ariaLabel: "Gallery" },
                      { value: "list", label: <List />, ariaLabel: "List" },
                    ]}
                  />
                </div>
              </div>
            )}

            {uploadFolder && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <p className="text-sm text-ink-2">
                  New uploads go to <span className="font-mono font-medium text-ink">{uploadFolder}</span>.
                </p>
                <Button
                  variant="danger-soft"
                  size="sm"
                  onClick={requestFolderDelete}
                >
                  <Trash2 />
                  Delete folder
                </Button>
              </div>
            )}

            {files.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
                ))}
              </div>
            ) : files.isError ? (
              <ErrorPanel
                icon={FilesIcon}
                title="Couldn't load the files"
                error={files.error}
                fallback="The list didn't load. Your files are still stored; try again."
                onRetry={() => files.refetch()}
                retrying={files.isRefetching}
                className="rounded-3xl border border-line bg-surface"
              />
            ) : allFiles.length === 0 ? (
              <button
                type="button"
                onClick={openPicker}
                style={projectTone(p.id)}
                className="group flex w-full flex-col items-center rounded-[32px] border-2 border-dashed border-line-strong bg-surface px-6 py-16 text-center transition-colors hover:border-[rgb(var(--tone))]"
              >
                <span className="tone-bg tone-text flex h-20 w-20 items-center justify-center rounded-3xl transition-transform duration-300 group-hover:-translate-y-1">
                  <CloudUpload className="h-9 w-9" strokeWidth={1.75} />
                </span>
                <span className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-ink">Drop files anywhere on this page</span>
                <span className="mt-2 max-w-md text-[15px] text-ink-2">
                  Or click to choose them. Apps can upload with this project&apos;s key; see Settings for an example.
                </span>
              </button>
            ) : visible.length === 0 ? (
              <EmptyPanel
                icon={Search}
                title={query ? "No matching files" : "This folder is empty"}
                description={
                  query ? `No file names contain "${query.trim()}".` : "Upload files while this folder is selected to add them here."
                }
                action={
                  query ? (
                    <Button variant="outline" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  ) : (
                    <Button onClick={openPicker}>
                      <CloudUpload />
                      Upload here
                    </Button>
                  )
                }
                className="rounded-3xl border border-dashed border-line-strong"
              />
            ) : view === "grid" ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {shown.map((file, i) => {
                  const isSelected = selected.has(file.id);
                  return (
                    <li key={file.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                      <div
                        className={cn(
                          "group relative overflow-hidden rounded-3xl border bg-surface transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lift",
                          isSelected ? "border-brand ring-2 ring-brand" : "border-line"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => (selecting ? toggle(file.id) : setPreviewId(file.id))}
                          className="block w-full text-left"
                          aria-label={selecting ? `Select ${file.original_name}` : `Open ${file.original_name}`}
                        >
                          <div className="aspect-square">
                            <FileThumb file={file} size="fill" />
                          </div>
                          <div className="p-3.5">
                            <p className="truncate text-sm font-semibold text-ink" title={file.original_name}>
                              {file.original_name}
                            </p>
                            <p className="mt-0.5 text-xs tabular text-ink-3">
                              {formatBytes(file.size)}, {timeAgo(file.upload_date)}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`Select ${file.original_name}`}
                          onClick={() => toggle(file.id)}
                          className={cn(
                            "absolute left-3 top-3 transition-opacity",
                            selecting || isSelected ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                          )}
                        >
                          <Check3 checked={isSelected} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-line bg-surface">
                <ul className="divide-y divide-line">
                  {shown.map((file) => {
                    const isSelected = selected.has(file.id);
                    return (
                      <li
                        key={file.id}
                        className={cn("flex items-center gap-3 px-3 py-2.5 sm:px-4", isSelected ? "bg-brand-soft/60" : "hover:bg-surface-2")}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`Select ${file.original_name}`}
                          onClick={() => toggle(file.id)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                            isSelected ? "border-brand bg-brand text-white" : "border-line-strong hover:border-ink-3"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" strokeWidth={3.5} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => (selecting ? toggle(file.id) : setPreviewId(file.id))}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <FileThumb file={file} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-ink">{file.original_name}</span>
                            <span className="block truncate text-xs text-ink-3 md:hidden">
                              {formatBytes(file.size)}
                              {file.folder_path ? `, ${file.folder_path}` : ""}
                            </span>
                          </span>
                          <span className="hidden w-40 truncate font-mono text-xs text-ink-3 md:block">{file.folder_path || "Top level"}</span>
                          <span className="hidden w-20 text-right text-sm tabular text-ink-2 md:block">{formatBytes(file.size)}</span>
                          <span className="hidden w-28 text-right text-sm text-ink-3 lg:block">{timeAgo(file.upload_date)}</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${file.original_name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => copyLink(file)}>
                              <Link2 />
                              Copy link
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={fileUrl(file, true)} download>
                                <Download />
                                Download
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem danger onSelect={() => setToDelete(file)}>
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {visible.length > shown.length && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  Show more
                </Button>
                <p className="text-xs tabular text-ink-3">
                  Showing {shown.length.toLocaleString()} of {visible.length.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </Page>

      {/* Selection bar */}
      {selecting && tab === "files" && (
        <div className="fixed inset-x-3 bottom-[104px] z-40 mx-auto flex max-w-md animate-rise items-center gap-2 rounded-full bg-ink p-2 pl-5 text-canvas shadow-pop lg:bottom-6">
          <span className="flex-1 text-sm font-semibold tabular">{pluralize(selected.size, "file")} selected</span>
          <button
            type="button"
            onClick={() => setSelected(new Set(shown.map((f) => f.id)))}
            className="rounded-full px-3 py-2 text-sm font-semibold text-canvas/70 hover:text-canvas"
          >
            All
          </button>
          <Button variant="danger" size="sm" onClick={() => setBulkOpen(true)}>
            <Trash2 />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="flex h-9 w-9 items-center justify-center rounded-full text-canvas/70 hover:bg-white/10 hover:text-canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <FilePreview file={previewFile} project={p} onOpenChange={(open) => !open && closePreview()} onDelete={setToDelete} />

      <ConfirmDialog
        open={folderDeleteOpen}
        onOpenChange={setFolderDeleteOpen}
        title={`Delete ${uploadFolder}?`}
        description={`The folder, any folders inside it, and ${pluralize(folderTreeCount, "file")} will be deleted for good. Their links will stop working.`}
        actionLabel="Delete folder"
        onConfirm={() => uploadFolder && deleteFolder.mutate(uploadFolder)}
        loading={deleteFolder.isPending}
        confirmText={uploadFolder}
        icon={<Trash2 />}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this file?"
        description={
          <>
            <span className="break-all font-semibold text-ink">{toDelete?.original_name}</span> will be deleted for good and its
            links will stop working.
          </>
        }
        actionLabel="Delete file"
        onConfirm={() => toDelete && deleteOne.mutate(toDelete)}
        loading={deleteOne.isPending}
        icon={<Trash2 />}
      />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Delete ${pluralize(selected.size, "file")}?`}
        description="They'll be deleted for good and their links will stop working."
        actionLabel={`Delete ${pluralize(selected.size, "file")}`}
        onConfirm={() => deleteMany.mutate([...selected])}
        loading={deleteMany.isPending}
        icon={<Trash2 />}
      />

      <Dialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          setNewFolderOpen(open);
          if (!open) setNewFolderName("");
        }}
      >
        <DialogContent>
          <DialogHeader
            icon={<FolderPlus />}
            title="New folder"
            description="The folder appears once a file is uploaded into it. Use slashes for nested folders."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const path = newFolderName.trim().replace(/\/+$/, "");
              if (!isValidFolder(path)) return;
              setPendingFolders((prev) => (prev.includes(path) ? prev : [...prev, path]));
              setFolder(path);
              setNewFolderOpen(false);
              setNewFolderName("");
            }}
          >
            <Field
              label="Folder path"
              htmlFor="folder-path"
              error={newFolderName && !isValidFolder(newFolderName.trim().replace(/\/+$/, "")) ? "Use letters, numbers, dashes, dots, underscores, and slashes. No leading dot." : undefined}
              hint="For example images/avatars"
            >
              <Input
                id="folder-path"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoComplete="off"
                autoFocus
                className="font-mono text-sm"
              />
            </Field>
            <DialogActions>
              <Button type="button" variant="ghost" onClick={() => setNewFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValidFolder(newFolderName.trim().replace(/\/+$/, ""))}>
                Create folder
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
