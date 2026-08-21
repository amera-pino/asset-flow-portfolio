import type { Asset } from "./asset";

// 備品一覧APIの返却データ型。備品一覧画面とそのテストで共通利用する。
export type AssetPageResponse = {
  items: Asset[];
  filtered_item_count: number;
  total_item_count: number;
  total_item_stock: number;
  total_effective_stock: number;
  low_stock_item_count: number;
  page: number;
  page_size: number;
  total_pages: number;
};
