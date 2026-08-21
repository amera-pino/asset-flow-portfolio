import type { Page } from "@playwright/test";

import { ADMIN_USER, loginAsAdminUser, logoutViaUserMenu } from "./helpers/auth";
import { expectNoPageError, getAssetRow } from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

const targetAsset = {
  category: "照明",
  homeCountsAfterRegistration: {
    approved: "5",
    loaned: "33",
    managedUsers: "3",
    pending: "11",
    registeredAssets: "56",
    rejected: "5",
  },
  homeCountsBeforeRegistration: {
    approved: "5",
    loaned: "33",
    managedUsers: "3",
    pending: "11",
    registeredAssets: "55",
    rejected: "5",
  },
  name: "LEDクリップライト",
  stock: "1",
  summaryCountsAfterRegistration: {
    effectiveStock: "255",
    totalItems: "56",
    totalStock: "343",
  },
} as const;

function getAdminHomeCardValue(page: Page, label: string) {
  return page
    .getByTestId("admin-panel-home")
    .getByText(label, { exact: true })
    .locator("xpath=..")
    .locator("p")
    .last();
}

function getAssetListSummaryValue(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=..")
    .locator("p")
    .last();
}

test.describe("E2E-005 管理ユーザー新規備品登録動線", () => {
  test("管理ユーザーが新規備品を登録し、ホームと備品一覧に反映を確認してログアウトできる", async ({
    page,
  }) => {
    await test.step("1-2. ログイン画面を表示し、エラーが表示されないことを確認する", async () => {
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("3-7. 管理ユーザーでログインし、備品一覧画面を確認する", async () => {
      await loginAsAdminUser(page);

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);
    });

    await test.step("8-16. 管理者メニューのホームを表示し、初期件数を確認する", async () => {
      await page.getByTestId("admin-menu-link").click();

      await expect(page.getByRole("heading", { name: "管理者メニュー" })).toBeVisible();
      await expect(page).toHaveURL(/\/admin(?:\?section=home)?$/);
      await expect(page.getByTestId("admin-panel-home")).toBeVisible();
      await expectNoPageError(page);
      await expect(
        getAdminHomeCardValue(page, "承認待ち"),
        "承認待ち件数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.pending);
      await expect(
        getAdminHomeCardValue(page, "承認済み"),
        "承認済み件数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.approved);
      await expect(
        getAdminHomeCardValue(page, "承認却下"),
        "承認却下件数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.rejected);
      await expect(
        getAdminHomeCardValue(page, "貸出中"),
        "貸出中件数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.loaned);
      await expect(
        getAdminHomeCardValue(page, "登録備品数"),
        "登録備品数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.registeredAssets);
      await expect(
        getAdminHomeCardValue(page, "管理対象ユーザー"),
        "管理対象ユーザー数",
      ).toHaveText(targetAsset.homeCountsBeforeRegistration.managedUsers);
    });

    await test.step("17-29. 備品管理（新規）で新しいカテゴリの備品を登録し、簡易一覧を確認する", async () => {
      await page.getByTestId("admin-nav-assets-new").click();

      await expect(page).toHaveURL(/\/admin\?section=assets-new$/);
      await expect(page.getByTestId("admin-panel-assets")).toBeVisible();
      await expect(page.getByRole("heading", { name: "備品を追加する" })).toBeVisible();
      await expectNoPageError(page);

      await page.getByTestId("admin-category-new-radio").check();
      await page
        .getByTestId("admin-asset-category-new-input")
        .fill(targetAsset.category);
      await page.getByTestId("admin-asset-name-input").fill(targetAsset.name);
      await page.getByTestId("admin-asset-stock-input").fill(targetAsset.stock);
      await page.getByTestId("admin-asset-submit").click();

      await expect(page.getByText("備品を登録しました。")).toBeVisible();
      const simpleListRow = page
        .getByRole("row")
        .filter({ hasText: targetAsset.category })
        .filter({ hasText: targetAsset.name });

      await expect(simpleListRow).toBeVisible();
      await expect(
        simpleListRow.getByRole("cell", { name: targetAsset.category, exact: true }),
      ).toBeVisible();
      await expect(
        simpleListRow.getByRole("cell", { name: targetAsset.name, exact: true }),
      ).toBeVisible();
      await expect(simpleListRow.getByRole("cell").last()).toHaveText(targetAsset.stock);
      await expectNoPageError(page);
    });

    await test.step("30-38. ホームへ戻り、登録後の件数を確認する", async () => {
      await page.getByTestId("admin-nav-home").click();

      await expect(page).toHaveURL(/\/admin\?section=home$/);
      await expect(page.getByTestId("admin-panel-home")).toBeVisible();
      await expectNoPageError(page);
      await expect(
        getAdminHomeCardValue(page, "承認待ち"),
        "登録後の承認待ち件数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.pending);
      await expect(
        getAdminHomeCardValue(page, "承認済み"),
        "登録後の承認済み件数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.approved);
      await expect(
        getAdminHomeCardValue(page, "承認却下"),
        "登録後の承認却下件数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.rejected);
      await expect(
        getAdminHomeCardValue(page, "貸出中"),
        "登録後の貸出中件数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.loaned);
      await expect(
        getAdminHomeCardValue(page, "登録備品数"),
        "登録後の登録備品数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.registeredAssets);
      await expect(
        getAdminHomeCardValue(page, "管理対象ユーザー"),
        "登録後の管理対象ユーザー数",
      ).toHaveText(targetAsset.homeCountsAfterRegistration.managedUsers);
    });

    await test.step("39-50. 備品一覧へ戻り、カテゴリ選択肢と絞り込み結果を確認する", async () => {
      await page.getByRole("link", { name: "備品一覧" }).click();

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);

      const categorySelect = page.getByLabel("カテゴリで絞り込み");
      await expect(
        categorySelect.locator("option").filter({ hasText: targetAsset.category }),
      ).toHaveCount(1);

      await categorySelect.selectOption({ label: targetAsset.category });
      await page.getByPlaceholder("備品名で検索").fill(targetAsset.name);

      await expect(
        getAssetRow(page, {
          name: targetAsset.name,
          category: targetAsset.category,
          effectiveStock: Number(targetAsset.stock),
        }),
      ).toBeVisible();
      await expect(
        getAssetListSummaryValue(page, "取扱品目数"),
        "取扱品目数",
      ).toHaveText(targetAsset.summaryCountsAfterRegistration.totalItems);
      await expect(
        getAssetListSummaryValue(page, "総在庫数"),
        "総在庫数",
      ).toHaveText(targetAsset.summaryCountsAfterRegistration.totalStock);
      await expect(
        getAssetListSummaryValue(page, "有効在庫数"),
        "有効在庫数",
      ).toHaveText(targetAsset.summaryCountsAfterRegistration.effectiveStock);
    });

    await test.step("51-53. ユーザーメニューからログアウトし、ログイン画面を確認する", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
