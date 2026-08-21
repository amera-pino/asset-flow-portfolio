import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { API_PATHS } from "../constants/APIPaths";
import { useAuth } from "../contexts/AuthContext";
import { ApiResponseError, apiFetch } from "../lib/api";
import { toAuthUser } from "../lib/authStorage";
import type { LoginResponseUser } from "../types/auth";

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

const DEFAULT_LOGIN_ERROR = "ログインに失敗しました。入力内容を確認してください。";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing, login } = useAuth();
  const locationState = location.state as LoginLocationState | null;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isInitializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-sm text-slate-500">
        読み込み中...
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const user = await apiFetch<LoginResponseUser>(API_PATHS.login, {
        method: "POST",
        body: {
          login_id: loginId.trim(),
          password,
        },
      });
      login(toAuthUser(user), user.session_token ?? null);
      navigate(locationState?.from?.pathname ?? "/", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiResponseError ? error.message : DEFAULT_LOGIN_ERROR);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-teal-700">AssetFlow</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">ログイン</h1>

        <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">ユーザーIDまたはメールアドレス</span>
            <input
              autoComplete="username"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              maxLength={120}
              onChange={(event) => setLoginId(event.target.value)}
              required
              type="text"
              value={loginId}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">パスワード</span>
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              maxLength={120}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}
