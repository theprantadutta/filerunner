import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 -> "1.5 KB"; drops trailing zeros */
export function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes < 0) return "0 B";
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : parseFloat(value.toFixed(decimals))} ${UNITS[i]}`;
}

/** Splits a size into number and unit, for large display figures */
export function splitBytes(bytes: number): { value: string; unit: string } {
  const [value, unit] = formatBytes(bytes).split(" ");
  return { value, unit };
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 minutes ago", "yesterday", then a date after a week */
export function timeAgo(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return RELATIVE.format(Math.round(seconds / 86400), "day");
  return formatDate(date);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

/** Error message from an API error, or a fallback */
export function apiError(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
}

export function pluralize(count: number, word: string, plural = `${word}s`) {
  return `${count.toLocaleString()} ${count === 1 ? word : plural}`;
}
