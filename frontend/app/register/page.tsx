"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { apiError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { AuthLayout } from "@/components/brand/AuthLayout";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rules = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: password.length > 0 && password === confirm, text: "Both passwords match" },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!rules.every((r) => r.met)) {
      setError(password.length < 8 ? "Use at least 8 characters." : "The passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register(email, password);
      setAuth(data.access_token, data.refresh_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 403
          ? "Sign-up is turned off on this server. Ask the administrator for an account."
          : apiError(err, "Couldn't create the account. Try again in a moment.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Projects, upload keys, and shareable links, on your own server."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className="h-12" />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-describedby="password-rules"
            className="h-12"
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={error || undefined}>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-12" />
        </Field>
        <ul id="password-rules" className="flex flex-wrap gap-2">
          {rules.map((rule) => (
            <li
              key={rule.text}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                rule.met ? "bg-good/10 text-good" : "bg-sunken text-ink-3"
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              {rule.text}
            </li>
          ))}
        </ul>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
          {!loading && <ArrowRight />}
        </Button>
      </form>
    </AuthLayout>
  );
}
