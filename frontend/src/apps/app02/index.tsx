import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Card,
  Button,
  Tabs,
  Space,
  Tag,
  message,
  Alert,
  Typography,
  Empty,
  Descriptions,
  Segmented,
  Modal,
} from "antd";
import {
  ExportOutlined,
  CopyOutlined,
  FileSearchOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileWordOutlined,
  RobotOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import client from "@/api/client";
import type {
  FileReviewResult,
  ReviewResponse,
  UploadedFileInfo,
  AiReviewFindingApp02,
  StickerType,
} from "@/types";
import { useAiReviewStream } from "./hooks/useAiReviewStream";
import { computeSticker, getStickerCounts } from "./utils/stickers";
import StreamingText from "./components/StreamingText";
import StickerIndicator from "./components/StickerIndicator";

const { Title, Text } = Typography;

const RULE_LABEL: Record<string, string> = {
  school_name_error: "学校名称错误",
  teacher_mismatch: "教师信息不匹配",
  typo: "错别字",
  hour_calculation_error: "课时计算错误",
  hour_inconsistency: "课时不一致",
  format_issue: "格式问题",
};

const App02: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiReviewPhase, setAiReviewPhase] = useState<"idle" | "reviewing" | "done">("idle");
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // AI审查（SSE 流式）
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [aiFindings, setAiFindings] = useState<AiReviewFindingApp02[]>([]);
  const [aiReviewing, setAiReviewing] = useState(false);
  const {
    streamReasonings,
    streamFindings,
    streamExtractedInfo,
    streamStatus,
    streamPhase,
    allDone,
    reset: resetStream,
  } = useAiReviewStream(aiTaskId);

  useEffect(() => {
    if (allDone) {
      const all: AiReviewFindingApp02[] = [];
      for (const findings of Object.values(streamFindings)) {
        all.push(...findings);
      }
      setAiFindings(all);
      setAiReviewing(false);
      setAiReviewPhase("done");
    }
  }, [allDone, streamFindings]);

  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());
  const [stickerFilter, setStickerFilter] = useState<StickerType | "all">("fail");
  const [ignoredIssueKeys, setIgnoredIssueKeys] = useState<Set<string>>(new Set());
  const hasReviewedOnce = useRef(false);

  // 全局动画
  useEffect(() => {
    const styleId = "app02-global-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = ``;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  // AI审查完成后自动展开有问题的行
  useEffect(() => {
    if (aiFindings.length > 0) {
      const ids = [...new Set(aiFindings.map((f) => f.file_id))];
      setExpandedRowKeys((prev) => [...new Set([...prev, ...ids])]);
    }
  }, [aiFindings]);

  const toggleStreamExpand = useCallback((fileId: string) => {
    setExpandedStreams((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const doUpload = useCallback(async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setLoading(true);
    const formData = new FormData();
    for (const f of fileList) {
      formData.append("files", f);
    }
    try {
      const res = await client.post("/api/app02/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedFiles((prev) => [...prev, ...res.data.files]);
      message.success(`已接收 ${res.data.files.length} 个文件`);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "上传失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const doReview = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      message.warning("请先上传文件");
      return;
    }
    setLoading(true);
    try {
      const res = await client.post<ReviewResponse>("/api/app02/review");
      setReviewResult(res.data);
      hasReviewedOnce.current = true;
      message.success(res.data.summary);

      if (res.data.ai_task_id) {
        resetStream();
        setAiFindings([]);
        setAiReviewing(true);
        setAiReviewPhase("reviewing");
        setAiTaskId(res.data.ai_task_id);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "审查失败");
    } finally {
      setLoading(false);
    }
  }, [uploadedFiles, resetStream]);

  const doClearAll = useCallback(async () => {
    try {
      await client.post("/api/app02/reset");
    } catch {
      // reset 失败不影响前端清空
    }
    setUploadedFiles([]);
    setReviewResult(null);
    setPreviewFileId(null);
    setAiFindings([]);
    setAiTaskId(null);
    setAiReviewing(false);
    setAiReviewPhase("idle");
    resetStream();
    setIgnoredIssueKeys(new Set());
    hasReviewedOnce.current = false;
  }, [resetStream]);

  const doExport = useCallback(async () => {
    if (!reviewResult) {
      message.warning("请先执行审查");
      return;
    }
    try {
      const res = await client.get("/api/app02/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "文件审查结果.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (err: any) {
      message.error("导出失败：" + (err?.message || "未知错误"));
    }
  }, [reviewResult]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) => {
        const name = f.name.toLowerCase();
        return name.endsWith(".doc") || name.endsWith(".docx");
      });
      if (files.length === 0) {
        message.warning("未找到 .doc 或 .docx 文件");
        e.target.value = "";
        return;
      }
      doUpload(files);
      e.target.value = "";
    },
    [doUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const items = e.dataTransfer.items;
      if (!items) return;

      const docFiles: File[] = [];

      const readEntry = (entry: FileSystemEntry): Promise<void> => {
        return new Promise((resolve) => {
          if (entry.isFile) {
            const fileEntry = entry as FileSystemFileEntry;
            fileEntry.file((f) => {
              const name = f.name.toLowerCase();
              if (name.endsWith(".doc") || name.endsWith(".docx")) {
                docFiles.push(f);
              }
              resolve();
            });
          } else if (entry.isDirectory) {
            const dirEntry = entry as FileSystemDirectoryEntry;
            const reader = dirEntry.createReader();
            reader.readEntries((entries) => {
              Promise.all(entries.map(readEntry)).then(() => resolve());
            });
          } else {
            resolve();
          }
        });
      };

      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }

      Promise.all(entries.map(readEntry)).then(() => {
        if (docFiles.length === 0) {
          message.warning("未找到 .doc 或 .docx 文件");
        } else {
          doUpload(docFiles);
        }
      });
    },
    [doUpload],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getTypeColor = (fileType: string) => {
    if (fileType === "课程标准") return "blue";
    if (fileType === "授课计划") return "green";
    if (fileType === "教案") return "orange";
    return "default";
  };

  const getFileAiFindings = useCallback(
    (fileId: string): AiReviewFindingApp02[] => {
      if (streamFindings[fileId]) return streamFindings[fileId];
      return aiFindings.filter((f) => f.file_id === fileId);
    },
    [streamFindings, aiFindings],
  );

  const filteredResults = useMemo(() => {
    if (!reviewResult) return [];
    if (stickerFilter === "all") return reviewResult.results;
    return reviewResult.results.filter((r) => {
      const sticker = computeSticker(r, getFileAiFindings(r.file_id));
      return sticker === stickerFilter;
    });
  }, [reviewResult, stickerFilter, getFileAiFindings]);

  const stickerCounts = useMemo(() => {
    if (!reviewResult) return { pass: 0, fail: 0, ambiguous: 0 };
    const map: Record<string, AiReviewFindingApp02[]> = {};
    for (const r of reviewResult.results) {
      map[r.file_id] = getFileAiFindings(r.file_id);
    }
    return getStickerCounts(reviewResult.results, map);
  }, [reviewResult, getFileAiFindings]);

  const toggleIgnoreIssue = useCallback((key: string) => {
    setIgnoredIssueKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 统一问题列表
  const renderUnifiedIssues = (result: FileReviewResult) => {
    const fileAiFindings = getFileAiFindings(result.file_id);

    const errors = fileAiFindings.filter((i) => i.severity === "error");
    const warnings = fileAiFindings.filter((i) => i.severity === "warning");
    const sortedIssues = [...errors, ...warnings];

    if (sortedIssues.length === 0) {
      return <Alert type="success" showIcon message="未发现任何问题" style={{ fontSize: 13 }} />;
    }

    return (
      <>
        {sortedIssues.map((f, idx) => {
          const key = `ai-${result.file_id}-${idx}`;
          const isIgnored = ignoredIssueKeys.has(key);
          const isError = f.severity === "error";
          return (
            <div
              key={key}
              style={{
                marginBottom: 8,
                padding: "8px 12px",
                background: isIgnored ? "#f5f5f5" : isError ? "#fff2f0" : "#fffbe6",
                borderLeft: `3px solid ${isIgnored ? "#d9d9d9" : isError ? "#ff4d4f" : "#faad14"}`,
                borderRadius: 4,
                opacity: isIgnored ? 0.55 : 1,
                textDecoration: isIgnored ? "line-through" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <Space size={4} style={{ marginBottom: 2 }}>
                    <Tag color={isIgnored ? "default" : isError ? "red" : "warning"} style={{ fontSize: 11 }}>
                      {RULE_LABEL[f.rule] || f.rule}
                    </Tag>
                    <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>
                    {isIgnored && (
                      <Text type="secondary" style={{ fontSize: 11 }}>已忽略</Text>
                    )}
                  </Space>
                  <Text style={{ fontSize: 13, color: isIgnored ? "#999" : isError ? "#cf1322" : undefined }}>
                    {f.description}
                  </Text>
                  {f.location && (
                    <div style={{ marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>位置：{f.location}</Text>
                    </div>
                  )}
                  {f.suggestion && (
                    <div style={{ marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: isIgnored ? "#999" : "#389e0d" }}>建议：{f.suggestion}</Text>
                    </div>
                  )}
                </div>
                {isError && (
                  <Button
                    size="small"
                    type={isIgnored ? "dashed" : "text"}
                    danger={!isIgnored}
                    style={{ flexShrink: 0, marginLeft: 8, fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIgnoreIssue(key);
                    }}
                  >
                    {isIgnored ? "取消忽略" : "忽略"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <FileSearchOutlined style={{ marginRight: 8 }} />
        文件审查
      </Title>

      {/* 上传区域 — 始终可见 */}
      <Card style={{ marginBottom: 16 }}>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed #d9d9d9",
            borderRadius: 8,
            padding: "20px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: "#fafafa",
            marginBottom: uploadedFiles.length > 0 ? 12 : 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#1677ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#d9d9d9";
          }}
        >
          <InboxOutlined style={{ fontSize: 32, color: "#1677ff", marginBottom: 8 }} />
          <div>
            <Text strong style={{ fontSize: 14 }}>
              点击或拖拽文件/文件夹到此处
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>支持 .doc / .docx，可多次导入累加</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Space>
              <Button size="small" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                选择文件
              </Button>
              <Button size="small" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}>
                选择文件夹
              </Button>
            </Space>
          </div>
        </div>

        {/* 已导入文件标签 */}
        {uploadedFiles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {uploadedFiles.map((f) => (
              <Tag
                key={f.file_id}
                icon={<FileWordOutlined />}
                color={getTypeColor(f.file_type)}
                style={{ fontSize: 13, padding: "4px 8px" }}
              >
                {f.filename}
                {f.is_doc && " (.doc→.docx)"}
              </Tag>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        {uploadedFiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Space>
              <Button
                type="primary"
                onClick={doReview}
                loading={loading && !aiReviewing}
                icon={hasReviewedOnce.current ? <PlusOutlined /> : <FileSearchOutlined />}
              >
                {hasReviewedOnce.current ? "审批新增" : "开始审查"}
              </Button>
              {aiReviewing && (
                <Button disabled>
                  <LoadingOutlined /> AI分析中（{Object.values(streamStatus).filter((s) => s === "done").length}/{reviewResult?.results.length || 0}）
                </Button>
              )}
              <Button onClick={doClearAll} icon={<ReloadOutlined />}>
                清除全部
              </Button>
            </Space>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore webkitdirectory is not in React types
          webkitdirectory=""
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </Card>

      {/* AI 审查中 — 流式进度面板 */}
      {aiReviewPhase === "reviewing" && reviewResult && (
        <Card
          title={
            <Text style={{ fontSize: 14, color: "#333" }}>
              AI 正在审查（{Object.values(streamStatus).filter((s) => s === "done").length}/{reviewResult.results.length}）
            </Text>
          }
        >
          <div style={{ maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
            {(() => {
              const sorted = [...reviewResult.results].sort((a, b) => {
                const pa = streamPhase[a.file_id];
                const pb = streamPhase[b.file_id];
                const order: Record<string, number> = { reasoning: 0, answering: 1, undefined: 2, waiting: 2, done: 3, error: 3 };
                return (order[pa || "waiting"] ?? 2) - (order[pb || "waiting"] ?? 2);
              });

              const active = sorted.filter((r) => {
                const p = streamPhase[r.file_id];
                return p !== "done" && p !== "error";
              });
              const finished = sorted.filter((r) => {
                const p = streamPhase[r.file_id];
                return p === "done" || p === "error";
              });

              const renderFileRow = (result: FileReviewResult, isFinished: boolean) => {
                const phase = streamPhase[result.file_id];
                const reasoningText = streamReasonings[result.file_id] || "";
                const isReasoning = phase === "reasoning";

                return (
                  <div
                    key={result.file_id}
                    style={{
                      marginBottom: 10,
                      padding: "10px 14px",
                      border: "1px solid #e8e8e8",
                      borderRadius: 6,
                      background: "#f7f7f7",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: reasoningText ? 4 : 0 }}>
                      <FileWordOutlined style={{ color: "#999" }} />
                      <Text strong style={{ fontSize: 13, flex: 1 }}>{result.filename}</Text>
                      <Tag color={getTypeColor(result.file_type)} style={{ fontSize: 11 }}>{result.file_type || "未知"}</Tag>
                      {isReasoning && <Tag style={{ fontSize: 11, background: "#f0f0f0", border: "1px solid #d9d9d9", color: "#999" }}>🧠 思考中</Tag>}
                      {!isFinished && phase === "answering" && <Tag color="processing" style={{ fontSize: 11 }}>📝 分析中</Tag>}
                      {isFinished && <Tag color="success" style={{ fontSize: 11 }}>✅ 完成</Tag>}
                      {!phase && <Text type="secondary" style={{ fontSize: 11 }}>排队中</Text>}
                      {phase === "error" && <Tag color="error" style={{ fontSize: 11 }}>出错</Tag>}
                    </div>

                    {/* 思考过程 — 灰色折叠框，只在未完成时显示 */}
                    {reasoningText && !isFinished && (
                      <StreamingText
                        text={reasoningText}
                        expanded={expandedStreams.has(result.file_id + "-reasoning")}
                        onToggleExpand={() => toggleStreamExpand(result.file_id + "-reasoning")}
                        isStreaming={isReasoning}
                        label={isReasoning ? "🧠 思考中..." : "🧠 已思考"}
                        variant="reasoning"
                      />
                    )}
                  </div>
                );
              };

              return (
                <div>
                  {active.map((r) => renderFileRow(r, false))}

                  {finished.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 8, userSelect: "none" }}
                        onClick={() => {
                          setExpandedStreams((prev) => {
                            const next = new Set(prev);
                            if (next.has("__done_section")) next.delete("__done_section");
                            else next.add("__done_section");
                            return next;
                          });
                        }}
                      >
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                        <Text style={{ fontSize: 13, color: "#52c41a" }}>已完成（{finished.length}）</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {expandedStreams.has("__done_section") ? "收起 ▲" : "展开 ▼"}
                        </Text>
                      </div>
                      {expandedStreams.has("__done_section") && finished.map((r) => renderFileRow(r, true))}
                      {!expandedStreams.has("__done_section") && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                          {finished.slice(0, 3).map((r) => r.filename.length > 18 ? r.filename.slice(0, 18) + "..." : r.filename).join("、")}
                          {finished.length > 3 ? ` 等 ${finished.length} 个` : ""}
                        </Text>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* AI 审查完成 — 汇总结果 */}
      {aiReviewPhase === "done" && reviewResult && (
        <Card
          title="审查结果"
          extra={
            <Space>
              {reviewResult.mode === "batch" && (
                <Button icon={<ExportOutlined />} onClick={doExport}>
                  导出 Excel
                </Button>
              )}
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              type={stickerCounts.fail > 0 ? "warning" : "success"}
              showIcon
              message={`共 ${reviewResult.results.length} 个文件：❌ ${stickerCounts.fail} 个关键问题，⚠ ${stickerCounts.ambiguous} 个仅有提醒，✅ ${stickerCounts.pass} 个通过`}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={[
                { label: `❌ 关键问题（${stickerCounts.fail}）`, value: "fail" },
                { label: `⚠ 仅有提醒（${stickerCounts.ambiguous}）`, value: "ambiguous" },
                { label: `✅ 通过（${stickerCounts.pass}）`, value: "pass" },
                { label: `全部（${reviewResult.results.length}）`, value: "all" },
              ]}
              value={stickerFilter}
              onChange={(val) => setStickerFilter(val as StickerType | "all")}
            />
          </div>

          <div style={{ maxHeight: "calc(100vh - 500px)", overflowY: "auto" }}>
            {filteredResults.length === 0 ? (
              <Empty description={
                stickerFilter === "fail" ? "所有文件都没有关键问题" :
                stickerFilter === "ambiguous" ? "所有文件都没有仅提醒项" :
                stickerFilter === "pass" ? "没有完全通过的文件" :
                "暂无文件"
              } />
            ) : (
              filteredResults.map((result) => {
                const fileAiFindings = getFileAiFindings(result.file_id);
                const sticker = computeSticker(result, fileAiFindings);
                const aiErrors = fileAiFindings.filter((f) => f.severity === "error");
                const aiWarnings = fileAiFindings.filter((f) => f.severity === "warning");
                const extractedInfo = streamExtractedInfo[result.file_id];
                const isExpanded = expandedRowKeys.includes(result.file_id);

                return (
                  <div key={result.file_id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 14px",
                        marginBottom: 6,
                        border: "1px solid #f0f0f0",
                        borderRadius: 8,
                        background: isExpanded ? "#fafafa" : "#fff",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onClick={() => {
                        setExpandedRowKeys((prev) =>
                          prev.includes(result.file_id)
                            ? prev.filter((id) => id !== result.file_id)
                            : [...prev, result.file_id]
                        );
                      }}
                    >
                      <div style={{ width: 36, flexShrink: 0 }}>
                        <StickerIndicator
                          result={result}
                          aiFindings={fileAiFindings}
                          streamStatus={streamStatus[result.file_id]}
                          aiReviewing={false}
                        />
                      </div>
                      <FileWordOutlined style={{ color: "#1677ff", marginRight: 8 }} />
                      <Text strong style={{ fontSize: 13, flex: 1 }}>{result.filename}</Text>
                      <Tag color={getTypeColor(result.file_type)} style={{ fontSize: 11 }}>{result.file_type || "未知"}</Tag>
                      {extractedInfo?.teacher && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>👤 {extractedInfo.teacher}</Text>
                      )}
                      {aiErrors.length > 0 && <Tag color="error" style={{ marginLeft: 8 }}>{aiErrors.length} 错误</Tag>}
                      {aiWarnings.length > 0 && <Tag color="warning" style={{ marginLeft: 4 }}>{aiWarnings.length} 提醒</Tag>}
                      {aiErrors.length === 0 && aiWarnings.length === 0 && <Tag color="success" style={{ marginLeft: 8 }}>通过</Tag>}
                      <Button
                        size="small"
                        type="link"
                        style={{ fontSize: 11, marginLeft: 8 }}
                        onClick={(e) => { e.stopPropagation(); setPreviewFileId(result.file_id); }}
                      >
                        查看原文
                      </Button>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                        {isExpanded ? "收起 ▲" : "展开 ▼"}
                      </Text>
                    </div>

                    {isExpanded && (
                      <div style={{ marginBottom: 12, marginLeft: 44, padding: "12px 16px", background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                        {extractedInfo && (extractedInfo.teacher || extractedInfo.course) && (
                          <Descriptions column={3} size="small" style={{ marginBottom: 12, background: "#f6f8fa", padding: "8px 12px", borderRadius: 4 }}>
                            {extractedInfo.teacher && <Descriptions.Item label="教师">{extractedInfo.teacher}</Descriptions.Item>}
                            {extractedInfo.course && <Descriptions.Item label="课程">{extractedInfo.course}</Descriptions.Item>}
                            {extractedInfo.class_name && <Descriptions.Item label="班级">{extractedInfo.class_name}</Descriptions.Item>}
                          </Descriptions>
                        )}
                        {renderUnifiedIssues(result)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {!reviewResult && uploadedFiles.length > 0 && (
        <Card>
          <Empty description="点击「开始审查」检查文件">
            <Button type="primary" onClick={doReview} loading={loading}>
              开始审查
            </Button>
          </Empty>
        </Card>
      )}
      {previewFileId && reviewResult && (
        <Modal
          open
          onCancel={() => setPreviewFileId(null)}
          footer={null}
          width="90%"
          style={{ top: 20 }}
          title={reviewResult.results.find((r) => r.file_id === previewFileId)?.filename || "文件预览"}
        >
          <div style={{ display: "flex", gap: 16, height: "calc(100vh - 200px)", minHeight: 500 }}>
            <div style={{ flex: 1, border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden" }}>
              <iframe
                src={`http://10.50.150.176:8006/api/app02/preview/${previewFileId}`}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
            <div style={{ width: 360, overflow: "auto", border: "1px solid #d9d9d9", borderRadius: 8, padding: 16 }}>
              {(() => {
                const r = reviewResult.results.find((x) => x.file_id === previewFileId);
                if (!r) return null;
                const fileAiFindings = getFileAiFindings(r.file_id);
                const aiErrors = fileAiFindings.filter((f) => f.severity === "error");
                const aiWarnings = fileAiFindings.filter((f) => f.severity === "warning");
                const extractedInfo = streamExtractedInfo[r.file_id];

                return (
                  <>
                    <Title level={5} style={{ marginTop: 0 }}>
                      {aiErrors.length === 0 && aiWarnings.length === 0 ? (
                        <Tag color="success" style={{ fontSize: 14 }}>审查通过</Tag>
                      ) : aiErrors.length === 0 ? (
                        <Tag color="warning" style={{ fontSize: 14 }}>通过（{aiWarnings.length} 条建议）</Tag>
                      ) : (
                        <Space size={4}>
                          <Tag color="error" style={{ fontSize: 14 }}>{aiErrors.length} 个错误</Tag>
                          {aiWarnings.length > 0 && <Tag color="warning" style={{ fontSize: 14 }}>{aiWarnings.length} 条提醒</Tag>}
                        </Space>
                      )}
                    </Title>

                    <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="文件类型">{r.file_type || "未知"}</Descriptions.Item>
                      <Descriptions.Item label="老师">{extractedInfo?.teacher || r.teacher}</Descriptions.Item>
                      {extractedInfo?.course && <Descriptions.Item label="课程">{extractedInfo.course}</Descriptions.Item>}
                      {extractedInfo?.class_name && <Descriptions.Item label="班级">{extractedInfo.class_name}</Descriptions.Item>}
                    </Descriptions>

                    {fileAiFindings.length === 0 ? (
                      <Alert type="success" showIcon message="未发现任何问题" />
                    ) : (
                      <>
                        {aiErrors.map((f, idx) => (
                          <div key={`err-${idx}`} style={{ marginBottom: 12, padding: 12, background: "#fff2f0", borderLeft: "4px solid #ff4d4f", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              <Space size={4}>
                                <Tag color="red">{RULE_LABEL[f.rule] || f.rule}</Tag>
                                <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>
                              </Space>
                            </div>
                            <Text style={{ fontSize: 13, color: "#cf1322" }}>{f.description}</Text>
                            {f.location && <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>位置：{f.location}</Text></div>}
                            {f.suggestion && <div style={{ marginTop: 4 }}><Text style={{ fontSize: 12, color: "#389e0d" }}>建议：{f.suggestion}</Text></div>}
                          </div>
                        ))}
                        {aiWarnings.map((f, idx) => (
                          <div key={`warn-${idx}`} style={{ marginBottom: 12, padding: 12, background: "#fffbe6", borderLeft: "4px solid #faad14", borderRadius: 4 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              <Space size={4}>
                                <Tag color="warning">{RULE_LABEL[f.rule] || f.rule}</Tag>
                                <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>
                              </Space>
                            </div>
                            <Text style={{ fontSize: 13 }}>{f.description}</Text>
                            {f.location && <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>位置：{f.location}</Text></div>}
                            {f.suggestion && <div style={{ marginTop: 4 }}><Text style={{ fontSize: 12, color: "#389e0d" }}>建议：{f.suggestion}</Text></div>}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default App02;
