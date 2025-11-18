import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: 
          "bg-white text-primary hover:bg-primary/10 data-[state=on]:bg-gradient-to-r data-[state=on]:from-blue-500 data-[state=on]:to-indigo-600 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:scale-[1.02]",
        outline:
          "border-2 border-primary bg-transparent hover:border-primary/80 hover:bg-primary/5 data-[state=on]:bg-gradient-to-r data-[state=on]:from-blue-500 data-[state=on]:to-indigo-600 data-[state=on]:text-white data-[state=on]:border-transparent data-[state=on]:shadow-lg data-[state=on]:scale-[1.02]",
        ghost:
          "bg-transparent hover:bg-primary/10 data-[state=on]:bg-gradient-to-r data-[state=on]:from-blue-500/20 data-[state=on]:to-indigo-600/20 data-[state=on]:text-primary data-[state=on]:shadow-inner data-[state=on]:scale-[1.02]",
        modern:
          "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300 hover:from-slate-200 hover:to-slate-300 data-[state=on]:from-blue-500 data-[state=on]:to-indigo-600 data-[state=on]:text-white data-[state=on]:border-transparent data-[state=on]:shadow-lg data-[state=on]:scale-[1.03] data-[state=on]:font-bold",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 py-1.5",
        lg: "h-12 px-6 py-2.5",
      },
      shape: {
        default: "rounded-lg",
        pill: "rounded-full",
        square: "rounded-none",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default"
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant = "default", size = "default", shape = "default", ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, shape, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }