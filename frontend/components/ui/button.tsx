import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-canvas hover:bg-ink/85",
        brand: "bg-brand text-brand-ink hover:bg-brand/90",
        soft: "bg-sunken text-ink hover:bg-line",
        outline: "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
        danger: "bg-bad text-white hover:bg-bad/90",
        "danger-soft": "bg-bad/10 text-bad hover:bg-bad/15",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5",
        md: "h-10 px-4 text-sm [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:h-[18px] [&_svg]:w-[18px]",
        icon: "h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        "icon-sm": "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
