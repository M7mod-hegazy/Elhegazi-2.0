import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={3000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <ToastWithProgress key={id} id={id} title={title} description={description} action={action} {...props} />
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

function ToastWithProgress({ id, title, description, action, ...props }: any) {
  const [progress, setProgress] = useState(100)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return

    const duration = 3000 // 3 seconds
    const interval = 10 // Update every 10ms
    const decrement = (100 / duration) * interval

    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - decrement
        return newProgress <= 0 ? 0 : newProgress
      })
    }, interval)

    return () => clearInterval(timer)
  }, [isPaused])

  return (
    <Toast
      {...props}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden"
    >
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose />
      
      {/* Themed Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </Toast>
  )
}
