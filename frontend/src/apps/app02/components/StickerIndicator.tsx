import React from "react"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import type { FileReviewResult, AiReviewFindingApp02, StickerType } from "@/types"
import { computeSticker } from "../utils/stickers"

interface Props {
  result: FileReviewResult
  aiFindings: AiReviewFindingApp02[]
  streamStatus?: "streaming" | "done" | "error"
  aiReviewing: boolean
}

const StickerIndicator: React.FC<Props> = ({ result, aiFindings, streamStatus, aiReviewing }) => {
  if (aiReviewing) {
    if (streamStatus === "streaming") {
      return (
        <div className="flex items-center justify-center w-8 h-8">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        </div>
      )
    }
    if (streamStatus === "done") {
      const sticker = computeSticker(result, aiFindings)
      return <StickerIcon type={sticker} />
    }
    if (streamStatus === "error") {
      return <XCircle className="h-5 w-5 text-destructive" />
    }
    return <div className="w-3 h-3 rounded-full border-2 border-border mx-auto" />
  }

  if (aiFindings.length > 0) {
    const sticker = computeSticker(result, aiFindings)
    return <StickerIcon type={sticker} />
  }

  const hasErrors = result.issues.some((i) => i.severity === "error")
  const hasFormatIssues = result.issues.some(
    (i) => ["字体偏离", "字号偏离", "对齐偏离", "字体过多"].includes(i.type),
  )
  if (hasErrors) return <XCircle className="h-5 w-5 text-destructive" />
  if (hasFormatIssues) return <AlertTriangle className="h-5 w-5 text-warning" />
  return <CheckCircle2 className="h-5 w-5 text-success" />
}

function StickerIcon({ type }: { type: StickerType }) {
  switch (type) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-success" />
    case "fail":
      return <XCircle className="h-5 w-5 text-destructive" />
    case "ambiguous":
      return <AlertTriangle className="h-5 w-5 text-warning" />
  }
}

export default StickerIndicator