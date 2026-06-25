import type { FileReviewResult, AiReviewFindingApp02, StickerType } from "@/types";

export function computeSticker(
  _result: FileReviewResult,
  aiFindings: AiReviewFindingApp02[],
): StickerType {
  if (aiFindings.length === 0) return "pass";

  const hasErrors = aiFindings.some((f) => f.severity === "error");
  if (hasErrors) return "fail";

  return "ambiguous";
}

export function getStickerCounts(
  results: FileReviewResult[],
  aiFindingsMap: Record<string, AiReviewFindingApp02[]>,
) {
  let pass = 0, fail = 0, ambiguous = 0;
  for (const r of results) {
    const sticker = computeSticker(r, aiFindingsMap[r.file_id] || []);
    if (sticker === "pass") pass++;
    else if (sticker === "fail") fail++;
    else ambiguous++;
  }
  return { pass, fail, ambiguous };
}
