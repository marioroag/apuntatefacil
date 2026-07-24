import { useLayoutEffect, type ComponentPropsWithoutRef } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

let mountedBoundaries = 0

export function AppThemeBoundary({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) {
  useLayoutEffect(() => {
    mountedBoundaries += 1
    document.documentElement.classList.add('app-ui')

    return () => {
      mountedBoundaries = Math.max(0, mountedBoundaries - 1)
      if (mountedBoundaries === 0) document.documentElement.classList.remove('app-ui')
    }
  }, [])

  return (
    <TooltipProvider>
      <div className={cn('app-ui', className)} {...props}>
        {children}
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
