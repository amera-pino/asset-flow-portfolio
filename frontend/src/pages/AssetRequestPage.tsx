import { CalendarDays, PackageSearch } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiClientError, apiFetch } from "../lib/api";
import { DEMO_USER_NAME } from "../constants/demoUser";
import type { Asset } from "../types/asset";
import type { AssetRequest, AssetRequestCreate } from "../types/assetRequest";

type LocationState = {
  asset?: Asset;
};

// 申請フォームの日付初期値を YYYY-MM-DD で作る
function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(dateString: string, months: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + months);

  const resultYear = date.getFullYear();
  const resultMonth = `${date.getMonth() + 1}`.padStart(2, "0");
  const resultDay = `${date.getDate()}`.padStart(2, "0");
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

  return value.replace(/^0+(?=\d)/, "");
}

// 備品詳細と申請フォームを表示し、POST /api/requests で借用申請する画面
export function AssetRequestPage() {
  const { assetId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LocationState | null;
  const initialStartDate = todayString();
  const redirectTimerRef = useRef<number | null>(null);

  const [asset, setAsset] = useState<Asset | null>(locationState?.asset ?? null);
  const [requesterName, setRequesterName] = useState(DEMO_USER_NAME);
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

  // 申請成功後の遷移タイマーをアンマウント時に片付ける
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // 一覧から渡されなかった備品情報を /api/assets/{id} から取得する
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
        const foundAsset = await apiFetch<Asset>(`/api/assets/${numericAssetId}`, {
          signal: abortController.signal,
        });

        setAsset(foundAsset);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 404) {
          setErrorMessage("指定された備品が見つかりません。");
        } else {
          setErrorMessage(error instanceof ApiClientError ? error.message : "備品情報の取得に失敗しました。");
        }
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
    setRequesterName(DEMO_USER_NAME);
    setQuantity("1");
    setStartDate(resetDate);
    setEndDate(resetDate);
    setReason("");
    setErrorMessage(null);
  }

  // 入力値と有効在庫から、送信前に表示する検証メッセージを決める
  const validationMessage = useMemo(() => {
    if (!Number.isInteger(numericAssetId)) {
      return "備品IDが正しくありません。";
    }

    if (!requesterName.trim()) {
      return "申請者名を入力してください。";
    }

    const numericQuantity = Number(quantity);

    if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
      return "申請数量は1以上で入力してください。";
    }

    if (!startDate) {
      return "開始日を入力してください。";
    }

    if (startDate < initialStartDate) {
      return "開始日は本日以降の日付を指定してください。";
    }

    if (!endDate) {
      return "終了日を入力してください。";
    }

    if (!reason.trim()) {
      return "使用目的を入力してください。";
    }

    if (!asset) {
      return null;
    }

    if (asset.effective_stock <= 0) {
      return "予約満了のため申請できません。";
    }

    if (numericQuantity > asset.effective_stock) {
      return "申請数量が有効在庫数を超えています。";
    }

    if (endDate < startDate) {
      return "終了日は開始日以降の日付を指定してください。";
    }

    if (endDate > requestDeadlineDate) {
      return `終了日は本日から6ヶ月後以内（${requestDeadlineLabel}まで）で指定してください。`;
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

  // フォーム内容を POST /api/requests へ送り、成功時は一覧へ戻す
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!asset || validationMessage) {
      setErrorMessage(validationMessage ?? "申請内容を確認してください。");
      return;
    }

    const requestedQuantity = Number(quantity);
    const payload: AssetRequestCreate = {
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
      const createdRequest = await apiFetch<AssetRequest>("/api/requests", {
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
      redirectTimerRef.current = window.setTimeout(() => {
        navigate("/", {
          state: { toastRequestId: createdRequest.id },
        });
      }, 1000);
    } catch (error) {
      setErrorMessage(error instanceof ApiClientError ? error.message : "申請の送信に失敗しました。");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-teal-700">AssetFlow</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">備品貸出申請</h1>
            </div>
            <nav aria-label="メインナビゲーション" className="flex flex-wrap gap-2 md:justify-end">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                to="/"
              >
                備品一覧
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                to="/my-requests"
              >
                マイ貸出状況
              </Link>
            </nav>
          </div>
        </header>

        {isLoadingAsset ? (
          <div className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
            備品情報を読み込み中...
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
                    max={asset.effective_stock}
                    min={1}
                    onChange={(event) => setQuantity(normalizeQuantityInput(event.target.value))}
                    required
                    type="number"
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
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="利用目的や貸出が必要な背景を入力"
                    required
                    value={reason}
                  />
                </label>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                  キャンセル
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
                  {isSubmitting ? "申請中..." : "申請する"}
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
                    <dt className="text-xs text-slate-500">有効在庫</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-950">{asset.effective_stock}</dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-3">
                    <dt className="text-xs text-slate-500">状態</dt>
                    <dd
                      className={`mt-1 text-sm font-medium ${
                        asset.effective_stock === 0 ? "text-red-700" : "text-teal-700"
                      }`}
                    >
                      {asset.effective_stock === 0 ? "予約満了" : asset.status === "available" ? "貸出可能" : asset.status}
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
          <div className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage ?? "指定された備品が見つかりません。"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
