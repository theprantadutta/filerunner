import { LogoMark } from "./Logo";

/** Shown for the moment it takes to load runtime config */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status" aria-label="Loading">
      <LogoMark className="h-12 w-12 animate-pulse" />
    </div>
  );
}
