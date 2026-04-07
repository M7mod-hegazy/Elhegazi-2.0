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
    default: 'data-[state=checked]:bg-primary/90 data-[state=checked]:border-primary',
    success: 'data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600',
    warning: 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-600',
    danger: 'data-[state=checked]:bg-red-500 data-[state=checked]:border-red-600',
    purple: 'data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-600',
    gradient: 'data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-600'
  }

  const sizeClasses = {
    sm: 'h-5 w-9',
    default: 'h-6 w-11',
    lg: 'h-8 w-14'
  }

  const thumbSizeClasses = {
    sm: 'h-4 w-4 data-[state=checked]:translate-x-[18px]',
    default: 'h-5 w-5 data-[state=checked]:translate-x-[22px]',
    lg: 'h-7 w-7 data-[state=checked]:translate-x-[26px]'
  }

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-slate-100 data-[state=unchecked]:border-slate-300",
        "data-[state=checked]:shadow-sm",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none relative block rounded-full bg-white shadow transition-transform duration-200 ease-out",
          "data-[state=unchecked]:translate-x-[2px]",
          thumbSizeClasses[size]
        )}
      >
        {showIcon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 data-[state=checked]:opacity-100 transition-opacity duration-150">
            <svg className="w-2.5 h-2.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
