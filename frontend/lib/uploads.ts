"use client";

import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import { filesApi } from "./api";
import { apiError } from "./utils";

export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

export interface UploadItem {
  id: string;
  projectId: string;
  projectName: string;
  apiKey: string;
  folderPath?: string;
  file: File;
  loaded: number;
  status: UploadStatus;
  error?: string;
}

interface UploadState {
  items: UploadItem[];
  add: (
    files: File[],
    target: { projectId: string; projectName: string; apiKey: string; folderPath?: string }
  ) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  clearFinished: () => void;
}

// Parallel uploads per browser tab
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 4;

const controllers = new Map<string, AbortController>();
let queryClient: QueryClient | null = null;

/** Lets finished uploads refresh the file lists, totals and charts */
export function connectUploadsToQueryClient(client: QueryClient) {
  queryClient = client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useUploads = create<UploadState>((set, get) => {
  const patch = (id: string, changes: Partial<UploadItem>) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));

  const pump = () => {
    const { items } = get();
    const active = items.filter((i) => i.status === "uploading").length;
    const next = items.filter((i) => i.status === "queued").slice(0, CONCURRENCY - active);
    next.forEach((item) => void run(item));
  };

  const run = async (item: UploadItem) => {
    const controller = new AbortController();
    controllers.set(item.id, controller);
    patch(item.id, { status: "uploading", loaded: 0, error: undefined });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await filesApi.upload(item.apiKey, item.file, {
          folderPath: item.folderPath,
          signal: controller.signal,
          onProgress: (event) => patch(item.id, { loaded: event.loaded }),
        });
        patch(item.id, { status: "done", loaded: item.file.size });
        queryClient?.invalidateQueries({ queryKey: ["files", item.projectId] });
        queryClient?.invalidateQueries({ queryKey: ["project", item.projectId] });
        queryClient?.invalidateQueries({ queryKey: ["projects"] });
        queryClient?.invalidateQueries({ queryKey: ["stats"] });
        queryClient?.invalidateQueries({ queryKey: ["recent"] });
        break;
      } catch (error) {
        if (controller.signal.aborted) {
          patch(item.id, { status: "cancelled" });
          break;
        }
        const e = error as { response?: { status?: number; headers?: Record<string, string> } };
        // Rate limited: wait as long as the server asks, then try again
        if (e.response?.status === 429 && attempt < MAX_ATTEMPTS) {
          const wait = Number(e.response.headers?.["retry-after"] ?? 2);
          await sleep(Math.max(1, wait) * 1000);
          continue;
        }
        patch(item.id, {
          status: "failed",
          error:
            e.response?.status === 413
              ? "Larger than the upload limit"
              : apiError(error, "Upload failed"),
        });
        break;
      }
    }

    controllers.delete(item.id);
    pump();
  };

  return {
    items: [],

    add: (files, target) => {
      const added: UploadItem[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...target,
        file,
        loaded: 0,
        status: "queued",
      }));
      set((state) => ({ items: [...state.items, ...added] }));
      pump();
    },

    cancel: (id) => {
      const controller = controllers.get(id);
      if (controller) controller.abort();
      else patch(id, { status: "cancelled" });
    },

    retry: (id) => {
      patch(id, { status: "queued", loaded: 0, error: undefined });
      pump();
    },

    clearFinished: () =>
      set((state) => ({
        items: state.items.filter((i) => i.status === "queued" || i.status === "uploading"),
      })),
  };
});
