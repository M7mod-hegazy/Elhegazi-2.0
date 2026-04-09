import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'gradient'
  size?: 'sm' | 'default' | 'lg'
  showIcon?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, variant = 'default', size = 'default', showIcon = false, ...props }, ref) => {
  const variantClasses = {
    // Keep API compatibility while aligning all switches to theme colors.
    default: 'data-[state=checked]:bg-primary',
    success: 'data-[state=checked]:bg-primary',
    warning: 'data-[state=checked]:bg-primary',
    danger: 'data-[state=checked]:bg-primary',
    purple: 'data-[state=checked]:bg-primary',
    gradient: 'data-[state=checked]:bg-primary'
  }

  const sizeClasses = {
    sm: 'h-5 w-9',
    default: 'h-6 w-11',
    lg: 'h-7 w-14'
  }

  const thumbSizeClasses = {
    sm: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
    default: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
    lg: 'h-6 w-6 data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0'
  }

  return (
    <SwitchPrimitives.Root
      dir="ltr"
      className={cn(
        "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-muted/80 data-[state=unchecked]:border-border/80 data-[state=unchecked]:shadow-inner",
        "data-[state=checked]:border-primary/80 data-[state=checked]:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_6px_16px_hsl(var(--primary)/0.28)]",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none relative block rounded-full border border-border/50 bg-background shadow-sm transition-all duration-200 ease-out",
          "data-[state=checked]:bg-primary-foreground data-[state=checked]:border-primary-foreground/60",
          "data-[state=unchecked]:translate-x-0",
          thumbSizeClasses[size]
        )}
      >
        {showIcon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 data-[state=checked]:opacity-100 transition-opacity duration-150">
            <svg className="w-2.5 h-2.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
