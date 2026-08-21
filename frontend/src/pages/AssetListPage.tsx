import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  ERROR_UNEXPECTED_CATEGORY_LIST_FETCH,
  ERROR_UNEXPECTED_ASSET_LIST_FETCH,
} from "../constants/errorMessages";
import { API_PATHS } from "../constants/APIPaths";
import { ASSET_LIST_PAGE_MESSAGES } from "../constants/AssetListPageMessages";
import { COMMON_MESSAGES } from "../constants/CommonMessages";
import { PAGE_NAMES } from "../constants/PageName";
import { getAssetStatusLabel } from "../constants/statusLabels";
import { ApiResponseError, apiFetch } from "../lib/api";
import type { Asset } from "../types/asset";
import type { AssetPageResponse } from "../types/assetList";
import { UserMenu } from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";

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

  return getAssetStatusLabel(asset.status);
}

// 備品一覧を表示し、カテゴリ・検索・並び替え・ページング条件で備品一覧取得APIを読む画面
export function AssetListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const locationState = location.state as { assetLoanRequestId?: number } | null;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [nameSort, setNameSort] = useState<NameSort>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredItemCount, setFilteredItemCount] = useState(0);
  const [totalItemCount, setTotalItemCount] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [totalEffectiveStock, setTotalEffectiveStock] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  // useState は値の変更を画面に反映したいときに使い、setState で再レンダリングが起きる。
  // useRef は再レンダリングしても残したい内部用の値を入れる箱で、isInitialMountRef.current = XX で値を変えても再レンダリングは起きない。
  // useMemo は値を入れる箱ではなく、依存値が変わらない間だけ計算結果を再利用するために使う。
  const isInitialMountRef = useRef(true);

  // 申請完了トーストのメッセージを設定し、遷移元で設定された state を消す
  useEffect(() => {
    if (!locationState?.assetLoanRequestId) {
      return;
    }

    setToastMessage(
      ASSET_LIST_PAGE_MESSAGES.loanRequestAccepted(locationState.assetLoanRequestId),
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, locationState?.assetLoanRequestId, navigate]);

  // トーストメッセージの自動表示と自動非表示をタイマーで制御する
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

  // カテゴリープルダウンリストを備品カテゴリ取得APIから取得する
  useEffect(() => {
    // コード概要s:
    // AbortController は、実行中の API 通信をあとからキャンセルするための仕組み。
    // コード解説:
    // 1. この useEffect が動いたら、キャンセル用の AbortController インスタンスを作る。const abortController = new AbortController();
    // 2. apiFetch（正確にはブラウザ標準の通信APIのfetch ） に abortController.signal を渡し、この通信をキャンセル対象として紐づけて監視する。 signal: abortController.signal,
    // 3. API 通信中に別画面へ遷移すると、React Router が表示画面を切り替える。
    // 4. 一覧画面 AssetListPage が画面から外れ、React によってアンマウント(index.htmlの<body><div>id="root"...がマウント／アンマウント先)される。
    // 5. アンマウント時に、この useEffect が返している cleanup 関数が実行される。     return () => {abortController.abort();};
    // 6. cleanup 内の abortController.abort() によって、紐づいた API 通信へ中断信号を送る。
    // 7. API 通信が中断された場合は abortController.signal.aborted が true になる。
    // 8. catch 内では aborted を確認し、キャンセル由来のエラーなら画面エラーにせず return する。
    // 9. これにより、画面を離れたあとに古い API レスポンスで state 更新されることを防ぐ。
    const abortController = new AbortController();

    // なぜ async function fetchCategories() を定義してから、下で fetchCategories() を呼ぶのか？
    // useEffect の外側のコールバック自体を async にすると（useEffect(async () => {const data = await apiFetch(...);....）、
    // 戻り値が cleanup 関数（return () => {abortController.abort();};）ではなく Promise になる。
    // React は useEffect の戻り値として cleanup 関数を直接受け取りたい。
    // そのため、useEffect 本体は同期関数のままにして、await を使う API 取得処理だけを内側の async function に分けている。
    async function fetchCategories() {
      try {
        const data = await apiFetch<string[]>(API_PATHS.assetCategories, {
          signal: abortController.signal,
        });
        setCategories(data);
      } catch (error) {
        // Java は catch の入口で例外型を分ける（catch (IOException e) {}、catch (SQLException e) {}）。
        // しかし、TypeScript は一旦どんな値でも catch する。
        // そのため catch 内で instanceof ApiResponseError のように型を判定し、エラーごとの処理を分ける。
        if (abortController.signal.aborted) {
          return;
        }

        setErrorMessage(
          // error が ApiResponseError クラスから作られたインスタンスかどうかを判定する
          error instanceof ApiResponseError
            ? error.message
            : ERROR_UNEXPECTED_CATEGORY_LIST_FETCH,
        );
      }
    }

    fetchCategories();

    return () => {
      abortController.abort();
    };
    // [] は、この effect 初回マウント時に1回だけ動かしたいという指定です。
  }, []);

  // 検索条件・ページ・並び替えに応じた備品一覧情報を備品一覧取得APIから取得する
  //
  // この useEffect は、備品一覧情報を備品一覧取得APIから取得するための処理。
  //
  // 初回マウント時:
  // 1. isInitialMountRef.current が true なので、fetchAssets()で すぐ実行し、備品一覧情報を備品一覧取得APIから取得する。
  // 2. isInitialMountRef.current を false にして、次回以降は初回扱いにしない。
  // 3. cleanup 関数を return して、250msタイマー処理には進まない。
  //
  // 初回以降:
  // 1. ユーザー操作でページ・ソート・検索文字・カテゴリープルダウンのイベントが発生する。
  // 2. イベント内で setCurrentPage / setNameSort / setQuery / setSelectedCategory が実行される。
  // 3. currentPage / nameSort / query / selectedCategory が更新され、再レンダリングされる。
  // 4. 依存配列の値が変わったため、この useEffect が再実行される。
  // 5. 初回フラグは false なので、250ms後に fetchAssets() を実行するタイマーを登録する。
  // 6. 250ms以内に条件が再変更されたら、cleanup で前回のタイマーを消す。
  // 7. 最後に残った条件でだけ fetchAssets()を実行し、備品一覧情報を備品一覧取得APIから取得する。
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchAssets() {
      setIsLoading(true);
      // 新しい取得を始める前に、前回のエラー表示をリセットする。
      // 前回失敗して赤いエラーが出ていたとしても、再取得を始めたらいったん消す。
      setErrorMessage(null);

      try {
        const data = await apiFetch<AssetPageResponse>(API_PATHS.assetList, {
          query: {
            // selectedCategory が truthy なら selectedCategory
            // selectedCategory が falsy なら undefined
            // || は 論理和演算子
            // | は 型に対する OR （union 型、TypeScript の型定義で「どちらかの型」を表す）
            category: selectedCategory || undefined,
            page: currentPage,
            q: query.trim() || undefined,
            sort: nameSort || undefined,
          },
          signal: abortController.signal,
        });
        setAssets(data.items);
        setFilteredItemCount(data.filtered_item_count);
        setTotalItemCount(data.total_item_count);
        setTotalStock(data.total_item_stock);
        setTotalEffectiveStock(data.total_effective_stock);
        setLowStockCount(data.low_stock_item_count);
        setPageSize(data.page_size);
        setTotalPages(data.total_pages);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiResponseError
            ? error.message
            : ERROR_UNEXPECTED_ASSET_LIST_FETCH,
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    // 初回マウント時の処理
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      void fetchAssets();

      // 初回マウント時は、ここで return するので、ここで処理は終了
      return () => {
        abortController.abort();
      };
    }

    const timeoutId = window.setTimeout(() => {
      void fetchAssets();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [currentPage, nameSort, query, selectedCategory]);

  // 一覧下部に出す表示範囲とページ番号を計算する（例：1 - 20 / 55　< 1 2 3 >）
  const visibleStart =
    filteredItemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd =
    filteredItemCount === 0 ? 0 : visibleStart + assets.length - 1;
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
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
                  {PAGE_NAMES.assetList}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">取扱品目数</p>
                  <p className="mt-1 text-lg font-semibold">{totalItemCount}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">総在庫数</p>
                  <p className="mt-1 text-lg font-semibold">{totalStock}</p>
                </div>
                <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">有効在庫数</p>
                  <p className="mt-1 text-lg font-semibold">{totalEffectiveStock}</p>
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
              className="flex flex-col items-start gap-2 lg:items-end"
            >
              <UserMenu />
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {user?.role === "admin" ? (
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-teal-700 bg-white px-4 text-sm font-medium text-teal-800 transition hover:bg-teal-50"
                    data-testid="admin-menu-link"
                    to="/admin"
                  >
                    <ShieldCheck className="size-4" />
                    {PAGE_NAMES.admin}
                  </Link>
                ) : null}
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
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  data-testid="asset-search-icon"
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  maxLength={60}
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
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
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
                              貸出申請
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
                        {ASSET_LIST_PAGE_MESSAGES.emptySearchResult}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 shadow-sm">
              {COMMON_MESSAGES.loading}
            </div>
          ) : null}

          {!isLoading ? (
            <div className="flex items-center justify-end gap-4 px-1 py-1">
              <p className="text-sm text-slate-500">
                {visibleStart} - {visibleEnd} / {filteredItemCount}
              </p>

              <div className="flex items-center gap-1">
                <button
                  aria-label="前のページ"
                  className="inline-flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  disabled={currentPage <= 1}
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
                  disabled={currentPage >= totalPages}
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
