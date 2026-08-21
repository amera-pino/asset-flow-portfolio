import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, type InitialEntry } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "../components/ProtectedRoute";
import { AuthProvider } from "../contexts/AuthContext";
import { clearSessionToken, setSessionToken } from "../lib/authStorage";
import { AssetListPage } from "./AssetListPage";
import { AssetLoanRequestPage } from "./AssetLoanRequestPage";
import { LoginPage } from "./LoginPage";
import { MyLoanRequestPage } from "./MyLoanRequestPage";
import { server } from "../test/server";

const execFileAsync = promisify(execFile);
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_FILE_DIR, "../../..");
const INTEGRATION_API_BASE_URL = "http://127.0.0.1:8001";
const HEALTH_URL = `${INTEGRATION_API_BASE_URL}/health`;
const FIXED_TEST_DATE = "2026-12-31";
const FIXED_TEST_DATETIME = `${FIXED_TEST_DATE}T00:00:00+09:00`;
const MANAGED_INTEGRATION_SERVICES =
  process.env.INTEGRATION_MANAGED_SERVICES !== "false";

type GlobalApiBaseUrl = typeof globalThis & {
  __ASSETFLOW_API_BASE_URL__?: string;
};

type ApiCallRecord = {
  method: string;
  path: string;
  status: number;
};

async function runDockerCompose(args: string[]) {
  return execFileAsync("docker", ["compose", "--profile", "integration-test", ...args], {
    cwd: REPO_ROOT,
  });
}

async function readIntegrationBackendLogs() {
  try {
    const { stdout, stderr } = await runDockerCompose(["logs", "--no-color", "backend-integration"]);
    return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  } catch {
    return integrationBackendLogs;
  }
}

let integrationBackendLogs = "";
let apiCallRecords: ApiCallRecord[] = [];
let integrationBackendBuilt = false;

async function waitForHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL);

      if (response.ok) {
        return;
      }
    } catch {
      // startup wait
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  integrationBackendLogs = await readIntegrationBackendLogs();
  throw new Error(`backend-integration service did not become healthy in time\n${integrationBackendLogs}`);
}

async function ensureIntegrationBackendBuilt() {
  if (!MANAGED_INTEGRATION_SERVICES || integrationBackendBuilt) {
    return;
  }

  await runDockerCompose(["build", "backend-integration"]);
  integrationBackendBuilt = true;
}

async function startIntegrationBackend() {
  integrationBackendLogs = "";

  if (MANAGED_INTEGRATION_SERVICES) {
    await runDockerCompose(["up", "-d", "--no-build", "backend-integration"]);
  } else {
    await runDockerCompose(["restart", "backend-integration"]);
  }

  await waitForHealth();
}

async function stopIntegrationBackend() {
  if (!MANAGED_INTEGRATION_SERVICES) {
    return;
  }

  try {
    await runDockerCompose(["rm", "-sf", "backend-integration"]);
  } catch {
    // no-op
  }
}

function installCookieAwareFetch() {
  const originalFetch = global.fetch.bind(globalThis);
  let cookieHeader = "";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const headers = new Headers(request.headers);

    if (request.url.startsWith(INTEGRATION_API_BASE_URL) && cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const response = await originalFetch(new Request(request, { headers }));
    const requestUrl = new URL(request.url);

    if (
      requestUrl.origin === INTEGRATION_API_BASE_URL &&
      requestUrl.pathname !== "/health"
    ) {
      apiCallRecords.push({
        method: request.method.toUpperCase(),
        path: requestUrl.pathname,
        status: response.status,
      });
    }

    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      const cookieMatch = setCookie.match(/assetflow_session=([^;]*)/);
      cookieHeader =
        cookieMatch && cookieMatch[1]
          ? `assetflow_session=${cookieMatch[1]}`
          : "";
    }

    return response;
  }) as typeof fetch;

  return () => {
    global.fetch = originalFetch;
  };
}

async function loginByApi(loginId: string, password: string) {
  const response = await fetch(`${INTEGRATION_API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login_id: loginId,
      password,
    }),
  });

  const payload = (await response.json()) as {
    success: boolean;
    data?: {
      session_token?: string | null;
    } | null;
  };
  expect(response.status).toBe(200);
  expect(payload.success).toBe(true);
  setSessionToken(payload.data?.session_token ?? null);
}

function expectApiStatus(method: string, path: string, status: number) {
  expect(
    apiCallRecords.some(
      (record) =>
        record.method === method &&
        record.path === path &&
        record.status === status,
    ),
  ).toBe(true);
}

function expectNoAlert() {
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
}

function renderAuthApp(initialEntries: InitialEntry[] = ["/"]) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<ProtectedRoute />}>
            <Route element={<AssetListPage />} path="/" />
            <Route element={<MyLoanRequestPage />} path="/my-requests" />
            <Route element={<AssetLoanRequestPage />} path="/requests/:assetId" />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

let restoreFetch: (() => void) | null = null;

beforeAll(() => {
  (globalThis as GlobalApiBaseUrl).__ASSETFLOW_API_BASE_URL__ = INTEGRATION_API_BASE_URL;
});

beforeAll(async () => {
  await stopIntegrationBackend();
  await ensureIntegrationBackendBuilt();
}, 120000);

afterAll(() => {
  delete (globalThis as GlobalApiBaseUrl).__ASSETFLOW_API_BASE_URL__;
});

describe("Frontend-backend integration", () => {
  beforeEach(async () => {
    server.close();
    apiCallRecords = [];
    clearSessionToken();
    restoreFetch?.();
    restoreFetch = installCookieAwareFetch();
    await stopIntegrationBackend();
    await startIntegrationBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXED_TEST_DATETIME));
  }, 60000);

  afterEach(async () => {
    vi.useRealTimers();
    clearSessionToken();
    restoreFetch?.();
    restoreFetch = null;
    await stopIntegrationBackend();
    server.listen({ onUnhandledRequest: "error" });
  }, 60000);

  it("IT-001: 未ログインで / にアクセスするとログイン画面へ遷移する", async () => {
    renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "備品一覧" })).not.toBeInTheDocument();
    expectApiStatus("GET", "/api/auth/me", 401);
    expectNoAlert();
  }, 60000);

  it("IT-002: 一般ユーザーでログイン成功すると再読み込み後も備品一覧画面を表示する", async () => {
    const user = userEvent.setup();
    const firstRender = renderAuthApp(["/login"]);

    await user.type(
      await screen.findByRole("textbox", { name: "ユーザーIDまたはメールアドレス" }),
      "user@example.com",
    );
    await user.type(screen.getByLabelText("パスワード"), "AssetFlow2026!");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("POST", "/api/auth/login", 200);
    });
    expect(screen.queryByText("管理者モードでログインしています。")).not.toBeInTheDocument();
    expectNoAlert();

    firstRender.unmount();
    renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("GET", "/api/auth/me", 200);
    });
    expect(screen.queryByText("管理者モードでログインしています。")).not.toBeInTheDocument();
    expectNoAlert();
  }, 60000);

  it("IT-003: 管理者ユーザーでログイン成功すると再読み込み後も備品一覧画面を表示し管理者表示が見える", async () => {
    const user = userEvent.setup();
    const firstRender = renderAuthApp(["/login"]);

    await user.type(
      await screen.findByRole("textbox", { name: "ユーザーIDまたはメールアドレス" }),
      "admin@example.com",
    );
    await user.type(screen.getByLabelText("パスワード"), "AssetFlow2026!");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("POST", "/api/auth/login", 200);
    });
    expect(screen.getByText("管理者モードでログインしています。")).toBeInTheDocument();
    expectNoAlert();

    firstRender.unmount();
    renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("GET", "/api/auth/me", 200);
    });
    expect(screen.getByText("管理者モードでログインしています。")).toBeInTheDocument();
    expectNoAlert();
  }, 60000);

  it("IT-004: ログアウトすると未ログイン状態に戻り / へ直接アクセスできない", async () => {
    const user = userEvent.setup();
    await loginByApi("user@example.com", "AssetFlow2026!");

    const firstRender = renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    const userMenuButton = screen.getByRole("button", { name: "ユーザーメニュー" });
    fireEvent.mouseEnter(userMenuButton.parentElement!);
    const userMenu = await screen.findByRole("menu");
    await user.click(within(userMenu).getByRole("button", { name: "ログアウト" }));

    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expectApiStatus("POST", "/api/auth/logout", 200);
    expect(screen.queryByRole("heading", { name: "備品一覧" })).not.toBeInTheDocument();

    firstRender.unmount();
    renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expectApiStatus("GET", "/api/auth/me", 401);
    expect(screen.queryByRole("heading", { name: "備品一覧" })).not.toBeInTheDocument();
  }, 60000);

  it("IT-005: 備品一覧画面の初期表示で件数・カテゴリ・一覧を表示する", async () => {
    await loginByApi("user@example.com", "AssetFlow2026!");
    renderAuthApp(["/"]);

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    expect(await screen.findByText("1 - 20 / 55")).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("GET", "/api/assets/categories", 200);
      expectApiStatus("GET", "/api/assets", 200);
    });
    expect(screen.getByRole("combobox", { name: "カテゴリで絞り込み" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expectNoAlert();
  }, 60000);

  it("IT-006: 備品一覧から備品貸出申請画面へ遷移し、初期表示の代表項目を表示する", async () => {
    const user = userEvent.setup();
    await loginByApi("user@example.com", "AssetFlow2026!");
    renderAuthApp(["/"]);

    const assetRow = (await screen.findByText('MacBook Pro 14"')).closest("tr");
    expect(assetRow).not.toBeNull();
    await user.click(within(assetRow!).getByRole("link", { name: /貸出申請/ }));

    expect(await screen.findByRole("heading", { name: "備品貸出申請" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: 'MacBook Pro 14"' })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "申請者名" })).toHaveValue("一般ユーザー");
    expect(screen.getByRole("textbox", { name: "申請数量" })).toHaveValue("1");
    expect(screen.getByLabelText("開始日")).toHaveValue(FIXED_TEST_DATE);
    expect(screen.getByLabelText("終了日")).toHaveValue(FIXED_TEST_DATE);
    expect(screen.getByRole("textbox", { name: "使用目的" })).toHaveValue("");
    expectNoAlert();
  }, 60000);

  it("IT-007: 備品貸出申請画面で正常値を送信し、備品一覧へ遷移して申請受付トーストを表示する", async () => {
    const user = userEvent.setup();
    await loginByApi("user@example.com", "AssetFlow2026!");
    renderAuthApp(["/requests/1"]);

    expect(await screen.findByRole("heading", { name: "備品貸出申請" })).toBeInTheDocument();
    expect(await screen.findByLabelText("申請者名")).toHaveValue("一般ユーザー");
    expect(screen.getByLabelText("申請数量")).toHaveValue("1");
    expect(screen.getByLabelText("開始日")).toHaveValue(FIXED_TEST_DATE);
    expect(screen.getByLabelText("終了日")).toHaveValue(FIXED_TEST_DATE);
    expect(screen.getByLabelText("使用目的")).toHaveValue("");

    await user.type(screen.getByLabelText("使用目的"), "会議");
    await user.click(screen.getByRole("button", { name: "申請する" }));

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    expectApiStatus("POST", "/api/requests", 201);
    expect(
      await screen.findByText(new RegExp(`申請を受け付けました。\\s*申請ID: \\d+`)),
    ).toBeInTheDocument();
    expectNoAlert();
  }, 60000);

  it("IT-008: 備品一覧からマイ貸出状況画面へ遷移し、初期表示の一覧件数を表示する", async () => {
    const user = userEvent.setup();
    await loginByApi("user@example.com", "AssetFlow2026!");
    renderAuthApp(["/"]);

    await screen.findByRole("heading", { name: "備品一覧" });
    await user.click(screen.getByRole("link", { name: "マイ貸出状況" }));

    expect(await screen.findByRole("heading", { name: "マイ貸出状況" })).toBeInTheDocument();
    expect(await screen.findByText("1 - 20 / 44")).toBeInTheDocument();
    await waitFor(() => {
      expectApiStatus("GET", "/api/requests/me/active", 200);
    });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expectNoAlert();
  }, 60000);
});
