import { useState, useEffect, useRef, useCallback } from "react";
import type { AiReviewFindingApp02, SseTokenEvent, SseReasoningEvent, SseFileDoneEvent, SseFileErrorEvent } from "@/types";
import { API_BASE } from "@/api/client";

export interface StreamState {
  streamingTexts: Record<string, string>;
  streamReasonings: Record<string, string>;
  streamFindings: Record<string, AiReviewFindingApp02[]>;
  streamExtractedInfo: Record<string, { teacher?: string | null; course?: string | null; class_name?: string | null }>;
  streamStatus: Record<string, "streaming" | "done" | "error">;
  streamPhase: Record<string, "reasoning" | "answering" | "done" | "error">;
  allDone: boolean;
  // 连接级错误（401/断流等），由界面显式提示，避免无限转圈
  connectionError: string | null;
}

const INITIAL_STATE: StreamState = {
  streamingTexts: {},
  streamReasonings: {},
  streamFindings: {},
  streamExtractedInfo: {},
  streamStatus: {},
  streamPhase: {},
  allDone: false,
  connectionError: null,
};

export function useAiReviewStream(taskId: string | null) {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!taskId) return;

    // 浏览器原生 EventSource 无法携带 Authorization 头，而后端 SSE 接口
    // 依赖 get_current_user 鉴权（会 401），因此改用 fetch 手动读取 SSE 流
    const controller = new AbortController();
    let closed = false;

    const fail = (message: string) => {
      if (closed || controller.signal.aborted) return;
      setState((prev) => ({ ...prev, connectionError: message }));
    };

    const handleFrame = (frame: string) => {
      let eventName = "message";
      let dataText = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataText += line.slice(5).trim();
      }
      if (!dataText) return;

      try {
        const data = JSON.parse(dataText);
        if (eventName === "reasoning") {
          const d = data as SseReasoningEvent;
          setState((prev) => ({
            ...prev,
            streamReasonings: {
              ...prev.streamReasonings,
              [d.file_id]: (prev.streamReasonings[d.file_id] || "") + d.content,
            },
            streamPhase: { ...prev.streamPhase, [d.file_id]: "reasoning" },
          }));
        } else if (eventName === "token") {
          const d = data as SseTokenEvent;
          setState((prev) => ({
            ...prev,
            streamingTexts: {
              ...prev.streamingTexts,
              [d.file_id]: (prev.streamingTexts[d.file_id] || "") + d.content,
            },
            streamPhase: { ...prev.streamPhase, [d.file_id]: "answering" },
            streamStatus: { ...prev.streamStatus, [d.file_id]: "streaming" },
          }));
        } else if (eventName === "file_done") {
          const d = data as SseFileDoneEvent;
          setState((prev) => ({
            ...prev,
            streamFindings: { ...prev.streamFindings, [d.file_id]: d.findings },
            streamExtractedInfo: { ...prev.streamExtractedInfo, [d.file_id]: d.extracted_info },
            streamStatus: { ...prev.streamStatus, [d.file_id]: "done" },
            streamPhase: { ...prev.streamPhase, [d.file_id]: "done" },
          }));
        } else if (eventName === "file_error") {
          const d = data as SseFileErrorEvent;
          setState((prev) => ({
            ...prev,
            streamStatus: { ...prev.streamStatus, [d.file_id]: "error" },
            streamPhase: { ...prev.streamPhase, [d.file_id]: "error" },
          }));
        } else if (eventName === "task_done") {
          setState((prev) => ({ ...prev, allDone: true }));
          closed = true;
          controller.abort();
        }
      } catch {
        // 单帧 JSON 解析失败直接跳过，不影响后续帧
      }
    };

    (async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/api/app02/ai-review/stream/${taskId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });

        if (res.status === 401) {
          fail("登录已过期，请重新登录后再执行 AI 审查");
          return;
        }
        if (!res.ok || !res.body) {
          fail(`审查流连接失败（HTTP ${res.status}），请重试`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        // 逐块读取并按 SSE 规范以空行分割事件帧
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            handleFrame(frame);
          }
        }
      } catch (err) {
        // 主动关闭（组件卸载/重置）不算错误
        if (!closed && !controller.signal.aborted) {
          fail("审查流连接中断，请重试");
        }
      }
    })();

    return () => {
      closed = true;
      controller.abort();
    };
  }, [taskId]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, reset };
}
