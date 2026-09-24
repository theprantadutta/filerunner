"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, CloudUpload, FolderPlus, Link2, Plus, Search, Sparkles, UploadCloud } from "lucide-react";
import { filesApi, projectsApi, statsApi } from "@/lib/api";
import { type FileCategory, useProjectTone } from "@/lib/spectrum";
import { useUi } from "@/lib/ui-store";
import { useAuthStore } from "@/lib/store";
import { formatBytes, greeting, pluralize, timeAgo } from "@/lib/utils";
import { Page, PageHeader, Panel } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyPanel, ErrorPanel } from "@/components/states";
import { ProjectTile, ProjectTileSkeleton } from "@/components/projects/ProjectTile";
import { FileThumb } from "@/components/files/FileThumb";
import { TypeDonut } from "@/components/charts/TypeDonut";
import { UploadColumns } from "@/components/charts/UploadColumns";

function FirstRun() {
  const setNewProjectOpen = useUi((s) => s.setNewProjectOpen);
  const steps = [
    { icon: FolderPlus, title: "Create a project", body: "Each one gets its own upload key and access setting.", slot: 1 },
    { icon: UploadCloud, title: "Add files", body: "Drop them in the browser or send them from your app.", slot: 2 },
    { icon: Link2, title: "Share links", body: "Serve files publicly, or with a read-only key.", slot: 3 },
  ];
  return (
    <div className="mt-10 overflow-hidden rounded-3xl bg-rail p-6 text-rail-ink sm:p-10">
      <Sparkles className="h-7 w-7 text-c4" />
      <h2 className="mt-4 max-w-lg font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
        Your file space is ready. Start with a project.
      </h2>
      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl bg-white/[0.06] p-5">
            <div className="flex items-center gap-3">
              <span className="font-display text-sm font-bold text-rail-muted">{i + 1}</span>
              <step.icon className="h-5 w-5" style={{ color: `rgb(var(--c${step.slot}))` }} />
            </div>
            <p className="mt-4 font-bold text-white">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-rail-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <Button variant="brand" size="lg" className="mt-8" onClick={() => setNewProjectOpen(true)}>
        <Plus />
        Create your first project
      </Button>
    </div>
  );
}

export default function OverviewPage() {
  const projectTone = useProjectTone();
  const user = useAuthStore((s) => s.user);
  const { setCommandOpen, setNewProjectOpen } = useUi();

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await projectsApi.list()).data,
  });
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => (await statsApi.get()).data,
  });
  const recent = useQuery({
    queryKey: ["recent", 12],
    queryFn: async () => (await filesApi.recent(12)).data,
  });

  const name = user?.email?.split("@")[0];
  const list = projects.data ?? [];
  const largest = Math.max(0, ...list.map((p) => p.total_size ?? 0));
  const featured = [...list].sort((a, b) => (b.total_size ?? 0) - (a.total_size ?? 0)).slice(0, 6);
  const s = stats.data;

  return (
    <Page>
      <PageHeader
        kicker={`${greeting()}${name ? `, ${name}` : ""}`}
        title={
          s ? (
            <>
              {formatBytes(s.total_size)} <span className="text-ink-3">across</span>{" "}
              {pluralize(s.total_projects, "project")}
            </>
          ) : stats.isLoading ? (
            <Skeleton className="h-12 w-80 max-w-full" />
          ) : (
            "Overview"
          )
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setCommandOpen(true)} className="max-sm:hidden">
              <Search />
              Search
              <kbd className="ml-1 rounded-md bg-sunken px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-3">Ctrl K</kbd>
            </Button>
            <Button onClick={() => setNewProjectOpen(true)} className="max-lg:hidden">
              <Plus />
              New project
            </Button>
          </>
        }
      />

      {projects.isError ? (
        <ErrorPanel
          icon={Boxes}
          title="Couldn't load your projects"
          error={projects.error}
          onRetry={() => projects.refetch()}
          retrying={projects.isRefetching}
          className="mt-10 rounded-3xl border border-line bg-surface"
        />
      ) : !projects.isLoading && list.length === 0 ? (
        <FirstRun />
      ) : (
        <>
          {/* Charts */}
          <div className="mt-8 grid gap-4 lg:grid-cols-12">
            <Panel title="Uploads" className="lg:col-span-7">
              {s ? <UploadColumns data={s.daily_uploads} /> : <Skeleton className="h-[220px] w-full" />}
            </Panel>
            <Panel title="Storage by file type" className="lg:col-span-5">
              {s ? (
                s.total_size > 0 ? (
                  <TypeDonut
                    total={s.total_size}
                    data={s.by_category.map((c) => ({ ...c, category: c.category as FileCategory }))}
                  />
                ) : (
                  <EmptyPanel
                    icon={CloudUpload}
                    title="Nothing stored yet"
                    description="Upload files to a project to see how your storage splits up."
                    className="py-6"
                  />
                )
              ) : (
                <Skeleton className="h-[220px] w-full" />
              )}
            </Panel>
          </div>

          {/* Projects */}
          <section className="mt-10" aria-labelledby="projects-heading">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="projects-heading" className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
                Projects
              </h2>
              {list.length > 0 && (
                <Link href="/dashboard/projects" className="group flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
                  All {list.length}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.isLoading
                ? [0, 1, 2].map((i) => <ProjectTileSkeleton key={i} />)
                : featured.map((p, i) => <ProjectTile key={p.id} project={p} largestSize={largest} index={i} />)}
            </div>
          </section>

          {/* Recent uploads */}
          <section className="mt-10" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="mb-4 font-display text-2xl font-bold tracking-[-0.03em] text-ink">
              Recently uploaded
            </h2>
            {recent.isLoading ? (
              <div className="flex gap-3 overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[196px] w-[168px] shrink-0 rounded-3xl" />
                ))}
              </div>
            ) : recent.data && recent.data.length > 0 ? (
              <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                {recent.data.map((f, i) => (
                  <li key={f.id} className="shrink-0 snap-start animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
                    <Link
                      href={`/dashboard/projects/${f.project_id}?file=${f.id}`}
                      className="group block w-[168px] overflow-hidden rounded-3xl border border-line bg-surface transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <div className="h-[112px]">
                        <FileThumb file={f} size="fill" />
                      </div>
                      <div className="p-3.5">
                        <p className="truncate text-sm font-semibold text-ink" title={f.original_name}>
                          {f.original_name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                          <span style={projectTone(f.project_id)} className="tone-solid h-2 w-2 shrink-0 rounded-full" />
                          <span className="truncate">{f.project_name}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-3">{timeAgo(f.upload_date)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center text-[15px] text-ink-2">
                Files you upload will show up here.
              </p>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
