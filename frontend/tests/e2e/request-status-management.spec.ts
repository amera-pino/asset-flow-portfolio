import type { Locator, Page } from "@playwright/test";

import {
  loginAsAdminUser,
  loginAsGeneralUser,
  logoutViaUserMenu,
} from "./helpers/auth";
import { expectNoPageError } from "./helpers/selectors";
import { expect, test } from "./fixtures/e2e-test";

const targetRequests = {
  approvedAfterAction: {
    assetName: "360 Meeting Camera",
    requesterName: "一般ユーザー",
    status: "承認済み",
  },
  approvedTarget: {
    assetName: "360 Meeting Camera",
    requesterName: "一般ユーザー",
    status: "承認待ち",
  },
  forceReturnTarget: {
    assetName: "Logitech MX Keys",
    requesterName: "一般ユーザー",
    status: "貸出中",
  },
  rejectedAfterAction: {
    assetName: "65W USB-C Charger",
    requesterName: "一般ユーザー",
    status: "承認却下",
  },
  rejectedTarget: {
    assetName: "65W USB-C Charger",
    requesterName: "一般ユーザー",
    status: "承認待ち",
  },
} as const;

const homeCountsAfterStatusChanges = {
  approved: "6",
  loaned: "32",
  pending: "9",
  rejected: "6",
} as const;

function getAdminHomeCardValue(page: Page, label: string) {
  return page
    .getByTestId("admin-panel-home")
    .getByText(label, { exact: true })
    .locator("xpath=..")
    .locator("p")
    .last();
}

function getAdminRequestRow(
  page: Page,
  options: {
    assetName: string;
    requesterName: string;
    status: string;
  },
): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: options.requesterName })
    .filter({ hasText: options.assetName })
    .filter({ hasText: options.status });
}

function getMyRequestRow(
  page: Page,
  options: {
    assetName: string;
    status: string;
  },
): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: options.assetName })
    .filter({ hasText: options.status });
}

async function expectNoAdminActionErrorDialog(page: Page) {
  await expect(page.getByText("処理に失敗しました")).toHaveCount(0);
}

test.describe("E2E-006 管理ユーザー申請管理ステータス変更動線", () => {
  test("管理ユーザーが申請管理でステータス変更し、一般ユーザーがマイ貸出状況で結果を確認できる", async ({
    page,
  }) => {
    await test.step("管理ユーザー 1-13. ログインし、申請管理を表示する", async () => {
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

      await page.getByTestId("admin-nav-requests").click();

      await expect(page).toHaveURL(/\/admin\?section=requests$/);
      await expect(page.getByTestId("admin-panel-requests")).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("管理ユーザー 14-20. 承認待ちの 2 件を承認・却下する", async () => {
      await page.getByLabel("ステータスで絞り込み").selectOption({ label: "承認待ち" });

      const approveRow = getAdminRequestRow(page, targetRequests.approvedTarget);
      await expect(approveRow).toBeVisible();
      await approveRow.getByRole("button", { name: "承認" }).click();
      await expectNoAdminActionErrorDialog(page);
      await expect(approveRow).toHaveCount(0);

      const rejectRow = getAdminRequestRow(page, targetRequests.rejectedTarget);
      await expect(rejectRow).toBeVisible();
      await rejectRow.getByRole("button", { name: "却下" }).click();
      await expectNoAdminActionErrorDialog(page);
      await expect(rejectRow).toHaveCount(0);
      await expectNoPageError(page);
    });

    await test.step("管理ユーザー 21-31. 貸出中の対象申請を強制返却し、ホーム件数を確認する", async () => {
      await page.getByLabel("ステータスで絞り込み").selectOption({ label: "貸出中" });

      const forceReturnRow = getAdminRequestRow(page, targetRequests.forceReturnTarget);
      await expect(forceReturnRow).toBeVisible();
      await forceReturnRow.getByRole("button", { name: "強制返却" }).click();
      await expectNoAdminActionErrorDialog(page);
      await expect(forceReturnRow).toHaveCount(0);

      await page.getByTestId("admin-nav-home").click();

      await expect(page).toHaveURL(/\/admin\?section=home$/);
      await expect(page.getByTestId("admin-panel-home")).toBeVisible();
      await expectNoPageError(page);
      await expect(getAdminHomeCardValue(page, "承認待ち")).toHaveText(
        homeCountsAfterStatusChanges.pending,
      );
      await expect(getAdminHomeCardValue(page, "承認済み")).toHaveText(
        homeCountsAfterStatusChanges.approved,
      );
      await expect(getAdminHomeCardValue(page, "承認却下")).toHaveText(
        homeCountsAfterStatusChanges.rejected,
      );
      await expect(getAdminHomeCardValue(page, "貸出中")).toHaveText(
        homeCountsAfterStatusChanges.loaned,
      );
    });

    await test.step("管理ユーザー 32-34. ログアウトしてログイン画面へ戻る", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });

    await test.step("一般ユーザー 1-10. ログインし、マイ貸出状況を表示する", async () => {
      await loginAsGeneralUser(page);

      await expect(page.getByRole("heading", { name: "備品一覧" })).toBeVisible();
      await expect(page).toHaveURL("/");
      await expectNoPageError(page);

      await page.getByRole("link", { name: "マイ貸出状況" }).click();

      await expect(page.getByRole("heading", { name: "マイ貸出状況" })).toBeVisible();
      await expect(page).toHaveURL("/my-requests");
      await expectNoPageError(page);
    });

    await test.step("一般ユーザー 11-21. 検索結果で変更後ステータスを確認する", async () => {
      const searchInput = page.getByPlaceholder("備品名で検索...");

      await searchInput.fill(targetRequests.approvedAfterAction.assetName);
      await expect(
        getMyRequestRow(page, {
          assetName: targetRequests.approvedAfterAction.assetName,
          status: targetRequests.approvedAfterAction.status,
        }),
      ).toBeVisible();
      await expectNoPageError(page);

      await searchInput.fill(targetRequests.rejectedAfterAction.assetName);
      await expect(
        getMyRequestRow(page, {
          assetName: targetRequests.rejectedAfterAction.assetName,
          status: targetRequests.rejectedAfterAction.status,
        }),
      ).toBeVisible();
      await expectNoPageError(page);

      await searchInput.fill(targetRequests.forceReturnTarget.assetName);
      await expect(
        page.getByRole("row").filter({ hasText: targetRequests.forceReturnTarget.assetName }),
      ).toHaveCount(0);
      await expect(page.getByText("検索条件に一致する申請はありません。")).toBeVisible();
      await expectNoPageError(page);
    });

    await test.step("一般ユーザー 22-24. ログアウトしてログイン画面へ戻る", async () => {
      await logoutViaUserMenu(page);

      await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expectNoPageError(page);
    });
  });
});
