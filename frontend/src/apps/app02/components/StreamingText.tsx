import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface Props {
  text: string
  expanded: boolean
  onToggleExpand: () => void
  isStreaming: boolean
  label: string
  variant: "reasoning" | "answer"
}

const StreamingText: React.FC<Props> = ({ text, expanded, onToggleExpand, isStreaming, label, variant }) => {
  const [visibleLen, setVisibleLen] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const targetLenRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  targetLenRef.current = text.length

  useEffect(() => {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      setVisibleLen((prev) => {
        const target = targetLenRef.current
        if (prev >= target) return prev
        return prev + 1
      })
    }, 30)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleLen])

  const isReasoning = variant === "reasoning"

  if (!text) {
    return (
      <div className={cn(
        "mt-1.5 px-2.5 py-1.5 rounded-md border border-border",
        isReasoning ? "bg-muted/50" : "bg-card",
      )}>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    )
  }

  const displayText = text.slice(0, visibleLen)
  const showExpand = text.length > 150

  return (
    <div className={cn(
      "mt-1.5 rounded-md border border-border",
      isReasoning ? "bg-muted/50" : "bg-card",
    )}>
      <div
        onClick={onToggleExpand}
        className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer select-none"
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        {showExpand && (
          <span className="text-xs text-muted-foreground">
            {expanded ? "收起 ▲" : "展开 ▼"}
          </span>
        )}
      </div>
      {expanded && (
        <div
          ref={scrollRef}
          className={cn(
            "text-xs px-2.5 pb-2.5 max-h-[250px] overflow-auto whitespace-pre-wrap break-words leading-relaxed",
            isReasoning ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {displayText}
        </div>
      )}
    </div>
  )
}

export default StreamingText