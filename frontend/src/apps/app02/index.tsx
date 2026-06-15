import React from "react";
import { Card, Typography } from "antd";
import { FileSearchOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const App02: React.FC = () => {
  return (
    <Card>
      <Title level={3}>
        <FileSearchOutlined style={{ marginRight: 8 }} />
        文件审查
      </Title>
      <Paragraph type="secondary">
        上传教学文件与模板比对，检查格式规范、课时计算、事实性错误和错别字。
        支持单文件和批量审查。功能开发中...
      </Paragraph>
    </Card>
  );
};

export default App02;
