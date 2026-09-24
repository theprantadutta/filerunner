"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Moon, ShieldAlert, Sun } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { apiError, formatDate, pluralize } from "@/lib/utils";
import { Page, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PasswordForm } from "@/components/shell/Dialogs";

function Block({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
      <div className="min-w-0 max-w-lg">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const [confirmAll, setConfirmAll] = useState(false);

  const signOutEverywhere = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: ({ data }) => {
      logout();
      queryClient.clear();
      showToast.success(`Signed out of ${pluralize(data.revoked_count, "session")}`);
      router.push("/login");
    },
    onError: (e) => showToast.error(apiError(e, "Couldn't sign out other sessions")),
  });

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <Page>
      <PageHeader title="Account" description="Your sign-in details and how FileRunner looks on this device." />

      <div className="mt-8 flex items-center gap-4 rounded-3xl bg-rail p-5 text-rail-ink sm:p-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-c1 to-c7 font-display text-2xl font-bold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-white">{user?.email}</p>
          <p className="mt-0.5 text-sm capitalize text-rail-muted">
            {user?.role}
            {user?.created_at ? `, member since ${formatDate(user.created_at)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-8">
        <Block title="Password" description="Changing it signs you out on every other device. You stay signed in here.">
          <PasswordForm />
        </Block>

        <Block title="Appearance" description="Saved on this device only.">
          <Segmented
            label="Theme"
            value={(theme as "light" | "dark" | "system") ?? "system"}
            onChange={setTheme}
            options={[
              { value: "light", label: <><Sun />Light</> },
              { value: "dark", label: <><Moon />Dark</> },
              { value: "system", label: <><Monitor />System</> },
            ]}
          />
        </Block>

        <Block
          title="Sessions"
          description="Signed in somewhere you don't recognise? End every session, including this one."
        >
          <Button variant="danger-soft" onClick={() => setConfirmAll(true)}>
            <LogOut />
            Sign out everywhere
          </Button>
        </Block>
      </div>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out everywhere?"
        description="Every device, including this one, will need to sign in again."
        actionLabel="Sign out everywhere"
        onConfirm={() => signOutEverywhere.mutate()}
        loading={signOutEverywhere.isPending}
        icon={<ShieldAlert />}
      />
    </Page>
  );
}
