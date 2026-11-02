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

// Files above this go up in chunks. Each request stays far below Cloudflare's 100 MB body
// cap and 100 s timeout, and a dropped connection costs one chunk instead of the file.
const CHUNKED_ABOVE = 32 * 1024 * 1024;
// Chunks in flight per file; hides the round trip on a distant server
const CHUNK_PARALLEL = 3;
const CHUNK_ATTEMPTS = 6;

type HttpError = { response?: { status?: number; headers?: Record<string, string> } };

const controllers = new Map<string, AbortController>();
let queryClient: QueryClient | null = null;

/** Lets finished uploads refresh the file lists, totals and charts */
export function connectUploadsToQueryClient(client: QueryClient) {
  queryClient = client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Worth another try: no response at all (network dropped), rate limited, or a server error */
const isTransient = (error: unknown) => {
  const status = (error as HttpError).response?.status;
  return status === undefined || status === 429 || status >= 500;
};

/** Wait as long as a 429 asks, otherwise back off 1 s, 2 s, 4 s ... up to 15 s */
const retryDelay = (error: unknown, attempt: number) => {
  const e = error as HttpError;
  if (e.response?.status === 429) {
    return Math.max(1, Number(e.response.headers?.["retry-after"] ?? 2)) * 1000;
  }
  return Math.min(15_000, 1000 * 2 ** (attempt - 1));
};

async function withRetry<T>(
  request: (attempt: number) => Promise<T>,
  signal: AbortSignal,
  attempts: number,
  retryable: (error: unknown) => boolean
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request(attempt);
    } catch (error) {
      if (signal.aborted || attempt >= attempts || !retryable(error)) throw error;
      await sleep(retryDelay(error, attempt));
      if (signal.aborted) throw error;
    }
  }
}

/** One request for the whole file. Retried only when rate limited: a resend after a lost
 * response could store the file twice. */
async function uploadWhole(item: UploadItem, signal: AbortSignal, onLoaded: (bytes: number) => void) {
  await withRetry(
    () =>
      filesApi.upload(item.apiKey, item.file, {
        folderPath: item.folderPath,
        signal,
        onProgress: (event) => onLoaded(event.loaded),
      }),
    signal,
    MAX_ATTEMPTS,
    (error) => (error as HttpError).response?.status === 429
  );
}

/** Session, chunks in parallel (each retried on its own), then complete */
async function uploadChunked(item: UploadItem, signal: AbortSignal, onLoaded: (bytes: number) => void) {
  const { data: session } = await withRetry(
    () => filesApi.startChunked(item.apiKey, item.file, { folderPath: item.folderPath, signal }),
    signal,
    MAX_ATTEMPTS,
    (error) => (error as HttpError).response?.status === 429
  );

  // Stops the other chunks as soon as one fails for good, or the user cancels
  const chunks = new AbortController();
  const stop = () => chunks.abort();
  signal.addEventListener("abort", stop);

  try {
    const sent = new Array<number>(session.chunk_count).fill(0);
    const report = () => onLoaded(sent.reduce((sum, n) => sum + n, 0));
    let next = 0;

    const worker = async () => {
      while (next < session.chunk_count && !chunks.signal.aborted) {
        const index = next++;
        const start = index * session.chunk_size;
        const blob = item.file.slice(start, Math.min(start + session.chunk_size, item.file.size));
        await withRetry(
          () => {
            sent[index] = 0;
            report();
            return filesApi.uploadChunk(item.apiKey, session.upload_id, index, blob, {
              signal: chunks.signal,
              onProgress: (event) => {
                sent[index] = event.loaded;
                report();
              },
            });
          },
          chunks.signal,
          CHUNK_ATTEMPTS,
          isTransient
        );
        sent[index] = blob.size;
        report();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CHUNK_PARALLEL, session.chunk_count) }, () =>
        worker().catch((error) => {
          chunks.abort();
          throw error;
        })
      )
    );
    if (signal.aborted) throw new Error("Upload cancelled");

    await withRetry(
      () => filesApi.completeChunked(item.apiKey, session.upload_id, signal),
      signal,
      CHUNK_ATTEMPTS,
      isTransient
    ).catch((error) => {
      // Only a complete removes the session, so a 404 after our own earlier attempt means
      // that attempt went through and only its response was lost.
      if ((error as HttpError).response?.status === 404 && !signal.aborted) return;
      throw error;
    });
  } catch (error) {
    // Free the half-sent file on the server instead of leaving it for the nightly prune
    filesApi.abortChunked(item.apiKey, session.upload_id).catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

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

    const onLoaded = (loaded: number) => patch(item.id, { loaded });
    try {
      if (item.file.size > CHUNKED_ABOVE) {
        await uploadChunked(item, controller.signal, onLoaded);
      } else {
        await uploadWhole(item, controller.signal, onLoaded);
      }
      patch(item.id, { status: "done", loaded: item.file.size });
      queryClient?.invalidateQueries({ queryKey: ["files", item.projectId] });
      queryClient?.invalidateQueries({ queryKey: ["project", item.projectId] });
      queryClient?.invalidateQueries({ queryKey: ["projects"] });
      queryClient?.invalidateQueries({ queryKey: ["stats"] });
      queryClient?.invalidateQueries({ queryKey: ["recent"] });
    } catch (error) {
      if (controller.signal.aborted) {
        patch(item.id, { status: "cancelled" });
      } else {
        patch(item.id, {
          status: "failed",
          error:
            (error as HttpError).response?.status === 413
              ? "Larger than the upload limit"
              : apiError(error, "Upload failed"),
        });
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
