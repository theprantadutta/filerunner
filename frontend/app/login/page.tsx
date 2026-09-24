"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { apiError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { AuthLayout } from "@/components/brand/AuthLayout";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.access_token, data.refresh_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 401
          ? "That email and password don't match an account."
          : status === 429
            ? "Too many attempts. Wait a few seconds and try again."
            : apiError(err, "Couldn't reach the server. Try again in a moment.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to manage your projects and files."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate={false}>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="h-12"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={error || undefined}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
          {!loading && <ArrowRight />}
        </Button>
      </form>
    </AuthLayout>
  );
}
