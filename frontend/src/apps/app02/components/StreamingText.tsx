import React, { useState, useEffect, useRef } from "react";
import { Typography } from "antd";

const { Text } = Typography;

interface Props {
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
  isStreaming: boolean;
  label: string;
  variant: "reasoning" | "answer";
}

const StreamingText: React.FC<Props> = ({ text, expanded, onToggleExpand, isStreaming, label, variant }) => {
  const [visibleLen, setVisibleLen] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetLenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 更新目标长度（text 变化时自动更新，不重启定时器）
  targetLenRef.current = text.length;

  // 启动唯一一个定时器，持续追赶 targetLenRef
  useEffect(() => {
    if (timerRef.current) return; // 已启动，不重复

    timerRef.current = setInterval(() => {
      setVisibleLen((prev) => {
        const target = targetLenRef.current;
        if (prev >= target) return prev;
        return prev + 1;
      });
    }, 30);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLen]);

  const isReasoning = variant === "reasoning";
  const bg = isReasoning ? "#f7f7f7" : "#fff";
  const border = isReasoning ? "#e8e8e8" : "#e8e8e8";
  const textColor = isReasoning ? "#888" : "#333";
  const titleColor = isReasoning ? "#999" : "#666";

  if (!text) {
    return (
      <div
        style={{
          marginTop: 6,
          padding: "6px 10px",
          background: bg,
          borderRadius: 6,
          border: `1px solid ${border}`,
        }}
      >
        <Text style={{ fontSize: 12, color: titleColor }}>
          {label}
        </Text>
      </div>
    );
  }

  const displayText = text.slice(0, visibleLen);
  const showExpand = text.length > 150;

  return (
    <div
      style={{
        marginTop: 6,
        background: bg,
        borderRadius: 6,
        border: `1px solid ${border}`,
      }}
    >
      <div
        onClick={onToggleExpand}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Text style={{ fontSize: 12, color: titleColor }}>
          {label}
        </Text>
        {showExpand && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {expanded ? "收起 ▲" : "展开 ▼"}
          </Text>
        )}
      </div>
      {expanded && (
        <div
          ref={scrollRef}
          style={{
            fontSize: 12,
            color: textColor,
            padding: "0 10px 10px",
            maxHeight: 250,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.8,
          }}
        >
          {displayText}
        </div>
      )}
    </div>
  );
};

export default StreamingText;
