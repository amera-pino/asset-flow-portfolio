import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetLoanRequestPage } from "./AssetLoanRequestPage";
import type { Asset } from "../types/asset";
import { server } from "../test/server";

const API_BASE_URL = "http://localhost:8000";
const TODAY = "2026-07-23";

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1,
    name: 'MacBook Pro 14"',
    category: "パソコン",
    total_stock: 6,
    consuming_quantity: 0,
    effective_stock: 6,
    status: "available",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockAssetDetail(asset = createAsset()) {
  server.use(
    http.get(`${API_BASE_URL}/api/assets/:assetId`, () =>
      HttpResponse.json({ success: true, data: asset, error: null }),
    ),
  );
}

function renderLoanRequest(
  options: {
    asset?: Asset;
    mockDetail?: boolean;
    pathname?: string;
    withLocationState?: boolean;
  } = {},
) {
  const asset = options.asset ?? createAsset();
  const withLocationState = options.withLocationState ?? true;
  const pathname = options.pathname ?? `/requests/${asset.id}`;

  if (!withLocationState && options.mockDetail !== false) {
    mockAssetDetail(asset);
  }

  window.history.replaceState({}, "", pathname);

  return render(
    <MemoryRouter
      initialEntries={[
        withLocationState
          ? { pathname, state: { asset } }
          : pathname,
      ]}
    >
      <Routes>
        <Route element={<AssetLoanRequestPage />} path="/requests/:assetId" />
        <Route element={<AssetListDestination />} path="/" />
        <Route element={<h1>マイ貸出状況画面</h1>} path="/my-requests" />
      </Routes>
    </MemoryRouter>,
  );
}

function renderLoadedLoanRequest(options: { asset?: Asset } = {}) {
  renderLoanRequest(options);
  screen.getByRole("heading", { name: "備品貸出申請" });
}

function mockApiError(status: number, message: string) {
  return HttpResponse.json(
    { success: false, data: null, error: { code: "REQUEST_FAILED", message } },
    { status },
  );
}

function fillValidReason() {
  fireEvent.change(screen.getByRole("textbox", { name: "使用目的" }), {
    target: { value: "出張" },
  });
}

function expectAssetDetailRequest(request: Request) {
  expect(request.method).toBe("GET");
  expect(request.url).toBe(`${API_BASE_URL}/api/assets/1`);
}

function AssetListDestination() {
  const location = useLocation();
  const state = location.state as { assetLoanRequestId?: number } | null;

  return <h1>備品一覧画面{state?.assetLoanRequestId ? ` 申請ID: ${state.assetLoanRequestId}` : ""}</h1>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-23T00:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AssetLoanRequestPage", () => {
  it("001: AssetFlow が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("AssetFlow")).toBeInTheDocument();
  });

  it("002: 備品貸出申請 が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("heading", { name: "備品貸出申請" })).toBeInTheDocument();
  });

  it("003: 備品一覧リンクが表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("link", { name: "備品一覧" })).toBeInTheDocument();
  });

  it("004: マイ貸出状況リンクが表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("link", { name: "マイ貸出状況" })).toBeInTheDocument();
  });

  it("005: 申請者名が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("申請者名")).toBeInTheDocument();
  });

  it("006: 申請者名はテストユーザーで読み取り専用である", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByRole("textbox", { name: "申請者名" });
    expect(input).toHaveValue("テストユーザー");
    expect(input).toHaveAttribute("readonly");
  });

  it("007: 申請数量が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("申請数量")).toBeInTheDocument();
  });

  it("008: 申請数量は1で活性である", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByRole("textbox", { name: "申請数量" });
    expect(input).toHaveValue("1");
    expect(input).toBeEnabled();
  });

  it("009: 開始日はJSTの本日で活性である", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByLabelText("開始日");
    expect(input).toHaveValue(TODAY);
    expect(input).toBeEnabled();
  });

  it("010: 終了日はJSTの本日で活性である", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByLabelText("終了日");
    expect(input).toHaveValue(TODAY);
    expect(input).toBeEnabled();
  });

  it("011: 使用目的が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("使用目的")).toBeInTheDocument();
  });

  it("012: 使用目的は空欄で指定のプレースホルダーを表示する", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByRole("textbox", { name: "使用目的" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "利用目的や貸出が必要な背景を入力");
  });

  it("013: クリアボタンが活性で表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("button", { name: "クリア" })).toBeEnabled();
  });

  it("014: 戻るボタンが活性で表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("button", { name: "戻る" })).toBeEnabled();
  });

  it("015: 申請するボタンが活性で表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("button", { name: "申請する" })).toBeEnabled();
  });

  it("016: 選択中の備品が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("選択中の備品")).toBeInTheDocument();
  });

  it("017: 有効在庫数が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("有効在庫数")).toBeInTheDocument();
  });

  it("018: 状態が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("状態")).toBeInTheDocument();
  });

  it("019: 有効在庫数6の備品情報を指定どおりに表示する", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByRole("heading", { name: 'MacBook Pro 14"' })).toBeInTheDocument();
    expect(screen.getByText("パソコン")).toBeInTheDocument();
    expect(screen.getByText("6")).toHaveClass("text-slate-950");
    expect(screen.getByText("貸出可能")).toHaveClass("text-teal-700");
  });

  it("020: 有効在庫数5の備品情報を指定どおりに表示する", async () => {
    await renderLoadedLoanRequest({
      asset: createAsset({
        id: 2,
        name: 'Dell 27" 4K Monitor',
        category: "モニター",
        total_stock: 5,
        effective_stock: 5,
      }),
    });
    expect(screen.getByRole("heading", { name: 'Dell 27" 4K Monitor' })).toBeInTheDocument();
    expect(screen.getByText("モニター")).toBeInTheDocument();
    expect(screen.getByText("5")).toHaveClass("text-red-600");
    expect(screen.getByText("貸出可能")).toHaveClass("text-teal-700");
  });

  it("021: 申請期間が表示されている", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText("申請期間")).toBeInTheDocument();
  });

  it("022: 申請期間は開始日から終了日までの形式で表示される", async () => {
    await renderLoadedLoanRequest();
    expect(screen.getByText(`${TODAY} から ${TODAY} まで`)).toBeInTheDocument();
  });

  it("023: 備品情報取得中は読み込み中...が表示されている", () => {
    renderLoanRequest({ withLocationState: false });
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("024: 備品一覧リンクを押すと備品一覧に遷移する", async () => {
    await renderLoadedLoanRequest();
    fireEvent.click(screen.getByRole("link", { name: "備品一覧" }));
    expect(screen.getByRole("heading", { name: "備品一覧画面" })).toBeInTheDocument();
  });

  it("025: マイ貸出状況リンクを押すとマイ貸出状況に遷移する", async () => {
    await renderLoadedLoanRequest();
    fireEvent.click(screen.getByRole("link", { name: "マイ貸出状況" }));
    expect(screen.getByRole("heading", { name: "マイ貸出状況画面" })).toBeInTheDocument();
  });

  it("026: 申請数量に2を入力すると2が表示される", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByRole("textbox", { name: "申請数量" });
    fireEvent.change(input, { target: { value: "2" } });
    expect(input).toHaveValue("2");
  });

  it("027: 申請数量の先頭ゼロは正規化される", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByRole("textbox", { name: "申請数量" });
    fireEvent.change(input, { target: { value: "02" } });
    expect(input).toHaveValue("2");
  });

  it("028: 開始日を2026-07-24に設定すると申請期間に反映される", async () => {
    await renderLoadedLoanRequest();
    const input = screen.getByLabelText("開始日");
    fireEvent.change(input, { target: { value: "2026-07-24" } });
    expect(input).toHaveValue("2026-07-24");
    expect(screen.getByText("2026-07-24 から 2026-07-23 まで")).toBeInTheDocument();
  });

  it("029: 終了日を2026-07-25に設定すると申請期間に反映される", async () => {
    await renderLoadedLoanRequest();
    const startDate = screen.getByLabelText("開始日");
    const endDate = screen.getByLabelText("終了日");
    fireEvent.change(startDate, { target: { value: "2026-07-24" } });
    fireEvent.change(endDate, { target: { value: "2026-07-25" } });
    expect(endDate).toHaveValue("2026-07-25");
    expect(screen.getByText("2026-07-24 から 2026-07-25 まで")).toBeInTheDocument();
  });

  it("030: 使用目的は300文字まで入力できる", async () => {
    await renderLoadedLoanRequest();
    vi.useRealTimers();
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: "使用目的" });
    await user.type(input, "あ".repeat(301));
    expect(input).toHaveValue("あ".repeat(300));
  });

  it("031: クリアを押すと入力値とエラーメッセージが初期状態に戻る", async () => {
    await renderLoadedLoanRequest();
    const requesterName = screen.getByRole("textbox", { name: "申請者名" });
    const quantity = screen.getByRole("textbox", { name: "申請数量" });
    const startDate = screen.getByLabelText("開始日");
    const endDate = screen.getByLabelText("終了日");
    const reason = screen.getByRole("textbox", { name: "使用目的" });
    fireEvent.change(quantity, { target: { value: "7" } });
    fireEvent.change(startDate, { target: { value: "2026-07-28" } });
    fireEvent.change(endDate, { target: { value: "2026-08-02" } });
    fireEvent.change(reason, { target: { value: "あいうえお" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("申請数量が有効在庫数を超えています。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));
    expect(requesterName).toHaveValue("テストユーザー");
    expect(quantity).toHaveValue("1");
    expect(startDate).toHaveValue(TODAY);
    expect(endDate).toHaveValue(TODAY);
    expect(reason).toHaveValue("");
    expect(screen.queryByText("申請数量が有効在庫数を超えています。")).not.toBeInTheDocument();
  });

  it("032: 戻るを押すと申請APIを呼ばずに備品一覧に遷移する", async () => {
    const requestHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, requestHandler));
    await renderLoadedLoanRequest();
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(requestHandler).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "備品一覧画面" })).toBeInTheDocument();
  });

  it("033: 不正な備品IDでは備品情報取得APIを呼ばずにエラーを表示する", () => {
    const detailHandler = vi.fn();
    server.use(http.get(`${API_BASE_URL}/api/assets/:assetId`, detailHandler));
    renderLoanRequest({ pathname: "/requests/a", withLocationState: false, mockDetail: false });
    expect(
      screen.getByText(/URL の備品IDが正しくありません。\s+備品一覧画面から対象備品を選び直してください。/),
    ).toBeInTheDocument();
    expect(detailHandler).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });

  it("034: 申請数量が空欄または0の場合はAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    const quantity = screen.getByRole("textbox", { name: "申請数量" });
    fireEvent.change(quantity, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("申請数量は1以上で入力してください。")).toBeInTheDocument();
    fireEvent.change(quantity, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("申請数量は1以上で入力してください。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("035: 有効在庫数を超える申請数量ではAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.change(screen.getByRole("textbox", { name: "申請数量" }), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("申請数量が有効在庫数を超えています。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("036: 開始日が本日より前の場合はAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-07-22" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("開始日は本日以降の日付を指定してください。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("037: 終了日が開始日より前の場合はAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-07-24" } });
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: TODAY } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("終了日は開始日以降の日付を指定してください。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("038: 終了日が本日から6ヶ月後を超える場合はAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: "2027-01-24" } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("終了日は本日から6ヶ月後以内（2027年1月23日まで）で指定してください。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("039: 使用目的が空欄または空白のみの場合はAPIを呼ばずにエラーを表示する", () => {
    const submitHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    const reason = screen.getByRole("textbox", { name: "使用目的" });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("使用目的を入力してください。")).toBeInTheDocument();
    fireEvent.change(reason, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByText("使用目的を入力してください。")).toBeInTheDocument();
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it("040: 正常な申請内容を送信し、送信中の表示と送信内容を確認する", async () => {
    let requestBody: unknown;
    server.use(
      http.post(`${API_BASE_URL}/api/requests`, async ({ request }) => {
        requestBody = await request.json();
        return new Promise(() => undefined);
      }),
    );
    renderLoadedLoanRequest();
    fillValidReason();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByRole("button", { name: "申請中..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
    await waitFor(() => {
      expect(requestBody).toEqual({
        asset_id: 1,
        requester_name: "テストユーザー",
        quantity: 1,
        start_date: TODAY,
        end_date: TODAY,
        reason: "出張",
      });
    });
  });

  it("041: 申請APIの応答待ちの間は主要ボタンが非活性である", () => {
    server.use(http.post(`${API_BASE_URL}/api/requests`, () => new Promise(() => undefined)));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "申請中..." })).toBeDisabled();
  });

  it("043: 申請APIが正常応答すると備品一覧へ申請IDを渡して遷移する", async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/requests`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 123, asset_id: 1, requester_name: "テストユーザー", quantity: 1, start_date: TODAY, end_date: TODAY, reason: "出張", user_id: 1, status: "pending", returned_at: null, created_at: "2026-07-23T00:00:00.000Z", updated_at: "2026-07-23T00:00:00.000Z" },
          error: null,
        }),
      ),
    );
    renderLoadedLoanRequest();
    fillValidReason();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(await screen.findByRole("heading", { name: "備品一覧画面 申請ID: 123" })).toBeInTheDocument();
  });

  it("045: 備品情報取得APIが404を返すとエラーを表示し、URLを / に書き換える", async () => {
    const detailHandler = vi.fn(({ request }: { request: Request }) => {
      expectAssetDetailRequest(request);
      return mockApiError(404, "指定された備品が見つかりません。");
    });
    server.use(http.get(`${API_BASE_URL}/api/assets/:assetId`, detailHandler));
    renderLoanRequest({ withLocationState: false, mockDetail: false });
    vi.useRealTimers();
    expect(
      await screen.findByText(/指定された備品が見つかりません。\s+備品一覧画面から対象備品を選び直してください。/),
    ).toBeInTheDocument();
    expect(detailHandler).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/");
  });

  it.each([
    ["048", 500, /サーバーエラーのため、備品情報の取得に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/],
    ["049", 503, /サービスが一時的に利用できないため、備品情報の取得に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/],
    ["050", 504, /タイムアウトが発生したため、備品情報の取得に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/],
  ])("%s: 備品情報取得APIエラーを表示し、URLは維持する", async (_caseId, status, messagePattern) => {
    const detailHandler = vi.fn(({ request }: { request: Request }) => {
      expectAssetDetailRequest(request);
      return mockApiError(status, "error");
    });
    server.use(http.get(`${API_BASE_URL}/api/assets/:assetId`, detailHandler));
    renderLoanRequest({ withLocationState: false, mockDetail: false });
    vi.useRealTimers();
    expect(await screen.findByText(messagePattern)).toBeInTheDocument();
    expect(detailHandler).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/requests/1");
  });

  it("051: 備品情報取得APIの不正なレスポンスをエラー表示し、URLは維持する", async () => {
    const detailHandler = vi.fn(({ request }: { request: Request }) => {
      expectAssetDetailRequest(request);
      return HttpResponse.text("invalid response");
    });
    server.use(http.get(`${API_BASE_URL}/api/assets/:assetId`, detailHandler));
    renderLoanRequest({ withLocationState: false, mockDetail: false });
    vi.useRealTimers();
    expect(
      await screen.findByText(/備品情報データの読み込みに失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/),
    ).toBeInTheDocument();
    expect(detailHandler).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/requests/1");
  });

  it("052: 備品情報取得APIの想定外エラーをエラー表示し、URLは維持する", async () => {
    const detailHandler = vi.fn(({ request }: { request: Request }) => {
      expectAssetDetailRequest(request);
      return HttpResponse.error();
    });
    server.use(http.get(`${API_BASE_URL}/api/assets/:assetId`, detailHandler));
    renderLoanRequest({ withLocationState: false, mockDetail: false });
    vi.useRealTimers();
    expect(
      await screen.findByText(/予期しないエラーが発生したため、備品情報の取得に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/),
    ).toBeInTheDocument();
    expect(detailHandler).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/requests/1");
  });

  it.each([
    ["054", 404, "指定された備品が見つかりません。", /指定された備品が見つかりません。\s+備品一覧画面から対象備品を選び直してください。/, "/", 1],
    ["055", 409, "予約満了のため、貸出申請できません。", /予約満了のため、貸出申請できません。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/, "/requests/1", 6],
    ["057", 500, "error", /サーバーエラーのため、備品貸出申請の送信に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/, "/requests/1", 1],
    ["058", 503, "error", /サービスが一時的に利用できないため、備品貸出申請の送信に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/, "/requests/1", 1],
    ["059", 504, "error", /タイムアウトが発生したため、備品貸出申請の送信に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/, "/requests/1", 1],
  ])("%s: 台帳どおりの内容で申請送信APIを呼び、エラーを表示する", async (
    _caseId,
    status,
    responseMessage,
    messagePattern,
    expectedPathname,
    expectedQuantity,
  ) => {
    let requestBody: unknown;
    const submitHandler = vi.fn(async ({ request }: { request: Request }) => {
      requestBody = await request.json();
      return mockApiError(status, responseMessage);
    });
    server.use(http.post(`${API_BASE_URL}/api/requests`, submitHandler));
    renderLoadedLoanRequest();
    fillValidReason();
    fireEvent.change(screen.getByRole("textbox", { name: "申請数量" }), {
      target: { value: String(expectedQuantity) },
    });
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(await screen.findByText(messagePattern)).toBeInTheDocument();
    expect(submitHandler).toHaveBeenCalledTimes(1);
    expect(requestBody).toEqual({
      asset_id: 1,
      requester_name: "テストユーザー",
      quantity: expectedQuantity,
      start_date: TODAY,
      end_date: TODAY,
      reason: "出張",
    });
    expect(window.location.pathname).toBe(expectedPathname);
  });

  it("060: 申請送信APIの不正なレスポンスをエラー表示し、URLは維持する", async () => {
    server.use(http.post(`${API_BASE_URL}/api/requests`, () => HttpResponse.text("invalid response")));
    renderLoadedLoanRequest();
    fillValidReason();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(
      await screen.findByText(/備品貸出申請結果データの読み込みに失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/requests/1");
  });

  it("061: 申請送信APIの想定外エラーをエラー表示し、URLは維持する", async () => {
    server.use(http.post(`${API_BASE_URL}/api/requests`, () => HttpResponse.error()));
    renderLoadedLoanRequest();
    fillValidReason();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "申請する" }));
    expect(
      await screen.findByText(/予期しないエラーが発生したため、備品貸出申請の送信に失敗しました。\s+備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。/),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/requests/1");
  });
});
