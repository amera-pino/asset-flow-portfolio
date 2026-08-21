import {
  ERROR_API_REQUEST_FAILED,
  ERROR_API_RESPONSE_READ_FAILED,
} from "../constants/errorMessages";
import { getSessionToken } from "./authStorage";

// API通信失敗時に返るバックエンドの error オブジェクト型
type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

// バックエンド共通レスポンスの success/data/error 形式
type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
};

// 画面側で API レスポンス異常を扱う標準エラー
export class ApiResponseError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type GlobalApiBaseUrl = typeof globalThis & {
  __ASSETFLOW_API_BASE_URL__?: string;
};

function getApiBaseUrl() {
  return (
    (globalThis as GlobalApiBaseUrl).__ASSETFLOW_API_BASE_URL__ ??
    import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:8000"
  );
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
};

// 画面から渡された検索・ページ条件を API URL に変換する
function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, getApiBaseUrl());

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

// JSON 送信、クエリ付与、共通レスポンスのエラー処理を標準化する
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, query, ...requestInit } = options;
  const requestHeaders = new Headers(headers);
  const sessionToken = getSessionToken();

  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (sessionToken && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${sessionToken}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...requestInit,
    credentials: "include",
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: ApiResponse<T>;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiResponseError(
      ERROR_API_RESPONSE_READ_FAILED,
      "INVALID_RESPONSE",
      response.status,
    );
  }

  if (!response.ok || !payload.success) {
    throw new ApiResponseError(
      payload.error?.message ?? ERROR_API_REQUEST_FAILED,
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
      payload.error?.details,
    );
  }

  return payload.data as T;
}
