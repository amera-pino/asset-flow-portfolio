import {
  Bell,
  Boxes,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  HardDrive,
  Home,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  ReceiptText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { UserMenu } from "../components/UserMenu";
import { API_PATHS } from "../constants/APIPaths";
import { ERROR_500_ADMIN_SUMMARY_FETCH_FAILED } from "../constants/errorMessages";
import { PAGE_NAMES } from "../constants/PageName";
import { getRequestStatusLabel } from "../constants/statusLabels";
import { useAuth } from "../contexts/AuthContext";
import { ApiResponseError, apiFetch } from "../lib/api";
import type { AdminSummary, AdminUser, AdminUserCreateInput } from "../types/admin";
import type { Asset, AssetCreateInput } from "../types/asset";
import type { ActiveAssetLoanRequest, AssetLoanRequest } from "../types/assetLoanRequest";

type AdminSection =
  | "home"
  | "dashboard"
  | "assets-new"
  | "assets-edit"
  | "requests"
  | "users"
  | "reports"
  | "rules"
  | "storage"
  | "notifications"
  | "audit"
  | "settings"
  | "account";

type MenuItem = {
  key: AdminSection;
  label: string;
  icon: LucideIcon;
  status: "live" | "coming-soon";
};

type AssetFormState = {
  name: string;
  category: string;
  totalStock: string;
};

const menuItems: MenuItem[] = [
  { key: "home", label: "ホーム", icon: Home, status: "live" },
  { key: "dashboard", label: "ダッシュボード", icon: LayoutDashboard, status: "coming-soon" },
  { key: "assets-new", label: "備品管理（新規）", icon: Boxes, status: "live" },
  { key: "assets-edit", label: "備品管理（編集）", icon: Boxes, status: "coming-soon" },
  { key: "requests", label: "申請管理", icon: ReceiptText, status: "live" },
  { key: "users", label: "ユーザー管理", icon: Users, status: "live" },
  { key: "reports", label: "レポート", icon: ChartColumn, status: "coming-soon" },
  { key: "rules", label: "ルール", icon: Shield, status: "coming-soon" },
  { key: "storage", label: "ストレージ", icon: HardDrive, status: "coming-soon" },
  { key: "notifications", label: "通知", icon: Bell, status: "coming-soon" },
  { key: "audit", label: "監査ログ", icon: ShieldAlert, status: "coming-soon" },
  { key: "settings", label: "設定", icon: Settings, status: "coming-soon" },
  { key: "account", label: "アカウント", icon: UserCog, status: "coming-soon" },
];

const sectionLabels: Record<AdminSection, string> = Object.fromEntries(
  menuItems.map((item) => [item.key, item.label]),
) as Record<AdminSection, string>;

const initialAssetForm: AssetFormState = {
  name: "",
  category: "",
  totalStock: "1",
};

function normalizeStockInput(value: string) {
  if (value === "") {
    return "";
  }

  const digitsOnlyValue = value.replace(/\D/g, "");
  if (digitsOnlyValue === "") {
    return "";
  }

  return digitsOnlyValue.replace(/^0+(?=\d)/, "");
}

function isAdminSection(value: string | null): value is AdminSection {
  return menuItems.some((item) => item.key === value);
}

const REQUEST_PAGE_SIZE = 20;
type AdminRequestStatusFilter = "all" | "pending" | "approved" | "loaned" | "rejected";

function formatRequestId(id: number) {
  return String(id).padStart(5, "0");
}

function requestStatusPillClass(status: ActiveAssetLoanRequest["status"]) {
  return status === "pending"
    ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
    : status === "approved"
      ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
      : status === "rejected"
        ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
      : "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200";
}

function roleBadgeClass(role: "user" | "admin") {
  return role === "admin"
    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
    : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

function accountStateClass(state: "active" | "invited") {
  return state === "active"
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
}

type UserFormState = {
  name: string;
  loginId: string;
  role: "user" | "admin";
  department: string;
};

const initialUserForm: UserFormState = {
  name: "",
  loginId: "",
  role: "user",
  department: "",
};

const INITIAL_USER_PASSWORD = "AssetFlow2026!";

function isValidEmailFormat(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SidebarMenu({
  activeSection,
}: {
  activeSection: AdminSection;
}) {
  return (
    <aside className="w-full rounded-[28px] border border-slate-300 bg-white p-3 shadow-[0_20px_48px_rgba(148,163,184,0.14)]">
      <nav aria-label="管理者メニュー" className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeSection;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-sm transition ${
                isActive
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              }`}
              data-testid={`admin-nav-${item.key}`}
              key={item.key}
              to={`/admin?section=${item.key}`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                  isActive ? "bg-white text-slate-900" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className={`min-w-0 flex-1 whitespace-nowrap ${isActive ? "text-[15px] font-semibold" : ""}`}>
                {item.label}
              </span>
              {item.status === "coming-soon" ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold tracking-[0.16em] text-slate-500">
                  SOON
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function HomePanel({
  errorMessage,
  isLoading,
  summary,
}: {
  errorMessage: string | null;
  isLoading: boolean;
  summary: AdminSummary | null;
}) {
  const cards = [
    { label: "承認待ち", value: summary?.pending_request_count ?? 0 },
    { label: "承認済み", value: summary?.approved_request_count ?? 0 },
    { label: "承認却下", value: summary?.rejected_request_count ?? 0 },
    { label: "貸出中", value: summary?.loaned_request_count ?? 0 },
    { label: "登録備品数", value: summary?.registered_asset_count ?? 0 },
    { label: "管理対象ユーザー", value: summary?.managed_user_count ?? 0 },
  ];

  return (
    <div className="space-y-6" data-testid="admin-panel-home">
      {errorMessage ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <article
            className="rounded-[22px] border border-slate-300 bg-white px-4 py-4 shadow-[0_14px_34px_rgba(148,163,184,0.10)]"
            key={card.label}
          >
            <p className="text-[13px] font-medium leading-5 text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {isLoading ? "..." : card.value}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-slate-300 bg-slate-50 px-6 py-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">本日の運用サマリー</p>
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center">
            <p className="text-base font-semibold text-slate-700">準備中</p>
            <p className="mt-2 text-sm text-slate-500">このエリアはサンプル表示として今後調整予定です。</p>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-300 bg-white px-6 py-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">ご案内</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">備品管理でカテゴリ追加と簡易登録を確認できます。</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">申請管理では承認フローと各ステータスの導線を確認できます。</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">ユーザー管理では権限表示の見え方を確認できます。</div>
          </div>
        </article>
      </section>
    </div>
  );
}

function AssetManagementPanel({
  assetCategories,
  assets,
  onClearAssets,
  onRegisterAsset,
}: {
  assetCategories: string[];
  assets: Asset[];
  onClearAssets: () => void;
  onRegisterAsset: (asset: AssetCreateInput) => Promise<Asset>;
}) {
  const [form, setForm] = useState<AssetFormState>(initialAssetForm);
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [localCategories, setLocalCategories] = useState<string[]>(assetCategories);
  const [addErrorMessage, setAddErrorMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerErrorMessage, setRegisterErrorMessage] = useState<string | null>(null);
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories((current) => {
      const merged = [...assetCategories];

      current.forEach((category) => {
        if (!merged.includes(category)) {
          merged.push(category);
        }
      });

      return merged;
    });

    if (!form.category && assetCategories.length > 0) {
      setForm((current) => ({ ...current, category: assetCategories[0] }));
    }
  }, [assetCategories, form.category]);

  function handleFormChange<K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleRegisterAsset() {
    const trimmedName = form.name.trim();
    const trimmedNewCategory = newCategoryName.trim();
    const quantity = Number(form.totalStock);

    if (categoryMode === "new" && !trimmedNewCategory) {
      setAddErrorMessage("新しいカテゴリー名を入力してください。");
      return;
    }

    if (!trimmedName) {
      setAddErrorMessage("備品名を入力してください。");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setAddErrorMessage("初期在庫数は1以上を入力してください。");
      return;
    }

    const selectedCategory =
      categoryMode === "new" ? trimmedNewCategory : form.category;

    if (isRegistering) {
      return;
    }

    setIsRegistering(true);
    setAddErrorMessage(null);
    setRegisterErrorMessage(null);
    setRegisterSuccessMessage(null);

    try {
      await onRegisterAsset({
        name: trimmedName,
        category: selectedCategory,
        total_stock: quantity,
      });
      setLocalCategories((current) =>
        current.includes(selectedCategory) ? current : [...current, selectedCategory],
      );
      setForm({
        name: "",
        category: selectedCategory,
        totalStock: "1",
      });
      setNewCategoryName("");
      setCategoryMode("existing");
      setRegisterSuccessMessage("備品を登録しました。");
    } catch (error) {
      setRegisterErrorMessage(
        error instanceof ApiResponseError
          ? error.message
          : error instanceof Error
            ? error.message
            : "サーバーエラーのため、備品登録に失敗しました。",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-panel-assets">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_14px_34px_rgba(148,163,184,0.10)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">新規登録</p>
              <h3 className="text-xl font-semibold text-slate-950">備品を追加する</h3>
            </div>
          </div>

          <form
            id="admin-asset-form"
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await handleRegisterAsset();
            }}
          >
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">カテゴリ</span>
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    checked={categoryMode === "existing"}
                    className="size-4 accent-emerald-600"
                    data-testid="admin-category-existing-radio"
                    name="admin-category-mode"
                    onChange={() => {
                      setCategoryMode("existing");
                    }}
                    type="radio"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      リストから選択
                    </span>
                    <select
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      data-testid="admin-asset-category-select"
                      disabled={categoryMode !== "existing"}
                      onChange={(event) => {
                        handleFormChange("category", event.target.value);
                        if (addErrorMessage) {
                          setAddErrorMessage(null);
                        }
                      }}
                      value={form.category}
                    >
                      {localCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    checked={categoryMode === "new"}
                    className="size-4 accent-emerald-600"
                    data-testid="admin-category-new-radio"
                    name="admin-category-mode"
                    onChange={() => {
                      setCategoryMode("new");
                    }}
                    type="radio"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      新しいカテゴリ
                    </span>
                    <input
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      data-testid="admin-asset-category-new-input"
                      disabled={categoryMode !== "new"}
                      onChange={(event) => {
                        setNewCategoryName(event.target.value);
                        if (addErrorMessage) {
                          setAddErrorMessage(null);
                        }
                      }}
                      placeholder="新しいカテゴリ名"
                      type="text"
                      value={newCategoryName}
                    />
                  </span>
                </label>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">備品名</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-asset-name-input"
                onChange={(event) => {
                  handleFormChange("name", event.target.value);
                  if (addErrorMessage) {
                    setAddErrorMessage(null);
                  }
                }}
                placeholder="備品名を入力"
                type="text"
                value={form.name}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">初期在庫数</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-asset-stock-input"
                inputMode="numeric"
                min="1"
                onChange={(event) => {
                  handleFormChange("totalStock", normalizeStockInput(event.target.value));
                  if (addErrorMessage) {
                    setAddErrorMessage(null);
                  }
                }}
                type="text"
                value={form.totalStock}
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              {addErrorMessage ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {addErrorMessage}
                </p>
              ) : (
                <span />
              )}
              <button
                className="inline-flex h-11 min-w-[88px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700"
                data-testid="admin-asset-submit"
                disabled={isRegistering}
                type="submit"
              >
                {isRegistering ? "登録中..." : "登録"}
              </button>
            </div>
          </form>
        </article>

        <article className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">マスタ登録備品</p>
              <h3 className="text-xl font-semibold text-slate-950">簡易一覧</h3>
              <p className="mt-2 text-sm text-slate-500">
                この一覧には、今回のセッションで登録した備品のみ表示されます。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                data-testid="admin-asset-clear"
                disabled={assets.length === 0}
                onClick={onClearAssets}
                type="button"
              >
                クリア
              </button>
            </div>
          </div>

          {registerErrorMessage ? (
            <div
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {registerErrorMessage}
            </div>
          ) : null}

          {registerSuccessMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {registerSuccessMessage}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">No.</th>
                  <th className="px-4 py-3 font-semibold">カテゴリ</th>
                  <th className="px-4 py-3 font-semibold">備品名</th>
                  <th className="px-4 py-3 font-semibold">初期在庫数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assets.length > 0 ? (
                  assets.map((asset, index) => (
                    <tr key={asset.id}>
                      <td className="px-4 py-4 text-slate-600">{index + 1}</td>
                      <td className="px-4 py-4 text-slate-600">{asset.category}</td>
                      <td className="px-4 py-4 font-medium text-slate-950">{asset.name}</td>
                      <td className="px-4 py-4 text-slate-600">{asset.total_stock}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      今回のセッションで登録した備品はまだありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </article>
      </section>
    </div>
  );
}

function RequestManagementPanel({
  requests,
  isLoading,
  errorMessage,
  onApprove,
  onReject,
  onForceReturn,
}: {
  requests: ActiveAssetLoanRequest[];
  isLoading: boolean;
  errorMessage: string | null;
  onApprove: (request: ActiveAssetLoanRequest) => Promise<void>;
  onReject: (request: ActiveAssetLoanRequest) => Promise<void>;
  onForceReturn: (request: ActiveAssetLoanRequest) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<AdminRequestStatusFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [processingAction, setProcessingAction] = useState<"approve" | "reject" | "force-return" | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const requestCategories = useMemo(
    () => [...new Set(requests.map((request) => request.asset_category))].sort((left, right) => left.localeCompare(right, "ja")),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return requests
      .filter((request) => {
        const matchesStatus = statusFilter === "all" || request.status === statusFilter;
        const matchesCategory = !selectedCategory || request.asset_category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          request.asset_name.toLowerCase().includes(normalizedQuery) ||
          request.asset_category.toLowerCase().includes(normalizedQuery) ||
          request.requester_name.toLowerCase().includes(normalizedQuery);

        return matchesStatus && matchesCategory && matchesQuery;
      })
      .sort((left, right) => {
        const periodComparison = left.start_date.localeCompare(right.start_date);
        return periodComparison !== 0 ? periodComparison : left.id - right.id;
      });
  }, [query, requests, selectedCategory, statusFilter]);
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
  const isProcessing = processingRequestId !== null;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function handleClearFilters() {
    setStatusFilter("all");
    setSelectedCategory("");
    setQuery("");
    setCurrentPage(1);
  }

  function handlePageChange(page: number) {
    const nextPage = Math.max(1, Math.min(page, totalPages));
    if (nextPage === currentPage) {
      return;
    }

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0 });
  }

  async function handleAction(
    action: "approve" | "reject" | "force-return",
    request: ActiveAssetLoanRequest,
  ) {
    if (isProcessing) {
      return;
    }

    setProcessingRequestId(request.id);
    setProcessingAction(action);
    setActionErrorMessage(null);

    try {
      if (action === "approve") {
        await onApprove(request);
      } else if (action === "reject") {
        await onReject(request);
      } else {
        await onForceReturn(request);
      }
    } catch {
      const actionLabel =
        action === "approve" ? "承認" : action === "reject" ? "却下" : "強制返却";
      setActionErrorMessage(`${actionLabel}の処理中に異常が発生したため、処理が完了しませんでした。`);
    } finally {
      setProcessingRequestId(null);
      setProcessingAction(null);
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-panel-requests">
      {actionErrorMessage ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-[420px] rounded-[28px] border border-red-200 bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.20)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700">申請管理</p>
                <p className="text-lg font-semibold text-slate-950">処理に失敗しました</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-700" role="alert">
              {actionErrorMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                className="inline-flex h-11 min-w-[92px] items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-medium text-white transition hover:bg-red-800"
                onClick={() => setActionErrorMessage(null)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">承認フロー</p>
            <h3 className="text-xl font-semibold text-slate-950">ステータス一覧</h3>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 md:max-w-3xl md:flex-row">
            <select
              aria-label="ステータスで絞り込み"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 md:w-40"
              disabled={isProcessing}
              onChange={(event) => {
                setStatusFilter(event.target.value as AdminRequestStatusFilter);
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
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 md:w-44"
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
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                disabled={isProcessing}
                maxLength={60}
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
            className="mt-4 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
            読み込み中...
          </div>
        ) : null}

        {!isLoading && totalCount === 0 ? (
          <section className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <PackageCheck className="size-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">
              {requests.length === 0 ? "表示対象の申請はありません。" : "条件に一致する申請がありません。"}
            </p>
          </section>
        ) : null}

        {!isLoading && totalCount > 0 ? (
          <>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="w-[54px] px-5 py-3 font-semibold">No.</th>
                      <th className="w-[82px] px-5 py-3 font-semibold">申請ID</th>
                      <th className="w-[178px] px-5 py-3 font-semibold">申請者</th>
                      <th className="w-[162px] px-5 py-3 font-semibold">カテゴリ</th>
                      <th className="w-[250px] px-5 py-3 font-semibold">備品名</th>
                      <th className="w-[146px] px-5 py-3 font-semibold">期間</th>
                      <th className="w-[118px] px-5 py-3 font-semibold">状態</th>
                      <th className="w-44 px-5 py-3 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {paginatedRequests.map((request, index) => (
                      <tr className="transition hover:bg-emerald-50/40" key={request.id}>
                        <td className="px-5 py-4 font-medium text-slate-500">
                          {index + 1 + (currentPage - 1) * REQUEST_PAGE_SIZE}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-600">{formatRequestId(request.id)}</td>
                        <td className="px-5 py-4 text-slate-600">{request.requester_name}</td>
                        <td className="px-5 py-4 text-slate-600">{request.asset_category}</td>
                        <td className="px-5 py-4 font-medium text-slate-950">{request.asset_name}</td>
                        <td className="px-5 py-4 text-slate-600">
                          <span className="block whitespace-nowrap">{request.start_date} -</span>
                          <span className="block whitespace-nowrap">{request.end_date}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${requestStatusPillClass(
                              request.status,
                            )}`}
                          >
                            {getRequestStatusLabel(request.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                className="inline-flex min-w-[84px] items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                data-testid={`admin-request-approve-${request.id}`}
                                disabled={isProcessing}
                                onClick={() => {
                                  void handleAction("approve", request);
                                }}
                                type="button"
                              >
                                {processingRequestId === request.id && processingAction === "approve" ? "承認中" : "承認"}
                              </button>
                              <button
                                className="inline-flex min-w-[84px] items-center justify-center rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                data-testid={`admin-request-reject-${request.id}`}
                                disabled={isProcessing}
                                onClick={() => {
                                  void handleAction("reject", request);
                                }}
                                type="button"
                              >
                                {processingRequestId === request.id && processingAction === "reject" ? "処理中" : "却下"}
                              </button>
                            </div>
                          ) : request.status === "approved" ? (
                            <button
                              className="inline-flex min-w-[110px] items-center justify-center rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              data-testid={`admin-request-reject-approved-${request.id}`}
                              disabled={isProcessing}
                              onClick={() => {
                                void handleAction("reject", request);
                              }}
                              type="button"
                            >
                              {processingRequestId === request.id && processingAction === "reject" ? "処理中" : "承認却下"}
                            </button>
                          ) : request.status === "loaned" ? (
                            <button
                              className="inline-flex min-w-[110px] items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              data-testid={`admin-request-force-return-${request.id}`}
                              disabled={isProcessing}
                              onClick={() => {
                                void handleAction("force-return", request);
                              }}
                              type="button"
                            >
                              {processingRequestId === request.id && processingAction === "force-return" ? "処理中" : "強制返却"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
          </>
        ) : null}
      </section>
    </div>
  );
}

function UserManagementPanel({
  errorMessage,
  isLoading,
  onCreateUser,
  onDeleteUser,
  users,
}: {
  errorMessage: string | null;
  isLoading: boolean;
  onCreateUser: (user: AdminUserCreateInput) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
  users: AdminUser[];
}) {
  const [form, setForm] = useState<UserFormState>(initialUserForm);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedUser = users.find((currentUser) => currentUser.id === selectedUserId) ?? null;
  const isDeleteDisabled = selectedUserId === null || isDeleting || selectedUser?.role === "admin";

  function handleFormChange<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedLoginId = form.loginId.trim();
    const trimmedDepartment = form.department.trim();

    if (!trimmedName) {
      setSubmitErrorMessage("氏名を入力してください。");
      setSubmitSuccessMessage(null);
      return;
    }

    if (!trimmedLoginId) {
      setSubmitErrorMessage("メールアドレスを入力してください。");
      setSubmitSuccessMessage(null);
      return;
    }

    if (!isValidEmailFormat(trimmedLoginId)) {
      setSubmitErrorMessage("メールアドレスの形式を確認してください。");
      setSubmitSuccessMessage(null);
      return;
    }

    if (!trimmedDepartment) {
      setSubmitErrorMessage("所属を入力してください。");
      setSubmitSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage(null);
    setSubmitSuccessMessage(null);

    try {
      await onCreateUser({
        name: trimmedName,
        login_id: trimmedLoginId,
        role: form.role,
        department: trimmedDepartment || null,
      });
      setForm(initialUserForm);
      setSubmitSuccessMessage(
        `ユーザーを追加しました。\nログインID: ${trimmedLoginId}\n初期パスワード: ${INITIAL_USER_PASSWORD}`,
      );
    } catch (error) {
      setSubmitErrorMessage(
        error instanceof ApiResponseError
          ? error.message
          : "サーバーエラーのため、ユーザー登録に失敗しました。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSelectedUser() {
    if (selectedUserId === null || isDeleting || selectedUser?.role === "admin") {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      await onDeleteUser(selectedUserId);
      setSelectedUserId(null);
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof ApiResponseError
          ? error.message
          : "サーバーエラーのため、ユーザー削除に失敗しました。",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-panel-users">
      {submitSuccessMessage ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-[420px] rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.20)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700">ユーザー登録</p>
                <p className="text-lg font-semibold text-slate-950">新規ユーザー登録完了</p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-slate-700" role="status">
              {submitSuccessMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                className="inline-flex h-11 min-w-[92px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
                onClick={() => setSubmitSuccessMessage(null)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">簡易登録</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">新しい利用者を追加</h3>
          <p className="mt-3 text-sm text-slate-500">
            ログインIDはメールアドレスです。
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">氏名</span>
              <input
                className="h-11 w-full max-w-[520px] rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-user-name-input"
                onChange={(event) => handleFormChange("name", event.target.value)}
                value={form.name}
                type="text"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">メールアドレス</span>
              <input
                className="h-11 w-full max-w-[520px] rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-user-login-id-input"
                onChange={(event) => handleFormChange("loginId", event.target.value)}
                value={form.loginId}
                type="email"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">権限</span>
              <select
                className="h-11 w-full max-w-[520px] rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-user-role-select"
                onChange={(event) => handleFormChange("role", event.target.value as UserFormState["role"])}
                value={form.role}
              >
                <option value="user">一般ユーザー</option>
                <option value="admin">管理者</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">所属</span>
              <input
                className="h-11 w-full max-w-[520px] rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                data-testid="admin-user-department-input"
                onChange={(event) => handleFormChange("department", event.target.value)}
                value={form.department}
                type="text"
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              {submitErrorMessage ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {submitErrorMessage}
                </p>
              ) : null}
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
                data-testid="admin-user-submit"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "登録中" : "登録"}
              </button>
            </div>
          </form>
        </article>

        <article className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">ユーザー一覧</p>
              <h3 className="text-xl font-semibold text-slate-950">権限と状態</h3>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="w-14 px-4 py-3 font-semibold" />
                  <th className="px-4 py-3 font-semibold">氏名</th>
                  <th className="px-4 py-3 font-semibold">ログインID</th>
                  <th className="px-4 py-3 font-semibold">所属</th>
                  <th className="px-4 py-3 font-semibold">権限</th>
                  <th className="px-4 py-3 font-semibold">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((demoUser) => (
                  <tr
                    className={selectedUserId === demoUser.id ? "bg-emerald-50/60" : ""}
                    key={demoUser.id}
                  >
                    <td className="px-4 py-4">
                      <input
                        checked={selectedUserId === demoUser.id}
                        className="size-4 accent-emerald-600"
                        data-testid={`admin-user-select-${demoUser.id}`}
                        name="selected-admin-user"
                        onChange={() => setSelectedUserId(demoUser.id)}
                        type="radio"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-950">{demoUser.name}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{demoUser.login_id}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{demoUser.department || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(
                          demoUser.role,
                        )}`}
                      >
                        {demoUser.role === "admin" ? "管理者" : "一般ユーザー"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${accountStateClass(
                          demoUser.state,
                        )}`}
                      >
                        {demoUser.state === "active" ? "有効" : "招待中"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">ユーザー一覧を読み込み中です。</p>
          ) : null}
          {!isLoading && users.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">登録済みユーザーはありません。</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {deleteErrorMessage ? (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {deleteErrorMessage}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end">
            <div className="flex items-center gap-3">
              {selectedUser?.role === "admin" ? (
                <p className="text-sm font-medium text-slate-500">管理者ユーザーは削除できません。</p>
              ) : null}
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                data-testid="admin-user-delete"
                disabled={isDeleteDisabled}
                onClick={() => {
                  void handleDeleteSelectedUser();
                }}
                type="button"
              >
                <Trash2 className="size-4" />
                {isDeleting ? "削除中" : "削除"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function ComingSoonPanel({ section }: { section: AdminSection }) {
  return (
    <div
      className="rounded-[28px] border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm"
      data-testid={`admin-panel-${section}`}
    >
      <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <FolderKanban className="size-7" />
      </div>
      <p className="mt-6 text-sm font-semibold text-emerald-700">{sectionLabels[section]}</p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-950">準備中</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
        この機能は現在準備中です。
      </p>
    </div>
  );
}

function AdminContent({
  activeSection,
  assetCategories,
  assets,
  requestErrorMessage,
  requests,
  requestLoading,
  errorMessage,
  isLoading,
  onApproveRequest,
  onClearAssets,
  onForceReturnRequest,
  onRejectRequest,
  onRegisterAsset,
  onCreateUser,
  onDeleteUser,
  summary,
  userErrorMessage,
  userLoading,
  users,
}: {
  activeSection: AdminSection;
  assetCategories: string[];
  assets: Asset[];
  requestErrorMessage: string | null;
  requests: ActiveAssetLoanRequest[];
  requestLoading: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  onApproveRequest: (request: ActiveAssetLoanRequest) => Promise<void>;
  onClearAssets: () => void;
  onCreateUser: (user: AdminUserCreateInput) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
  onForceReturnRequest: (request: ActiveAssetLoanRequest) => Promise<void>;
  onRejectRequest: (request: ActiveAssetLoanRequest) => Promise<void>;
  onRegisterAsset: (asset: AssetCreateInput) => Promise<Asset>;
  summary: AdminSummary | null;
  userErrorMessage: string | null;
  userLoading: boolean;
  users: AdminUser[];
}) {
  switch (activeSection) {
    case "home":
      return <HomePanel errorMessage={errorMessage} isLoading={isLoading} summary={summary} />;
    case "assets-new":
      return (
        <AssetManagementPanel
          assetCategories={assetCategories}
          assets={assets}
          onClearAssets={onClearAssets}
          onRegisterAsset={onRegisterAsset}
        />
      );
    case "requests":
      return (
        <RequestManagementPanel
          errorMessage={requestErrorMessage}
          isLoading={requestLoading}
          onApprove={onApproveRequest}
          onForceReturn={onForceReturnRequest}
          onReject={onRejectRequest}
          requests={requests}
        />
      );
    case "users":
      return (
        <UserManagementPanel
          errorMessage={userErrorMessage}
          isLoading={userLoading}
          onCreateUser={onCreateUser}
          onDeleteUser={onDeleteUser}
          users={users}
        />
      );
    default:
      return <ComingSoonPanel section={activeSection} />;
  }
}

export function AdminPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const activeSection =
    requestedSection === "assets"
      ? "assets-new"
      : isAdminSection(requestedSection)
        ? requestedSection
        : "home";
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(null);
  const [assetCategories, setAssetCategories] = useState<string[]>([]);
  const [localAddedAssets, setLocalAddedAssets] = useState<Asset[]>([]);
  const [adminRequests, setAdminRequests] = useState<ActiveAssetLoanRequest[]>([]);
  const [isLoadingAdminRequests, setIsLoadingAdminRequests] = useState(false);
  const [adminRequestErrorMessage, setAdminRequestErrorMessage] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [adminUserErrorMessage, setAdminUserErrorMessage] = useState<string | null>(null);

  async function reloadSummary(signal?: AbortSignal) {
    const data = await apiFetch<AdminSummary>(API_PATHS.adminSummary, {
      signal,
    });
    setSummary(data);
  }

  async function reloadAdminUsers(signal?: AbortSignal) {
    const data = await apiFetch<AdminUser[]>(API_PATHS.adminUsers, {
      signal,
    });
    setAdminUsers(data);
  }

  async function safeReloadSummary() {
    try {
      await reloadSummary();
      setSummaryErrorMessage(null);
    } catch {
      setSummaryErrorMessage("最新件数の再取得に失敗しました。画面を再読み込みして確認してください。");
    }
  }

  async function safeReloadAdminUsers() {
    try {
      await reloadAdminUsers();
      setAdminUserErrorMessage(null);
    } catch {
      setAdminUserErrorMessage("最新のユーザー一覧の再取得に失敗しました。画面を再読み込みして確認してください。");
    }
  }

  async function safeReloadAssetCategories() {
    try {
      const categories = await apiFetch<string[]>(API_PATHS.assetCategories);
      setAssetCategories(categories);
    } catch {
      // Keep current categories when refresh fails.
    }
  }

  useEffect(() => {
    if (user?.role !== "admin" || activeSection !== "home") {
      return;
    }

    const abortController = new AbortController();

    async function fetchSummary() {
      setIsLoadingSummary(true);
      setSummaryErrorMessage(null);

      try {
        await reloadSummary(abortController.signal);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setSummaryErrorMessage(
          error instanceof ApiResponseError
            ? error.message
            : ERROR_500_ADMIN_SUMMARY_FETCH_FAILED,
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingSummary(false);
        }
      }
    }

    void fetchSummary();

    return () => {
      abortController.abort();
    };
  }, [activeSection, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin" || activeSection !== "users") {
      return;
    }

    const abortController = new AbortController();

    async function fetchAdminUsers() {
      setIsLoadingAdminUsers(true);
      setAdminUserErrorMessage(null);

      try {
        await reloadAdminUsers(abortController.signal);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setAdminUserErrorMessage(
          error instanceof ApiResponseError
            ? error.message
            : "サーバーエラーのため、ユーザー一覧の取得に失敗しました。",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingAdminUsers(false);
        }
      }
    }

    void fetchAdminUsers();

    return () => {
      abortController.abort();
    };
  }, [activeSection, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin" || activeSection !== "assets-new") {
      return;
    }

    const abortController = new AbortController();

    async function fetchAssetResources() {
      try {
        const categories = await apiFetch<string[]>(API_PATHS.assetCategories, {
          signal: abortController.signal,
        });
        setAssetCategories(categories);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
      }
    }

    void fetchAssetResources();

    return () => {
      abortController.abort();
    };
  }, [activeSection, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin" || activeSection !== "requests") {
      return;
    }

    const abortController = new AbortController();

    async function fetchAdminRequests() {
      setIsLoadingAdminRequests(true);
      setAdminRequestErrorMessage(null);

      try {
        const data = await apiFetch<ActiveAssetLoanRequest[]>(API_PATHS.adminActiveRequests, {
          signal: abortController.signal,
        });
        setAdminRequests(data);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setAdminRequestErrorMessage(
          error instanceof ApiResponseError
            ? error.message
            : "サーバーエラーのため、管理者向け申請一覧の取得に失敗しました。",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingAdminRequests(false);
        }
      }
    }

    void fetchAdminRequests();

    return () => {
      abortController.abort();
    };
  }, [activeSection, user?.role]);

  if (user?.role !== "admin") {
    return <Navigate replace to="/" />;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfa_0%,#eef7f4_48%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto max-w-[1460px] px-5 py-5 lg:px-8 lg:py-7">
        <header className="rounded-[28px] border border-slate-300 bg-white px-6 py-4 shadow-[0_16px_40px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">AssetFlow</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
                {PAGE_NAMES.admin}
              </h1>
            </div>

            <nav
              aria-label="管理者ナビゲーション"
              className="flex flex-col items-start gap-2 lg:items-end"
            >
              <UserMenu />
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
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

        <div
          className="mt-6 grid items-start gap-6"
          style={{
            gridTemplateColumns: "minmax(220px, 20%) minmax(0, 1fr)",
          }}
        >
          <SidebarMenu activeSection={activeSection} />

          <section className="min-w-0 flex-1 rounded-[32px] border border-slate-300 bg-white p-4 shadow-[0_20px_48px_rgba(148,163,184,0.12)] md:p-6">
            <AdminContent
              activeSection={activeSection}
              assetCategories={assetCategories}
              assets={localAddedAssets}
              requestErrorMessage={adminRequestErrorMessage}
              requests={adminRequests}
              requestLoading={isLoadingAdminRequests}
              errorMessage={summaryErrorMessage}
              isLoading={isLoadingSummary}
              onApproveRequest={async (request) => {
                const updated = await apiFetch<AssetLoanRequest>(API_PATHS.adminApproveRequest(request.id), {
                  method: "POST",
                });
                setAdminRequestErrorMessage(null);
                setAdminRequests((current) =>
                  current.map((currentRequest) =>
                    currentRequest.id === request.id ? { ...currentRequest, status: updated.status } : currentRequest,
                  ),
                );
              }}
              onClearAssets={() => {
                setLocalAddedAssets([]);
              }}
              onCreateUser={async (userInput) => {
                await apiFetch<AdminUser>(API_PATHS.adminUserRegistration, {
                  method: "POST",
                  body: userInput,
                });
                await safeReloadAdminUsers();
              }}
              onDeleteUser={async (userId) => {
                await apiFetch<{ deleted_user_id: number }>(API_PATHS.adminUserDeletion(userId), {
                  method: "DELETE",
                });
                await safeReloadAdminUsers();
              }}
              onForceReturnRequest={async (request) => {
                await apiFetch<AssetLoanRequest>(API_PATHS.adminForceReturnRequest(request.id), {
                  method: "POST",
                });
                setAdminRequestErrorMessage(null);
                setAdminRequests((current) => current.filter((currentRequest) => currentRequest.id !== request.id));
              }}
              onRejectRequest={async (request) => {
                const updated = await apiFetch<AssetLoanRequest>(API_PATHS.adminRejectRequest(request.id), {
                  method: "POST",
                });
                setAdminRequestErrorMessage(null);
                setAdminRequests((current) =>
                  current.map((currentRequest) =>
                    currentRequest.id === request.id ? { ...currentRequest, status: updated.status } : currentRequest,
                  ),
                );
              }}
              onRegisterAsset={async (assetToRegister) => {
                const createdAsset = await apiFetch<Asset>(API_PATHS.assetRegistration, {
                  method: "POST",
                  body: assetToRegister,
                });
                setLocalAddedAssets((current) => [createdAsset, ...current]);
                await safeReloadAssetCategories();
                return createdAsset;
              }}
              summary={summary}
              userErrorMessage={adminUserErrorMessage}
              userLoading={isLoadingAdminUsers}
              users={adminUsers}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
