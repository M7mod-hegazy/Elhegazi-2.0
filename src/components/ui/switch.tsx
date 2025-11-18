import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple'
  size?: 'sm' | 'default' | 'lg'
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const variantClasses = {
    default: 'data-[state=checked]:bg-primary',
    success: 'data-[state=checked]:bg-green-500',
    warning: 'data-[state=checked]:bg-amber-500',
    danger: 'data-[state=checked]:bg-red-500',
    purple: 'data-[state=checked]:bg-purple-500'
  }

  const sizeClasses = {
    sm: 'h-4 w-7',
    default: 'h-6 w-11',
    lg: 'h-8 w-14'
  }

  const thumbSizeClasses = {
    sm: 'h-3 w-3 data-[state=checked]:translate-x-3',
    default: 'h-5 w-5 data-[state=checked]:translate-x-5',
    lg: 'h-6 w-6 data-[state=checked]:translate-x-6'
  }

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-slate-200 data-[state=unchecked]:hover:bg-slate-300",
        "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/25",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-in-out data-[state=unchecked]:translate-x-0",
          "data-[state=checked]:shadow-xl",
          thumbSizeClasses[size]
        )}
      />
      {/* Animated indicator dot */}
      <div className={cn(
        "absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-300",
        "data-[state=checked]:opacity-100 data-[state=checked]:animate-ping"
      )} />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
