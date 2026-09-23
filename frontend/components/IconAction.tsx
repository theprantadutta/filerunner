"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IconActionProps extends ButtonProps {
  label: string;
}

/** Icon-only button that always carries an accessible name and a tooltip */
export const IconAction = React.forwardRef<HTMLButtonElement, IconActionProps>(
  ({ label, className, variant = "ghost", children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant={variant}
          size="icon"
          aria-label={label}
          className={cn("h-8 w-8 [&_svg]:h-4 [&_svg]:w-4", className)}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
);
IconAction.displayName = "IconAction";
