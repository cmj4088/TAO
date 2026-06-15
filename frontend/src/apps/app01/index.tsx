import React from "react";
import { Card, Typography } from "antd";
import { ScheduleOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const App01: React.FC = () => {
  return (
    <Card>
      <Title level={3}>
        <ScheduleOutlined style={{ marginRight: 8 }} />
        监考分配
      </Title>
      <Paragraph type="secondary">
        导入期末考试安排、课表及教师信息，系统根据规则自动分配监考员。
        支持拖拽替换和异常标记。功能开发中...
      </Paragraph>
    </Card>
  );
};

export default App01;
