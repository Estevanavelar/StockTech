import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollingTextProps {
  text: string
  className?: string
  containerClassName?: string
}

export function ScrollingText({ text, className, containerClassName }: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [duration, setDuration] = useState(10)

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.clientWidth
        // We measure the first child only to get the original text width
        const firstChild = textRef.current.firstChild as HTMLElement
        if (firstChild) {
          const textWidth = firstChild.offsetWidth
          const isOverflowing = textWidth > containerWidth
          setShouldScroll(isOverflowing)
          if (isOverflowing) {
            // Speed: approx 40px per second
            setDuration(textWidth / 40)
          }
        }
      }
    }

    const timer = setTimeout(checkOverflow, 100)
    window.addEventListener('resize', checkOverflow)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [text])

  return (
    <div 
      ref={containerRef} 
      className={cn("overflow-hidden whitespace-nowrap", containerClassName)}
    >
      <div
        ref={textRef}
        className={cn(
          "inline-flex w-max",
          shouldScroll && "animate-marquee"
        )}
        style={shouldScroll ? { animationDuration: `${duration}s` } : undefined}
      >
        <span className={cn("inline-block", shouldScroll && "pr-12", className)}>{text}</span>
        {shouldScroll && (
          <span className={cn("inline-block pr-12", className)} aria-hidden="true">
            {text}
          </span>
        )}
      </div>
    </div>
  )
}
