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
  UndoOutlined,
  ExportOutlined,
  InboxOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  RobotOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import client from "@/api/client";
import type { ExamRow, TeacherInfo, AllocateResponse, ValidationError } from "@/types";

const { Title, Text } = Typography;

const App01: React.FC = () => {
  const [examRows, setExamRows] = useState<ExamRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [teacherLoads, setTeacherLoads] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  const [viewMode, setViewMode] = useState<"date" | "teacher">("date");
  const [dragSource, setDragSource] = useState<{
    rowIndex: number;
    field: string;
    teacher: string;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<ExamRow[][]>([]);
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;
  const teachersRef = useRef(teachers);
  teachersRef.current = teachers;
  const examRowsRef = useRef(examRows);
  examRowsRef.current = examRows;
  const tabHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSourceRef = useRef(dragSource);
  dragSourceRef.current = dragSource;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const stickerTeacherRef = useRef<string | null>(null);

  // AI 审查状态
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiFindings, setAiFindings] = useState<{ severity: string; description: string; suggestion: string }[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState("");
  const aiEventSourceRef = useRef<EventSource | null>(null);

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
    setUndoStack((prev) => {
      const next = [...prev, examRows];
      if (next.length > 50) next.shift();
      return next;
    });
    setLoading(true);
    try {
      const allocateRes = await client.post<AllocateResponse>("/api/app01/allocate", {
        exam_rows: examRows,
        teachers,
      });
      setExamRows(allocateRes.data.exam_rows);
      setWarnings(allocateRes.data.warnings);
      setTeacherLoads(allocateRes.data.teacher_loads || {});

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

  const doReplace = useCallback(
    async (rowIndex: number, field: "监考1" | "监考2", newTeacher: string) => {
      setUndoStack((prev) => {
        const next = [...prev, examRows];
        if (next.length > 50) next.shift();
        return next;
      });
      const newRows = [...examRows];
      const tgtRow = newRows.find((r) => r.index === rowIndex);
      if (!tgtRow) return;
      tgtRow[field] = newTeacher || null;
      setExamRows(newRows);

      try {
        await client.post("/api/app01/replace", {
          row_index: rowIndex,
          position: field,
          new_teacher: newTeacher,
        });
        const newLoadMap = new Map<string, number>();
        for (const r of newRows) {
          if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1);
          if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1);
        }
        setTeacherLoads(Object.fromEntries(newLoadMap));
        const validateRes = await client.post("/api/app01/validate", {
          exam_rows: newRows,
          teachers,
        });
        setErrors(validateRes.data.errors);
        message.success("替换成功");
      } catch {
        // 静默
      }
    },
    [examRows, teachers],
  );

  const handleDragStart = (rowIndex: number, field: string, teacher: string) => {
    stickerTeacherRef.current = null;
    setDragSource({ rowIndex, field, teacher });
  };

  const handleStickerDragStart = (teacherName: string) => {
    stickerTeacherRef.current = teacherName;
    setDragSource(null);
  };

  const handleDrop = useCallback(
    async (targetRowIndex: number, targetField: string) => {
      if (stickerTeacherRef.current) {
        const stickerTeacher = stickerTeacherRef.current;
        stickerTeacherRef.current = null;
        setDragSource(null);
        await doReplace(targetRowIndex, targetField as "监考1" | "监考2", stickerTeacher);
        return;
      }

      if (!dragSource) return;
      if (dragSource.rowIndex === targetRowIndex && dragSource.field === targetField) {
        setDragSource(null);
        return;
      }

      setUndoStack((prev) => {
        const next = [...prev, examRows];
        if (next.length > 50) next.shift();
        return next;
      });

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
          source_row_index: dragSource.rowIndex,
          source_position: dragSource.field,
          target_row_index: targetRowIndex,
          target_position: targetField,
        });
        const newLoadMap = new Map<string, number>();
        for (const r of newRows) {
          if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1);
          if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1);
        }
        setTeacherLoads(Object.fromEntries(newLoadMap));
        const validateRes = await client.post("/api/app01/validate", {
          exam_rows: newRows,
          teachers,
        });
        setErrors(validateRes.data.errors);
      } catch {
        // 静默失败
      }
    },
    [dragSource, examRows, teachers, doReplace],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const doUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1];
    const remaining = undoStackRef.current.length - 1;
    setUndoStack((prev) => prev.slice(0, -1));
    setExamRows(snapshot);
    const newLoadMap = new Map<string, number>();
    for (const r of snapshot) {
      if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1);
      if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1);
    }
    setTeacherLoads(Object.fromEntries(newLoadMap));
    client.post("/api/app01/set-rows", { exam_rows: snapshot }).catch(() => {});
    client.post("/api/app01/validate", {
      exam_rows: snapshot,
      teachers: teachersRef.current,
    }).then((res) => { setErrors(res?.data?.errors || []); }).catch(() => {});
    message.info(`已撤销（剩余 ${remaining} 步）`);
  }, []);

  // AI 审查
  const doAiReview = useCallback(async () => {
    if (examRows.length === 0) {
      message.warning("请先执行分配");
      return;
    }
    setAiReviewOpen(true);
    setAiReviewing(true);
    setAiStreamText("");
    setAiFindings([]);
    setAiSummary("");
    setAiError("");

    try {
      const res = await client.post("/api/app01/ai-review");
      const taskId = res.data.task_id;
      const baseUrl = client.defaults.baseURL || "http://localhost:8002";
      const url = `${baseUrl}/api/app01/ai-review/stream/${taskId}`;
      const es = new EventSource(url);
      aiEventSourceRef.current = es;

      es.addEventListener("reasoning", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setAiStreamText((prev) => prev + data.content);
      });

      es.addEventListener("token", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setAiStreamText((prev) => prev + data.content);
      });

      es.addEventListener("done", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setAiFindings(data.findings || []);
        setAiSummary(data.summary || "");
        setAiReviewing(false);
        es.close();
      });

      es.addEventListener("review_error", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setAiError(data.error || "AI 审查出错");
        setAiReviewing(false);
        es.close();
      });

      es.addEventListener("error", () => {
        // EventSource 原生错误（连接断开等），不做额外处理
        if (aiEventSourceRef.current) {
          setAiReviewing(false);
          es.close();
        }
      });

      es.addEventListener("task_done", () => {
        es.close();
      });
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "AI审查启动失败");
      setAiReviewing(false);
    }
  }, [examRows]);

  const closeAiReview = useCallback(() => {
    if (aiEventSourceRef.current) {
      aiEventSourceRef.current.close();
    }
    setAiReviewOpen(false);
  }, []);

  // 一键跳转到错误行
  const jumpToError = useCallback((rowIndex: number) => {
    const row = examRows.find((r) => r.index === rowIndex);
    if (!row) return;
    const m = row.考试时间.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = m ? m[1] : row.考试时间;

    setViewMode("date");
    setActiveTab(date);

    // 延迟 + 重试，等 DOM 更新
    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector(`[data-row-key="${rowIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement).style.transition = "background 0.3s";
        (el as HTMLElement).style.background = "#fff2f0";
        setTimeout(() => {
          (el as HTMLElement).style.background = "";
        }, 2000);
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryScroll, 100);
      }
    };
    setTimeout(tryScroll, 100);
  }, [examRows]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z" && !e.repeat) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doUndo]);

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

  // 统计实际监考场次
  const loadMap = new Map<string, number>();
  for (const r of examRows) {
    if (r.监考1) loadMap.set(r.监考1, (loadMap.get(r.监考1) || 0) + 1);
    if (r.监考2) loadMap.set(r.监考2, (loadMap.get(r.监考2) || 0) + 1);
  }

  // 教师信息映射
  const teacherInfoMap = new Map(teachers.map((t) => [t.name, t]));
  const teacherSlotsMap = new Map(teachers.map((t) => [t.name, t.slots]));

  // 按老师汇总
  interface TeacherSession {
    date: string;
    time: string;
    location: string;
    className: string;
    courseName: string;
    sessionName: string;
    type: string; // "监考1" | "监考2"
  }
  const teacherSummaryMap = new Map<string, TeacherSession[]>();
  for (const r of examRows) {
    const date = extractDate(r.考试时间);
    const base = { date, time: r.考试时间, location: r.考试地点, className: r.班级名称, courseName: r.课程名称, sessionName: r.场次 };
    if (r.监考1) {
      if (!teacherSummaryMap.has(r.监考1)) teacherSummaryMap.set(r.监考1, []);
      teacherSummaryMap.get(r.监考1)!.push({ ...base, type: "监考1" });
    }
    if (r.监考2) {
      if (!teacherSummaryMap.has(r.监考2)) teacherSummaryMap.set(r.监考2, []);
      teacherSummaryMap.get(r.监考2)!.push({ ...base, type: "监考2" });
    }
  }
  const teacherSummaries = Array.from(teacherSummaryMap.entries())
    .map(([name, sessions]) => {
      const info = teacherInfoMap.get(name);
      return {
        name,
        department: info?.department || "",
        slots: info?.slots || 0,
        group: info?.group || "",
        count: sessions.length,
        sessions,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));

  const errorMap = new Map<string, ValidationError[]>();
  for (const e of errors) {
    const key = `${e.row_index}-${e.field}`;
    if (!errorMap.has(key)) errorMap.set(key, []);
    errorMap.get(key)!.push(e);
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
      width: 110,
      render: (val: string | null, record: ExamRow) => {
        const key = `${record.index}-监考1`;
        const cellErrors = errorMap.get(key);
        const isError = cellErrors && cellErrors.length > 0;
        const actual = val ? (loadMap.get(val) || 0) : 0;
        const target = val ? (teacherSlotsMap.get(val) || 0) : 0;
        let tagColor = "blue";
        if (isError) tagColor = "red";
        else if (val && actual > target) tagColor = "red";
        else if (val && actual < target) tagColor = "blue";
        const label = val ? `${val}(${actual}/${target})` : "";
        const content = val ? (
          <Tag
            color={tagColor}
            draggable
            onDragStart={() => handleDragStart(record.index, "监考1", val || "")}
            style={{ cursor: "grab", margin: 0 }}
          >
            {label}
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
      width: 110,
      render: (val: string | null, record: ExamRow) => {
        const key = `${record.index}-监考2`;
        const cellErrors = errorMap.get(key);
        const isError = cellErrors && cellErrors.length > 0;
        const actual = val ? (loadMap.get(val) || 0) : 0;
        const target = val ? (teacherSlotsMap.get(val) || 0) : 0;
        let tagColor = "green";
        if (isError) tagColor = "red";
        else if (val && actual > target) tagColor = "red";
        else if (val && actual < target) tagColor = "blue";
        const label = val ? `${val}(${actual}/${target})` : "";
        const content = val ? (
          <Tag
            color={tagColor}
            draggable
            onDragStart={() => handleDragStart(record.index, "监考2", val || "")}
            style={{ cursor: "grab", margin: 0 }}
          >
            {label}
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
              <Tooltip title="撤销上一步（Ctrl+Z）">
                <Button
                  icon={<UndoOutlined />}
                  onClick={doUndo}
                  disabled={undoStack.length === 0}
                >
                  撤销{undoStack.length > 0 ? `（${undoStack.length}）` : ""}
                </Button>
              </Tooltip>
              <Button icon={<ExportOutlined />} onClick={doExport}>
                导出 Excel
              </Button>
              <Button
                icon={aiReviewing ? <LoadingOutlined /> : <RobotOutlined />}
                onClick={doAiReview}
                disabled={aiReviewing}
              >
                AI 审查
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
              <>
                <Alert
                  type="error"
                  showIcon
                  closable
                  message={`${errors.length} 个违规项`}
                  description={'点击下方「跳转 →」按钮定位到问题单元格'}
                  style={{ marginBottom: 8 }}
                />
                <div style={{
                  maxHeight: 240, overflow: "auto", marginBottom: 16,
                  border: "1px solid #ffccc7", borderRadius: 6, padding: "4px 8px",
                  background: "#fff",
                }}>
                  {errors.slice(0, 30).map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 0",
                        borderBottom: i < errors.length - 1 && i < 29 ? "1px solid #ffd8d2" : "none",
                        fontSize: 13,
                      }}
                    >
                      <Tag color="error" style={{ margin: 0, flexShrink: 0 }}>
                        {e.field || "全局"}
                      </Tag>
                      <Text style={{ flex: 1, wordBreak: "break-all" }}>
                        {e.row_index > 0 ? (
                          <Text type="secondary">第{e.row_index}行 </Text>
                        ) : null}
                        {e.teacher ? `${e.teacher}：` : ""}
                        {e.reason}
                      </Text>
                      {e.row_index > 0 && (
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          onClick={() => jumpToError(e.row_index)}
                          style={{ flexShrink: 0, fontSize: 12 }}
                        >
                          跳转 →
                        </Button>
                      )}
                    </div>
                  ))}
                  {errors.length > 30 && (
                    <div style={{ padding: "6px 0", color: "#999", fontSize: 12, textAlign: "center" }}>
                      ...还有 {errors.length - 30} 个违规项
                    </div>
                  )}
                </div>
              </>
            )}

            <Tabs
              activeKey={viewMode}
              onChange={(key) => setViewMode(key as "date" | "teacher")}
              items={[
                {
                  key: "date",
                  label: "按日期查看",
                  children: (
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
                              if ((dragSourceRef.current || stickerTeacherRef.current) && activeTabRef.current !== g.date) {
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
                        children: (() => {
                          // 计算该日期分组内的未达目标老师
                          const stickers: { name: string; current: number; target: number }[] = [];
                          for (const [name, info] of teacherInfoMap) {
                            const current = loadMap.get(name) || 0;
                            const target = info.slots;
                            if (current < target) {
                              // 检查当天这个老师是否有空
                              const daySlots = new Set<string>();
                              for (const r of g.rows) {
                                if ((r.监考1 === name || r.监考2 === name)) {
                                  daySlots.add(r.考试时间);
                                }
                              }
                              const allDaySlots = new Set(g.rows.map(r => r.考试时间));
                              const available = Array.from(allDaySlots).some(slot => !daySlots.has(slot)) || daySlots.size === 0;
                              if (available) {
                                stickers.push({ name, current, target });
                              }
                            }
                          }
                          stickers.sort((a, b) => (b.target - b.current) - (a.target - a.current) || a.name.localeCompare(b.name, "zh"));

                          return (
                            <>
                              <Table
                                columns={buildColumns()}
                                dataSource={g.rows}
                                rowKey="index"
                                scroll={{ x: 1000 }}
                                size="small"
                                pagination={false}
                              />
                              {stickers.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    padding: "10px 12px",
                                    background: "#fffbe6",
                                    border: "1px solid #ffe58f",
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                                    未达目标老师（拖拽到单元格替换）：
                                  </Text>
                                  <Space size={[4, 4]} wrap>
                                    {stickers.map((s) => (
                                      <Tag
                                        key={s.name}
                                        color="orange"
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.effectAllowed = "move";
                                          handleStickerDragStart(s.name);
                                        }}
                                        onDragEnd={() => {
                                          stickerTeacherRef.current = null;
                                        }}
                                        style={{ cursor: "grab" }}
                                      >
                                        {s.name}（{s.current}/{s.target}场）
                                      </Tag>
                                    ))}
                                  </Space>
                                </div>
                              )}
                            </>
                          );
                        })(),
                      }))}
                    />
                  ),
                },
                {
                  key: "teacher",
                  label: "按老师查看",
                  children: (
                    <Table
                      dataSource={teacherSummaries}
                      rowKey="name"
                      size="small"
                      pagination={false}
                      expandable={{
                        expandedRowRender: (record) => (
                          <Table
                            dataSource={record.sessions}
                            rowKey={(_, i) => String(i)}
                            size="small"
                            pagination={false}
                            columns={[
                              { title: "日期", dataIndex: "date", width: 110 },
                              { title: "时间", dataIndex: "time", width: 180 },
                              { title: "地点", dataIndex: "location", width: 110, ellipsis: true },
                              { title: "班级", dataIndex: "className", width: 160, ellipsis: true },
                              { title: "课程", dataIndex: "courseName", width: 200, ellipsis: true },
                              { title: "场次", dataIndex: "sessionName", width: 60 },
                              { title: "类型", dataIndex: "type", width: 70 },
                            ]}
                          />
                        ),
                        rowExpandable: (record) => record.count > 0,
                      }}
                      columns={[
                        { title: "教师姓名", dataIndex: "name", width: 100, sorter: (a: any, b: any) => a.name.localeCompare(b.name, "zh") },
                        {
                          title: "部门/岗位",
                          dataIndex: "department",
                          width: 160,
                          ellipsis: true,
                          render: (dept: string) => dept ? <Text type="secondary" style={{ fontSize: 13 }}>{dept}</Text> : <Text type="secondary">—</Text>,
                        },
                        {
                          title: "分组",
                          dataIndex: "group",
                          width: 80,
                          render: (group: string) => group ? <Tag color="purple">{group}</Tag> : <Tag color="default">无</Tag>,
                        },
                        {
                          title: "目标场次",
                          dataIndex: "slots",
                          width: 90,
                          sorter: (a: any, b: any) => a.slots - b.slots,
                          render: (slots: number) => <Text>{slots} 场</Text>,
                        },
                        {
                          title: "已排/目标",
                          dataIndex: "count",
                          width: 150,
                          sorter: (a: any, b: any) => a.count - b.count,
                          render: (count: number, record: any) => {
                            const target = record.slots;
                            let color = "green";
                            if (count > target) color = "red";
                            else if (count < target) color = "blue";
                            return <Tag color={color}>{count} / {target} 场</Tag>;
                          },
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Card>

      <Modal
        open={aiReviewOpen}
        onCancel={closeAiReview}
        footer={null}
        width={720}
        title={
          <Space>
            <RobotOutlined />
            AI 审查结果
          </Space>
        }
      >
        {aiReviewing && (
          <div>
            <div style={{ textAlign: "center", padding: 24 }}>
              <LoadingOutlined style={{ fontSize: 32, color: "#1677ff" }} />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">AI 正在分析监考安排...</Text>
              </div>
            </div>
            {aiStreamText && (
              <div style={{
                maxHeight: 300, overflow: "auto", padding: "12px 16px",
                background: "#f6f8fa", borderRadius: 6, whiteSpace: "pre-wrap",
                fontSize: 13, lineHeight: 1.6, color: "#555",
              }}>
                {aiStreamText}
              </div>
            )}
          </div>
        )}

        {!aiReviewing && aiError && (
          <Alert type="error" showIcon message={aiError} />
        )}

        {!aiReviewing && !aiError && aiFindings.length === 0 && (
          <Alert type="success" showIcon message="未发现问题，安排合理" />
        )}

        {!aiReviewing && aiFindings.length > 0 && (
          <div>
            {aiSummary && (
              <Alert
                type={aiFindings.some((f) => f.severity === "error") ? "error" : "warning"}
                showIcon
                message={aiSummary}
                style={{ marginBottom: 16 }}
              />
            )}
            {aiFindings.map((f, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  padding: "12px 16px",
                  background: f.severity === "error" ? "#fff2f0" : "#fffbe6",
                  borderLeft: `4px solid ${f.severity === "error" ? "#ff4d4f" : "#faad14"}`,
                  borderRadius: 4,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Space size={4}>
                    <Tag color={f.severity === "error" ? "red" : "warning"}>
                      {f.severity === "error" ? "错误" : "提醒"}
                    </Tag>
                  </Space>
                </div>
                <Text style={{ fontSize: 13, color: f.severity === "error" ? "#cf1322" : undefined }}>
                  {f.description}
                </Text>
                {f.suggestion && (
                  <div style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: "#389e0d" }}>建议：{f.suggestion}</Text>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default App01;
