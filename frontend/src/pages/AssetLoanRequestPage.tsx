import { CalendarDays, PackageSearch } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { UserMenu } from "../components/UserMenu";
import {
  ERROR_ASSET_DETAIL_API_RESPONSE_READ_FAILED,
  ERROR_ASSET_LOAN_REQUEST_RELOAD_GUIDANCE,
  ERROR_ASSET_LOAN_REQUEST_RESELECT_GUIDANCE,
  ERROR_INVALID_ASSET_ID,
  ERROR_ASSET_NOT_FOUND,
  ERROR_LOAN_REQUEST_SUBMIT_API_RESPONSE_READ_FAILED,
  ERROR_500_ASSET_DETAIL_FETCH_FAILED,
  ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
  ERROR_503_ASSET_DETAIL_FETCH_FAILED,
  ERROR_503_LOAN_REQUEST_SUBMIT_FAILED,
  ERROR_504_ASSET_DETAIL_FETCH_FAILED,
  ERROR_504_LOAN_REQUEST_SUBMIT_FAILED,
  ERROR_UNEXPECTED_ASSET_DETAIL_FETCH,
  ERROR_UNEXPECTED_LOAN_REQUEST_SUBMIT,
} from "../constants/errorMessages";
import { API_PATHS } from "../constants/APIPaths";
import { ASSET_LOAN_REQUEST_PAGE_MESSAGES } from "../constants/AssetLoanRequestPageMessages";
import { COMMON_MESSAGES } from "../constants/CommonMessages";
import { PAGE_NAMES } from "../constants/PageName";
import { DEMO_USER_NAME } from "../constants/demoUser";
import { useAuth } from "../contexts/AuthContext";
import { getAssetStatusLabel } from "../constants/statusLabels";
import { ApiResponseError, apiFetch } from "../lib/api";
import type { Asset } from "../types/asset";
import type { AssetLoanRequest, AssetLoanRequestCreate } from "../types/assetLoanRequest";

type LocationState = {
  asset?: Asset;
};

const JST_TIME_ZONE = "Asia/Tokyo";

// 申請フォームの日付初期値を日本時間/JST基準の YYYY-MM-DD で作る
function todayString() {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    timeZone: JST_TIME_ZONE,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  return `${year}-${month}-${day}`;
}

function addMonths(dateString: string, months: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);

  const resultYear = date.getUTCFullYear();
  const resultMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const resultDay = `${date.getUTCDate()}`.padStart(2, "0");
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function formatJapaneseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function normalizeQuantityInput(value: string) {
  if (value === "") {
    return "";
  }

  const digitsOnlyValue = value.replace(/\D/g, "");
  if (digitsOnlyValue === "") {
    return "";
  }

  return digitsOnlyValue.replace(/^0+(?=\d)/, "");
}

function stockValueClassName(stock: number) {
  if (stock === 0) {
    return "text-red-700";
  }

  if (stock <= 5) {
    return "text-red-600";
  }

  return "text-slate-950";
}

function withReloadGuidance(message: string) {
  return `${message}\n${ERROR_ASSET_LOAN_REQUEST_RELOAD_GUIDANCE}`;
}

function withAssetReselectGuidance(message: string) {
  return `${message}\n${ERROR_ASSET_LOAN_REQUEST_RESELECT_GUIDANCE}`;
}

function replaceBrowserPath(path: string) {
  if (window.location.pathname === path && !window.location.search && !window.location.hash) {
    return;
  }

  window.history.replaceState({}, "", path);
}

function getAssetDetailErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_ASSET_DETAIL_FETCH);
  }

  if (error.code === "INVALID_RESPONSE") {
    return withReloadGuidance(ERROR_ASSET_DETAIL_API_RESPONSE_READ_FAILED);
  }

  if (error.status === 404) {
    return withAssetReselectGuidance(ERROR_ASSET_NOT_FOUND);
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_ASSET_DETAIL_FETCH_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_ASSET_DETAIL_FETCH_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_ASSET_DETAIL_FETCH_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_UNEXPECTED_ASSET_DETAIL_FETCH);
}

function getLoanRequestSubmitErrorMessage(error: unknown) {
  if (!(error instanceof ApiResponseError)) {
    return withReloadGuidance(ERROR_UNEXPECTED_LOAN_REQUEST_SUBMIT);
  }

  if (error.code === "INVALID_RESPONSE") {
    return withReloadGuidance(ERROR_LOAN_REQUEST_SUBMIT_API_RESPONSE_READ_FAILED);
  }

  if (error.status === 404) {
    return withAssetReselectGuidance(error.message || ERROR_ASSET_NOT_FOUND);
  }

  if (error.status === 503) {
    return withReloadGuidance(ERROR_503_LOAN_REQUEST_SUBMIT_FAILED);
  }

  if (error.status === 504) {
    return withReloadGuidance(ERROR_504_LOAN_REQUEST_SUBMIT_FAILED);
  }

  if (error.status === 500) {
    return withReloadGuidance(ERROR_500_LOAN_REQUEST_SUBMIT_FAILED);
  }

  return withReloadGuidance(error.message || ERROR_UNEXPECTED_LOAN_REQUEST_SUBMIT);
}

// 対象備品情報と申請フォームを表示し、申請登録APIで借用申請する画面
export function AssetLoanRequestPage() {
  const { assetId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const locationState = location.state as LocationState | null;
  const initialStartDate = todayString();

  const [asset, setAsset] = useState<Asset | null>(locationState?.asset ?? null);
  const [requesterName, setRequesterName] = useState(user?.name ?? DEMO_USER_NAME);
  const [quantity, setQuantity] = useState("1");
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialStartDate);
  const [reason, setReason] = useState("");
  const [isLoadingAsset, setIsLoadingAsset] = useState(!locationState?.asset);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestDeadlineDate = useMemo(() => addMonths(initialStartDate, 6), [initialStartDate]);
  const requestDeadlineLabel = useMemo(() => formatJapaneseDate(requestDeadlineDate), [requestDeadlineDate]);

  const numericAssetId = useMemo(() => Number(assetId), [assetId]);

  useEffect(() => {
    if (Number.isInteger(numericAssetId)) {
      return;
    }

    setIsLoadingAsset(false);
    setErrorMessage(withAssetReselectGuidance(ERROR_INVALID_ASSET_ID));
    replaceBrowserPath("/");
  }, [numericAssetId]);

  // 一覧から渡されなかった備品情報を備品情報取得APIから取得する
  useEffect(() => {
    if (asset || !Number.isInteger(numericAssetId)) {
      setIsLoadingAsset(false);
      return;
    }

    const abortController = new AbortController();

    async function fetchAsset() {
      setIsLoadingAsset(true);
      setErrorMessage(null);

      try {
        const foundAsset = await apiFetch<Asset>(API_PATHS.assetDetail(numericAssetId), {
          signal: abortController.signal,
        });

        setAsset(foundAsset);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        if (error instanceof ApiResponseError && error.status === 404) {
          replaceBrowserPath("/");
        }

        setErrorMessage(getAssetDetailErrorMessage(error));
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingAsset(false);
        }
      }
    }

    void fetchAsset();

    return () => {
      abortController.abort();
    };
  }, [asset, numericAssetId]);

  // 申請フォームの入力値とエラーを初期状態に戻す
  function resetForm() {
    if (isSubmitting) {
      return;
    }

    const resetDate = todayString();
    setRequesterName(user?.name ?? DEMO_USER_NAME);
    setQuantity("1");
    setStartDate(resetDate);
    setEndDate(resetDate);
    setReason("");
    setErrorMessage(null);
  }

  // 入力値と有効在庫から、送信前に表示する検証メッセージを決める
  const validationMessage = useMemo(() => {
    if (!Number.isInteger(numericAssetId)) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.invalidAssetId;
    }

    if (!requesterName.trim()) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.requesterNameRequired;
    }

    const numericQuantity = Number(quantity);

    if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.quantityMinimum;
    }

    if (startDate < initialStartDate) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.startDateMinimum;
    }

    if (!reason.trim()) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.reasonRequired;
    }

    if (!asset) {
      return null;
    }

    if (numericQuantity > asset.effective_stock) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.quantityExceedsStock;
    }

    if (endDate < startDate) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.endDateMinimum;
    }

    if (endDate > requestDeadlineDate) {
      return ASSET_LOAN_REQUEST_PAGE_MESSAGES.endDateMaximum(requestDeadlineLabel);
    }

    return null;
  }, [
    asset,
    endDate,
    initialStartDate,
    numericAssetId,
    quantity,
    reason,
    requestDeadlineDate,
    requestDeadlineLabel,
    requesterName,
    startDate,
  ]);

  // フォーム内容を申請登録APIへ送り、成功時は一覧へ戻す
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!asset || validationMessage) {
      setErrorMessage(validationMessage ?? ASSET_LOAN_REQUEST_PAGE_MESSAGES.invalidFormSubmission);
      return;
    }

    const requestedQuantity = Number(quantity);
    const payload: AssetLoanRequestCreate = {
      asset_id: asset.id,
      requester_name: requesterName.trim(),
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
      quantity: requestedQuantity,
    };

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdRequest = await apiFetch<AssetLoanRequest>(API_PATHS.loanRequestRegistration, {
        method: "POST",
        body: payload,
      });
      setAsset((currentAsset) =>
              currentAsset
                ? {
                    ...currentAsset,
                    consuming_quantity: currentAsset.consuming_quantity + requestedQuantity,
                    effective_stock: Math.max(currentAsset.effective_stock - requestedQuantity, 0),
                  }
                : currentAsset,
      );
      navigate("/", {
        state: { assetLoanRequestId: createdRequest.id },
      });
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 404) {
        replaceBrowserPath("/");
      }

      setErrorMessage(getLoanRequestSubmitErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        {user?.role === "admin" ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            管理者モードでログインしています。
          </div>
        ) : null}

        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-teal-700">AssetFlow</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">{PAGE_NAMES.assetLoanRequest}</h1>
            </div>
            <nav aria-label="メインナビゲーション" className="flex flex-col items-start gap-2 md:items-end">
              <UserMenu />
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  to="/"
                >
                  {PAGE_NAMES.assetList}
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  to="/my-requests"
                >
                  {PAGE_NAMES.myRequests}
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {isLoadingAsset ? (
          <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
            {COMMON_MESSAGES.loading}
          </div>
        ) : null}

        {asset ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              noValidate
              onSubmit={handleSubmit}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">申請者名</span>
                  <input
                    className="h-11 cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 text-sm text-slate-500 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    maxLength={120}
                    readOnly
                    aria-readonly="true"
                    required
                    type="text"
                    value={requesterName}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">申請数量</span>
                  <input
                    className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setQuantity(normalizeQuantityInput(event.target.value))}
                    pattern="[0-9]*"
                    required
                    type="text"
                    inputMode="numeric"
                    value={quantity}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">開始日</span>
                  <input
                    className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    min={initialStartDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                    type="date"
                    value={startDate}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">終了日</span>
                  <input
                    className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    min={startDate}
                    max={requestDeadlineDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    required
                    type="date"
                    value={endDate}
                  />
                </label>

                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">使用目的</span>
                  <textarea
                    className="min-h-32 resize-y rounded-md border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    maxLength={300}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={ASSET_LOAN_REQUEST_PAGE_MESSAGES.reasonPlaceholder}
                    required
                    value={reason}
                  />
                </label>
              </div>

              {errorMessage ? (
                <div
                  className="mt-5 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-28"
                  disabled={isSubmitting}
                  onClick={resetForm}
                  type="button"
                >
                  クリア
                </button>
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-28"
                  disabled={isSubmitting}
                  onClick={() => navigate("/")}
                  type="button"
                >
                  戻る
                </button>
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-28"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? ASSET_LOAN_REQUEST_PAGE_MESSAGES.submitting : "申請する"}
                </button>
              </div>
            </form>

            <aside className="flex flex-col gap-4">
              <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <PackageSearch className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">選択中の備品</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{asset.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{asset.category}</p>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-slate-50 px-3 py-3">
                    <dt className="text-xs text-slate-500">有効在庫数</dt>
                    <dd className={`mt-1 text-lg font-semibold ${stockValueClassName(asset.effective_stock)}`}>
                      {asset.effective_stock}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-3">
                    <dt className="text-xs text-slate-500">状態</dt>
                    <dd
                      className={`mt-1 text-sm font-medium ${
                        asset.effective_stock === 0 ? "text-red-700" : "text-teal-700"
                      }`}
                    >
                      {asset.effective_stock === 0 ? "予約満了" : getAssetStatusLabel(asset.status)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CalendarDays className="size-4 text-teal-700" />
                  申請期間
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {startDate} から {endDate} まで
                </p>
              </div>
            </aside>
          </section>
        ) : null}

        {!isLoadingAsset && !asset ? (
          <div
            className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
            role="alert"
          >
            {errorMessage ??
              (Number.isInteger(numericAssetId)
                ? ERROR_ASSET_NOT_FOUND
                : ERROR_INVALID_ASSET_ID)}
          </div>
        ) : null}
      </div>
    </main>
  );
}
