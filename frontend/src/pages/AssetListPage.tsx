import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiClientError, apiFetch } from "../lib/api";
import type { Asset } from "../types/asset";

// 備品一覧APIの返却データ型
type AssetPageResponse = {
  items: Asset[];
  total: number;
  total_count: number;
  total_stock: number;
  low_stock_count: number;
  page: number;
  page_size: number;
  total_pages: number;
};

// 備品名のソート順を表す型。未指定・昇順・降順を区別する。
type NameSort = "" | "name_asc" | "name_desc";

// 一覧の在庫数に応じた警告色を決める
function stockClassName(stock: number) {
  if (stock === 0) {
    return "text-red-700";
  }

  if (stock <= 5) {
    return "text-red-600";
  }

  return "text-slate-900";
}

// 有効在庫から一覧表示用の貸出状態ラベルを作る
function statusLabel(asset: Asset) {
  if (asset.effective_stock === 0) {
    return "予約満了";
  }

  return asset.status === "available" ? "貸出可能" : asset.status;
}

// 備品一覧を表示し、カテゴリ・検索・並び替え・ページング条件で /api/assets を読む画面
export function AssetListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { toastRequestId?: number } | null;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [nameSort, setNameSort] = useState<NameSort>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalItemCount, setTotalItemCount] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);

  // 申請画面から戻ったときの申請完了トーストを表示する
  useEffect(() => {
    if (!locationState?.toastRequestId) {
      return;
    }

    setToastMessage(
      `申請を受け付けました。 申請ID: ${locationState.toastRequestId}`,
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, locationState?.toastRequestId, navigate]);

  // トーストの表示アニメーションと自動非表示を管理する
  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    setIsToastVisible(false);
    const showTimeoutId = window.setTimeout(() => {
      setIsToastVisible(true);
    }, 10);
    const timeoutId = window.setTimeout(() => {
      setIsToastVisible(false);
      setToastMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  // 一覧の絞り込みプルダウンに使うカテゴリ一覧を API から取得する
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchCategories() {
      try {
        const data = await apiFetch<string[]>("/api/assets/categories", {
          signal: abortController.signal,
        });
        setCategories(data);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "カテゴリ一覧の取得に失敗しました。",
        );
      }
    }

    fetchCategories();

    return () => {
      abortController.abort();
    };
  }, []);

  // 検索条件・ページ・並び替えに応じて備品一覧と集計値を API から取得する
  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await apiFetch<AssetPageResponse>("/api/assets", {
          query: {
            category: selectedCategory || undefined,
            page: currentPage,
            q: query.trim() || undefined,
            sort: nameSort || undefined,
          },
          signal: abortController.signal,
        });
        setAssets(data.items);
        setTotalCount(data.total);
        setTotalItemCount(data.total_count);
        setTotalStock(data.total_stock);
        setLowStockCount(data.low_stock_count);
        setPageSize(data.page_size);
        setTotalPages(data.total_pages);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "備品一覧の取得に失敗しました。",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [currentPage, nameSort, query, selectedCategory]);

  // 一覧下部に出す表示範囲とページ番号を計算する（例：1 - 20 / 55　< 1 2 3 >）
  const visibleStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = totalCount === 0 ? 0 : visibleStart + assets.length - 1;
  const paginationPages = useMemo(() => {
    const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    const endPage = Math.min(totalPages, startPage + 2);

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index,
    );
  }, [currentPage, totalPages]);

  // ページネーション（ページ番号ボタン・ <・ >）を押したときの共通処理
  function handlePageChange(page: number) {
    // <・ >を押した場合に1ページ未満や最終ページ超えを防ぐ
    const nextPage = Math.max(1, Math.min(page, totalPages));

    if (nextPage === currentPage) {
      return;
    }

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0 });
  }

  // カテゴリ・検索語・並び替えを初期化して 1 ページ目に戻す
  function handleClearSearch() {
    setSelectedCategory("");
    setQuery("");
    setNameSort("");
    setCurrentPage(1);
  }

  // 備品名の昇順・降順ソートを切り替える
  function handleNameSortToggle() {
    setNameSort((sort) => (sort === "name_asc" ? "name_desc" : "name_asc"));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-medium text-teal-700">AssetFlow</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
                  備品一覧
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">取扱品目数</p>
                  <p className="mt-1 text-lg font-semibold">{totalItemCount}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">総在庫数</p>
                  <p className="mt-1 text-lg font-semibold">{totalStock}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">要確認品目数</p>
                  <p className="mt-1 text-lg font-semibold text-red-600">
                    {lowStockCount}
                  </p>
                </div>
              </div>
            </div>

            <nav
              aria-label="メインナビゲーション"
              className="flex flex-wrap justify-start gap-2 lg:justify-end"
            >
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                to="/my-requests"
              >
                マイ貸出状況
              </Link>
            </nav>
          </div>
        </header>

        {toastMessage ? (
          <div
            className={`fixed left-1/2 top-0 z-50 -translate-x-1/2 rounded-b-md border border-t-0 border-teal-200 bg-teal-50 px-5 py-3 text-sm font-medium text-teal-800 shadow-md transition-transform duration-300 ${
              isToastVisible ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            ✅ {toastMessage}
          </div>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row">
              <select
                aria-label="カテゴリで絞り込み"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:w-56"
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setCurrentPage(1);
                }}
                value={selectedCategory}
              >
                <option value="">すべてのカテゴリ</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="relative block w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  placeholder="備品名で検索"
                  type="search"
                />
              </label>
            </div>

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={handleClearSearch}
              type="button"
            >
              <RefreshCw className="size-4" />
              クリア
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-20 px-5 py-3 font-semibold">No.</th>
                    <th
                      className="px-5 py-3 font-semibold"
                      aria-sort={
                        nameSort === "name_asc"
                          ? "ascending"
                          : nameSort === "name_desc"
                            ? "descending"
                            : "none"
                      }
                    >
                      <button
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-slate-500 transition hover:text-slate-800"
                        onClick={handleNameSortToggle}
                        type="button"
                      >
                        備品名
                        <span className="text-[10px] leading-none">
                          {nameSort === "name_asc"
                            ? "▲"
                            : nameSort === "name_desc"
                              ? "▼"
                              : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-5 py-3 font-semibold">カテゴリ</th>
                    <th className="px-5 py-3 font-semibold">有効在庫数</th>
                    <th className="px-5 py-3 font-semibold">状態</th>
                    <th className="w-48 px-5 py-3 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {assets.map((asset, index) => {
                    const isReservationFull = asset.effective_stock === 0;
                    const itemNumber = index + 1 + (currentPage - 1) * pageSize;

                    return (
                      <tr
                        className={
                          isReservationFull
                            ? "transition"
                            : "group transition hover:bg-teal-50/50"
                        }
                        key={asset.id}
                      >
                        <td className="px-5 py-4 font-medium text-slate-500">
                          {itemNumber}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                              <PackageSearch className="size-4" />
                            </div>
                            <span className="font-medium text-slate-950">
                              {asset.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {asset.category}
                        </td>
                        <td
                          className={`px-5 py-4 text-base font-semibold ${stockClassName(asset.effective_stock)}`}
                        >
                          {asset.effective_stock}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                              isReservationFull
                                ? "bg-red-50 text-red-700"
                                : "bg-teal-50 text-teal-700"
                            }`}
                          >
                            {statusLabel(asset)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {isReservationFull ? null : (
                            <Link
                              className="inline-flex h-9 translate-y-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100 hover:bg-teal-800 focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-teal-200"
                              state={{ asset }}
                              to={`/requests/${asset.id}`}
                            >
                              借用申請
                              <ArrowRight className="size-4" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!isLoading && assets.length === 0 ? (
                    <tr>
                      <td
                        className="px-5 py-12 text-center text-sm text-slate-500"
                        colSpan={6}
                      >
                        該当する備品が見つかりませんでした。条件を変えて検索してください。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {isLoading ? (
              <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                読み込み中...
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-4 border-t border-slate-200 px-5 py-3">
              <p className="text-sm text-slate-500">
                {visibleStart} - {visibleEnd} / {totalCount}
              </p>

              <div className="flex items-center gap-1">
                <button
                  aria-label="前のページ"
                  className="inline-flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => handlePageChange(currentPage - 1)}
                  type="button"
                >
                  <ChevronLeft className="size-4" />
                </button>

                {paginationPages.map((page) => (
                  <button
                    aria-current={currentPage === page ? "page" : undefined}
                    className={`inline-flex size-9 items-center justify-center rounded-md border text-sm font-medium transition ${
                      currentPage === page
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                    disabled={isLoading}
                    key={page}
                    onClick={() => handlePageChange(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}

                <button
                  aria-label="次のページ"
                  className="inline-flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => handlePageChange(currentPage + 1)}
                  type="button"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
