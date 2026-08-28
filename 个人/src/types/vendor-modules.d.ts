/**
 * 无官方类型声明的第三方模块.
 * 只声明项目实际用到的最小面; 日后若安装了对应的 @types 包, 删除对应声明即可.
 */
declare module 'ali-oss' {
  export interface OSSClient {
    [key: string]: any;
  }
  const OSS: {
    new (options: Record<string, unknown>): OSSClient;
  };
  export default OSS;
}

declare module '@alicloud/dm-2015-11-23';
