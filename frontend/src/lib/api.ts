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

// 画面側で API エラー表示に使う標準エラー
export class ApiClientError extends Error {
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
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
};

// 画面から渡された検索・ページ条件を API URL に変換する
function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, API_BASE_URL);

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
  const response = await fetch(buildUrl(path, query), {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: ApiResponse<T>;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "APIレスポンスの読み込みに失敗しました。",
      "INVALID_RESPONSE",
      response.status,
    );
  }

  if (!response.ok || !payload.success) {
    throw new ApiClientError(
      payload.error?.message ?? "APIリクエストに失敗しました。",
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
      payload.error?.details,
    );
  }

  return payload.data as T;
}
