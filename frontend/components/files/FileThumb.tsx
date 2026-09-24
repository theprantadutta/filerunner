"use client";

import { useState } from "react";
import { fileUrl, type FileMetadata } from "@/lib/api";
import { CATEGORIES, categoryOf, categoryTone, fileExtension } from "@/lib/spectrum";
import { cn } from "@/lib/utils";

type ThumbFile = Pick<FileMetadata, "original_name" | "mime_type" | "download_url" | "access_url">;

/**
 * Image preview when the file is an image, otherwise a tile in the file type's colour
 * with its icon and extension. Falls back to the tile if the image fails to load.
 */
export function FileThumb({
  file,
  size = "md",
  className,
}: {
  file: ThumbFile;
  size?: "sm" | "md" | "fill";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const category = categoryOf(file.mime_type);
  const { icon: Icon } = CATEGORIES[category];
  const ext = fileExtension(file.original_name);
  const showImage = category === "images" && !failed;

  const box =
    size === "sm" ? "h-10 w-10 rounded-xl" : size === "md" ? "h-14 w-14 rounded-2xl" : "h-full w-full";

  if (showImage) {
    return (
      <div className={cn("overflow-hidden bg-sunken", box, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the file API, not Next */}
        <img
          src={fileUrl(file)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      style={categoryTone(category)}
      className={cn("tone-bg tone-text flex flex-col items-center justify-center gap-1", box, className)}
    >
      <Icon
        className={size === "sm" ? "h-[18px] w-[18px]" : size === "md" ? "h-6 w-6" : "h-10 w-10"}
        strokeWidth={1.75}
      />
      {size === "fill" && ext && (
        <span className="max-w-[80%] truncate font-mono text-xs font-semibold">.{ext}</span>
      )}
    </div>
  );
}
