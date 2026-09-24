"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Trash2, Eraser } from "lucide-react";
import { getConfig, projectsApi, type ProjectResponse } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { apiError, cn, copyToClipboard, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function mask(key: string) {
  return `${key.slice(0, 8)}${"•".repeat(20)}${key.slice(-4)}`;
}

/** Settings are a column of sections: title and explanation left, controls right */
function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className="grid gap-5 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className={cn("font-display text-lg font-bold tracking-[-0.02em]", danger ? "text-bad" : "text-ink")}>{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function KeyCard({
  label,
  description,
  value,
  tone,
  onRegenerate,
}: {
  label: string;
  description: string;
  value: string;
  tone: "full" | "read";
  onRegenerate: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tone === "full" ? "bg-warn/10 text-warn" : "bg-good/10 text-good"
          )}
        >
          {tone === "full" ? <KeyRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{label}</p>
          <p className="text-[13px] leading-snug text-ink-2">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-sunken p-1.5 pl-3.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{revealed ? value : mask(value)}</code>
        <Button variant="ghost" size="icon-sm" aria-label={revealed ? `Hide ${label}` : `Show ${label}`} onClick={() => setRevealed((r) => !r)}>
          {revealed ? <EyeOff /> : <Eye />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await copyToClipboard(value);
            setCopied(true);
            showToast.success(`${label} copied`);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check className="!text-good" /> : <Copy />}
        </Button>
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Regenerate
      </button>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-rail text-rail-ink">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-xs font-semibold text-rail-muted">{title}</span>
        <button
          type="button"
          onClick={async () => {
            await copyToClipboard(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-rail-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ProjectSettings({ project }: { project: ProjectResponse }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(project.name);
  const [confirm, setConfirm] = useState<null | "full-key" | "read-key" | "empty" | "delete">(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const update = useMutation({
    mutationFn: (changes: { name?: string; is_public?: boolean }) => projectsApi.update(project.id, changes),
    onSuccess: (_, changes) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["files", project.id] });
      showToast.success(
        changes.is_public === undefined ? "Project renamed" : changes.is_public ? "Project is now public" : "Project is now private"
      );
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't save the change")),
  });

  const regenerate = useMutation({
    mutationFn: (which: "full" | "read") =>
      which === "full" ? projectsApi.regenerateKey(project.id) : projectsApi.regenerateReadKey(project.id),
    onSuccess: (_, which) => {
      refresh();
      setConfirm(null);
      showToast.success(which === "full" ? "Upload key regenerated" : "Read-only key regenerated");
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't regenerate the key")),
  });

  const empty = useMutation({
    mutationFn: () => projectsApi.emptyProject(project.id),
    onSuccess: ({ data }) => {
      refresh();
      ["files", "stats", "recent"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setConfirm(null);
      showToast.success(`Deleted ${pluralize(data.deleted_count, "file")}`);
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't empty the project")),
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      ["projects", "stats", "recent"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      showToast.success(`Deleted ${project.name}`);
      router.push("/dashboard/projects");
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't delete the project")),
  });

  const { baseUrl } = getConfig();
  const uploadSnippet = `curl -X POST "${baseUrl}/api/upload" \\
  -H "X-API-Key: <upload key>" \\
  -F "folder_path=images" \\
  -F "file=@photo.jpg"`;
  const downloadSnippet = project.is_public
    ? `curl -O "${baseUrl}/api/files/<file id>"`
    : `curl -O "${baseUrl}/api/files/<file id>" \\
  -H "X-API-Key: <read-only key>"`;

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 sm:p-8">
      <Section title="Name" description="Shown across the dashboard. Renaming doesn't change any file links.">
        <form
          className="flex flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== project.name) update.mutate({ name: name.trim() });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" maxLength={255} />
          <Button type="submit" disabled={!name.trim() || name.trim() === project.name} loading={update.isPending && update.variables?.name !== undefined}>
            Save
          </Button>
        </form>
      </Section>

      <Section
        title="Public access"
        description="Public projects serve every file to anyone with its address. Private projects need a key or a link you share."
      >
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <span>
            <span className="block font-bold text-ink">{project.is_public ? "Public" : "Private"}</span>
            <span className="block text-[13px] text-ink-2">
              {project.is_public ? "Files open without a key." : "Files need a key or a shared link."}
            </span>
          </span>
          <Switch
            checked={project.is_public}
            disabled={update.isPending}
            onCheckedChange={(checked) => update.mutate({ is_public: checked })}
            aria-label="Public access"
          />
        </label>
      </Section>

      <Section
        title="Keys"
        description="Keep the upload key on your servers. The read-only key can only download, so it's safe in links and app front-ends."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          <KeyCard
            tone="full"
            label="Upload key"
            description="Uploads, downloads, and deletes files."
            value={project.api_key}
            onRegenerate={() => setConfirm("full-key")}
          />
          <KeyCard
            tone="read"
            label="Read-only key"
            description="Downloads files, nothing else."
            value={project.read_key}
            onRegenerate={() => setConfirm("read-key")}
          />
        </div>
      </Section>

      <Section title="Use from your app" description="Send the key in the X-API-Key header. Every upload returns the file's download path.">
        <div className="space-y-3">
          <CodeBlock title="Upload a file" code={uploadSnippet} />
          <CodeBlock title="Download a file" code={downloadSnippet} />
        </div>
      </Section>

      <Section title="Danger zone" description="These can't be undone." danger>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-bad/25 p-4">
            <p className="font-bold text-ink">Empty project</p>
            <p className="mt-1 text-[13px] text-ink-2">
              Delete all {pluralize(project.file_count ?? 0, "file")}. The project and its keys stay.
            </p>
            <Button variant="danger-soft" size="sm" className="mt-4" disabled={!project.file_count} onClick={() => setConfirm("empty")}>
              <Eraser />
              Empty project
            </Button>
          </div>
          <div className="rounded-2xl border border-bad/25 p-4">
            <p className="font-bold text-ink">Delete project</p>
            <p className="mt-1 text-[13px] text-ink-2">Removes the project, its keys, and every file in it.</p>
            <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirm("delete")}>
              <Trash2 />
              Delete project
            </Button>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={confirm === "full-key"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Regenerate the upload key?"
        description="The current key stops working immediately. Apps that upload or delete with it will fail until you give them the new one."
        actionLabel="Regenerate upload key"
        onConfirm={() => regenerate.mutate("full")}
        loading={regenerate.isPending}
        tone="default"
        icon={<KeyRound />}
      />
      <ConfirmDialog
        open={confirm === "read-key"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Regenerate the read-only key?"
        description="Links and apps using the current read-only key stop working immediately."
        actionLabel="Regenerate read-only key"
        onConfirm={() => regenerate.mutate("read")}
        loading={regenerate.isPending}
        tone="default"
        icon={<ShieldCheck />}
      />
      <ConfirmDialog
        open={confirm === "empty"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Empty ${project.name}?`}
        description={`All ${pluralize(project.file_count ?? 0, "file")} will be deleted for good, and their links will stop working.`}
        actionLabel="Delete all files"
        onConfirm={() => empty.mutate()}
        loading={empty.isPending}
        confirmText={project.name}
        icon={<Eraser />}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${project.name}?`}
        description="The project, both keys, and every file in it will be deleted for good."
        actionLabel="Delete project"
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        confirmText={project.name}
        icon={<Trash2 />}
      />
    </div>
  );
}
