"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { projectsApi, filesApi, getConfig, type FileMetadata } from "@/lib/api";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/EmptyState";
import { IconAction } from "@/components/IconAction";
import {
  ArrowLeft,
  Copy,
  Upload,
  FileIcon,
  Trash2,
  Download,
  RefreshCw,
  Globe,
  Lock,
  Image as ImageIcon,
  FileText,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  LayoutGrid,
  List,
  Folder,
  Key,
  Settings,
  Files,
  Check,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Crumb,
  Search,
  MoreHorizontal,
  ExternalLink,
  Loader2,
  RotateCw,
  CheckCircle2,
  CloudUpload,
  Minus,
} from "lucide-react";
import { formatBytes, formatDate, copyToClipboard, cn } from "@/lib/utils";
import Link from "next/link";

// Helper to build file URL with API key for private projects
function getFileUrl(baseUrl: string, downloadUrl: string, isPublic: boolean, apiKey: string, download?: boolean): string {
  const url = `${baseUrl}${downloadUrl}`;
  // For private projects, append API key as query param for image/file previews
  if (!isPublic) {
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    if (download) params.set("download", "true");
    return `${url}?${params.toString()}`;
  }
  if (download) {
    return `${url}?download=true`;
  }
  return url;
}

// File type icon mapper
function getFileIcon(mimeType: string, fileName: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gzip"))
    return FileArchive;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text"))
    return FileText;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css"))
    return FileCode;
  return FileIcon;
}

function maskKey(key: string) {
  return `${key.slice(0, 6)}${"•".repeat(Math.max(8, key.length - 10))}${key.slice(-4)}`;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const showPages = 5;

  if (totalPages <= showPages + 2) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  // Adjust if at edges
  if (currentPage <= 3) {
    end = Math.min(totalPages - 1, 4);
  } else if (currentPage >= totalPages - 2) {
    start = Math.max(2, totalPages - 3);
  }

  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");

  // Always show last page
  pages.push(totalPages);
  return pages;
}

type Tab = "files" | "upload" | "settings";

// Shared column template for the file table header and rows
const FILE_ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,160px)_88px_150px_136px] md:items-center md:gap-4";

export default function ProjectDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>("files");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCounts, setUploadCounts] = useState({ done: 0, total: 0 });
  const [lastUploadCount, setLastUploadCount] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [fileQuery, setFileQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Bulk delete & empty project dialogs
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [emptyProjectDialogOpen, setEmptyProjectDialogOpen] = useState(false);
  const [emptyProjectConfirmText, setEmptyProjectConfirmText] = useState("");

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectIsError,
    error: projectError,
    refetch: refetchProject,
    isRefetching: projectRefetching,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await projectsApi.get(projectId);
      return response.data;
    },
  });

  const {
    data: files,
    isLoading: filesLoading,
    isError: filesIsError,
    refetch: refetchFiles,
    isRefetching: filesRefetching,
  } = useQuery({
    queryKey: ["files", projectId],
    queryFn: async () => {
      const response = await projectsApi.listFiles(projectId);
      return response.data;
    },
  });

  // Keep the dashboard totals and sidebar in sync after changes here
  const invalidateProjectData = () => {
    queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId),
    onSuccess: () => {
      invalidateProjectData();
      showToast.success(`Deleted "${fileToDelete?.name ?? "file"}"`);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to delete file";
      showToast.error(message);
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: () => projectsApi.regenerateKey(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      showToast.success("API key regenerated. Update any apps using the old key.");
      setRegenerateDialogOpen(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to regenerate key";
      showToast.error(message);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (fileIds: string[]) => filesApi.bulkDelete(fileIds),
    onSuccess: (_, variables) => {
      invalidateProjectData();
      showToast.success(`Deleted ${variables.length} file${variables.length > 1 ? "s" : ""}`);
      setBulkDeleteDialogOpen(false);
      setSelectedFiles(new Set());
      setSelectMode(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to delete files";
      showToast.error(message);
    },
  });

  const emptyProjectMutation = useMutation({
    mutationFn: () => projectsApi.emptyProject(projectId),
    onSuccess: (response) => {
      invalidateProjectData();
      showToast.success(`Project emptied. ${response.data.deleted_count} files deleted.`);
      setEmptyProjectDialogOpen(false);
      setEmptyProjectConfirmText("");
      setSelectedFiles(new Set());
      setSelectMode(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to empty project";
      showToast.error(message);
    },
  });

  const handleUpload = useCallback(
    async (acceptedFiles: File[]) => {
      if (!project || acceptedFiles.length === 0) return;

      setUploading(true);
      setUploadProgress(0);
      setLastUploadCount(null);
      setUploadCounts({ done: 0, total: acceptedFiles.length });

      try {
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];
          await filesApi.upload(project.api_key, file, folderPath || undefined);
          setUploadProgress(((i + 1) / acceptedFiles.length) * 100);
          setUploadCounts({ done: i + 1, total: acceptedFiles.length });
        }
        queryClient.invalidateQueries({ queryKey: ["files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        setFolderPath("");
        setLastUploadCount(acceptedFiles.length);
        showToast.success(
          `Uploaded ${acceptedFiles.length} file${acceptedFiles.length > 1 ? "s" : ""}`
        );
      } catch (error: any) {
        const message = error.response?.data?.error || "Upload failed";
        showToast.error(message);
        // Files uploaded before the failure are still stored
        queryClient.invalidateQueries({ queryKey: ["files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [project, folderPath, projectId, queryClient]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop: handleUpload,
    disabled: uploading || !project,
  });

  const handleCopyApiKey = () => {
    if (project) {
      copyToClipboard(project.api_key);
      setCopiedKey(true);
      showToast.success("API key copied");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyUrl = (url: string) => {
    const { baseUrl } = getConfig();
    copyToClipboard(`${baseUrl}${url}`);
    showToast.success("File URL copied");
  };

  const openDeleteDialog = (fileId: string, fileName: string) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteDialogOpen(true);
  };

  // Filter, then paginate the filtered list
  const visibleFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase();
    if (!files) return [];
    if (!query) return files;
    return files.filter(
      (f) =>
        f.original_name.toLowerCase().includes(query) ||
        (f.folder_path ?? "").toLowerCase().includes(query)
    );
  }, [files, fileQuery]);

  const totalFiles = visibleFiles.length;
  const totalPages = Math.max(1, Math.ceil(totalFiles / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiles = visibleFiles.slice(startIndex, endIndex);

  // Reset to page 1 when items per page changes or files change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Selection helpers
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllOnPage = () => {
    const newSet = new Set(selectedFiles);
    paginatedFiles.forEach((file) => newSet.add(file.id));
    setSelectedFiles(newSet);
  };

  const deselectAllOnPage = () => {
    const newSet = new Set(selectedFiles);
    paginatedFiles.forEach((file) => newSet.delete(file.id));
    setSelectedFiles(newSet);
  };

  const allOnPageSelected = paginatedFiles.length > 0 && paginatedFiles.every((file) => selectedFiles.has(file.id));
  const someOnPageSelected = paginatedFiles.some((file) => selectedFiles.has(file.id));

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedFiles(new Set());
  };

  if (projectLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading project">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Card className="divide-y overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (!project) {
    const status = (projectError as any)?.response?.status;
    const notFound = !projectIsError || status === 404 || status === 403;
    return (
      <Card className="mt-4">
        <EmptyState
          tone={notFound ? "neutral" : "error"}
          icon={notFound ? Folder : AlertTriangle}
          title={notFound ? "Project not found" : "Couldn't load this project"}
          description={
            notFound
              ? "It may have been deleted, or it belongs to another account."
              : (projectError as any)?.response?.data?.error ||
                "The server didn't respond. Check that the backend is running, then try again."
          }
          action={
            <>
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4" />
                  All projects
                </Button>
              </Link>
              {!notFound && (
                <Button onClick={() => refetchProject()} disabled={projectRefetching}>
                  {projectRefetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Try again
                </Button>
              )}
            </>
          }
        />
      </Card>
    );
  }

  const { baseUrl } = getConfig();
  const fileUrl = (file: FileMetadata, download?: boolean) =>
    getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key, download);
  const buildCurl = (key: string) => `curl -X POST "${baseUrl}/api/upload" \\
  -H "X-API-Key: ${key}" \\
  -F "file=@/path/to/file.png" \\
  -F "folder_path=images"`;
  const curlSnippet = buildCurl(project.api_key);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <li>
              <Link href="/dashboard" className="rounded hover:text-foreground">
                Projects
              </Link>
            </li>
            <li aria-hidden="true">
              <Crumb className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="truncate font-medium text-foreground">
              {project.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] sm:text-[28px] sm:leading-9">
                {project.name}
              </h1>
              {project.is_public ? (
                <Badge variant="success">
                  <Globe />
                  Public
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Lock />
                  Private
                </Badge>
              )}
            </div>
            <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
              <div className="flex gap-1">
                <dt className="sr-only">Files</dt>
                <dd className="tabular">
                  <span className="font-medium text-foreground">
                    {(project.file_count || 0).toLocaleString()}
                  </span>{" "}
                  files
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="sr-only">Size</dt>
                <dd className="tabular">
                  <span className="font-medium text-foreground">
                    {formatBytes(project.total_size || 0)}
                  </span>{" "}
                  stored
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Created</dt>
                <dd>{formatDate(project.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={handleCopyApiKey}>
              {copiedKey ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Key className="h-4 w-4 text-muted-foreground" />
              )}
              Copy API key
            </Button>
            <Button onClick={() => setActiveTab("upload")}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="files">
            <Files />
            Files
            <span className="rounded-full bg-muted px-1.5 text-xs tabular text-muted-foreground">
              {(project.file_count || 0).toLocaleString()}
            </span>
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload />
            Upload
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-3">
          {files && files.length > 0 && (
            <div className="flex min-h-9 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {selectMode ? (
                <div className="flex flex-wrap items-center gap-2 animate-fade-in">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={allOnPageSelected ? deselectAllOnPage : selectAllOnPage}
                  >
                    <SelectBox checked={allOnPageSelected} indeterminate={!allOnPageSelected && someOnPageSelected} />
                    {allOnPageSelected ? "Deselect page" : "Select page"}
                  </Button>
                  <span className="px-1 text-[13px] tabular text-muted-foreground" aria-live="polite">
                    {selectedFiles.size} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedFiles.size === 0}
                    onClick={() => setBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    <X className="h-3.5 w-3.5" />
                    Done
                  </Button>
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter by name or folder"
                      aria-label="Filter files"
                      value={fileQuery}
                      onChange={(e) => {
                        setFileQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9 pr-9"
                    />
                    {fileQuery && (
                      <button
                        type="button"
                        onClick={() => setFileQuery("")}
                        aria-label="Clear filter"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => setSelectMode(true)}>
                    <Check className="h-4 w-4 text-muted-foreground" />
                    Select
                  </Button>
                </div>
              )}

              <div
                role="radiogroup"
                aria-label="View"
                className="hidden h-9 items-center rounded-md border bg-card p-0.5 shadow-panel sm:inline-flex"
              >
                {(
                  [
                    ["list", List, "List view"],
                    ["grid", LayoutGrid, "Grid view"],
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={viewMode === mode}
                    aria-label={label}
                    title={label}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "inline-flex h-full w-8 items-center justify-center rounded-[5px] transition-colors",
                      viewMode === mode
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filesLoading ? (
            <Card className="divide-y overflow-hidden" aria-busy="true" aria-label="Loading files">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </Card>
          ) : filesIsError ? (
            <Card>
              <EmptyState
                tone="error"
                icon={AlertTriangle}
                title="Couldn't load files"
                description="The file list didn't load. Your files are still stored; try again."
                action={
                  <Button variant="outline" onClick={() => refetchFiles()} disabled={filesRefetching}>
                    {filesRefetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCw className="h-4 w-4" />
                    )}
                    Try again
                  </Button>
                }
              />
            </Card>
          ) : !files || files.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <EmptyState
                icon={CloudUpload}
                title="No files yet"
                description="Upload files here, or send them from your app with this project's API key."
                action={
                  <>
                    <Button onClick={() => setActiveTab("upload")}>
                      <Upload className="h-4 w-4" />
                      Upload files
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("settings")}>
                      <FileCode className="h-4 w-4" />
                      See API example
                    </Button>
                  </>
                }
              />
            </Card>
          ) : visibleFiles.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <EmptyState
                icon={Search}
                title="No matching files"
                description={`No file names or folders contain "${fileQuery.trim()}".`}
                action={
                  <Button variant="outline" onClick={() => setFileQuery("")}>
                    Clear filter
                  </Button>
                }
              />
            </Card>
          ) : viewMode === "list" ? (
            <Card className="overflow-hidden">
              <div
                className={cn(
                  "hidden border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground",
                  FILE_ROW_GRID
                )}
              >
                <span className={cn(selectMode && "pl-8")}>Name</span>
                <span>Folder</span>
                <span className="text-right">Size</span>
                <span>Uploaded</span>
                <span className="sr-only">Actions</span>
              </div>
              <ul className="divide-y">
                {paginatedFiles.map((file) => {
                  const FileTypeIcon = getFileIcon(file.mime_type, file.original_name);
                  const isImage = file.mime_type.startsWith("image/");
                  const isSelected = selectedFiles.has(file.id);

                  return (
                    <li
                      key={file.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-colors",
                        FILE_ROW_GRID,
                        selectMode && "cursor-pointer select-none",
                        isSelected ? "bg-primary/[0.06]" : "hover:bg-accent/40"
                      )}
                      onClick={selectMode ? () => toggleFileSelection(file.id) : undefined}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {selectMode && (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Select ${file.original_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFileSelection(file.id);
                            }}
                            className="rounded"
                          >
                            <SelectBox checked={isSelected} />
                          </button>
                        )}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/60">
                          {isImage ? (
                            <img
                              src={fileUrl(file)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileTypeIcon className="h-[18px] w-[18px] text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" title={file.original_name}>
                            {file.original_name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground md:hidden">
                            <span className="tabular">{formatBytes(file.size)}</span>
                            {file.folder_path && (
                              <>
                                <span aria-hidden="true" className="h-3 w-px bg-border" />
                                <span className="truncate font-mono text-[11px]">{file.folder_path}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="hidden truncate font-mono text-xs text-muted-foreground md:block" title={file.folder_path}>
                        {file.folder_path || <span className="font-sans">—</span>}
                      </span>
                      <span className="hidden text-right text-sm tabular md:block">
                        {formatBytes(file.size)}
                      </span>
                      <span className="hidden text-[13px] text-muted-foreground md:block">
                        {formatDate(file.upload_date)}
                      </span>

                      <div
                        className={cn(
                          "flex shrink-0 justify-end gap-0.5",
                          selectMode && "invisible"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconAction
                          label="Copy URL"
                          className="hidden sm:inline-flex"
                          onClick={() => handleCopyUrl(file.download_url)}
                        >
                          <Copy />
                        </IconAction>
                        <a
                          href={fileUrl(file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          tabIndex={-1}
                          className="hidden sm:inline-flex"
                        >
                          <IconAction label="Open">
                            <ExternalLink />
                          </IconAction>
                        </a>
                        <a href={fileUrl(file, true)} download tabIndex={-1} className="hidden sm:inline-flex">
                          <IconAction label="Download">
                            <Download />
                          </IconAction>
                        </a>
                        <IconAction
                          label="Delete"
                          className="hidden hover:bg-destructive/10 hover:text-destructive sm:inline-flex"
                          onClick={() => openDeleteDialog(file.id, file.original_name)}
                        >
                          <Trash2 />
                        </IconAction>
                        <div className="sm:hidden">
                          <FileMenu
                            onCopy={() => handleCopyUrl(file.download_url)}
                            openHref={fileUrl(file)}
                            downloadHref={fileUrl(file, true)}
                            onDelete={() => openDeleteDialog(file.id, file.original_name)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {paginatedFiles.map((file) => {
                const FileTypeIcon = getFileIcon(file.mime_type, file.original_name);
                const isImage = file.mime_type.startsWith("image/");
                const isSelected = selectedFiles.has(file.id);

                return (
                  <li
                    key={file.id}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border bg-card shadow-panel transition-[border-color,box-shadow]",
                      selectMode ? "cursor-pointer select-none" : "hover:border-foreground/20",
                      isSelected && "border-primary ring-1 ring-primary"
                    )}
                    onClick={selectMode ? () => toggleFileSelection(file.id) : undefined}
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b bg-muted/50">
                      {isImage ? (
                        <img
                          src={fileUrl(file)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileTypeIcon className="h-9 w-9 text-muted-foreground/70" strokeWidth={1.5} />
                      )}
                      {selectMode && (
                        <span className="absolute left-2 top-2 rounded bg-card/80 backdrop-blur">
                          <SelectBox checked={isSelected} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-2.5 pl-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium" title={file.original_name}>
                          {file.original_name}
                        </p>
                        <p className="text-xs tabular text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                      {!selectMode && (
                        <FileMenu
                          onCopy={() => handleCopyUrl(file.download_url)}
                          openHref={fileUrl(file)}
                          downloadHref={fileUrl(file, true)}
                          onDelete={() => openDeleteDialog(file.id, file.original_name)}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination Footer */}
          {files && files.length > 0 && visibleFiles.length > 0 && (
            <div className="flex flex-col gap-3 pt-1 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="tabular">
                  {startIndex + 1}–{Math.min(endIndex, totalFiles)} of {totalFiles.toLocaleString()}
                  {fileQuery.trim() ? " matching" : ""} file{totalFiles !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span id="per-page-label">Per page</span>
                  <div
                    role="radiogroup"
                    aria-labelledby="per-page-label"
                    className="inline-flex h-8 items-center rounded-md border bg-card p-0.5"
                  >
                    {[10, 20, 50].map((count) => (
                      <button
                        key={count}
                        type="button"
                        role="radio"
                        aria-checked={itemsPerPage === count}
                        onClick={() => handleItemsPerPageChange(count)}
                        className={cn(
                          "h-full rounded-[5px] px-2.5 text-xs font-medium tabular transition-colors",
                          itemsPerPage === count
                            ? "bg-accent text-foreground"
                            : "hover:text-foreground"
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {totalPages > 1 && (
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  <IconAction
                    label="Previous page"
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft />
                  </IconAction>
                  {getPageNumbers(safePage, totalPages).map((page, i) =>
                    typeof page === "string" ? (
                      <span key={`ellipsis-${i}`} className="w-6 text-center">
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        aria-current={safePage === page ? "page" : undefined}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "h-8 min-w-8 rounded-md px-2 text-xs font-medium tabular transition-colors",
                          safePage === page
                            ? "bg-foreground text-background"
                            : "hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <IconAction
                    label="Next page"
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                  >
                    <ChevronRight />
                  </IconAction>
                </nav>
              )}
            </div>
          )}
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card className="p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.01em]">Upload files</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Files go straight into this project. Pick a folder first if you want them grouped.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="folder-path">Folder (optional)</Label>
                  <Input
                    id="folder-path"
                    placeholder="images/avatars"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    disabled={uploading}
                    className="font-mono text-[13px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to upload to the project root.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className={cn(
                    "relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/25 hover:bg-accent/30",
                    uploading && "cursor-not-allowed opacity-60"
                  )}
                >
                  <input {...getInputProps()} />
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg border bg-card shadow-panel transition-transform",
                      isDragActive && "scale-110 border-primary/40"
                    )}
                  >
                    <CloudUpload
                      className={cn("h-5 w-5", isDragActive ? "text-primary" : "text-muted-foreground")}
                    />
                  </div>
                  {isDragActive ? (
                    <p className="mt-4 text-sm font-medium text-primary">Drop to upload</p>
                  ) : (
                    <>
                      <p className="mt-4 text-sm font-medium">
                        Drop files here, or{" "}
                        <span className="text-primary underline-offset-4 hover:underline">browse</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Any file type. Select several at once.
                        {folderPath.trim() && (
                          <>
                            {" "}Uploading to <span className="font-mono">{folderPath.trim()}</span>.
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3.5 animate-fade-in" aria-live="polite">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        Uploading {Math.min(uploadCounts.done + 1, uploadCounts.total)} of {uploadCounts.total}
                      </span>
                      <span className="tabular text-muted-foreground">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {!uploading && lastUploadCount !== null && (
                  <div
                    className="flex flex-col gap-3 rounded-lg border border-success/25 bg-success/5 p-3.5 animate-fade-in sm:flex-row sm:items-center sm:justify-between"
                    role="status"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Uploaded {lastUploadCount} file{lastUploadCount > 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={openFilePicker}>
                        Upload more
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLastUploadCount(null);
                          setActiveTab("files");
                        }}
                      >
                        View files
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="divide-y">
            <SettingsSection
              title="API key"
              description="Send this key in the X-API-Key header to upload files from your apps."
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    value={revealKey ? project.api_key : maskKey(project.api_key)}
                    readOnly
                    aria-label="API key"
                    className="pr-10 font-mono text-[13px]"
                    onFocus={(e) => revealKey && e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => setRevealKey((v) => !v)}
                    aria-label={revealKey ? "Hide API key" : "Show API key"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {revealKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" onClick={handleCopyApiKey} className="shrink-0">
                  {copiedKey ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  <span className="hidden sm:inline">{copiedKey ? "Copied" : "Copy"}</span>
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Regenerate key</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    The current key stops working immediately.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setRegenerateDialogOpen(true)}
                  disabled={regenerateKeyMutation.isPending}
                  className="shrink-0"
                >
                  <RefreshCw className={cn("h-4 w-4", regenerateKeyMutation.isPending && "animate-spin")} />
                  Regenerate
                </Button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Upload from the command line"
              description="A working example for this project. Swap in your own file path and folder."
            >
              <div className="relative overflow-hidden rounded-lg border bg-muted/40">
                <div className="flex items-center justify-between border-b px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">curl</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      copyToClipboard(curlSnippet);
                      setCopiedSnippet(true);
                      showToast.success("Example copied");
                      setTimeout(() => setCopiedSnippet(false), 2000);
                    }}
                  >
                    {copiedSnippet ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedSnippet ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
                  <code>{revealKey ? curlSnippet : buildCurl(maskKey(project.api_key))}</code>
                </pre>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Danger zone"
              description="Actions here permanently remove data."
              danger
            >
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Empty project</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Delete all {(project.file_count || 0).toLocaleString()} files. The project and its key stay.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setEmptyProjectDialogOpen(true)}
                  disabled={(project.file_count || 0) === 0 || emptyProjectMutation.isPending}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  Empty project
                </Button>
              </div>
            </SettingsSection>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="break-all font-medium text-foreground">{fileToDelete?.name}</span> will be
              permanently deleted and its URL will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (fileToDelete) deleteMutation.mutate(fileToDelete.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleteMutation.isPending ? "Deleting" : "Delete file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Key Confirmation Dialog */}
      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The current key stops working immediately. Any app or script using it will fail until you
              update it with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                regenerateKeyMutation.mutate();
              }}
              disabled={regenerateKeyMutation.isPending}
            >
              {regenerateKeyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {regenerateKeyMutation.isPending ? "Regenerating" : "Regenerate key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedFiles.size} file{selectedFiles.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected files will be permanently deleted and their URLs will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                bulkDeleteMutation.mutate(Array.from(selectedFiles));
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulkDeleteMutation.isPending
                ? "Deleting"
                : `Delete ${selectedFiles.size} file${selectedFiles.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Project Confirmation Dialog (Type to Confirm) */}
      <Dialog
        open={emptyProjectDialogOpen}
        onOpenChange={(open) => {
          setEmptyProjectDialogOpen(open);
          if (!open) setEmptyProjectConfirmText("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Empty {project.name}?</DialogTitle>
            <DialogDescription>
              All {(project.file_count || 0).toLocaleString()} files will be permanently deleted. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="empty-confirm">
              Type <span className="font-mono font-semibold">{project.name}</span> to confirm
            </Label>
            <Input
              id="empty-confirm"
              value={emptyProjectConfirmText}
              onChange={(e) => setEmptyProjectConfirmText(e.target.value)}
              className="font-mono text-[13px]"
              autoComplete="off"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEmptyProjectDialogOpen(false);
                setEmptyProjectConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => emptyProjectMutation.mutate()}
              disabled={emptyProjectConfirmText !== project.name || emptyProjectMutation.isPending}
            >
              {emptyProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {emptyProjectMutation.isPending ? "Deleting files" : "Delete all files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectBox({ checked, indeterminate = false }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card"
      )}
    >
      {checked ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : indeterminate ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </span>
  );
}

function FileMenu({
  onCopy,
  openHref,
  downloadHref,
  onDelete,
}: {
  onCopy: () => void;
  openHref: string;
  downloadHref: string;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="File actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onCopy}>
          <Copy className="mr-2" />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={openHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2" />
            Open
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={downloadHref} download>
            <Download className="mr-2" />
            Download
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:!text-destructive"
        >
          <Trash2 className="mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingsSection({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className={cn("text-sm font-semibold", danger && "text-destructive")}>{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
