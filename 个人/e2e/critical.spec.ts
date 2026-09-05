/**
 * E2E 关键路径回归
 * 依赖: 本地 dev server (localhost:3000) + 测试账号
 *   管理员: testa@example.com / pass123456
 * 运行: pnpm e2e
 */
import { test, expect } from '@playwright/test';

const ADMIN = { email: 'testa@example.com', password: 'pass123456' };

async function login(page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/signin');
  await page.getByRole('textbox', { name: '邮箱' }).fill(email);
  await page.getByRole('textbox', { name: '密码' }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 15000 });
}

test('首页渲染: 问候/搜索/服务卡/hero 壁纸', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索服务/)).toBeVisible();
  // hero 壁纸已加载
  const hero = page.locator('div[aria-hidden] img');
  await expect(hero).toHaveCount(1);
  await expect(hero).toHaveJSProperty('complete', true);
  // 服务卡片玻璃系统
  await expect(page.locator('.glass-card').first()).toBeVisible();
});

test('登录: 错误密码有提示, 正确密码进主页', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('textbox', { name: '邮箱' }).fill(ADMIN.email);
  await page.getByRole('textbox', { name: '密码' }).fill('wrong-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText(/密码错误|邮箱或密码|错误/).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('textbox', { name: '密码' }).fill(ADMIN.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 15000 });
  await expect(page.getByRole('button', { name: '账号菜单' })).toBeVisible();
});

test('博客: 文章页渲染图片与评论区', async ({ page }) => {
  await login(page);
  await page.goto('/blog/night-before-launch');
  await expect(page.getByRole('heading', { name: '上线前夜' })).toBeVisible();
  // 文内三张剧照
  await expect(page.locator('article img[src*="night-before-launch"]')).toHaveCount(4);
  // 评论区
  await expect(page.getByRole('heading', { name: /评论/ })).toBeVisible();
});

test('更新日志: 时间线渲染', async ({ page }) => {
  await page.goto('/updates');
  await expect(page.getByRole('heading', { name: '更新日志' })).toBeVisible();
  await expect(page.getByText(/共 \d+ 条/)).toBeVisible();
});

test('背单词: 选书并完成一组学习', async ({ page }) => {
  await login(page);
  await page.goto('/vocab');
  await expect(page.getByText('选择词书')).toBeVisible();

  // 确保选中 CET4
  await page.getByRole('button', { name: /英语四级/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);

  // 进入学习
  await page.getByText('开始学习').first().click();
  await page.waitForURL((u) => u.pathname.includes('study'), { timeout: 15000 });

  // 依次走完队列: 新词卡点继续 / 选择题点一个选项 / 拼写输入任意后提交
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(800);
    if (page.url().includes('done') || (await page.getByText('今日完成').count()) > 0) break;
    const continueBtn = page.getByRole('button', { name: '我记住了, 继续' });
    if ((await continueBtn.count()) === 1) { await continueBtn.click(); continue; }
    const submitBtn = page.getByRole('button', { name: '提交' });
    if ((await submitBtn.count()) === 1) {
      await page.locator('input[placeholder*="英文"]').fill('zz');
      await submitBtn.click();
      await page.waitForTimeout(600);
      const nextBtn = page.getByRole('button', { name: '继续' });
      if ((await nextBtn.count()) === 1) { await nextBtn.click(); continue; }
      continue;
    }
    // 选择题: 点第一个选项
    const choice = page.locator('main button').filter({ hasText: /\.[^第]/ }).first();
    if ((await choice.count()) === 1) { await choice.click(); await page.waitForTimeout(600); continue; }
  }

  await expect(page.getByText('今日完成').first()).toBeVisible({ timeout: 30000 });
});
