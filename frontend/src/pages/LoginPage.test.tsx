import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { server } from "../test/server";

const API_BASE_URL = "http://localhost:8000";

function mockLoggedOutUser() {
  server.use(
    http.get(`${API_BASE_URL}/api/auth/me`, () =>
      HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "HTTP_ERROR",
            message: "ログインが必要です。",
            details: null,
          },
        },
        { status: 401 },
      ),
    ),
  );
}

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <AuthObserver />
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<h1>備品一覧</h1>} path="/" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

function AuthObserver() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      <p data-testid="current-path">{location.pathname}</p>
      <p data-testid="auth-status">{isAuthenticated ? "authenticated" : "guest"}</p>
      <p data-testid="auth-role">{user?.role ?? "none"}</p>
      <p data-testid="auth-name">{user?.name ?? "none"}</p>
    </div>
  );
}

describe("LoginPage", () => {
  it("ログインに成功すると備品一覧へ遷移する", async () => {
    const user = userEvent.setup();
    const loginRequests: unknown[] = [];
    mockLoggedOutUser();
    server.use(
      http.post(`${API_BASE_URL}/api/auth/login`, async ({ request }) => {
        loginRequests.push(await request.json());
        return HttpResponse.json({
          success: true,
          data: {
            id: 1,
            name: "一般ユーザー",
            login_id: "user@example.com",
            role: "user",
            session_token: "session-token-user",
          },
          error: null,
        });
      }),
    );

    renderLoginPage();

    await user.type(
      await screen.findByRole("textbox", { name: "ユーザーIDまたはメールアドレス" }),
      "user@example.com",
    );
    await user.type(screen.getByLabelText("パスワード"), "AssetFlow2026!");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    expect(loginRequests).toContainEqual({
      login_id: "user@example.com",
      password: "AssetFlow2026!",
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/");
    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("auth-role")).toHaveTextContent("user");
    expect(screen.getByTestId("auth-name")).toHaveTextContent("一般ユーザー");
    expect(window.localStorage.getItem("assetflow_session_token")).toBe("session-token-user");
  });

  it("ログインに失敗するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    const loginRequests: unknown[] = [];
    mockLoggedOutUser();
    server.use(
      http.post(`${API_BASE_URL}/api/auth/login`, async ({ request }) => {
        loginRequests.push(await request.json());
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "INVALID_CREDENTIALS",
              message: "ログインIDまたはパスワードが正しくありません。",
              details: null,
            },
          },
          { status: 401 },
        );
      }),
    );

    renderLoginPage();

    await user.type(
      await screen.findByRole("textbox", { name: "ユーザーIDまたはメールアドレス" }),
      "user@example.com",
    );
    await user.type(screen.getByLabelText("パスワード"), "wrong");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("ログインIDまたはパスワードが正しくありません。"),
    ).toBeInTheDocument();
    expect(loginRequests).toContainEqual({
      login_id: "user@example.com",
      password: "wrong",
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    expect(screen.getByTestId("auth-status")).toHaveTextContent("guest");
    expect(screen.getByTestId("auth-role")).toHaveTextContent("none");
  });

  it("ログイン済みの場合はログイン画面を表示せず備品一覧へ遷移する", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/auth/me`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 2,
            name: "管理者",
            login_id: "admin@example.com",
            role: "admin",
            session_token: null,
          },
          error: null,
        }),
      ),
    );

    renderLoginPage();

    expect(await screen.findByRole("heading", { name: "備品一覧" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/");
    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("auth-role")).toHaveTextContent("admin");
    expect(screen.getByTestId("auth-name")).toHaveTextContent("管理者");
  });
});
