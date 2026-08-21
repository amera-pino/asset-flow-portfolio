import { GENERAL_USER, logoutViaUserMenu } from "./helpers/auth";
import {
  expectNoPageError,
  getAssetRow,
  getRequestRow,
} from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

const targetRequest = {
  assetName: "Webカメラ 1080p",
  category: "カメラ",
  quantity: 2,
  status: "承認待ち",
  initialEffectiveStock: 4,
  updatedEffectiveStock: 6,
  searchText: "webカメラ",
} as const;

test.describe("E2E-003 一般ユーザー承認待ち申請キャンセル動線", () => {
  test("一般ユーザーが承認待ち申請をキャンセルし、マイ貸出状況と備品一覧に反映される", async ({
    page,
  }) => {
    await test.step("1-2. ログイン画面を表示し、エラーが表示されないことを確認する", async () => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("3-7. 一般ユーザーでログインし、備品一覧画面を確認する", async () => {
      await page
        .getByLabel("ユーザーIDまたはメールアドレス")
        .fill(GENERAL_USER.loginId);
      await page.getByLabel("パスワード").fill(GENERAL_USER.password);
      await page.getByRole("button", { name: "ログイン" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);
    });

    await test.step("8-16. マイ貸出状況でキャンセル対象の承認待ち申請を確認する", async () => {
      await page.getByRole("link", { name: "マイ貸出状況" }).click();

      await expect(
        page.getByRole("heading", { name: "マイ貸出状況" }),
      ).toBeVisible();
      await expectNoPageError(page);

      await page.getByLabel("ステータスで絞り込み").selectOption({ label: targetRequest.status });
      await page.getByLabel("カテゴリで絞り込み").selectOption({ label: targetRequest.category });
      await page.getByPlaceholder("備品名で検索...").fill(targetRequest.searchText);

      const requestRow = getRequestRow(page, {
        assetName: targetRequest.assetName,
        category: targetRequest.category,
        status: targetRequest.status,
      });

      await expect(requestRow).toBeVisible();
      await expect(
        requestRow.getByRole("cell", {
          exact: true,
          name: String(targetRequest.quantity),
        }),
      ).toBeVisible();
    });

    await test.step("17-22. 対象申請をキャンセルし、現在の絞り込み条件で非表示になることを確認する", async () => {
      const requestRow = getRequestRow(page, {
        assetName: targetRequest.assetName,
        category: targetRequest.category,
        status: targetRequest.status,
      });

      await requestRow.getByRole("button", { name: "キャンセル" }).click();
      await expect(page.getByRole("dialog", { name: "キャンセル確認" })).toBeVisible();
      await page.getByRole("button", { name: "OK" }).click();

      await expect(page.getByText(/キャンセルを受け付けました。申請ID：\d+/)).toBeVisible();
      await expectNoPageError(page);
      await expect(
        getRequestRow(page, {
          assetName: targetRequest.assetName,
          category: targetRequest.category,
          status: targetRequest.status,
        }),
      ).toHaveCount(0);
      await expect(page.getByText("検索条件に一致する申請はありません。")).toBeVisible();
    });

    await test.step("23-29. 備品一覧へ戻り、有効在庫数が 6 に戻っていることを確認する", async () => {
      await page.getByRole("link", { name: "備品一覧" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);

      await page.getByLabel("カテゴリで絞り込み").selectOption({ label: targetRequest.category });
      await page.getByPlaceholder("備品名で検索").fill(targetRequest.searchText);

      await expect(
        getAssetRow(page, {
          name: targetRequest.assetName,
          category: targetRequest.category,
          effectiveStock: targetRequest.updatedEffectiveStock,
        }),
      ).toBeVisible();
    });

    await test.step("30-32. ユーザーメニューからログアウトし、ログイン画面を確認する", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
