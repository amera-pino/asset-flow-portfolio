import type { Page } from "@playwright/test";

export const GENERAL_USER = {
  loginId: "user@example.com",
  name: "一般ユーザー",
  password: "AssetFlow2026!",
} as const;

export const ADMIN_USER = {
  loginId: "admin@example.com",
  name: "管理者ユーザー",
  password: "AssetFlow2026!",
} as const;

async function login(page: Page, loginId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーIDまたはメールアドレス").fill(loginId);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}

export async function loginAsGeneralUser(page: Page) {
  await login(page, GENERAL_USER.loginId, GENERAL_USER.password);
}

export async function loginAsAdminUser(page: Page) {
  await login(page, ADMIN_USER.loginId, ADMIN_USER.password);
}

export async function logoutViaUserMenu(page: Page) {
  await page.getByRole("button", { name: "ユーザーメニュー" }).hover();
  const logoutButton = page.getByRole("button", { name: "ログアウト" });
  await logoutButton.waitFor({ state: "visible" });
  await logoutButton.click();
}
