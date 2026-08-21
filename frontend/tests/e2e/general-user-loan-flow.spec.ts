import { GENERAL_USER, logoutViaUserMenu } from "./helpers/auth";
import {
  expectNoPageError,
  getAssetRow,
  getRequestRow,
  todayInTokyo,
} from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

const targetAsset = {
  name: 'MacBook Pro 14"',
  category: "パソコン",
  initialEffectiveStock: 6,
  updatedEffectiveStock: 5,
} as const;

test.describe("E2E-001 一般ユーザー申請動線", () => {
  test("一般ユーザーが貸出申請を行い、申請後の確認とログアウトまで完了できる", async ({
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

    await test.step("8-10. MacBook Pro の貸出申請画面を表示し、エラーが表示されないことを確認する", async () => {
      const assetRow = getAssetRow(page, {
        name: targetAsset.name,
        category: targetAsset.category,
        effectiveStock: targetAsset.initialEffectiveStock,
      });

      await expect(assetRow).toBeVisible();
      await assetRow.hover();
      await assetRow.getByRole("link", { name: /貸出申請/ }).click();

      await expect(
        page.getByRole("heading", { name: "備品貸出申請" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: targetAsset.name })).toBeVisible();
      await expect(page.getByText(targetAsset.category, { exact: true })).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("11-15. 申請フォームの初期値を確認し、使用目的を入力する", async () => {
      const today = todayInTokyo();

      await expect(page.getByLabel("申請者名")).toHaveValue(GENERAL_USER.name);
      await expect(page.getByLabel("申請数量")).toHaveValue("1");
      await expect(page.getByLabel("開始日")).toHaveValue(today);
      await expect(page.getByLabel("終了日")).toHaveValue(today);
      await page.getByLabel("使用目的").fill("E2Eテスト");
    });

    await test.step("16-20. 申請して備品一覧へ戻り、有効在庫数が 5 になることを確認する", async () => {
      await page.getByRole("button", { name: "申請する" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expect(page.getByText(/申請を受け付けました。 申請ID: \d+/)).toBeVisible();
      await expectNoPageError(page);

      await expect(
        getAssetRow(page, {
          name: targetAsset.name,
          category: targetAsset.category,
          effectiveStock: targetAsset.updatedEffectiveStock,
        }),
      ).toBeVisible();
    });

    await test.step("21-28. マイ貸出状況で登録した承認待ち申請を確認する", async () => {
      await page.getByRole("link", { name: "マイ貸出状況" }).click();
      await expect(
        page.getByRole("heading", { name: "マイ貸出状況" }),
      ).toBeVisible();
      await expectNoPageError(page);

      await page.getByLabel("ステータスで絞り込み").selectOption({ label: "承認待ち" });
      await page.getByLabel("カテゴリで絞り込み").selectOption({ label: targetAsset.category });
      await page.getByPlaceholder("備品名で検索...").fill("mac");

      const requestRow = getRequestRow(page, {
        assetName: targetAsset.name,
        category: targetAsset.category,
        status: "承認待ち",
      });

      await expect(requestRow).toBeVisible();
    });

    await test.step("29-31. 備品一覧画面へ戻り、エラーが表示されないことを確認する", async () => {
      await page.getByRole("link", { name: "備品一覧" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);
    });

    await test.step("32-34. ユーザーメニューからログアウトし、ログイン画面を確認する", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
