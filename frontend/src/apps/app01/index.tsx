import React, { useState, useCallback } from "react";
import {
  Card,
  Upload,
  Button,
  Table,
  Tabs,
  Space,
  Tag,
  message,
  Alert,
  Tooltip,
  Typography,
} from "antd";
import {
  UploadOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload";
import client from "@/api/client";
import type { ExamRow, TeacherInfo, AllocateResponse, ValidationError } from "@/types";

const { Title, Text } = Typography;

const App01: React.FC = () => {
  const [examRows, setExamRows] = useState<ExamRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragSource, setDragSource] = useState<{
    rowIndex: number;
    field: string;
    teacher: string;
  } | null>(null);

  const [examFile, setExamFile] = useState<File | null>(null);
  const [contactFile, setContactFile] = useState<File | null>(null);

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
      const res = await client.post<AllocateResponse>("/api/app01/allocate", {
        exam_rows: examRows,
        teachers,
      });
      setExamRows(res.data.exam_rows);
      setWarnings(res.data.warnings);
      setErrors([]);
      if (res.data.warnings.length > 0) {
        message.warning(`分配完成，但有 ${res.data.warnings.length} 条警告`);
      } else {
        message.success("分配完成，无警告");
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
  }, [examRows]);

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
      } catch {
        // 静默失败
      }
    },
    [dragSource, examRows]
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
        const content = val ? (
          <Tag
            color={isError ? "red" : "blue"}
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

        if (isError) {
          return (
            <Tooltip title={cellErrors!.map((e) => e.reason).join("；")}>
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
        const content = val ? (
          <Tag
            color={isError ? "red" : "green"}
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

        if (isError) {
          return (
            <Tooltip title={cellErrors!.map((e) => e.reason).join("；")}>
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
            <div style={{ flex: 1 }}>
              <Text strong>考试安排表（.xlsx）</Text>
              <Upload
                accept=".xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  setExamFile(file);
                  return false;
                }}
                onRemove={() => setExamFile(null)}
                fileList={
                  examFile
                    ? [{ uid: "exam", name: examFile.name, status: "done" } as UploadFile]
                    : []
                }
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </div>
            <div style={{ flex: 1 }}>
              <Text strong>教师通讯录（.xlsx）</Text>
              <Upload
                accept=".xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  setContactFile(file);
                  return false;
                }}
                onRemove={() => setContactFile(null)}
                fileList={
                  contactFile
                    ? [{ uid: "contact", name: contactFile.name, status: "done" } as UploadFile]
                    : []
                }
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </div>
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
              <Button icon={<CheckCircleOutlined />} onClick={doValidate} loading={loading}>
                校验结果
              </Button>
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

            <Tabs
              defaultActiveKey={dateGroups[0]?.date}
              items={dateGroups.map((g) => ({
                key: g.date,
                label: `${g.date}（${g.rows.length}场）`,
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
