import React, { useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
  Table,
  Tabs,
  Space,
  Tag,
  message,
  Alert,
  Typography,
  Empty,
  Descriptions,
} from "antd";
import {
  ExportOutlined,
  CopyOutlined,
  FileSearchOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import client from "@/api/client";
import type {
  FileReviewResult,
  ReviewResponse,
  UploadedFileInfo,
  ReviewIssue,
} from "@/types";

const { Title, Text } = Typography;

const App02: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
      setUploadedFiles(res.data.files);
      setReviewResult(null);
      setActiveTab("summary");
      setOpenFileIds([]);
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
      message.success(res.data.summary);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "审查失败");
    } finally {
      setLoading(false);
    }
  }, [uploadedFiles]);

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

  const doCopyAnnotations = useCallback((issues: ReviewIssue[]) => {
    const text = issues
      .map((i) => `【${i.type}】${i.location ? `位置：${i.location}，` : ""}${i.detail}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(
      () => message.success("已复制到剪贴板"),
      () => message.error("复制失败"),
    );
  }, []);

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
      const files = Array.from(e.target.files || []).filter(
        (f) => f.name.endsWith(".doc") || f.name.endsWith(".docx"),
      );
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
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".doc") || f.name.endsWith(".docx"),
      );
      if (files.length === 0) {
        message.warning("请拖入 .doc 或 .docx 文件");
        return;
      }
      doUpload(files);
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

  const getIssueColor = (type: string) => {
    if (type.includes("字体") || type.includes("字号")) return "#faad14";
    if (type.includes("课时")) return "#ff4d4f";
    if (type.includes("转换")) return "#ff4d4f";
    return "#faad14";
  };

  // 汇总表格列
  const summaryColumns: ColumnsType<FileReviewResult> = [
    {
      title: "文件名",
      dataIndex: "filename",
      width: 280,
      ellipsis: true,
      render: (name: string, record: FileReviewResult) => (
        <Space>
          {record.passed ? (
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
          ) : (
            <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
          )}
          <Text>{name}</Text>
        </Space>
      ),
    },
    { title: "老师", dataIndex: "teacher", width: 80 },
    {
      title: "类型",
      dataIndex: "file_type",
      width: 90,
      render: (t: string) => <Tag color={getTypeColor(t)}>{t || "未知"}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "passed",
      width: 70,
      render: (p: boolean) => (
        <Tag color={p ? "success" : "error"}>{p ? "通过" : "不通过"}</Tag>
      ),
    },
    {
      title: "错误数",
      width: 70,
      render: (_: any, record: FileReviewResult) => (
        <Text type={record.issues.length > 0 ? "danger" : "secondary"}>
          {record.issues.length}
        </Text>
      ),
    },
    {
      title: "操作",
      width: 70,
      render: (_: any, record: FileReviewResult) => (
        <Button type="link" size="small" onClick={() => openFileTab(record.file_id)}>
          查看
        </Button>
      ),
    },
  ];

  // 单文件预览（左侧 PDF + 右侧批注）
  const renderFilePreview = (result: FileReviewResult) => (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 360px)", minHeight: 500 }}>
      <div style={{ flex: 1, border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden" }}>
        <iframe
          src={`http://localhost:8000/api/app02/preview/${result.file_id}`}
          style={{ width: "100%", height: "100%", border: "none" }}
          title={result.filename}
        />
      </div>

      <div style={{ width: 360, display: "flex", flexDirection: "column" }}>
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
            {result.passed ? (
              <Tag color="success" style={{ fontSize: 14 }}>审查通过</Tag>
            ) : (
              <Tag color="error" style={{ fontSize: 14 }}>{result.issues.length} 个问题</Tag>
            )}
          </Title>

          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="文件类型">{result.file_type || "未知"}</Descriptions.Item>
            <Descriptions.Item label="老师">{result.teacher}</Descriptions.Item>
            <Descriptions.Item label="使用字体">
              {result.fonts_used.length > 0 ? result.fonts_used.join("、") : "无"}
            </Descriptions.Item>
          </Descriptions>

          {result.issues.length === 0 ? (
            <Alert type="success" showIcon message="未发现任何问题" />
          ) : (
            (() => {
              // 错误级优先，建议级靠后
              const isError = (t: string) =>
                t.includes("课时") || t.includes("转换");
              const sorted = [...result.issues].sort((a, b) => {
                const aErr = isError(a.type) ? 0 : 1;
                const bErr = isError(b.type) ? 0 : 1;
                return aErr - bErr;
              });
              return sorted.map((issue, idx) => {
                const err = isError(issue.type);
                return (
              <div
                key={idx}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  background: err ? "#fff2f0" : "#fafafa",
                  borderLeft: `4px solid ${err ? "#ff4d4f" : "#d9d9d9"}`,
                  borderRadius: 4,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  <Tag color={err ? "red" : "default"}>{issue.type}</Tag>
                </div>
                <Text style={{ fontSize: 13, color: err ? "#cf1322" : undefined }}>
                  {issue.detail}
                </Text>
                {issue.location && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      位置：{issue.location}
                    </Text>
                  </div>
                )}
              </div>
                );
              });
            })()
          )}
        </div>

        {result.issues.length > 0 && (
          <Button
            icon={<CopyOutlined />}
            type="primary"
            block
            style={{ marginTop: 12 }}
            onClick={() => doCopyAnnotations(result.issues)}
          >
            复制全部批注
          </Button>
        )}
      </div>
    </div>
  );

  // Tab 页（仅批量模式使用）
  const tabItems: { key: string; label: React.ReactNode; children: React.ReactNode; closable?: boolean }[] = [];

  if (reviewResult && reviewResult.mode === "batch") {
    tabItems.push({
      key: "summary",
      label: "汇总表",
      children: (
        <>
          <Alert
            type={reviewResult.results.every((r) => r.passed) ? "success" : "warning"}
            showIcon
            message={reviewResult.summary}
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={summaryColumns}
            dataSource={reviewResult.results}
            rowKey="file_id"
            size="small"
            pagination={false}
            scroll={{ y: "calc(100vh - 500px)" }}
          />
        </>
      ),
    });

    for (const fileId of openFileIds) {
      const r = reviewResult.results.find((x) => x.file_id === fileId);
      if (r) {
        tabItems.push({
          key: r.file_id,
          label: (
            <Space size={4}>
              {r.passed ? (
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
              ) : (
                <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
              )}
              <span>{r.filename.length > 16 ? r.filename.slice(0, 16) + "..." : r.filename}</span>
            </Space>
          ),
          children: renderFilePreview(r),
          closable: true,
        });
      }
    }
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <FileSearchOutlined style={{ marginRight: 8 }} />
        文件审查
      </Title>

      {/* 上传区域 */}
      <Card style={{ marginBottom: 16 }}>
        {uploadedFiles.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed #d9d9d9",
              borderRadius: 8,
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: "#fafafa",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "#1677ff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "#d9d9d9";
            }}
          >
            <InboxOutlined style={{ fontSize: 48, color: "#1677ff", marginBottom: 16 }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>
                点击或拖拽文件/文件夹到此处
              </Text>
            </div>
            <div>
              <Text type="secondary">支持 .doc / .docx，单文件或批量上传</Text>
            </div>
            <div style={{ marginTop: 12 }}>
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
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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
            <Space>
              <Button type="primary" onClick={doReview} loading={loading}>
                开始审查
              </Button>
              <Button
                onClick={() => {
                  setUploadedFiles([]);
                  setReviewResult(null);
                }}
              >
                清除重选
              </Button>
            </Space>
          </Space>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx"
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
              <Text type="secondary">{reviewResult.summary}</Text>
            </Space>
          }
        >
          {reviewResult.mode === "single" ? (
            /* 单文件模式：直接展示预览 */
            renderFilePreview(reviewResult.results[0])
          ) : (
            /* 批量模式：标签页 */
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
          )}
        </Card>
      )}

      {!reviewResult && uploadedFiles.length > 0 && (
        <Card>
          <Empty description="点击「开始审查」检查文件" />
        </Card>
      )}
    </div>
  );
};

export default App02;
