# components/Layout/ConsoleLayout.tsx — 控制台布局

**文件路径**：`frontend/src/components/Layout/ConsoleLayout.tsx`

**核心设计**：
- 左侧导航栏（200px宽度）+ 右侧工作区
- **所有App始终挂载**，通过 `display: none/block` 切换——切换不卸载，不中断SSE/任务
- 设置页面同样通过display切换，不在导航菜单中

**组件结构**：
```
Layout (height: 100vh)
├── Sider (width: 200px)
│   ├── 标题: "教务办·智能体"
│   ├── Menu: 动态应用列表（从appStore读取）
│   └── 底部固定: 设置按钮
├── Layout
│   ├── Header (height: 48px)
│   │   └── VersionBadge
│   └── Content
│       ├── div[display切换] → App01 (lazy)
│       ├── div[display切换] → App02 (lazy)
│       └── div[display切换] → SettingsPage (lazy)
```

**图标映射**：`ICON_MAP` 将字符串映射到Ant Design图标组件