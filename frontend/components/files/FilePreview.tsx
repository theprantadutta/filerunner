"use client";

import { useState } from "react";
import { Check, Clock3, Copy, Download, ExternalLink, FolderOpen, KeyRound, Link2, Trash2 } from "lucide-react";
import { fileUrl, publicFileUrl, readKeyFileUrl, type FileMetadata, type ProjectResponse } from "@/lib/api";
import { CATEGORIES, categoryOf, categoryTone } from "@/lib/spectrum";
import { showToast } from "@/lib/toast";
import { copyToClipboard, formatBytes, formatDateTime } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileThumb } from "./FileThumb";

function CopyRow({ icon: Icon, label, detail, value }: { icon: typeof Link2; label: string; detail: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyToClipboard(value);
        setCopied(true);
        showToast.success(`${label} copied`);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-2">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{detail}</span>
      </span>
      {copied ? <Check className="h-4 w-4 text-good" strokeWidth={3} /> : <Copy className="h-4 w-4 text-ink-3" />}
    </button>
  );
}

function Preview({ file }: { file: FileMetadata }) {
  const category = categoryOf(file.mime_type);
  const src = fileUrl(file);
  if (category === "images") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by the file API
      <img src={src} alt={file.original_name} className="max-h-full max-w-full rounded-2xl object-contain" />
    );
  }
  if (category === "video") {
    return <video src={src} controls preload="metadata" className="max-h-full w-full rounded-2xl bg-black" />;
  }
  if (category === "audio") {
    return (
      <div className="w-full space-y-6">
        <FileThumb file={file} size="fill" className="mx-auto !h-40 !w-40 rounded-3xl" />
        <audio src={src} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  return <FileThumb file={file} size="fill" className="!h-44 !w-44 rounded-3xl" />;
}

/** Everything about one file: preview, details, share links, download and delete */
export function FilePreview({
  file,
  project,
  onOpenChange,
  onDelete,
}: {
  file: FileMetadata | null;
  project: ProjectResponse;
  onOpenChange: (open: boolean) => void;
  onDelete: (file: FileMetadata) => void;
}) {
  if (!file) return null;
  const category = categoryOf(file.mime_type);

  return (
    <Sheet open={!!file} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby="preview-details">
        <div
          style={categoryTone(category)}
          className="tone-bg relative flex h-[42%] min-h-[220px] shrink-0 items-center justify-center overflow-hidden rounded-t-3xl p-6"
        >
          <Preview file={file} />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <SheetTitle className="break-words font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            {file.original_name}
          </SheetTitle>
          <SheetDescription id="preview-details" className="mt-1.5 text-sm text-ink-2">
            {CATEGORIES[category].label.replace(/s$/, "")} file, {formatBytes(file.size)}
          </SheetDescription>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-sunken p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                <Clock3 className="h-3.5 w-3.5" /> Uploaded
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{formatDateTime(file.upload_date)}</dd>
            </div>
            <div className="rounded-2xl bg-sunken p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                <FolderOpen className="h-3.5 w-3.5" /> Folder
              </dt>
              <dd className="mt-1 truncate font-mono text-sm font-medium text-ink">{file.folder_path || "Top level"}</dd>
            </div>
          </dl>

          <h3 className="mb-3 mt-7 text-sm font-bold text-ink">Share</h3>
          <div className="space-y-2">
            {project.is_public ? (
              <CopyRow icon={Link2} label="Public link" detail="Anyone with the link can open it" value={publicFileUrl(file)} />
            ) : (
              <>
                <CopyRow
                  icon={KeyRound}
                  label="Link with read-only key"
                  detail="Keeps working until you regenerate the read key"
                  value={readKeyFileUrl(file, project.read_key)}
                />
                <CopyRow icon={Clock3} label="Temporary link" detail="Expires in 2 hours" value={fileUrl(file)} />
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-line p-4">
          <a
            href={fileUrl(file)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
          >
            <ExternalLink />
            Open
          </a>
          <a href={fileUrl(file, true)} download className={cn(buttonVariants(), "flex-1")}>
            <Download />
            Download
          </a>
          <Button variant="danger-soft" size="icon" aria-label="Delete file" onClick={() => onDelete(file)}>
            <Trash2 />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
