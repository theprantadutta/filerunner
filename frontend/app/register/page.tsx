"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRequirements = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: password === confirmPassword && password.length > 0, text: "Passwords match" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      showToast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register(email, password);
      const { access_token, refresh_token, user } = response.data;
      setAuth(access_token, refresh_token, user);
      showToast.success("Account created");
      router.push("/dashboard");
    } catch (err: any) {
      const message = err.response?.data?.error || "Registration failed";
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Set up an account to start creating projects and uploading files."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            visible={showPassword}
            onVisibleChange={setShowPassword}
            required
            aria-describedby="password-requirements"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-10"
          />
        </div>

        {/* Password requirements */}
        <ul id="password-requirements" className="space-y-1.5 pt-1">
          {passwordRequirements.map((req) => (
            <li
              key={req.text}
              className={cn(
                "flex items-center gap-2 text-[13px] transition-colors",
                req.met ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {req.met ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              ) : (
                <Circle className="h-4 w-4 text-border" />
              )}
              {req.text}
            </li>
          ))}
        </ul>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
