/**
 * 阿里云 DirectMail (邮件推送) 封装
 *
 * 配置来源: .env
 *   ALIYUN_DM_ACCESS_KEY_ID
 *   ALIYUN_DM_ACCESS_KEY_SECRET
 *   ALIYUN_DM_FROM_ADDRESS   发件地址 (必须已验证域名)
 *   ALIYUN_DM_FROM_ALIAS     发件人显示名
 *   ALIYUN_DM_REGION          默认 cn-hangzhou
 *
 * mock 模式: 任意关键 env 缺失时, 邮件正文打 console.log (不真发).
 * 走真实发送需 @alicloud/dm-2015-11-23 SDK.
 */
import 'server-only';

export interface SendResult {
  ok: boolean;
  mode: 'real' | 'mock';
  error?: string;
}

interface DirectMailConfig {
  accessKeyId: string;
  accessKeySecret: string;
  fromAddress: string;
  fromAlias: string;
  region: string;
}

function getConfig(): DirectMailConfig {
  return {
    accessKeyId: process.env.ALIYUN_DM_ACCESS_KEY_ID ?? '',
    accessKeySecret: process.env.ALIYUN_DM_ACCESS_KEY_SECRET ?? '',
    fromAddress: process.env.ALIYUN_DM_FROM_ADDRESS ?? '',
    fromAlias: process.env.ALIYUN_DM_FROM_ALIAS ?? '个人门户',
    region: process.env.ALIYUN_DM_REGION ?? 'cn-hangzhou',
  };
}

export function isMockMode(): boolean {
  const c = getConfig();
  return !c.accessKeyId || !c.accessKeySecret || !c.fromAddress;
}

interface PasswordResetParams {
  to: string;
  resetUrl: string;
  /** 服务器当前时间 (ISO 字符串), 写到邮件里防钓鱼. */
  serverNow: string;
}

function buildHtmlContent({ resetUrl, serverNow }: { resetUrl: string; serverNow: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>重置密码</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
  <h2 style="margin:0 0 16px;">密码重置</h2>
  <p>你 (或代你) 请求了重置密码. 点击下方按钮设置新密码:</p>
  <p style="margin:24px 0;">
    <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;">重置密码</a>
  </p>
  <p style="color:#6b7280;font-size:14px;">或复制链接到浏览器打开:<br><a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a></p>
  <p style="color:#6b7280;font-size:14px;">该链接 1 小时内有效, 只能使用一次.</p>
  <p style="color:#6b7280;font-size:14px;">请求时间: ${serverNow}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#9ca3af;font-size:12px;">如果这不是你本人操作, 请忽略此邮件, 你的账号仍然安全.</p>
</body>
</html>`;
}

function buildTextContent({ resetUrl, serverNow }: { resetUrl: string; serverNow: string }): string {
  return `密码重置

你 (或代你) 请求了重置密码. 请在 1 小时内访问下方链接设置新密码:

${resetUrl}

请求时间: ${serverNow}

如果这不是你本人操作, 请忽略此邮件, 你的账号仍然安全.`;
}

/**
 * 发密码重置邮件.
 * mock 模式: 打 console.log 模拟发送, 返回 ok=true.
 * 真实模式: 调 DirectMail SDK.
 */
export async function sendPasswordResetEmail(params: PasswordResetParams): Promise<SendResult> {
  const { to, resetUrl, serverNow } = params;

  if (isMockMode()) {
    console.log('[email:mock] password reset email');
    console.log('  to:', to);
    console.log('  from:', getConfig().fromAddress);
    console.log('  resetUrl:', resetUrl);
    console.log('  ---TEXT---');
    console.log(buildTextContent({ resetUrl, serverNow }));
    return { ok: true, mode: 'mock' };
  }

  try {
    const { default: DysmsClient } = await import('@alicloud/dm-2015-11-23');
    const config = getConfig();
    const client = new DysmsClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: 'https://dm.aliyuncs.com',
    });
    const htmlBody = buildHtmlContent({ resetUrl, serverNow });
    const textBody = buildTextContent({ resetUrl, serverNow });
    await client.singleSendMail({
      AccountName: config.fromAddress,
      // AddressType: 0 = 随机发送 (邮件头 IP 随机, 反垃圾过滤友好)
      //              1 = 批量发送 (固定 IP, 适合订阅类)
      AddressType: 0,
      ReplyToAddress: false, // false = 不开回信
      ToAddress: to,
      FromAlias: config.fromAlias,
      Subject: '重置你的密码',
      HtmlBody: htmlBody,
      TextBody: textBody,
    });
    console.log('[email:real] sent ok to', to, 'from', config.fromAddress);
    return { ok: true, mode: 'real' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email:real] send failed:', msg);
    return { ok: false, mode: 'real', error: msg };
  }
}
