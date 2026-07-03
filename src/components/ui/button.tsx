import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// "Candy" buttons: pill shape, chunky ink border, hard offset shadow that
// lifts on hover and presses flat on click (motion-safe only).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full text-sm font-bold whitespace-nowrap transition-bouncy outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-2 border-foreground bg-primary text-primary-foreground shadow-pop motion-safe:hover:-translate-x-0.5 motion-safe:hover:-translate-y-0.5 hover:shadow-pop-lg motion-safe:active:translate-x-0.5 motion-safe:active:translate-y-0.5 active:shadow-pop-sm",
        secondary:
          "border-2 border-foreground bg-secondary text-secondary-foreground shadow-pop motion-safe:hover:-translate-x-0.5 motion-safe:hover:-translate-y-0.5 hover:shadow-pop-lg motion-safe:active:translate-x-0.5 motion-safe:active:translate-y-0.5 active:shadow-pop-sm",
        outline:
          "border-2 border-foreground bg-card text-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "border-2 border-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "border-2 border-destructive bg-card text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-1.5 px-5",
        xs: "h-7 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-7 text-base",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
