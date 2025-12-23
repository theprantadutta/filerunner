"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { projectsApi, filesApi, getConfig } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/EmptyState";
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
  Grid3X3,
  List,
  Folder,
  ExternalLink,
  Key,
  Settings,
  Files,
  Check,
  Eye,
  HardDrive,
  Calendar,
  Square,
  CheckSquare,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectId = params.id as string;

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderPath, setFolderPath] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
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

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await projectsApi.get(projectId);
      return response.data;
    },
  });

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["files", projectId],
    queryFn: async () => {
      const response = await projectsApi.listFiles(projectId);
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      showToast.success("File deleted successfully");
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
      showToast.success("API key regenerated successfully");
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
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      showToast.success(`${variables.length} file${variables.length > 1 ? "s" : ""} deleted`);
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
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      showToast.success(`Project emptied - ${response.data.deleted_count} files deleted`);
      setEmptyProjectDialogOpen(false);
      setEmptyProjectConfirmText("");
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

      try {
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];
          await filesApi.upload(project.api_key, file, folderPath || undefined);
          setUploadProgress(((i + 1) / acceptedFiles.length) * 100);
        }
        queryClient.invalidateQueries({ queryKey: ["files", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        setFolderPath("");
        showToast.success(
          `${acceptedFiles.length} file${acceptedFiles.length > 1 ? "s" : ""} uploaded successfully`
        );
      } catch (error: any) {
        const message = error.response?.data?.error || "Upload failed";
        showToast.error(message);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [project, folderPath, projectId, queryClient]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    disabled: uploading || !project,
  });

  const handleCopyApiKey = () => {
    if (project) {
      copyToClipboard(project.api_key);
      setCopiedKey(true);
      showToast.success("API key copied to clipboard");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyUrl = (url: string) => {
    const { baseUrl } = getConfig();
    copyToClipboard(`${baseUrl}${url}`);
    showToast.success("URL copied to clipboard");
  };

  const openDeleteDialog = (fileId: string, fileName: string) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteDialogOpen(true);
  };

  // Pagination logic
  const totalFiles = files?.length || 0;
  const totalPages = Math.ceil(totalFiles / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiles = files?.slice(startIndex, endIndex) || [];

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

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedFiles(new Set());
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <EmptyState
          icon={Folder}
          title="Project not found"
          description="This project may have been deleted or you don't have access to it."
          action={
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Folder className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                <Badge variant={project.is_public ? "success" : "secondary"} className="gap-1">
                  {project.is_public ? (
                    <>
                      <Globe className="h-3 w-3" />
                      Public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" />
                      Private
                    </>
                  )}
                </Badge>
              </div>
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Files className="h-3 w-3" />
                  {project.file_count || 0} files
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatBytes(project.total_size || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(project.created_at)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="files" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="files" className="gap-2">
            <Files className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          {files && files.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left side - Select mode controls */}
              <div className="flex items-center gap-2">
                {selectMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={allOnPageSelected ? deselectAllOnPage : selectAllOnPage}
                    >
                      {allOnPageSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      {allOnPageSelected ? "Deselect Page" : "Select Page"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.size} selected
                    </span>
                    {selectedFiles.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectMode}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setSelectMode(true)}
                    >
                      <CheckSquare className="h-4 w-4" />
                      Select
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalFiles)} of {totalFiles} file{totalFiles !== 1 ? "s" : ""}
                    </p>
                  </>
                )}
              </div>

              {/* Right side - View mode toggle */}
              <div className="flex gap-1 rounded-lg border p-1">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {filesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : files && files.length > 0 ? (
            viewMode === "list" ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {paginatedFiles.map((file, index) => {
                      const FileTypeIcon = getFileIcon(file.mime_type, file.original_name);
                      const isImage = file.mime_type.startsWith("image/");
                      const { baseUrl } = getConfig();
                      const isSelected = selectedFiles.has(file.id);

                      return (
                        <div
                          key={file.id}
                          className={cn(
                            "flex items-center gap-4 p-4 transition-colors animate-fade-up",
                            selectMode ? "cursor-pointer" : "",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                          )}
                          style={{ animationDelay: `${index * 30}ms` }}
                          onClick={selectMode ? () => toggleFileSelection(file.id) : undefined}
                        >
                          {/* Checkbox for select mode */}
                          {selectMode && (
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          )}

                          {isImage ? (
                            <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-muted">
                              <img
                                src={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key)}
                                alt={file.original_name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                              <FileTypeIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{file.original_name}</p>
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                              {file.folder_path && (
                                <span className="flex items-center gap-1">
                                  <Folder className="h-3 w-3" />
                                  {file.folder_path}
                                </span>
                              )}
                              <span>{formatBytes(file.size)}</span>
                              <span>{formatDate(file.upload_date)}</span>
                            </p>
                          </div>
                          {!selectMode && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyUrl(file.download_url)}
                                title="Copy URL"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <a
                                href={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="View">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </a>
                              <a
                                href={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key, true)}
                                download
                              >
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Download">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(file.id, file.original_name)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedFiles.map((file, index) => {
                  const FileTypeIcon = getFileIcon(file.mime_type, file.original_name);
                  const isImage = file.mime_type.startsWith("image/");
                  const { baseUrl } = getConfig();
                  const isSelected = selectedFiles.has(file.id);

                  return (
                    <Card
                      key={file.id}
                      className={cn(
                        "group overflow-hidden transition-all animate-fade-up",
                        selectMode ? "cursor-pointer" : "hover:shadow-lg",
                        isSelected ? "ring-2 ring-primary" : ""
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                      onClick={selectMode ? () => toggleFileSelection(file.id) : undefined}
                    >
                      {isImage ? (
                        <div className="relative aspect-video overflow-hidden bg-muted">
                          <img
                            src={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key)}
                            alt={file.original_name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          {/* Selection checkbox overlay */}
                          {selectMode && (
                            <div className="absolute top-2 left-2">
                              {isSelected ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                                  <Check className="h-4 w-4" />
                                </div>
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded border-2 border-white bg-black/30" />
                              )}
                            </div>
                          )}
                          {!selectMode && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
                              <a
                                href={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="icon" variant="secondary" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </a>
                              <a href={getFileUrl(baseUrl, file.download_url, project.is_public, project.api_key, true)} download>
                                <Button size="icon" variant="secondary" className="h-8 w-8">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative flex aspect-video items-center justify-center bg-muted">
                          <FileTypeIcon className="h-12 w-12 text-muted-foreground" />
                          {/* Selection checkbox overlay for non-images */}
                          {selectMode && (
                            <div className="absolute top-2 left-2">
                              {isSelected ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                                  <Check className="h-4 w-4" />
                                </div>
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded border-2 border-muted-foreground/50 bg-background/50" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <CardContent className="p-3">
                        <p className="truncate text-sm font-medium">{file.original_name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <EmptyState
                  icon={FileIcon}
                  title="No files yet"
                  description="Upload your first file to get started"
                  action={
                    <Button
                      onClick={() => {
                        const tabsTrigger = document.querySelector(
                          '[data-state="inactive"][value="upload"]'
                        ) as HTMLButtonElement;
                        tabsTrigger?.click();
                      }}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Files
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Pagination Footer */}
          {files && files.length > 0 && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-card p-4">
              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <div className="flex gap-1 rounded-lg border p-1">
                  {[10, 20, 50].map((count) => (
                    <Button
                      key={count}
                      variant={itemsPerPage === count ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => handleItemsPerPageChange(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1">
                    {/* Generate page numbers */}
                    {(() => {
                      const pages: (number | string)[] = [];
                      const showPages = 5;

                      if (totalPages <= showPages + 2) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
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

                        // Add ellipsis if needed
                        if (start > 2) pages.push("...");

                        // Add middle pages
                        for (let i = start; i <= end; i++) pages.push(i);

                        // Add ellipsis if needed
                        if (end < totalPages - 1) pages.push("...");

                        // Always show last page
                        pages.push(totalPages);
                      }

                      return pages.map((page, i) =>
                        typeof page === "string" ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
                            {page}
                          </span>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      );
                    })()}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
              <CardDescription>
                Drag and drop files or click to browse. Files will be uploaded to this project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folder-path">Folder Path (optional)</Label>
                <Input
                  id="folder-path"
                  placeholder="e.g., images/avatars"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Organize files into folders. Leave empty to upload to the root.
                </p>
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                  uploading && "cursor-not-allowed opacity-60"
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      "rounded-full p-4",
                      isDragActive ? "bg-primary/10" : "bg-muted"
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-8 w-8",
                        isDragActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  {isDragActive ? (
                    <p className="text-sm text-primary">Drop the files here</p>
                  ) : uploading ? (
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        Drag & drop files here, or click to select
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Upload multiple files at once
                      </p>
                    </>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key
              </CardTitle>
              <CardDescription>
                Use this key to upload files via the API or external applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={project.api_key}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyApiKey}
                  className="shrink-0"
                >
                  {copiedKey ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="rounded-lg border border-warning/50 bg-warning/5 p-4">
                <h4 className="font-medium text-warning">Regenerate API Key</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you believe your API key has been compromised, you can regenerate it.
                  This will invalidate the old key immediately.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenerateDialogOpen(true)}
                  className="mt-3 border-warning/50 text-warning hover:bg-warning/10"
                  disabled={regenerateKeyMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Key
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                API Usage
              </CardTitle>
              <CardDescription>
                Example code for uploading files to this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>{`curl -X POST "${getConfig().baseUrl}/api/upload" \\
  -H "X-API-Key: ${project.api_key}" \\
  -F "file=@/path/to/file.png" \\
  -F "folder_path=images"`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Destructive actions that cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div>
                  <p className="font-medium">Empty Project</p>
                  <p className="text-sm text-muted-foreground">
                    Delete all {project.file_count || 0} files from this project. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setEmptyProjectDialogOpen(true)}
                  disabled={(project.file_count || 0) === 0 || emptyProjectMutation.isPending}
                  className="shrink-0"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{fileToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToDelete && deleteMutation.mutate(fileToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Key Confirmation Dialog */}
      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to regenerate the API key? The old key will stop working
              immediately and any applications using it will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateKeyMutation.mutate()}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {regenerateKeyMutation.isPending ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFiles.size} file{selectedFiles.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedFiles))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedFiles.size} File${selectedFiles.size > 1 ? "s" : ""}`}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Empty Project
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all {project.file_count || 0} files from this project. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm">
                To confirm, type <span className="font-mono font-bold">{project.name}</span> below:
              </p>
            </div>
            <Input
              placeholder={`Type "${project.name}" to confirm`}
              value={emptyProjectConfirmText}
              onChange={(e) => setEmptyProjectConfirmText(e.target.value)}
              className="font-mono"
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
              {emptyProjectMutation.isPending ? "Deleting..." : "Delete All Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
