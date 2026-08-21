import { afterEach, describe, expect, it, vi } from "vitest";

import { clearSessionToken, setSessionToken } from "./authStorage";
import { apiFetch } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    clearSessionToken();
    vi.restoreAllMocks();
  });

  it("保存済みセッショントークンを Authorization ヘッダーとして送る", async () => {
    setSessionToken("render-session-token");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: "ok" },
          error: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await apiFetch<{ status: string }>("/health");

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);

    expect(headers.get("Authorization")).toBe("Bearer render-session-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
