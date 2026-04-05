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
    default: 'data-[state=checked]:bg-primary',
    success: 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500',
    warning: 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-500',
    danger: 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-rose-500',
    purple: 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-violet-500',
    gradient: 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-purple-600'
  }

  const sizeClasses = {
    sm: 'h-5 w-9',
    default: 'h-7 w-12',
    lg: 'h-9 w-16'
  }

  const thumbSizeClasses = {
    sm: 'h-4 w-4 data-[state=checked]:translate-x-4',
    default: 'h-5 w-5 data-[state=checked]:translate-x-6',
    lg: 'h-7 w-7 data-[state=checked]:translate-x-8'
  }

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-slate-200/80 data-[state=unchecked]:hover:bg-slate-300/90 data-[state=unchecked]:border-slate-300/50",
        "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/30 data-[state=checked]:border-white/20",
        "hover:scale-105 active:scale-95",
        "data-[state=checked]:ring-2 data-[state=checked]:ring-primary/20",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
      ref={ref}
    >
      {/* Background glow effect */}
      <div className={cn(
        "absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 blur-sm",
        "data-[state=checked]:opacity-40",
        variant === 'default' && "data-[state=checked]:bg-primary",
        variant === 'success' && "data-[state=checked]:bg-green-500",
        variant === 'warning' && "data-[state=checked]:bg-amber-500",
        variant === 'danger' && "data-[state=checked]:bg-red-500",
        variant === 'purple' && "data-[state=checked]:bg-purple-500",
        variant === 'gradient' && "data-[state=checked]:bg-primary"
      )} />
      
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none relative block rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-out data-[state=unchecked]:translate-x-0.5",
          "data-[state=checked]:shadow-xl data-[state=checked]:ring-2 data-[state=checked]:ring-white/50",
          thumbSizeClasses[size]
        )}
      >
        {/* Check icon for checked state */}
        {showIcon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 data-[state=checked]:opacity-100 transition-opacity duration-200">
            <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </SwitchPrimitives.Thumb>
      
      {/* Animated pulse ring on check */}
      <div className={cn(
        "absolute inset-0 rounded-full opacity-0 transition-all duration-500",
        "data-[state=checked]:opacity-100 data-[state=checked]:animate-pulse",
        "ring-2 ring-white/30"
      )} />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
