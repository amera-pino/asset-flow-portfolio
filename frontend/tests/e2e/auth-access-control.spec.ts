import { GENERAL_USER, logoutViaUserMenu } from "./helpers/auth";
import { expectNoPageError, getRequestRow } from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

test.describe("E2E-002 一般ユーザー認証・アクセス制御", () => {
  test("一般ユーザーの認証状態に応じて保護画面へのアクセス制御が動作する", async ({
    page,
  }) => {
    await test.step("1-3. 未ログイン状態で / にアクセスするとログイン画面が表示される", async () => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });

    await test.step("4-8. 一般ユーザーでログインし、備品一覧画面を確認する", async () => {
      await page
        .getByLabel("ユーザーIDまたはメールアドレス")
        .fill(GENERAL_USER.loginId);
      await page.getByLabel("パスワード").fill(GENERAL_USER.password);
      await page.getByRole("button", { name: "ログイン" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);
    });

    await test.step("9-11. 再読み込み後も備品一覧画面が表示される", async () => {
      await page.reload();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);
    });

    await test.step("12-15. /my-requests に直接アクセスし、申請レコード一覧を確認する", async () => {
      await page.goto("/my-requests");

      await expect(
        page.getByRole("heading", { name: "マイ貸出状況" }),
      ).toBeVisible();
      await expectNoPageError(page);
      await expect(page.getByRole("table")).toBeVisible();
      await expect(
        getRequestRow(page, {
          assetName: "Logitech MX Keys",
          category: "キーボード",
          status: "貸出中",
        }),
      ).toBeVisible();
    });

    await test.step("16-18. ログアウトするとログイン画面が表示される", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });

    await test.step("19-21. ログアウト後の状態で / に直接アクセスするとログイン画面が表示される", async () => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });

    await test.step("22-24. ログアウト後の状態で /my-requests に直接アクセスするとログイン画面が表示される", async () => {
      await page.goto("/my-requests");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
