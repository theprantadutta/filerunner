"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, filesApi } from "@/lib/api";
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
  ArrowLeft,
  Copy,
  Upload,
  FileIcon,
  Trash2,
  Download,
  RefreshCw,
  Globe,
  Lock,
} from "lucide-react";
import { formatBytes, formatDate, copyToClipboard } from "@/lib/utils";
import Link from "next/link";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectId = params.id as string;

  const [uploading, setUploading] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await projectsApi.get(projectId);
      return response.data;
    },
  });

  const { data: files } = useQuery({
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
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: () => projectsApi.regenerateKey(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    setUploading(true);
    try {
      await filesApi.upload(project.api_key, file, folderPath || undefined);
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setFolderPath("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyApiKey = () => {
    if (project) {
      copyToClipboard(project.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      deleteMutation.mutate(fileId);
    }
  };

  if (!project) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.is_public ? (
              <Globe className="h-5 w-5 text-green-600" title="Public" />
            ) : (
              <Lock className="h-5 w-5 text-gray-500" title="Private" />
            )}
          </div>
          <p className="text-muted-foreground">
            {project.file_count || 0} files • {formatBytes(project.total_size || 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>
              Use this key to upload files via the API
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
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copiedKey && (
              <p className="text-sm text-green-600">API key copied!</p>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Regenerate API key? Old key will stop working.")) {
                  regenerateKeyMutation.mutate();
                }
              }}
              disabled={regenerateKeyMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate Key
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload files to this project
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
              />
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Choose File"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            All files in this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files && files.length > 0 ? (
            <div className="divide-y">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{file.original_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.folder_path && (
                          <span className="mr-2">📁 {file.folder_path}</span>
                        )}
                        {formatBytes(file.size)} • {formatDate(file.upload_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}${file.download_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.id, file.original_name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <FileIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No files yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your first file to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
