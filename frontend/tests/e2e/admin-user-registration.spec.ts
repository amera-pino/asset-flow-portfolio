import type { Locator, Page } from "@playwright/test";

import { loginAsAdminUser, logoutViaUserMenu } from "./helpers/auth";
import { expectNoPageError } from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

const newGeneralUser = {
  department: "総務",
  loginId: "hanako.sato@example.com",
  name: "佐藤花子",
  password: "AssetFlow2026!",
  roleLabel: "一般ユーザー",
} as const;

function getAdminHomeCardValue(page: Page, label: string) {
  return page
    .getByTestId("admin-panel-home")
    .getByText(label, { exact: true })
    .locator("xpath=..")
    .locator("p")
    .last();
}

function getAdminUserRow(
  page: Page,
  options: {
    loginId: string;
    name: string;
  },
): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: options.name })
    .filter({ hasText: options.loginId });
}

test.describe("E2E-007 管理ユーザー新規一般ユーザー登録動線", () => {
  test("管理ユーザーが一般ユーザーを登録し、そのユーザーでログインできる", async ({
    page,
  }) => {
    await test.step("管理ユーザー 1-11. ログインしてホームの管理対象ユーザー数を確認する", async () => {
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expectNoPageError(page);

      await loginAsAdminUser(page);

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);

      await page.getByTestId("admin-menu-link").click();

      await expect(page.getByRole("heading", { name: "管理者メニュー" })).toBeVisible();
      await expect(page).toHaveURL(/\/admin(?:\?section=home)?$/);
      await expect(page.getByTestId("admin-panel-home")).toBeVisible();
      await expectNoPageError(page);
      await expect(getAdminHomeCardValue(page, "管理対象ユーザー")).toHaveText("3");
    });

    await test.step("管理ユーザー 12-29. ユーザー管理で新規一般ユーザーを登録し、一覧反映を確認する", async () => {
      await page.getByTestId("admin-nav-users").click();

      await expect(page).toHaveURL(/\/admin\?section=users$/);
      await expect(page.getByTestId("admin-panel-users")).toBeVisible();
      await expectNoPageError(page);

      await page.getByTestId("admin-user-name-input").fill(newGeneralUser.name);
      await page.getByTestId("admin-user-login-id-input").fill(newGeneralUser.loginId);

      const roleSelect = page.getByTestId("admin-user-role-select");
      await expect(roleSelect).toHaveValue("user");
      await expect(roleSelect).toHaveText(/一般ユーザー/);

      await page.getByTestId("admin-user-department-input").fill(newGeneralUser.department);
      await page.getByTestId("admin-user-submit").click();

      const completionDialog = page
        .getByText("新規ユーザー登録完了")
        .locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
      await expect(completionDialog).toBeVisible();
      await expect(completionDialog.getByText(`ログインID: ${newGeneralUser.loginId}`)).toBeVisible();
      await expect(
        completionDialog.getByText(`初期パスワード: ${newGeneralUser.password}`),
      ).toBeVisible();

      await completionDialog.getByRole("button", { name: "OK" }).click();
      await expect(completionDialog).toHaveCount(0);

      const userRow = getAdminUserRow(page, newGeneralUser);
      await expect(userRow).toBeVisible();
      await expect(
        userRow.getByRole("cell", { name: newGeneralUser.name, exact: true }),
      ).toBeVisible();
      await expect(
        userRow.getByRole("cell", { name: newGeneralUser.loginId, exact: true }),
      ).toBeVisible();
      await expect(
        userRow.getByRole("cell", { name: newGeneralUser.department, exact: true }),
      ).toBeVisible();
      await expect(userRow.getByText(newGeneralUser.roleLabel, { exact: true })).toBeVisible();
      await expect(userRow.getByText("有効", { exact: true })).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("管理ユーザー 30-36. ホームへ戻って管理対象ユーザー数の更新を確認し、ログアウトする", async () => {
      await page.getByTestId("admin-nav-home").click();

      await expect(page).toHaveURL(/\/admin\?section=home$/);
      await expect(page.getByTestId("admin-panel-home")).toBeVisible();
      await expectNoPageError(page);
      await expect(getAdminHomeCardValue(page, "管理対象ユーザー")).toHaveText("4");

      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });

    await test.step("新規一般ユーザー 1-10. 登録したユーザーでログインし、備品一覧画面からログアウトする", async () => {
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expectNoPageError(page);

      await page.getByLabel("ユーザーIDまたはメールアドレス").fill(newGeneralUser.loginId);
      await page.getByLabel("パスワード").fill(newGeneralUser.password);
      await page.getByRole("button", { name: "ログイン" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);

      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
