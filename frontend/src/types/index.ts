/** 子应用注册接口 */
export interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** 设置项 */
export interface SettingItem {
  key: string;
  value: string;
}

/** 大模型配置 */
export interface LLMConfig {
  url: string;
  key: string;
}

/** 版本信息 */
export interface VersionInfo {
  version: string;
}
