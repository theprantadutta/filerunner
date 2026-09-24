"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Dialog, DialogActions, DialogContent, DialogHeader } from "@/components/ui/dialog";

/**
 * Confirmation for destructive or disruptive actions. With `confirmText`, the person must
 * type it (usually the project name) before the action unlocks.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onConfirm,
  loading,
  tone = "danger",
  confirmText,
  icon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  tone?: "danger" | "default";
  confirmText?: string;
  icon?: React.ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const locked = confirmText !== undefined && typed !== confirmText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader icon={icon ?? <AlertTriangle />} title={title} description={description} tone={tone} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked) onConfirm();
          }}
        >
          {confirmText !== undefined && (
            <Field
              label={`Type ${confirmText} to confirm`}
              htmlFor="confirm-text"
            >
              <Input
                id="confirm-text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
                className="font-mono text-sm"
              />
            </Field>
          )}
          <DialogActions>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} disabled={locked} loading={loading}>
              {actionLabel}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
