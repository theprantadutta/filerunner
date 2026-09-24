"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Globe2, KeyRound, LockKeyhole } from "lucide-react";
import { authApi, projectsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { showToast } from "@/lib/toast";
import { apiError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { Dialog, DialogActions, DialogContent, DialogHeader } from "@/components/ui/dialog";

/** Two large choices for who can open a project's files */
export function VisibilityPicker({
  isPublic,
  onChange,
}: {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}) {
  const option = (value: boolean, Icon: typeof Globe2, title: string, body: string) => (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/20",
        isPublic === value ? "border-brand bg-brand-soft/60" : "border-line hover:border-line-strong"
      )}
    >
      <input
        type="radio"
        name="visibility"
        className="sr-only"
        checked={isPublic === value}
        onChange={() => onChange(value)}
      />
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          isPublic === value ? "bg-brand text-white" : "bg-sunken text-ink-2"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-bold text-ink">{title}</span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-2">{body}</span>
      </span>
    </label>
  );

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">Who can open files</legend>
      <div className="grid grid-cols-2 gap-3">
        {option(false, LockKeyhole, "Private", "Only with a key or a link you share.")}
        {option(true, Globe2, "Public", "Anyone with a file's address.")}
      </div>
    </fieldset>
  );
}

export function NewProjectDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { newProjectOpen, setNewProjectOpen } = useUi();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const create = useMutation({
    mutationFn: () => projectsApi.create(name.trim(), isPublic),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      showToast.success(`Created ${data.name}`);
      close();
      router.push(`/dashboard/projects/${data.id}`);
    },
    onError: (error) => showToast.error(apiError(error, "Couldn't create the project")),
  });

  const close = () => {
    setNewProjectOpen(false);
    setName("");
    setIsPublic(false);
  };

  return (
    <Dialog open={newProjectOpen} onOpenChange={(open) => (open ? setNewProjectOpen(true) : close())}>
      <DialogContent>
        <DialogHeader
          icon={<FolderPlus />}
          title="New project"
          description="A project keeps its own files, access setting, and upload key."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="space-y-6"
        >
          <Field label="Name" htmlFor="new-project-name">
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. marketing-site"
              autoComplete="off"
              autoFocus
              maxLength={255}
            />
          </Field>
          <VisibilityPicker isPublic={isPublic} onChange={setIsPublic} />
          <DialogActions className="mt-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()} loading={create.isPending}>
              Create project
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Change password form, shared by the dialog and the account page */
export function PasswordForm({ onDone, submitLabel = "Change password" }: { onDone?: () => void; submitLabel?: string }) {
  const queryClient = useQueryClient();
  const { setTokens, clearMustChangePassword } = useAuthStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: ({ data }) => {
      // The server revokes every session and returns a fresh one for this tab
      setTokens(data.access_token, data.refresh_token);
      clearMustChangePassword();
      queryClient.invalidateQueries();
      setCurrent("");
      setNext("");
      setConfirm("");
      showToast.success("Password changed");
      onDone?.();
    },
    onError: (e) => setError(apiError(e, "Couldn't change the password")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError("Choose a password different from the current one.");
    change.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Current password" htmlFor="pw-current">
        <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 8 characters.">
        <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm" error={error || undefined}>
        <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full sm:w-auto" loading={change.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Voluntary change from the account menu, or the forced one for temporary passwords */
export function PasswordDialog() {
  const user = useAuthStore((s) => s.user);
  const { passwordOpen, setPasswordOpen } = useUi();
  const forced = !!user?.must_change_password;

  return (
    <Dialog open={forced || passwordOpen} onOpenChange={(open) => !forced && setPasswordOpen(open)}>
      <DialogContent
        hideClose={forced}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
        onPointerDownOutside={(e) => forced && e.preventDefault()}
      >
        <DialogHeader
          icon={<KeyRound />}
          title={forced ? "Choose your own password" : "Change password"}
          description={
            forced
              ? "This account is using a temporary password. Set a new one to start using FileRunner."
              : "You'll stay signed in here. Other devices will be signed out."
          }
        />
        <PasswordForm
          key={forced ? "forced" : "voluntary"}
          submitLabel={forced ? "Save password" : "Change password"}
          onDone={() => setPasswordOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
