"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, LayoutGrid, Boxes, Moon, Plus, Search, Sun, UserRound } from "lucide-react";
import { projectsApi, filesApi } from "@/lib/api";
import { useProjectTone } from "@/lib/spectrum";
import { useUi } from "@/lib/ui-store";
import { FileThumb } from "@/components/files/FileThumb";
import { formatBytes } from "@/lib/utils";

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink data-[selected=true]:bg-sunken [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-ink-3";

/** Ctrl/Cmd+K: jump to any project or recent file, or run an action */
export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { commandOpen, setCommandOpen, setNewProjectOpen } = useUi();
  const projectTone = useProjectTone();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useUi.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await projectsApi.list()).data,
    enabled: commandOpen,
  });
  const { data: recent } = useQuery({
    queryKey: ["recent", 8],
    queryFn: async () => (await filesApi.recent(8)).data,
    enabled: commandOpen,
  });

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-rail/55 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12dvh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search projects and recent files, or run an action
          </DialogPrimitive.Description>
          <Command label="Search" className="flex max-h-[70dvh] flex-col">
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="h-5 w-5 shrink-0 text-ink-3" />
              <Command.Input
                autoFocus
                placeholder="Search projects, files, and actions"
                className="h-16 w-full bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3"
              />
            </div>
            <Command.List className="overflow-y-auto p-2.5">
              <Command.Empty className="px-4 py-10 text-center text-[15px] text-ink-3">
                Nothing matches. Try a project or file name.
              </Command.Empty>

              {projects && projects.length > 0 && (
                <Command.Group heading="Projects" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  {projects.map((p) => (
                    <Command.Item key={p.id} value={`project ${p.name}`} onSelect={() => go(`/dashboard/projects/${p.id}`)} className={itemClass}>
                      <span style={projectTone(p.id)} className="tone-solid h-7 w-7 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs tabular text-ink-3">{(p.file_count ?? 0).toLocaleString()} files</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {recent && recent.length > 0 && (
                <Command.Group heading="Recent files" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  {recent.map((f) => (
                    <Command.Item
                      key={f.id}
                      value={`file ${f.original_name} ${f.project_name}`}
                      onSelect={() => go(`/dashboard/projects/${f.project_id}?file=${f.id}`)}
                      className={itemClass}
                    >
                      <FileThumb file={f} size="sm" className="!h-7 !w-7 !rounded-lg" />
                      <span className="min-w-0 flex-1 truncate">{f.original_name}</span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {f.project_name}, {formatBytes(f.size)}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                <Command.Item value="new project create" onSelect={() => { setCommandOpen(false); setNewProjectOpen(true); }} className={itemClass}>
                  <Plus />
                  New project
                </Command.Item>
                <Command.Item value="overview home dashboard" onSelect={() => go("/dashboard")} className={itemClass}>
                  <LayoutGrid />
                  Go to overview
                </Command.Item>
                <Command.Item value="all projects" onSelect={() => go("/dashboard/projects")} className={itemClass}>
                  <Boxes />
                  Go to projects
                </Command.Item>
                <Command.Item value="account settings password" onSelect={() => go("/dashboard/account")} className={itemClass}>
                  <UserRound />
                  Account settings
                </Command.Item>
                <Command.Item
                  value="theme dark light mode"
                  onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setCommandOpen(false); }}
                  className={itemClass}
                >
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                  Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs font-medium text-ink-3">
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="h-3.5 w-3.5" /> to open
              </span>
              <span>Esc to close</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
