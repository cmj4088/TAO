import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Card,
  Button,
  Table,
  Tabs,
  Space,
  Tag,
  message,
  Alert,
  Tooltip,
  Typography,
  Modal,
} from "antd";
import {
  PlayCircleOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import client from "@/api/client";
import type { ExamRow, TeacherInfo, AllocateResponse, ValidationError, AiReviewFinding, AiReviewResponse } from "@/types";

const { Title, Text } = Typography;

const App01: React.FC = () => {
  const [examRows, setExamRows] = useState<ExamRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  const [dragSource, setDragSource] = useState<{
    rowIndex: number;
    field: string;
    teacher: string;
  } | null>(null);
  const tabHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 避免拖拽时闭包读到过期的 state
  const dragSourceRef = useRef(dragSource);
  dragSourceRef.current = dragSource;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiFindings, setAiFindings] = useState<AiReviewFinding[]>([]);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiElapsed, setAiElapsed] = useState(0);
  const aiPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTaskIdRef = useRef<string>("");
  const aiStartTimeRef = useRef(0);

  // 页面加载时检查 AI 是否已配置
  useEffect(() => {
    client
      .get("/api/app01/ai-review/status")
      .then((res) => setAiConfigured(res.data.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const [examFile, setExamFile] = useState<File | null>(null);
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [examDragOver, setExamDragOver] = useState(false);
  const [contactDragOver, setContactDragOver] = useState(false);
  const examInputRef = useRef<HTMLInputElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback(
    (file: File, target: "exam" | "contact") => {
      if (!file.name.endsWith(".xlsx")) {
        message.warning("只接受 .xlsx 文件");
        return;
      }
      if (target === "exam") {
        setExamFile(file);
      } else {
        setContactFile(file);
      }
    },
    [],
  );

  const handleDragEvent = useCallback(
    (e: React.DragEvent, target: "exam" | "contact", over: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      if (over) {
        // 只接受单个文件
        if (e.dataTransfer.items.length !== 1) return;
        const item = e.dataTransfer.items[0];
        if (item.kind !== "file") return;
      }
      if (target === "exam") {
        setExamDragOver(over);
      } else {
        setContactDragOver(over);
      }
    },
    [],
  );

  const handleZoneDrop = useCallback(
    (e: React.DragEvent, target: "exam" | "contact") => {
      e.preventDefault();
      e.stopPropagation();
      setExamDragOver(false);
      setContactDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 1) {
        message.warning("每次只能拖入 1 个文件");
        return;
      }
      if (files.length === 0) return;
      handleFileDrop(files[0], target);
    },
    [handleFileDrop],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, target: "exam" | "contact") => {
      const files = Array.from(e.target.files || []);
      if (files.length > 1) {
        message.warning("每次只能选择 1 个文件");
        e.target.value = "";
        return;
      }
      if (files.length === 0) return;
      handleFileDrop(files[0], target);
      e.target.value = "";
    },
    [handleFileDrop],
  );

  const renderDropZone = (
    target: "exam" | "contact",
    file: File | null,
    dragOver: boolean,
    label: string,
    description: string,
  ) => {
    const inputRef = target === "exam" ? examInputRef : contactInputRef;
    const borderColor = dragOver ? "#1677ff" : file ? "#52c41a" : "#d9d9d9";
    const bgColor = dragOver ? "#e6f4ff" : file ? "#f6ffed" : "#fafafa";

    return (
      <div
        onDrop={(e) => handleZoneDrop(e, target)}
        onDragOver={(e) => handleDragEvent(e, target, true)}
        onDragLeave={(e) => handleDragEvent(e, target, false)}
        onClick={() => inputRef.current?.click()}
        style={{
          flex: 1,
          border: `2px dashed ${borderColor}`,
          borderRadius: 8,
          padding: file ? "12px 16px" : "24px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: bgColor,
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 80,
        }}
      >
        {file ? (
          <Space>
            <FileExcelOutlined style={{ fontSize: 20, color: "#52c41a" }} />
            <Text strong style={{ fontSize: 14 }}>
              {file.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({(file.size / 1024).toFixed(1)} KB)
            </Text>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                if (target === "exam") setExamFile(null);
                else setContactFile(null);
              }}
            />
          </Space>
        ) : (
          <div>
            <InboxOutlined style={{ fontSize: 28, color: "#1677ff", marginBottom: 8 }} />
            <div>
              <Text strong>{label}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {description}
              </Text>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e, target)}
        />
      </div>
    );
  };

  const doUploadBoth = useCallback(async () => {
    if (!examFile || !contactFile) {
      message.warning("请先选择考试安排表和通讯录");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("exam_file", examFile);
    formData.append("contact_file", contactFile);
    try {
      const res = await client.post("/api/app01/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setExamRows(res.data.exam_rows);
      setTeachers(res.data.teachers);
      setWarnings([]);
      setErrors([]);
      message.success(
        `解析完成：${res.data.exam_rows.length} 条考试安排，${res.data.teachers.length} 位教师`
      );
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "上传失败");
    } finally {
      setLoading(false);
    }
  }, [examFile, contactFile]);

  const doAllocate = useCallback(async () => {
    if (examRows.length === 0) {
      message.warning("请先上传文件");
      return;
    }
    setLoading(true);
    try {
      const allocateRes = await client.post<AllocateResponse>("/api/app01/allocate", {
        exam_rows: examRows,
        teachers,
      });
      setExamRows(allocateRes.data.exam_rows);
      setWarnings(allocateRes.data.warnings);
      setAiFindings([]);

      // 分配后自动校验
      try {
        const validateRes = await client.post("/api/app01/validate", {
          exam_rows: allocateRes.data.exam_rows,
          teachers,
        });
        setErrors(validateRes.data.errors);
        if (validateRes.data.errors.length > 0) {
          message.warning(
            `分配完成，发现 ${validateRes.data.errors.length} 个违规项（已标红）`,
          );
        } else if (allocateRes.data.warnings.length > 0) {
          message.warning(`分配完成，但有 ${allocateRes.data.warnings.length} 条警告`);
        } else {
          message.success("分配完成，无违规");
        }
      } catch {
        setErrors([]);
        if (allocateRes.data.warnings.length > 0) {
          message.warning(`分配完成，但有 ${allocateRes.data.warnings.length} 条警告`);
        } else {
          message.success("分配完成，无警告");
        }
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "分配失败");
    } finally {
      setLoading(false);
    }
  }, [examRows, teachers]);

  const doValidate = useCallback(async () => {
    if (examRows.length === 0) {
      message.warning("请先执行分配");
      return;
    }
    setLoading(true);
    try {
      const res = await client.post("/api/app01/validate", {
        exam_rows: examRows,
        teachers,
      });
      setErrors(res.data.errors);
      if (res.data.errors.length === 0) {
        message.success("校验通过，无违规项");
      } else {
        message.warning(`发现 ${res.data.errors.length} 个违规项`);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "校验失败");
    } finally {
      setLoading(false);
    }
  }, [examRows, teachers]);

  const doAiReview = useCallback(async () => {
    if (examRows.length === 0) {
      message.warning("请先执行分配");
      return;
    }
    if (!aiConfigured) {
      message.warning("未接入API，请在管理后台配置大模型Key");
      return;
    }
    setAiReviewing(true);
    setAiElapsed(0);
    setAiFindings([]);

    try {
      // 启动AI审查任务
      const startRes = await client.post("/api/app01/ai-review/start", {
        exam_rows: examRows,
        teachers,
      });
      const taskId = startRes.data.task_id;
      aiTaskIdRef.current = taskId;
      aiStartTimeRef.current = Date.now();

      // 每秒轮询进度
      aiPollTimer.current = setInterval(async () => {
        setAiElapsed(Math.round((Date.now() - aiStartTimeRef.current) / 1000));
        try {
          const progressRes = await client.get(`/api/app01/ai-review/progress/${taskId}`);
          const { status, findings, error } = progressRes.data;

          if (status === "done") {
            clearInterval(aiPollTimer.current!);
            aiPollTimer.current = null;
            setAiReviewing(false);
            setAiFindings(findings || []);
            if (!findings || findings.length === 0) {
              message.success("AI审查通过，未发现问题");
            } else {
              message.warning(`AI审查发现 ${findings.length} 个潜在问题`);
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
    } catch (err: any) {
      setAiReviewing(false);
      message.error(err?.response?.data?.detail || "AI审查启动失败");
    }
  }, [examRows, teachers, aiConfigured]);

  const doExport = useCallback(async () => {
    if (examRows.length === 0) {
      message.warning("请先执行分配");
      return;
    }
    if (errors.length > 0) {
      Modal.confirm({
        title: "存在违规项",
        content: `当前有 ${errors.length} 个违规项尚未处理，确定要导出吗？`,
        okText: "仍然导出",
        cancelText: "返回修改",
        okButtonProps: { danger: true },
        onOk: () => doActualExport(),
      });
    } else {
      doActualExport();
    }
  }, [examRows, errors]);

  const doActualExport = useCallback(async () => {
    try {
      const res = await client.get("/api/app01/export", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "监考安排结果.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (err: any) {
      message.error("导出失败：" + (err?.response?.data?.detail || err?.message || "未知错误"));
    }
  }, []);

  const handleDragStart = (rowIndex: number, field: string, teacher: string) => {
    setDragSource({ rowIndex, field, teacher });
  };

  const handleDrop = useCallback(
    async (targetRowIndex: number, targetField: string) => {
      if (!dragSource) return;
      if (dragSource.rowIndex === targetRowIndex && dragSource.field === targetField) {
        setDragSource(null);
        return;
      }

      const newRows = [...examRows];
      const srcRow = newRows.find((r) => r.index === dragSource.rowIndex);
      const tgtRow = newRows.find((r) => r.index === targetRowIndex);

      if (!srcRow || !tgtRow) {
        setDragSource(null);
        return;
      }

      const srcField = dragSource.field as "监考1" | "监考2";
      const tgtField = targetField as "监考1" | "监考2";
      const srcVal = srcRow[srcField];
      const tgtVal = tgtRow[tgtField];

      srcRow[srcField] = tgtVal;
      tgtRow[tgtField] = srcVal;
      setExamRows([...newRows]);
      setDragSource(null);

      try {
        await client.post("/api/app01/swap", {
          row_index: targetRowIndex,
          position: targetField,
          new_teacher: srcVal || "",
        });
        // 交换后自动校验
        const validateRes = await client.post("/api/app01/validate", {
          exam_rows: newRows,
          teachers,
        });
        setErrors(validateRes.data.errors);
      } catch {
        // 静默失败
      }
    },
    [dragSource, examRows, teachers]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // 从考试时间中提取日期，如 "2026-01-20(09:00-10:30)" → "2026-01-20"
  const extractDate = (time: string) => {
    const m = time.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : time;
  };

  // 按日期分组
  const dateGroups: { date: string; rows: ExamRow[] }[] = [];
  const dateMap = new Map<string, ExamRow[]>();
  for (const r of examRows) {
    const d = extractDate(r.考试时间);
    if (!dateMap.has(d)) dateMap.set(d, []);
    dateMap.get(d)!.push(r);
  }
  for (const [date, rows] of dateMap) {
    dateGroups.push({ date, rows });
  }
  dateGroups.sort((a, b) => a.date.localeCompare(b.date));

  // 错误行映射
  const errorMap = new Map<string, ValidationError[]>();
  for (const e of errors) {
    const key = `${e.row_index}-${e.field}`;
    if (!errorMap.has(key)) errorMap.set(key, []);
    errorMap.get(key)!.push(e);
  }

  // AI 审查结果映射（用于单元格着色）
  const aiErrorMap = new Map<string, AiReviewFinding[]>();
  for (const f of aiFindings) {
    for (const cell of f.affected_cells) {
      const key = `${cell.row_index}-${cell.field}`;
      if (!aiErrorMap.has(key)) aiErrorMap.set(key, []);
      aiErrorMap.get(key)!.push(f);
    }
  }

  const buildColumns = (): ColumnsType<ExamRow> => [
    { title: "序号", dataIndex: "index", width: 55 },
    { title: "场次", dataIndex: "场次", width: 55 },
    { title: "班级", dataIndex: "班级名称", width: 160, ellipsis: true },
    { title: "课程", dataIndex: "课程名称", width: 200, ellipsis: true },
    {
      title: "任课教师",
      dataIndex: "任课教师",
      width: 120,
      render: (teachers: string[]) =>
        teachers.map((t) => <Tag key={t} color="default">{t}</Tag>),
    },
    { title: "时间", dataIndex: "考试时间", width: 180 },
    { title: "地点", dataIndex: "考试地点", width: 110, ellipsis: true },
    { title: "人数", dataIndex: "人数", width: 50 },
    {
      title: "监考1",
      dataIndex: "监考1",
      width: 90,
      render: (val: string | null, record: ExamRow) => {
        const key = `${record.index}-监考1`;
        const cellErrors = errorMap.get(key);
        const isError = cellErrors && cellErrors.length > 0;
        const cellAiErrors = aiErrorMap.get(key);
        const isAiError = cellAiErrors && cellAiErrors.length > 0;
        const tagColor = isError ? "red" : isAiError ? "orange" : "blue";
        const content = val ? (
          <Tag
            color={tagColor}
            draggable
            onDragStart={() => handleDragStart(record.index, "监考1", val || "")}
            style={{ cursor: "grab", margin: 0 }}
          >
            {val}
          </Tag>
        ) : (
          <Text
            type="secondary"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(record.index, "监考1")}
            style={{
              minWidth: 60,
              display: "inline-block",
              padding: "2px 8px",
              border: "1px dashed #d9d9d9",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            拖入
          </Text>
        );

        const tooltipParts: string[] = [];
        if (cellErrors) tooltipParts.push(...cellErrors.map((e) => e.reason));
        if (cellAiErrors) tooltipParts.push(...cellAiErrors.map((e) => `[AI] ${e.description}`));

        if (tooltipParts.length > 0) {
          return (
            <Tooltip title={tooltipParts.join("；")}>
              {content}
            </Tooltip>
          );
        }
        return (
          <span onDragOver={handleDragOver} onDrop={() => handleDrop(record.index, "监考1")}>
            {content}
          </span>
        );
      },
    },
    {
      title: "监考2",
      dataIndex: "监考2",
      width: 90,
      render: (val: string | null, record: ExamRow) => {
        const key = `${record.index}-监考2`;
        const cellErrors = errorMap.get(key);
        const isError = cellErrors && cellErrors.length > 0;
        const cellAiErrors = aiErrorMap.get(key);
        const isAiError = cellAiErrors && cellAiErrors.length > 0;
        const tagColor = isError ? "red" : isAiError ? "orange" : "green";
        const content = val ? (
          <Tag
            color={tagColor}
            draggable
            onDragStart={() => handleDragStart(record.index, "监考2", val || "")}
            style={{ cursor: "grab", margin: 0 }}
          >
            {val}
          </Tag>
        ) : (
          <Text
            type="secondary"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(record.index, "监考2")}
            style={{
              minWidth: 60,
              display: "inline-block",
              padding: "2px 8px",
              border: "1px dashed #d9d9d9",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            拖入
          </Text>
        );

        const tooltipParts: string[] = [];
        if (cellErrors) tooltipParts.push(...cellErrors.map((e) => e.reason));
        if (cellAiErrors) tooltipParts.push(...cellAiErrors.map((e) => `[AI] ${e.description}`));

        if (tooltipParts.length > 0) {
          return (
            <Tooltip title={tooltipParts.join("；")}>
              {content}
            </Tooltip>
          );
        }
        return (
          <span onDragOver={handleDragOver} onDrop={() => handleDrop(record.index, "监考2")}>
            {content}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        监考分配
      </Title>

      <Card title="第一步：上传文件" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {renderDropZone("exam", examFile, examDragOver, "考试安排表", "拖入或点击选择 .xlsx 文件")}
            {renderDropZone("contact", contactFile, contactDragOver, "教师通讯录", "拖入或点击选择 .xlsx 文件")}
          </div>
          <Button
            type="primary"
            onClick={doUploadBoth}
            loading={loading}
            disabled={!examFile || !contactFile}
          >
            解析文件
          </Button>
        </Space>
      </Card>

      <Card
        title="第二步：预览与调整"
        extra={
          <Text type="secondary">
            {examRows.length > 0 && `共 ${examRows.length} 条记录，${dateGroups.length} 个考试日`}
          </Text>
        }
      >
        {examRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
            <InboxOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <br />
            请先上传文件并点击"解析文件"
          </div>
        ) : (
          <>
            <Space style={{ marginBottom: 16 }} wrap>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={doAllocate}
                loading={loading}
              >
                执行分配
              </Button>
              {aiConfigured ? (
                <Tooltip title={aiReviewing ? `AI正在分析中...（已等待 ${aiElapsed} 秒）` : undefined}>
                  <Button
                    icon={<RobotOutlined />}
                    onClick={doAiReview}
                    loading={aiReviewing}
                  >
                    {aiReviewing ? `分析中(${aiElapsed}s)` : "AI审查"}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="未接入API，请在管理后台配置大模型Key">
                  <Button icon={<RobotOutlined />} disabled>
                    AI审查
                  </Button>
                </Tooltip>
              )}
              <Button icon={<ExportOutlined />} onClick={doExport}>
                导出 Excel
              </Button>
            </Space>

            {warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                closable
                message={`${warnings.length} 条警告`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {warnings.length > 5 && <li>...共 {warnings.length} 条</li>}
                  </ul>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {errors.length > 0 && (
              <Alert
                type="error"
                showIcon
                closable
                message={`${errors.length} 个违规项`}
                description="红色标记的单元格存在违规，鼠标悬停查看详情"
                style={{ marginBottom: 16 }}
              />
            )}

            {aiFindings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                closable
                message={`AI审查：${aiFindings.length} 个潜在问题`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiFindings.map((f, i) => (
                      <li key={i}>
                        <Tag color={f.rule === "time_overlap" ? "orange" : "gold"}>
                          {f.rule === "time_overlap" ? "时间重叠" : "应监考自己班级"}
                        </Tag>
                        [{f.teacher}] {f.description}
                      </li>
                    ))}
                  </ul>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            <Tabs
              activeKey={activeTab || dateGroups[0]?.date}
              onChange={setActiveTab}
              destroyInactiveTabPane={false}
              items={dateGroups.map((g) => ({
                key: g.date,
                label: (
                  <span
                    style={{ display: "inline-block", width: "100%" }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragSourceRef.current && activeTabRef.current !== g.date) {
                        if (!tabHoverTimer.current) {
                          tabHoverTimer.current = setTimeout(() => {
                            setActiveTab(g.date);
                            tabHoverTimer.current = null;
                          }, 600);
                        }
                      }
                    }}
                    onDragLeave={() => {
                      if (tabHoverTimer.current) {
                        clearTimeout(tabHoverTimer.current);
                        tabHoverTimer.current = null;
                      }
                    }}
                  >
                    {g.date}（{g.rows.length}场）
                  </span>
                ),
                children: (
                  <Table
                    columns={buildColumns()}
                    dataSource={g.rows}
                    rowKey="index"
                    scroll={{ x: 1000 }}
                    size="small"
                    pagination={false}
                  />
                ),
              }))}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default App01;
