import { ChevronLeft, ChevronRight, PackageCheck, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiClientError, apiFetch } from "../lib/api";
import type { ActiveAssetRequest, AssetRequest } from "../types/assetRequest";

type StatusFilter = "all" | "loaned" | "pending";
const REQUEST_PAGE_SIZE = 20;

// API の申請ステータスを画面表示用ラベルに変換する
function statusDisplayLabel(status: ActiveAssetRequest["status"]) {
  if (status === "pending") {
    return "承認待ち";
  }

  if (status === "loaned") {
    return "貸出中";
  }

  if (status === "returned") {
    return "返却済み";
  }

  if (status === "cancelled") {
    return "キャンセル済み";
  }

  return status;
}

// トースト表示用に申請IDを 5 桁へ整形する
function formatRequestId(id: number) {
  return String(id).padStart(5, "0");
}

// 自分の承認待ち・貸出中申請を表示し、返却・キャンセル API を操作する画面
export function MyRequestsPage() {
  const [activeRequests, setActiveRequests] = useState<ActiveAssetRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [returningRequestId, setReturningRequestId] = useState<number | null>(null);
  const [cancellingRequestId, setCancellingRequestId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);

  // マイ貸出状況の元データを /api/requests/me/active から取得する
  const fetchActiveRequests = useCallback(async (signal?: AbortSignal) => {
    const data = await apiFetch<ActiveAssetRequest[]>("/api/requests/me/active", { signal });
    setActiveRequests(data);
  }, []);

  const pendingCount = useMemo(
    () => activeRequests.filter((request) => request.status === "pending").length,
    [activeRequests],
  );
  const loanedCount = useMemo(
    () => activeRequests.filter((request) => request.status === "loaned").length,
    [activeRequests],
  );
  const categories = useMemo(
    () => Array.from(new Set(activeRequests.map((request) => request.asset_category))).sort(),
    [activeRequests],
  );
  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeRequests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesCategory = !selectedCategory || request.asset_category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        request.asset_name.toLowerCase().includes(normalizedQuery) ||
        request.asset_category.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [activeRequests, query, selectedCategory, statusFilter]);
  const totalCount = filteredRequests.length;
  const totalPages = Math.max(Math.ceil(totalCount / REQUEST_PAGE_SIZE), 1);
  const paginatedRequests = useMemo(
    () => filteredRequests.slice((currentPage - 1) * REQUEST_PAGE_SIZE, currentPage * REQUEST_PAGE_SIZE),
    [currentPage, filteredRequests],
  );
  const visibleStart = totalCount === 0 ? 0 : (currentPage - 1) * REQUEST_PAGE_SIZE + 1;
  const visibleEnd = totalCount === 0 ? 0 : visibleStart + paginatedRequests.length - 1;
  const paginationPages = useMemo(() => {
    const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    const endPage = Math.min(totalPages, startPage + 2);

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [currentPage, totalPages]);

  // 初回表示時にアクティブな申請一覧を読み込む
  useEffect(() => {
    const abortController = new AbortController();

    async function loadActiveRequests() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await fetchActiveRequests(abortController.signal);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setErrorMessage(error instanceof ApiClientError ? error.message : "貸出状況の取得に失敗しました。");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadActiveRequests();

    return () => {
      abortController.abort();
    };
  }, [fetchActiveRequests]);

  // 返却・キャンセル完了トーストの表示と自動非表示を管理する
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

  // 絞り込み後に現在ページが範囲外になった場合、最終ページへ戻す
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 貸出中の申請を /api/requests/{id}/return で返却済みにする
  async function handleReturn(request: ActiveAssetRequest) {
    if (returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    const isConfirmed = window.confirm("この備品を返却してもよろしいですか？");

    if (!isConfirmed) {
      return;
    }

    setReturningRequestId(request.id);
    setErrorMessage(null);

    try {
      await apiFetch<AssetRequest>(`/api/requests/${request.id}/return`, {
        method: "POST",
      });
      await fetchActiveRequests();
      setToastMessage(`返却を受け付けました。申請ID：${formatRequestId(request.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiClientError ? error.message : "返却処理に失敗しました。");
    } finally {
      setReturningRequestId(null);
    }
  }

  // 承認待ちの申請を /api/requests/{id}/cancel でキャンセルする
  async function handleCancelRequest(request: ActiveAssetRequest) {
    if (returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    const isConfirmed = window.confirm("この申請をキャンセルしてもよろしいですか？");

    if (!isConfirmed) {
      return;
    }

    setCancellingRequestId(request.id);
    setErrorMessage(null);

    try {
      await apiFetch<AssetRequest>(`/api/requests/${request.id}/cancel`, {
        method: "POST",
      });
      await fetchActiveRequests();
      setToastMessage(`キャンセルを受け付けました。申請ID：${formatRequestId(request.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiClientError ? error.message : "キャンセル処理に失敗しました。");
    } finally {
      setCancellingRequestId(null);
    }
  }

  // 状態・カテゴリ・検索語を初期化して全件表示へ戻す
  function handleClearFilters() {
    setStatusFilter("all");
    setSelectedCategory("");
    setQuery("");
    setCurrentPage(1);
  }

  // 絞り込み後の件数に合わせて表示ページを切り替える
  function handlePageChange(page: number) {
    const nextPage = Math.max(1, Math.min(page, totalPages));

    if (nextPage === currentPage) {
      return;
    }

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-medium text-teal-700">AssetFlow</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">マイ貸出状況</h1>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">承認待ち</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{pendingCount}</p>
              </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">貸出中</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{loanedCount}</p>
                </div>
              </div>
            </div>

            <nav aria-label="メインナビゲーション" className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                to="/"
              >
                備品一覧
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
            {toastMessage}
          </div>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-3 md:max-w-3xl md:flex-row">
              <select
                aria-label="ステータスで絞り込み"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:w-40"
                id="request-status-filter"
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setCurrentPage(1);
                }}
                value={statusFilter}
              >
                <option value="all">すべての状態</option>
                <option value="loaned">貸出中</option>
                <option value="pending">承認待ち</option>
              </select>

              <select
                aria-label="カテゴリで絞り込み"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:w-44"
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
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="備品名で検索..."
                  type="search"
                  value={query}
                />
              </label>
            </div>

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={handleClearFilters}
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

          {isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              貸出状況を読み込み中...
            </div>
          ) : null}

          {!isLoading && totalCount === 0 ? (
            <section className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <PackageCheck className="size-6" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">
                {activeRequests.length === 0
                  ? "現在、あなたが借りている備品はありません。"
                  : "選択したステータスの備品はありません。"}
              </p>
            </section>
          ) : null}

          {!isLoading && totalCount > 0 ? (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-16 px-5 py-3 font-semibold">No.</th>
                    <th className="w-28 px-5 py-3 font-semibold">申請ID</th>
                    <th className="px-5 py-3 font-semibold">備品名</th>
                    <th className="px-5 py-3 font-semibold">カテゴリ</th>
                    <th className="w-20 px-5 py-3 font-semibold">数量</th>
                    <th className="w-56 px-5 py-3 font-semibold">貸出期間</th>
                    <th className="w-28 px-5 py-3 font-semibold">状態</th>
                    <th className="w-36 px-5 py-3 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {paginatedRequests.map((request, index) => (
                    <tr className="transition hover:bg-teal-50/50" key={request.id}>
                      <td className="px-5 py-4 font-medium text-slate-500">
                        {index + 1 + (currentPage - 1) * REQUEST_PAGE_SIZE}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">{formatRequestId(request.id)}</td>
                      <td className="px-5 py-4 font-medium text-slate-950">{request.asset_name}</td>
                      <td className="px-5 py-4 text-slate-600">{request.asset_category}</td>
                      <td className="px-5 py-4 font-semibold text-slate-950">{request.quantity}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {request.start_date} - {request.end_date}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                            request.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"
                          }`}
                        >
                          {statusDisplayLabel(request.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {request.status === "loaned" ? (
                          <button
                            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={returningRequestId !== null || cancellingRequestId !== null}
                            onClick={() => void handleReturn(request)}
                            type="button"
                          >
                            {returningRequestId === request.id ? "返却中" : "返却"}
                          </button>
                        ) : (
                          <button
                            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-md bg-red-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={returningRequestId !== null || cancellingRequestId !== null}
                            onClick={() => void handleCancelRequest(request)}
                            type="button"
                          >
                            {cancellingRequestId === request.id ? "処理中" : "キャンセル"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex items-center justify-end gap-4 border-t border-slate-200 px-5 py-3">
                <p className="text-sm text-slate-500">{visibleStart} - {visibleEnd} / {totalCount}</p>

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
          ) : null}
        </section>
      </div>
    </main>
  );
}
