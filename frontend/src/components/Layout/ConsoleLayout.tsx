import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Button, Space, Typography, theme } from "antd";
import {
  ScheduleOutlined,
  FileSearchOutlined,
  SettingOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useAppStore } from "@/stores/appStore";
import VersionBadge from "@/components/VersionBadge";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  ScheduleOutlined: <ScheduleOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
};

const ConsoleLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { apps, activeAppId, setActiveApp } = useAppStore();
  const { token } = theme.useToken();

  const menuItems = apps.map((app) => ({
    key: app.id,
    icon: ICON_MAP[app.icon] || <ToolOutlined />,
    label: app.name,
  }));

  const handleMenuClick = (info: { key: string }) => {
    setActiveApp(info.key);
    navigate(`/app/${info.key}`);
  };

  const currentPath = location.pathname;

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <Sider
        width={200}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text strong style={{ fontSize: 16, color: token.colorPrimary }}>
            教务办·智能体
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentPath.startsWith("/settings") ? "" : currentPath.startsWith("/admin") ? "" : activeAppId]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 8 }}
        />
        <div style={{ position: "absolute", bottom: 0, width: 200, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Menu
            mode="inline"
            selectable={false}
            items={[
              {
                key: "settings",
                icon: <SettingOutlined />,
                label: "设置",
                onClick: () => navigate("/settings"),
              },
              {
                key: "admin",
                icon: <ToolOutlined />,
                label: "管理后台",
                onClick: () => navigate("/admin"),
              },
            ]}
            style={{ borderRight: 0 }}
          />
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            height: 48,
            lineHeight: "48px",
          }}
        >
          <Space>
            <VersionBadge />
          </Space>
        </Header>
        <Content
          style={{
            padding: 24,
            overflow: "auto",
            background: token.colorBgLayout,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ConsoleLayout;
