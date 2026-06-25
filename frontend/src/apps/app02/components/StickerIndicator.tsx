import React from "react";
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import type { FileReviewResult, AiReviewFindingApp02, StickerType } from "@/types";
import { computeSticker } from "../utils/stickers";

interface Props {
  result: FileReviewResult;
  aiFindings: AiReviewFindingApp02[];
  streamStatus?: "streaming" | "done" | "error";
  aiReviewing: boolean;
}

const StickerIndicator: React.FC<Props> = ({ result, aiFindings, streamStatus, aiReviewing }) => {
  if (aiReviewing) {
    if (streamStatus === "streaming") {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#1677ff",
              animation: "claude-dot-pulse 1.2s ease-in-out infinite, claude-ring-ripple 1.2s ease-out infinite",
            }}
          />
        </div>
      );
    }
    if (streamStatus === "done") {
      const sticker = computeSticker(result, aiFindings);
      return <StickerIcon type={sticker} />;
    }
    if (streamStatus === "error") {
      return <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />;
    }
    return <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #d9d9d9", margin: "0 auto" }} />;
  }

  if (aiFindings.length > 0) {
    const sticker = computeSticker(result, aiFindings);
    return <StickerIcon type={sticker} />;
  }

  const hasErrors = result.issues.some((i) => i.severity === "error");
  const hasFormatIssues = result.issues.some(
    (i) => ["字体偏离", "字号偏离", "对齐偏离", "字体过多"].includes(i.type),
  );
  if (hasErrors) return <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />;
  if (hasFormatIssues) return <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 18 }} />;
  return <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />;
};

function StickerIcon({ type }: { type: StickerType }) {
  switch (type) {
    case "pass":
      return <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 20 }} />;
    case "fail":
      return <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 20 }} />;
    case "ambiguous":
      return <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 20 }} />;
  }
}

export default StickerIndicator;
