import { ChevronLeft, ChevronRight, PackageCheck, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { ConfirmModal } from "../components/ConfirmModal";
import { UserMenu } from "../components/UserMenu";
import {
  ERROR_ACTIVE_REQUESTS_API_RESPONSE_READ_FAILED,
  ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED,
  ERROR_500_CANCEL_REQUEST_FAILED,
  ERROR_500_RETURN_REQUEST_FAILED,
  ERROR_500_START_LOAN_REQUEST_FAILED,
  ERROR_ACTIVE_REQUESTS_FETCH_FAILED,
  ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED,
  ERROR_503_CANCEL_REQUEST_FAILED,
  ERROR_503_RETURN_REQUEST_FAILED,
  ERROR_503_START_LOAN_REQUEST_FAILED,
  ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED,
  ERROR_504_CANCEL_REQUEST_FAILED,
  ERROR_504_RETURN_REQUEST_FAILED,
  ERROR_504_START_LOAN_REQUEST_FAILED,
  ERROR_CANCEL_REQUEST_API_RESPONSE_READ_FAILED,
  ERROR_CANCEL_REQUEST_FAILED,
  ERROR_CANCEL_REQUEST_RELOAD_GUIDANCE,
  ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE,
  ERROR_RETURN_REQUEST_API_RESPONSE_READ_FAILED,
  ERROR_RETURN_REQUEST_RELOAD_GUIDANCE,
  ERROR_RETURN_REQUEST_FAILED,
  ERROR_START_LOAN_REQUEST_API_RESPONSE_READ_FAILED,
  ERROR_START_LOAN_REQUEST_RELOAD_GUIDANCE,
  ERROR_UNEXPECTED_ACTIVE_REQUESTS_FETCH,
  ERROR_UNEXPECTED_CANCEL_REQUEST,
  ERROR_UNEXPECTED_RETURN_REQUEST,
  ERROR_UNEXPECTED_START_LOAN_REQUEST,
} from "../constants/errorMessages";
import { API_PATHS } from "../constants/APIPaths";
import { COMMON_MESSAGES } from "../constants/CommonMessages";
import { MY_LOAN_REQUEST_PAGE_MESSAGES } from "../constants/MyLoanRequestPageMessages";
import { PAGE_NAMES } from "../constants/PageName";
import { useAuth } from "../contexts/AuthContext";
import { getRequestStatusLabel } from "../constants/statusLabels";
import { ApiResponseError, apiFetch } from "../lib/api";
import type { ActiveAssetLoanRequest, AssetLoanRequest } from "../types/assetLoanRequest";

type StatusFilter = "all" | "loaned" | "pending" | "approved" | "rejected";
const REQUEST_PAGE_SIZE = 20;
const REQUEST_CATEGORIES = [
  "アクセサリー",
  "カメラ",
  "キーボード",
  "ストレージ",
  "タブレット",
  "パソコン",
  "ヘッドセット",
  "マウス",
  "モニター",
  "会議機器",
  "家具",
  "周辺機器",
  "電源機器",
] as const;
type ConfirmAction =
  | {
      kind: "start-loan";
      request: ActiveAssetLoanRequest;
    }
  | {
      kind: "return";
      request: ActiveAssetLoanRequest;
    }
  | {
      kind: "cancel";
      request: ActiveAssetLoanRequest;
    }
  | null;

// トースト表示用に申請IDを 5 桁へ整形する
function formatRequestId(id: number) {
  return String(id).padStart(5, "0");
}

function withReloadGuidance(message: string) {
  return `${message}\n${ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE}`;
}

function getActiveRequestsFetchErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_ACTIVE_REQUESTS_FETCH);
  }

  if (error.code === "INVALID_RESPONSE") {
    return withReloadGuidance(ERROR_ACTIVE_REQUESTS_API_RESPONSE_READ_FAILED);
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_ACTIVE_REQUESTS_FETCH_FAILED);
}

function getReturnRequestErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_RETURN_REQUEST);
  }

  if (error.code === "INVALID_RESPONSE") {
    return `${ERROR_RETURN_REQUEST_API_RESPONSE_READ_FAILED}\n${ERROR_RETURN_REQUEST_RELOAD_GUIDANCE}`;
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_RETURN_REQUEST_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_RETURN_REQUEST_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_RETURN_REQUEST_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_RETURN_REQUEST_FAILED);
}

function getStartLoanRequestErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_START_LOAN_REQUEST);
  }

  if (error.code === "INVALID_RESPONSE") {
    return `${ERROR_START_LOAN_REQUEST_API_RESPONSE_READ_FAILED}\n${ERROR_START_LOAN_REQUEST_RELOAD_GUIDANCE}`;
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_START_LOAN_REQUEST_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_START_LOAN_REQUEST_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_START_LOAN_REQUEST_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_500_START_LOAN_REQUEST_FAILED);
}

function getCancelRequestErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_CANCEL_REQUEST);
  }

  if (error.code === "INVALID_RESPONSE") {
    return `${ERROR_CANCEL_REQUEST_API_RESPONSE_READ_FAILED}\n${ERROR_CANCEL_REQUEST_RELOAD_GUIDANCE}`;
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_CANCEL_REQUEST_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_CANCEL_REQUEST_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_CANCEL_REQUEST_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_CANCEL_REQUEST_FAILED);
}

// 自分の承認待ち・貸出中申請を表示し、返却登録API・申請キャンセルAPIを操作する画面
export function MyLoanRequestPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeRequests, setActiveRequests] = useState<ActiveAssetLoanRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [startingLoanRequestId, setStartingLoanRequestId] = useState<number | null>(null);
  const [returningRequestId, setReturningRequestId] = useState<number | null>(null);
  const [cancellingRequestId, setCancellingRequestId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // マイ貸出状況の元データを貸出状況取得APIから取得する
  const fetchActiveRequests = useCallback(async (signal?: AbortSignal) => {
    const data = await apiFetch<ActiveAssetLoanRequest[]>(API_PATHS.myLoanRequests, { signal });
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
  const approvedCount = useMemo(
    () => activeRequests.filter((request) => request.status === "approved").length,
    [activeRequests],
  );
  const rejectedCount = useMemo(
    () => activeRequests.filter((request) => request.status === "rejected").length,
    [activeRequests],
  );
  const requestCategories = useMemo(
    () => {
      const activeCategorySet = new Set(
        activeRequests.map((request) => request.asset_category),
      );
      const knownRequestCategories = new Set<string>(REQUEST_CATEGORIES);

      const prioritizedCategories = REQUEST_CATEGORIES.filter((category) =>
        activeCategorySet.has(category),
      );

      const additionalCategories = [...activeCategorySet]
        .filter((category) => !knownRequestCategories.has(category))
        .sort((left, right) => left.localeCompare(right, "ja"));

      return [...prioritizedCategories, ...additionalCategories];
    },
    [activeRequests],
  );
  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeRequests
      .filter((request) => {
        const matchesStatus = statusFilter === "all" || request.status === statusFilter;
        const matchesCategory = !selectedCategory || request.asset_category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          request.asset_name.toLowerCase().includes(normalizedQuery) ||
          request.asset_category.toLowerCase().includes(normalizedQuery);

        return matchesStatus && matchesCategory && matchesQuery;
      })
      .sort((left, right) => {
        const periodComparison = left.start_date.localeCompare(right.start_date);
        return periodComparison !== 0 ? periodComparison : left.id - right.id;
      });
  }, [activeRequests, query, selectedCategory, statusFilter]);
  const totalCount = filteredRequests.length;
  const isProcessing =
    startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null;
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

        setErrorMessage(getActiveRequestsFetchErrorMessage(error));
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

  // エラー表示後にURLのクエリを除去し、ブラウザ再読み込み時に通常導線へ戻せるようにする
  useEffect(() => {
    if (!errorMessage || !location.search) {
      return;
    }

    window.history.replaceState({}, "", location.pathname);
  }, [errorMessage, location.pathname, location.search]);

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

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    if (!requestCategories.includes(selectedCategory)) {
      setSelectedCategory("");
    }
  }, [requestCategories, selectedCategory]);

  async function submitStartLoan(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setStartingLoanRequestId(request.id);
    setErrorMessage(null);

    try {
      await apiFetch<AssetLoanRequest>(API_PATHS.startLoanRequest(request.id), {
        method: "POST",
      });
      await fetchActiveRequests();
      setToastMessage(MY_LOAN_REQUEST_PAGE_MESSAGES.startLoanAccepted(formatRequestId(request.id)));
    } catch (error) {
      setErrorMessage(getStartLoanRequestErrorMessage(error));
    } finally {
      setStartingLoanRequestId(null);
    }
  }

  // 貸出中の申請を返却登録APIで返却済みにする
  async function submitReturn(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setReturningRequestId(request.id);
    setErrorMessage(null);

    try {
      await apiFetch<AssetLoanRequest>(API_PATHS.returnLoanRequest(request.id), {
        method: "POST",
      });
      await fetchActiveRequests();
      setToastMessage(MY_LOAN_REQUEST_PAGE_MESSAGES.returnAccepted(formatRequestId(request.id)));
    } catch (error) {
      setErrorMessage(getReturnRequestErrorMessage(error));
    } finally {
      setReturningRequestId(null);
    }
  }

  // 承認待ち・承認却下の申請を申請キャンセルAPIでキャンセルする
  async function submitCancelRequest(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setCancellingRequestId(request.id);
    setErrorMessage(null);

    try {
      await apiFetch<AssetLoanRequest>(API_PATHS.cancelLoanRequest(request.id), {
        method: "POST",
      });
      await fetchActiveRequests();
      setToastMessage(MY_LOAN_REQUEST_PAGE_MESSAGES.cancelAccepted(formatRequestId(request.id)));
    } catch (error) {
      setErrorMessage(getCancelRequestErrorMessage(error));
    } finally {
      setCancellingRequestId(null);
    }
  }

  function handleStartLoan(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setConfirmAction({ kind: "start-loan", request });
  }

  function handleReturn(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setConfirmAction({ kind: "return", request });
  }

  function handleCancelRequest(request: ActiveAssetLoanRequest) {
    if (startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null) {
      return;
    }

    setConfirmAction({ kind: "cancel", request });
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    const action = confirmAction;
    setConfirmAction(null);

    if (action.kind === "start-loan") {
      await submitStartLoan(action.request);
      return;
    }

    if (action.kind === "return") {
      await submitReturn(action.request);
      return;
    }

    await submitCancelRequest(action.request);
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
      <ConfirmModal
        cancelLabel="キャンセル"
        confirmLabel="OK"
        confirmTone={confirmAction?.kind === "cancel" ? "danger" : "primary"}
        isOpen={confirmAction !== null}
        isSubmitting={startingLoanRequestId !== null || returningRequestId !== null || cancellingRequestId !== null}
        message={
          confirmAction?.kind === "start-loan"
            ? MY_LOAN_REQUEST_PAGE_MESSAGES.startLoanConfirmMessage
            : confirmAction?.kind === "return"
            ? MY_LOAN_REQUEST_PAGE_MESSAGES.returnConfirmMessage
            : MY_LOAN_REQUEST_PAGE_MESSAGES.cancelConfirmMessage
        }
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          void handleConfirmAction();
        }}
        title={
          confirmAction?.kind === "start-loan"
            ? MY_LOAN_REQUEST_PAGE_MESSAGES.startLoanConfirmTitle
            : confirmAction?.kind === "return"
            ? MY_LOAN_REQUEST_PAGE_MESSAGES.returnConfirmTitle
            : MY_LOAN_REQUEST_PAGE_MESSAGES.cancelConfirmTitle
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        {user?.role === "admin" ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            管理者モードでログインしています。
          </div>
        ) : null}

        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-medium text-teal-700">AssetFlow</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">{PAGE_NAMES.myRequests}</h1>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">承認待ち</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{pendingCount}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">承認済み</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{approvedCount}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">承認却下</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{rejectedCount}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">貸出中</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{loanedCount}</p>
                </div>
              </div>
            </div>

            <nav aria-label="メインナビゲーション" className="flex flex-col items-start gap-2 lg:items-end">
              <UserMenu />
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {user?.role === "admin" ? (
                  <Link
                    aria-disabled={isProcessing}
                    className={`inline-flex h-10 items-center justify-center rounded-md border border-teal-700 bg-white px-4 text-sm font-medium text-teal-800 transition hover:bg-teal-50 ${
                      isProcessing ? "pointer-events-none cursor-not-allowed opacity-60" : ""
                    }`}
                    onClick={(event) => {
                      if (isProcessing) {
                        event.preventDefault();
                      }
                    }}
                    to="/admin"
                  >
                    <ShieldCheck className="mr-2 size-4" />
                    {PAGE_NAMES.admin}
                  </Link>
                ) : null}
                <Link
                  aria-disabled={isProcessing}
                  className={`inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 ${
                    isProcessing ? "pointer-events-none cursor-not-allowed opacity-60" : ""
                  }`}
                  onClick={(event) => {
                    if (isProcessing) {
                      event.preventDefault();
                    }
                  }}
                  to="/"
                >
                  {PAGE_NAMES.assetList}
                </Link>
              </div>
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
                disabled={isProcessing}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setCurrentPage(1);
                }}
                value={statusFilter}
              >
                <option value="all">すべての状態</option>
                <option value="approved">承認済み</option>
                <option value="rejected">承認却下</option>
                <option value="loaned">貸出中</option>
                <option value="pending">承認待ち</option>
              </select>

              <select
                aria-label="カテゴリで絞り込み"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:w-44"
                disabled={isProcessing}
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setCurrentPage(1);
                }}
                value={selectedCategory}
              >
                <option value="">すべてのカテゴリ</option>
                {requestCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="relative block w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  maxLength={60}
                  disabled={isProcessing}
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
              disabled={isProcessing}
              onClick={handleClearFilters}
              type="button"
            >
              <RefreshCw className="size-4" />
              クリア
            </button>
          </div>

          {errorMessage ? (
            <div
              className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              {COMMON_MESSAGES.loading}
            </div>
          ) : null}

          {!isLoading && totalCount === 0 ? (
            <section className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <PackageCheck className="size-6" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">
                {activeRequests.length === 0
                  ? MY_LOAN_REQUEST_PAGE_MESSAGES.emptyInitialState
                  : MY_LOAN_REQUEST_PAGE_MESSAGES.emptySearchResult}
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
                            request.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : request.status === "approved"
                                ? "bg-blue-50 text-blue-700"
                                : request.status === "rejected"
                                  ? "bg-rose-50 text-rose-700"
                                : "bg-teal-50 text-teal-700"
                          }`}
                        >
                          {getRequestStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {request.status === "approved" ? (
                          <button
                            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={isProcessing}
                            onClick={() => void handleStartLoan(request)}
                            type="button"
                          >
                            {startingLoanRequestId === request.id ? "処理中" : "貸出開始"}
                          </button>
                        ) : request.status === "loaned" ? (
                          <button
                            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={isProcessing}
                            onClick={() => void handleReturn(request)}
                            type="button"
                          >
                            {returningRequestId === request.id ? "返却中" : "返却"}
                          </button>
                        ) : request.status === "pending" || request.status === "rejected" ? (
                          <button
                            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-md bg-red-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={isProcessing}
                            onClick={() => void handleCancelRequest(request)}
                            type="button"
                          >
                            {cancellingRequestId === request.id ? "処理中" : "キャンセル"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : null}

          {!isLoading && activeRequests.length > 0 ? (
            <div className="flex items-center justify-end gap-4 px-1 py-1">
              <p className="text-sm text-slate-500">{visibleStart} - {visibleEnd} / {totalCount}</p>

              <div className="flex items-center gap-1">
                <button
                  aria-label="前のページ"
                  className="inline-flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  disabled={currentPage <= 1 || isLoading || isProcessing}
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
                    disabled={isLoading || isProcessing}
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
                  disabled={currentPage >= totalPages || isLoading || isProcessing}
                  onClick={() => handlePageChange(currentPage + 1)}
                  type="button"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
