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
} from "antd";
import {
  ExportOutlined,
  CopyOutlined,
  FileSearchOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
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
  ReviewIssue,
  AiReviewFindingApp02,
  AiFileProgress,
} from "@/types";

const { Title, Text } = Typography;

const RULE_LABEL: Record<string, string> = {
  school_name_error: "学校名称错误",
  teacher_mismatch: "教师信息不匹配",
  typo: "错别字",
  hour_calculation_error: "课时计算错误",
  hour_inconsistency: "课时不一致",
};

const App02: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // AI审查
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiFindings, setAiFindings] = useState<AiReviewFindingApp02[]>([]);
  const [aiFileProgress, setAiFileProgress] = useState<AiFileProgress[]>([]);
  const [aiTotalFiles, setAiTotalFiles] = useState(0);
  const [aiCompletedFiles, setAiCompletedFiles] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "needs_fix">("needs_fix");
  const [ignoredIssueKeys, setIgnoredIssueKeys] = useState<Set<string>>(new Set());
  const aiPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasReviewedOnce = useRef(false);

  // Claude 风格脉冲动画
  useEffect(() => {
    const styleId = "app02-claude-pulse";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes claude-dot-pulse {
        0%, 100% { transform: scale(0.75); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
      }
      @keyframes claude-ring-ripple {
        0% { box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.5); }
        100% { box-shadow: 0 0 0 12px rgba(22, 119, 255, 0); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (aiPollTimer.current) clearInterval(aiPollTimer.current);
    };
  }, []);

  // AI审查完成后自动展开有问题的行
  useEffect(() => {
    if (aiFindings.length > 0) {
      const ids = [...new Set(aiFindings.map((f) => f.file_id))];
      setExpandedRowKeys((prev) => [...new Set([...prev, ...ids])]);
    }
  }, [aiFindings]);

  const resetAiState = useCallback(() => {
    setAiFindings([]);
    setAiFileProgress([]);
    setAiTotalFiles(0);
    setAiCompletedFiles(0);
    setIgnoredIssueKeys(new Set());
  }, []);

  // 开始轮询 AI 进度
  const startPollingAi = useCallback((taskId: string) => {
    if (!taskId) return;
    setAiReviewing(true);
    setAiFindings([]);
    setAiFileProgress([]);
    setAiTotalFiles(0);
    setAiCompletedFiles(0);

    if (aiPollTimer.current) clearInterval(aiPollTimer.current);

    aiPollTimer.current = setInterval(async () => {
      try {
        const progressRes = await client.get(`/api/app02/ai-review/progress/${taskId}`);
        const { status, findings, error, files, total, completed } = progressRes.data;
        setAiFileProgress(files || []);
        setAiTotalFiles(total || 0);
        setAiCompletedFiles(completed || 0);
        if (status === "done") {
          clearInterval(aiPollTimer.current!);
          aiPollTimer.current = null;
          setAiReviewing(false);
          setAiFindings(findings || []);
          if (!findings || findings.length === 0) {
            message.success("AI审查通过，未发现事实性问题");
          } else {
            message.warning(`AI审查发现 ${findings.length} 个问题`);
          }
        } else if (status === "error") {
          clearInterval(aiPollTimer.current!);
          aiPollTimer.current = null;
          setAiReviewing(false);
          message.error(`AI审查失败：${error || "未知错误"}`);
        }
      } catch {
        // 轮询失败继续重试
      }
    }, 1000);
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

      // 自动启动 AI 轮询
      if (res.data.ai_task_id) {
        startPollingAi(res.data.ai_task_id);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "审查失败");
    } finally {
      setLoading(false);
    }
  }, [uploadedFiles, startPollingAi]);

  const doClearAll = useCallback(async () => {
    try {
      await client.post("/api/app02/reset");
    } catch {
      // reset 失败不影响前端清空
    }
    setUploadedFiles([]);
    setReviewResult(null);
    setOpenFileIds([]);
    setActiveTab("summary");
    resetAiState();
    hasReviewedOnce.current = false;
    if (aiPollTimer.current) {
      clearInterval(aiPollTimer.current);
      aiPollTimer.current = null;
    }
    setAiReviewing(false);
  }, [resetAiState]);

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

  const openFileTab = useCallback(
    (fileId: string) => {
      if (!openFileIds.includes(fileId)) {
        setOpenFileIds((prev) => [...prev, fileId]);
      }
      setActiveTab(fileId);
    },
    [openFileIds],
  );

  const closeFileTab = useCallback(
    (fileId: string) => {
      const newIds = openFileIds.filter((id) => id !== fileId);
      setOpenFileIds(newIds);
      if (activeTab === fileId) {
        setActiveTab(newIds.length > 0 ? newIds[newIds.length - 1] : "summary");
      }
    },
    [openFileIds, activeTab],
  );

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

  const needsFix = useCallback((result: FileReviewResult) => {
    const aiFileFindings = aiFindings.filter((f) => f.file_id === result.file_id);
    const allErrors = [
      ...result.issues.filter((i) => i.severity === "error").map((_, idx) => `format-${result.file_id}-${idx}`),
      ...aiFileFindings.filter((f) => f.severity === "error").map((_, idx) => `ai-${result.file_id}-${idx}`),
    ];
    return allErrors.some((key) => !ignoredIssueKeys.has(key));
  }, [aiFindings, ignoredIssueKeys]);

  const filteredResults = useMemo(() => {
    if (!reviewResult) return [];
    if (filterMode === "needs_fix") {
      return reviewResult.results.filter(needsFix);
    }
    return reviewResult.results;
  }, [reviewResult, filterMode, needsFix]);

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
    const aiFileFindings = aiFindings.filter((f) => f.file_id === result.file_id);

    interface UnifiedIssue {
      key: string;
      type: string;
      detail: string;
      location: string;
      suggestion?: string;
      severity: "error" | "warning";
      source: "format" | "ai";
    }

    const formatIssues: UnifiedIssue[] = result.issues.map((issue, idx) => ({
      key: `format-${result.file_id}-${idx}`,
      type: issue.type,
      detail: issue.detail,
      location: issue.location,
      severity: issue.severity as "error" | "warning",
      source: "format" as const,
    }));

    const aiIssues: UnifiedIssue[] = aiFileFindings.map((f, idx) => ({
      key: `ai-${result.file_id}-${idx}`,
      type: RULE_LABEL[f.rule] || f.rule,
      detail: f.description,
      location: f.location,
      suggestion: f.suggestion,
      severity: f.severity,
      source: "ai" as const,
    }));

    const allIssues = [...formatIssues, ...aiIssues];
    const errors = allIssues.filter((i) => i.severity === "error");
    const warnings = allIssues.filter((i) => i.severity === "warning");
    const sortedIssues = [...errors, ...warnings];
    const visibleIssues = filterMode === "needs_fix" ? errors : sortedIssues;

    if (visibleIssues.length === 0 && warnings.length === 0) {
      return <Alert type="success" showIcon message="未发现任何问题" style={{ fontSize: 13 }} />;
    }

    return (
      <>
        {visibleIssues.length > 0 && (
          <div>
            {visibleIssues.map((issue) => {
              const isIgnored = ignoredIssueKeys.has(issue.key);
              const isError = issue.severity === "error";
              return (
                <div
                  key={issue.key}
                  style={{
                    marginBottom: 8,
                    padding: "8px 12px",
                    background: isIgnored ? "#f5f5f5" : (isError ? "#fff2f0" : "#fffbe6"),
                    borderLeft: `3px solid ${isIgnored ? "#d9d9d9" : (isError ? "#ff4d4f" : "#faad14")}`,
                    borderRadius: 4,
                    opacity: isIgnored ? 0.55 : 1,
                    textDecoration: isIgnored ? "line-through" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <Space size={4} style={{ marginBottom: 2 }}>
                        <Tag color={isIgnored ? "default" : (isError ? "red" : "warning")} style={{ fontSize: 11 }}>
                          {issue.type}
                        </Tag>
                        {issue.source === "ai" && (
                          <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>
                        )}
                        {isIgnored && (
                          <Text type="secondary" style={{ fontSize: 11 }}>已忽略</Text>
                        )}
                      </Space>
                      <Text style={{ fontSize: 13, color: isIgnored ? "#999" : (isError ? "#cf1322" : undefined) }}>
                        {issue.detail}
                      </Text>
                      {issue.location && (
                        <div style={{ marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>位置：{issue.location}</Text>
                        </div>
                      )}
                      {issue.suggestion && (
                        <div style={{ marginTop: 2 }}>
                          <Text style={{ fontSize: 12, color: isIgnored ? "#999" : "#389e0d" }}>建议：{issue.suggestion}</Text>
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
                          toggleIgnoreIssue(issue.key);
                        }}
                      >
                        {isIgnored ? "取消忽略" : "忽略"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filterMode === "needs_fix" && warnings.length > 0 && (
          <div style={{ marginBottom: 8, marginTop: visibleIssues.length > 0 ? 12 : 0 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              另有 {warnings.length} 条提醒，切换至「全部」可查看
            </Text>
          </div>
        )}
      </>
    );
  };

  // 左侧状态指示器
  const renderStatusIndicator = (result: FileReviewResult) => {
    const progressItem = aiFileProgress.find((p) => p.file_id === result.file_id);
    const isReviewing = progressItem?.status === "reviewing";
    const isDone = progressItem?.status === "done";
    const isWaiting = progressItem?.status === "waiting";

    // AI 审查进行中
    if (aiReviewing) {
      // 正在审查这个文件 → 脉冲动画
      if (isReviewing) {
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
      // 还在排队等待 → 空心圈
      if (isWaiting || !progressItem) {
        return <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #d9d9d9", margin: "0 auto" }} />;
      }
      // AI 审查完了 → 显示结果
      if (isDone) {
        return needsFix(result)
          ? <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />
          : <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />;
      }
    }

    // AI 没在跑，直接显示格式审查结果
    if (needsFix(result)) {
      return <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />;
    }
    return <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />;
  };

  // 文件卡片
  const renderFileCard = (result: FileReviewResult) => {
    const aiFileFindings = aiFindings.filter((f) => f.file_id === result.file_id);
    const formatErrors = result.issues.filter((i) => i.severity === "error");
    const formatWarnings = result.issues.filter((i) => i.severity === "warning");
    const aiErrors = aiFileFindings.filter((f) => f.severity === "error");
    const aiWarnings = aiFileFindings.filter((f) => f.severity === "warning");
    const allErrors = [
      ...formatErrors.map((_, idx) => `format-${result.file_id}-${idx}`),
      ...aiErrors.map((_, idx) => `ai-${result.file_id}-${idx}`),
    ];
    const activeErrors = allErrors.filter((key) => !ignoredIssueKeys.has(key));
    const totalErrors = formatErrors.length + aiErrors.length;
    const totalWarnings = formatWarnings.length + aiWarnings.length;
    const ignoredCount = allErrors.length - activeErrors.length;

    const isExpanded = expandedRowKeys.includes(result.file_id);
    const progressItem = aiFileProgress.find((p) => p.file_id === result.file_id);
    const extractedInfo = progressItem?.extracted_info;
    const displayTeacher = extractedInfo?.teacher || result.teacher;
    const displayCourse = extractedInfo?.course || null;
    const displayClassName = extractedInfo?.class_name || null;

    return (
      <div
        key={result.file_id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          background: isExpanded ? "#fafafa" : "#fff",
          transition: "background 0.2s",
        }}
      >
        <div style={{ width: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
          {renderStatusIndicator(result)}
        </div>

        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => {
          setExpandedRowKeys((prev) =>
            prev.includes(result.file_id)
              ? prev.filter((id) => id !== result.file_id)
              : [...prev, result.file_id]
          );
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FileWordOutlined style={{ color: "#1677ff" }} />
            <Text strong style={{ fontSize: 14 }}>{result.filename}</Text>
            <Tag color={getTypeColor(result.file_type)}>{result.file_type || "未知"}</Tag>
            {displayTeacher && displayTeacher !== "未知" && (
              <Text type="secondary" style={{ fontSize: 12 }}>👤 {displayTeacher}</Text>
            )}
            {displayCourse && (
              <Text type="secondary" style={{ fontSize: 12 }}>📖 {displayCourse}</Text>
            )}
            {displayClassName && (
              <Text type="secondary" style={{ fontSize: 12 }}>🏫 {displayClassName}</Text>
            )}
            {(!displayTeacher || displayTeacher === "未知") && !displayCourse && (
              <Text type="secondary" style={{ fontSize: 12, color: "#faad14" }}>待AI提取</Text>
            )}
            {activeErrors.length > 0 && <Tag color="error" style={{ margin: 0 }}>{activeErrors.length} 错误</Tag>}
            {activeErrors.length === 0 && ignoredCount > 0 && (
              <Tag color="success" style={{ margin: 0 }}>已忽略全部</Tag>
            )}
            {activeErrors.length === 0 && totalErrors === 0 && totalWarnings > 0 && (
              <Tag color="warning" style={{ margin: 0 }}>{totalWarnings} 提醒</Tag>
            )}
            {activeErrors.length === 0 && totalErrors === 0 && totalWarnings === 0 && (
              <Tag color="success" style={{ margin: 0 }}>通过</Tag>
            )}
            {aiFileFindings.length > 0 && (
              <Tag color="purple" style={{ margin: 0 }}>
                <RobotOutlined /> AI
              </Tag>
            )}
            <Text type="secondary" style={{ fontSize: 11, marginLeft: "auto" }}>
              {isExpanded ? "收起 ▲" : "展开 ▼"}
            </Text>
          </div>

          {isExpanded && (
            <div style={{ marginTop: 12 }}>
              {extractedInfo && (extractedInfo.teacher || extractedInfo.course) && (
                <Descriptions column={3} size="small" style={{ marginBottom: 12, background: "#f6f8fa", padding: "8px 12px", borderRadius: 4 }}>
                  {extractedInfo.teacher && <Descriptions.Item label="教师">{extractedInfo.teacher}</Descriptions.Item>}
                  {extractedInfo.course && <Descriptions.Item label="课程">{extractedInfo.course}</Descriptions.Item>}
                  {extractedInfo.class_name && <Descriptions.Item label="班级">{extractedInfo.class_name}</Descriptions.Item>}
                </Descriptions>
              )}

              {renderUnifiedIssues(result)}

              <Space style={{ marginTop: 12 }}>
                <Button size="small" onClick={(e) => { e.stopPropagation(); openFileTab(result.file_id); }}>
                  查看原文
                </Button>
                {(formatErrors.length > 0 || aiErrors.length > 0) && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      const errorTexts = [
                        ...formatErrors.map((i) => `【${i.type}】${i.location ? `位置：${i.location}，` : ""}${i.detail}`),
                        ...aiErrors.map((f) => `【${RULE_LABEL[f.rule] || f.rule}】${f.location ? `位置：${f.location}，` : ""}${f.description}`),
                      ];
                      navigator.clipboard.writeText(errorTexts.join("\n")).then(
                        () => message.success(`已复制 ${errorTexts.length} 条关键错误`),
                        () => message.error("复制失败"),
                      );
                    }}
                  >
                    仅复制关键错误
                  </Button>
                )}
                {(result.issues.length > 0 || aiFileFindings.length > 0) && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      const allTexts = [
                        ...result.issues.map((i) => `【${i.type}】${i.location ? `位置：${i.location}，` : ""}${i.detail}`),
                        ...aiFileFindings.map((f) => `【${RULE_LABEL[f.rule] || f.rule}】${f.location ? `位置：${f.location}，` : ""}${f.description}`),
                      ];
                      navigator.clipboard.writeText(allTexts.join("\n")).then(
                        () => message.success(`已复制 ${allTexts.length} 条`),
                        () => message.error("复制失败"),
                      );
                    }}
                  >
                    复制全部（含提醒）
                  </Button>
                )}
              </Space>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 单文件预览（含 AI 进度和发现）
  const renderFilePreview = (result: FileReviewResult) => {
    const aiFileFindings = aiFindings.filter((f) => f.file_id === result.file_id);
    const formatErrors = result.issues.filter((i) => i.severity === "error");
    const formatWarnings = result.issues.filter((i) => i.severity === "warning");
    const aiErrors = aiFileFindings.filter((f) => f.severity === "error");
    const aiWarnings = aiFileFindings.filter((f) => f.severity === "warning");
    const allErrors = [...formatErrors, ...aiErrors];
    const allWarnings = [...formatWarnings, ...aiWarnings];
    const progressItem = aiFileProgress.find((p) => p.file_id === result.file_id);
    const extractedInfo = progressItem?.extracted_info;

    return (
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 360px)", minHeight: 500 }}>
        <div style={{ flex: 1, border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden" }}>
          <iframe
            src={`http://localhost:8001/api/app02/preview/${result.file_id}`}
            style={{ width: "100%", height: "100%", border: "none" }}
            title={result.filename}
          />
        </div>

        <div style={{ width: 360, display: "flex", flexDirection: "column" }}>
          {/* AI 审查进度条 */}
          {aiReviewing && (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "#e6f4ff", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
              {progressItem?.status === "reviewing" ? (
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1677ff", animation: "claude-dot-pulse 1.2s ease-in-out infinite, claude-ring-ripple 1.2s ease-out infinite" }} />
              ) : (
                <LoadingOutlined style={{ color: "#1677ff", fontSize: 14 }} />
              )}
              <Text style={{ color: "#1677ff", fontSize: 13 }}>
                {progressItem?.status === "reviewing" ? `AI 正在审查 ${result.filename}` : "AI 审查排队中..."}
              </Text>
            </div>
          )}

          <div
            style={{
              flex: 1,
              overflow: "auto",
              border: "1px solid #d9d9d9",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Title level={5} style={{ marginTop: 0 }}>
              {(() => {
                if (allErrors.length === 0 && allWarnings.length === 0) {
                  return <Tag color="success" style={{ fontSize: 14 }}>审查通过</Tag>;
                }
                if (allErrors.length === 0) {
                  return <Tag color="warning" style={{ fontSize: 14 }}>通过（{allWarnings.length} 条建议）</Tag>;
                }
                return (
                  <Space size={4}>
                    <Tag color="error" style={{ fontSize: 14 }}>{allErrors.length} 个错误</Tag>
                    {allWarnings.length > 0 && <Tag color="warning" style={{ fontSize: 14 }}>{allWarnings.length} 条提醒</Tag>}
                  </Space>
                );
              })()}
            </Title>

            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件类型">{result.file_type || "未知"}</Descriptions.Item>
              <Descriptions.Item label="老师">
                {extractedInfo?.teacher || result.teacher}
                {extractedInfo?.teacher && extractedInfo.teacher !== result.teacher && result.teacher !== "未知" && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>(原: {result.teacher})</Text>
                )}
              </Descriptions.Item>
              {extractedInfo?.course && (
                <Descriptions.Item label="课程">{extractedInfo.course}</Descriptions.Item>
              )}
              {extractedInfo?.class_name && (
                <Descriptions.Item label="班级">{extractedInfo.class_name}</Descriptions.Item>
              )}
              <Descriptions.Item label="使用字体">
                {result.fonts_used.length > 0 ? result.fonts_used.join("、") : "无"}
              </Descriptions.Item>
            </Descriptions>

            {formatErrors.length === 0 && formatWarnings.length === 0 && aiFileFindings.length === 0 ? (
              <Alert type="success" showIcon message="未发现任何问题" />
            ) : (
              <>
                {allErrors.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 8,
                        color: "#ff4d4f",
                        borderBottom: "2px solid #ff4d4f",
                        paddingBottom: 4,
                      }}
                    >
                      关键错误（{allErrors.length}）
                    </div>
                    {allErrors.map((item, idx) => {
                      const isFormat = "type" in item;
                      const isAi = "rule" in item;
                      return (
                        <div
                          key={`err-${idx}`}
                          style={{
                            marginBottom: 12,
                            padding: 12,
                            background: "#fff2f0",
                            borderLeft: "4px solid #ff4d4f",
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <Space size={4}>
                              <Tag color="red">{isFormat ? (item as ReviewIssue).type : RULE_LABEL[(item as AiReviewFindingApp02).rule] || (item as AiReviewFindingApp02).rule}</Tag>
                              {isAi && <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>}
                            </Space>
                          </div>
                          <Text style={{ fontSize: 13, color: "#cf1322" }}>
                            {isFormat ? (item as ReviewIssue).detail : (item as AiReviewFindingApp02).description}
                          </Text>
                          {(isFormat ? (item as ReviewIssue).location : (item as AiReviewFindingApp02).location) && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                位置：{isFormat ? (item as ReviewIssue).location : (item as AiReviewFindingApp02).location}
                              </Text>
                            </div>
                          )}
                          {isAi && (item as AiReviewFindingApp02).suggestion && (
                            <div style={{ marginTop: 4 }}>
                              <Text style={{ fontSize: 12, color: "#389e0d" }}>
                                建议：{(item as AiReviewFindingApp02).suggestion}
                              </Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {allWarnings.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 8,
                        color: "#faad14",
                        borderBottom: "2px solid #faad14",
                        paddingBottom: 4,
                      }}
                    >
                      提醒建议（{allWarnings.length}）
                    </div>
                    {allWarnings.map((item, idx) => {
                      const isFormat = "type" in item;
                      const isAi = "rule" in item;
                      return (
                        <div
                          key={`warn-${idx}`}
                          style={{
                            marginBottom: 12,
                            padding: 12,
                            background: "#fffbe6",
                            borderLeft: "4px solid #faad14",
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <Space size={4}>
                              <Tag color="warning">{isFormat ? (item as ReviewIssue).type : RULE_LABEL[(item as AiReviewFindingApp02).rule] || (item as AiReviewFindingApp02).rule}</Tag>
                              {isAi && <Tag color="purple" style={{ fontSize: 10 }}>AI</Tag>}
                            </Space>
                          </div>
                          <Text style={{ fontSize: 13 }}>
                            {isFormat ? (item as ReviewIssue).detail : (item as AiReviewFindingApp02).description}
                          </Text>
                          {(isFormat ? (item as ReviewIssue).location : (item as AiReviewFindingApp02).location) && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                位置：{isFormat ? (item as ReviewIssue).location : (item as AiReviewFindingApp02).location}
                              </Text>
                            </div>
                          )}
                          {isAi && (item as AiReviewFindingApp02).suggestion && (
                            <div style={{ marginTop: 4 }}>
                              <Text style={{ fontSize: 12, color: "#389e0d" }}>
                                建议：{(item as AiReviewFindingApp02).suggestion}
                              </Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {(formatErrors.length > 0 || formatWarnings.length > 0 || aiFileFindings.length > 0) && (
            <Space direction="vertical" style={{ marginTop: 12, width: "100%" }}>
              <Button
                icon={<CopyOutlined />}
                type="primary"
                block
                onClick={() => {
                  const texts = [
                    ...formatErrors.map((i) => `【${i.type}】${i.location ? `位置：${i.location}，` : ""}${i.detail}`),
                    ...aiErrors.map((f) => `【${RULE_LABEL[f.rule] || f.rule}】${f.location ? `位置：${f.location}，` : ""}${f.description}`),
                  ];
                  if (texts.length === 0) { message.warning("没有关键错误"); return; }
                  navigator.clipboard.writeText(texts.join("\n")).then(
                    () => message.success(`已复制 ${texts.length} 条关键错误`),
                    () => message.error("复制失败"),
                  );
                }}
              >
                仅复制关键错误
              </Button>
              <Button
                icon={<CopyOutlined />}
                block
                onClick={() => {
                  const texts = [
                    ...result.issues.map((i) => `【${i.type}】${i.location ? `位置：${i.location}，` : ""}${i.detail}`),
                    ...aiFileFindings.map((f) => `【${RULE_LABEL[f.rule] || f.rule}】${f.location ? `位置：${f.location}，` : ""}${f.description}`),
                  ];
                  navigator.clipboard.writeText(texts.join("\n")).then(
                    () => message.success(`已复制 ${texts.length} 条`),
                    () => message.error("复制失败"),
                  );
                }}
              >
                复制全部（含提醒）
              </Button>
            </Space>
          )}
        </div>
      </div>
    );
  };

  // Tab 页
  const tabItems = useMemo(() => {
    const items: { key: string; label: React.ReactNode; children: React.ReactNode; closable?: boolean }[] = [];
    if (!reviewResult || reviewResult.mode !== "batch") return items;

    items.push({
      key: "summary",
      label: `审查结果（${reviewResult.results.length}）`,
      children: (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Space>
              <Alert
                type={reviewResult.results.every((r) => r.passed) ? "success" : "warning"}
                showIcon
                message={reviewResult.summary}
                style={{ marginBottom: 0, padding: "4px 12px" }}
              />
            </Space>
            <Segmented
              options={[
                { label: `需修改（${reviewResult.results.filter(needsFix).length}）`, value: "needs_fix" },
                { label: `全部（${reviewResult.results.length}）`, value: "all" },
              ]}
              value={filterMode}
              onChange={(val) => setFilterMode(val as "all" | "needs_fix")}
            />
          </div>

          {aiReviewing && (
            <div style={{ marginBottom: 16, padding: "8px 16px", background: "#e6f4ff", borderRadius: 6, display: "flex", alignItems: "center", gap: 12 }}>
              <LoadingOutlined style={{ color: "#1677ff", fontSize: 16 }} />
              <Text style={{ color: "#1677ff" }}>
                AI 正在审查：{aiFileProgress.find((p) => p.status === "reviewing")?.filename || "..."}
              </Text>
              <Text type="secondary" style={{ marginLeft: "auto", fontSize: 13 }}>
                {aiCompletedFiles}/{aiTotalFiles}
              </Text>
            </div>
          )}

          <div
            style={{
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              overflow: "hidden",
              background: "#fff",
              maxHeight: "calc(100vh - 520px)",
              overflowY: "auto",
            }}
          >
            {filteredResults.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <Empty description={filterMode === "needs_fix" ? "所有文件都已通过，无需修改" : "暂无文件"} />
              </div>
            ) : (
              filteredResults.map(renderFileCard)
            )}
          </div>
        </div>
      ),
    });

    for (const fileId of openFileIds) {
      const r = reviewResult.results.find((x) => x.file_id === fileId);
      if (r) {
        items.push({
          key: r.file_id,
          label: (
            <Space size={4}>
              {needsFix(r) ? (
                <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
              ) : (
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
              )}
              <span>{r.filename.length > 16 ? r.filename.slice(0, 16) + "..." : r.filename}</span>
            </Space>
          ),
          children: renderFilePreview(r),
          closable: true,
        });
      }
    }
    return items;
  }, [reviewResult, openFileIds, filterMode, aiFileProgress, aiReviewing, aiTotalFiles, aiCompletedFiles, expandedRowKeys, aiFindings]);

  // 单文件预览模式
  if (reviewResult && reviewResult.mode === "single") {
    return (
      <div>
        <Title level={3} style={{ marginBottom: 16 }}>
          <FileSearchOutlined style={{ marginRight: 8 }} />
          文件审查
        </Title>
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Button onClick={doClearAll} icon={<ReloadOutlined />}>返回重新上传</Button>
          </Space>
        </Card>
        <Card title="审查结果">
          {renderFilePreview(reviewResult.results[0])}
        </Card>
      </div>
    );
  }

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
                  <LoadingOutlined /> AI分析中（{aiCompletedFiles}/{aiTotalFiles}）
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

      {/* 审查结果 */}
      {reviewResult && (
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
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type={openFileIds.length > 0 ? "editable-card" : "card"}
            hideAdd
            onEdit={(key, action) => {
              if (action === "remove") closeFileTab(key as string);
            }}
            items={tabItems}
          />
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
    </div>
  );
};

export default App02;
