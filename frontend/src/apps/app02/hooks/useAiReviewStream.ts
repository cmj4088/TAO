import { useState, useEffect, useRef, useCallback } from "react";
import type { AiReviewFindingApp02, SseTokenEvent, SseReasoningEvent, SseFileDoneEvent, SseFileErrorEvent } from "@/types";

export interface StreamState {
  streamingTexts: Record<string, string>;
  streamReasonings: Record<string, string>;
  streamFindings: Record<string, AiReviewFindingApp02[]>;
  streamExtractedInfo: Record<string, { teacher?: string | null; course?: string | null; class_name?: string | null }>;
  streamStatus: Record<string, "streaming" | "done" | "error">;
  streamPhase: Record<string, "reasoning" | "answering" | "done" | "error">;
  allDone: boolean;
}

const API_BASE = "http://10.50.150.176:8006";

export function useAiReviewStream(taskId: string | null) {
  const [state, setState] = useState<StreamState>({
    streamingTexts: {},
    streamReasonings: {},
    streamFindings: {},
    streamExtractedInfo: {},
    streamStatus: {},
    streamPhase: {},
    allDone: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!taskId) return;

    const url = `${API_BASE}/api/app02/ai-review/stream/${taskId}`;
    const es = new EventSource(url);

    es.addEventListener("reasoning", (e: MessageEvent) => {
      const data: SseReasoningEvent = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        streamReasonings: {
          ...prev.streamReasonings,
          [data.file_id]: (prev.streamReasonings[data.file_id] || "") + data.content,
        },
        streamPhase: { ...prev.streamPhase, [data.file_id]: "reasoning" },
      }));
    });

    es.addEventListener("token", (e: MessageEvent) => {
      const data: SseTokenEvent = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        streamingTexts: {
          ...prev.streamingTexts,
          [data.file_id]: (prev.streamingTexts[data.file_id] || "") + data.content,
        },
        streamPhase: { ...prev.streamPhase, [data.file_id]: "answering" },
        streamStatus: { ...prev.streamStatus, [data.file_id]: "streaming" },
      }));
    });

    es.addEventListener("file_done", (e: MessageEvent) => {
      const data: SseFileDoneEvent = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        streamFindings: { ...prev.streamFindings, [data.file_id]: data.findings },
        streamExtractedInfo: { ...prev.streamExtractedInfo, [data.file_id]: data.extracted_info },
        streamStatus: { ...prev.streamStatus, [data.file_id]: "done" },
        streamPhase: { ...prev.streamPhase, [data.file_id]: "done" },
      }));
    });

    es.addEventListener("file_error", (e: MessageEvent) => {
      const data: SseFileErrorEvent = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        streamStatus: { ...prev.streamStatus, [data.file_id]: "error" },
        streamPhase: { ...prev.streamPhase, [data.file_id]: "error" },
      }));
    });

    es.addEventListener("task_done", () => {
      setState((prev) => ({ ...prev, allDone: true }));
      es.close();
    });

    es.onerror = () => {
      if (stateRef.current.allDone) es.close();
    };

    return () => es.close();
  }, [taskId]);

  const reset = useCallback(() => {
    setState({
      streamingTexts: {},
      streamReasonings: {},
      streamFindings: {},
      streamExtractedInfo: {},
      streamStatus: {},
      streamPhase: {},
      allDone: false,
    });
  }, []);

  return { ...state, reset };
}
