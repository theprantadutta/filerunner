import { cn } from "@/lib/utils";

/** Loading placeholder with a slow sheen */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shine rounded-lg bg-[linear-gradient(90deg,rgb(var(--sunken))_0%,rgb(var(--line))_50%,rgb(var(--sunken))_100%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
