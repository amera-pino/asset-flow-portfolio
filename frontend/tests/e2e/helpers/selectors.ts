import { expect, type Locator, type Page } from "@playwright/test";

type AssetRowOptions = {
  name: string;
  category: string;
  effectiveStock?: number;
};

type RequestRowOptions = {
  assetName: string;
  category?: string;
  status?: string;
};

export function getAssetRow(page: Page, options: AssetRowOptions): Locator {
  let row = page
    .getByRole("row")
    .filter({ hasText: options.name })
    .filter({ hasText: options.category });

  if (options.effectiveStock !== undefined) {
    row = row.filter({
      has: page.getByRole("cell", {
        exact: true,
        name: String(options.effectiveStock),
      }),
    });
  }

  return row;
}

export function getRequestRow(page: Page, options: RequestRowOptions): Locator {
  let row = page.getByRole("row").filter({ hasText: options.assetName });

  if (options.category) {
    row = row.filter({ hasText: options.category });
  }

  if (options.status) {
    row = row.filter({ hasText: options.status });
  }

  return row;
}

export async function expectNoPageError(page: Page) {
  await expect(page.getByRole("alert")).toHaveCount(0);
}

export function todayInTokyo() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}
