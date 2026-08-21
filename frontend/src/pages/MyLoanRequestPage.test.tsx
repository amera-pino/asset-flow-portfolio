import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyLoanRequestPage } from "./MyLoanRequestPage";
import { server } from "../test/server";
import type { ActiveAssetLoanRequest } from "../types/assetLoanRequest";

const API_BASE_URL = "http://localhost:8000";

function createRequest(
  id: number,
  assetName: string,
  assetCategory: string,
  status: ActiveAssetLoanRequest["status"],
  startDate: string,
  quantity = 2,
): ActiveAssetLoanRequest {
  return {
    id,
    asset_id: id,
    asset_name: assetName,
    asset_category: assetCategory,
    requester_name: "テストユーザー",
    user_id: 1,
    status,
    quantity,
    start_date: startDate,
    end_date: "2026-08-01",
    reason: "テスト",
    returned_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

// 台帳 No.024〜044 の行番号、件数、集計値を再現する並び順のテストデータ。
function createActiveRequests(): ActiveAssetLoanRequest[] {
  const rows: Array<
    [number, string, string, "loaned" | "pending" | "approved" | "rejected", string, string?, number?]
  > = [
    [19, "Logitech MX Keys", "キーボード", "loaned", "2026-07-08", "2026-07-26", 1],
    [1, "Laptop Stand Pro", "周辺機器", "loaned", "2026-07-09"],
    [2, "HDMI Splitter", "周辺機器", "loaned", "2026-07-09"],
    [3, "ThinkPad X1 Carbon", "パソコン", "approved", "2026-07-10"],
    [4, "USB-C Adapter", "アクセサリー", "loaned", "2026-07-10"],
    [6, "Apple Pencil", "アクセサリー", "loaned", "2026-07-10"],
    [7, "Wireless Presenter", "周辺機器", "loaned", "2026-07-11"],
    [8, "Webcam Pro", "会議機器", "loaned", "2026-07-11"],
    [9, "Portable Display", "モニター", "loaned", "2026-07-11"],
    [5, "Herman Miller Aeron", "家具", "loaned", "2026-07-12", "2026-07-30"],
    [10, "USB-C Hub Pro", "アクセサリー", "loaned", "2026-07-12"],
    [28, "360 Meeting Camera", "会議機器", "pending", "2026-07-13"],
    [11, "Projector Screen", "会議機器", "loaned", "2026-07-14"],
    [13, "Ethernet Adapter", "周辺機器", "loaned", "2026-07-15"],
    [14, "Gaming Mouse", "マウス", "loaned", "2026-07-16"],
    [15, "Storage SSD", "ストレージ", "loaned", "2026-07-17"],
    [16, "Electric Strip", "電源機器", "pending", "2026-07-18"],
    [17, "Camera Mount", "カメラ", "pending", "2026-07-19"],
    [18, "Tablet Cover", "タブレット", "loaned", "2026-07-20"],
    [12, "HP EliteBook 840", "パソコン", "loaned", "2026-07-27", "2026-08-01", 3],
    [21, "静音ワイヤレスマウス", "マウス", "loaned", "2026-07-28"],
    [22, "Keychron K3 Pro", "キーボード", "loaned", "2026-07-29"],
    [23, "Headset Max", "ヘッドセット", "loaned", "2026-07-30"],
    [24, "Remote Clicker", "周辺機器", "loaned", "2026-07-31"],
    [25, "USB-C Cable", "アクセサリー", "pending", "2026-08-01"],
    [26, "Wi-Fi Adapter", "周辺機器", "pending", "2026-08-02"],
    [27, "Monitor Arm", "モニター", "pending", "2026-08-03"],
    [29, "Office Chair", "家具", "pending", "2026-08-04"],
    [30, "Surface Note 6", "パソコン", "approved", "2026-08-05"],
    [31, "HHKB Studio", "キーボード", "loaned", "2026-08-06"],
    [32, "Dell Latitude", "パソコン", "loaned", "2026-08-07"],
    [33, "Display Cable", "アクセサリー", "rejected", "2026-08-08"],
    [34, "Conference Mic", "会議機器", "loaned", "2026-08-09"],
    [35, "Webcam 4K", "会議機器", "loaned", "2026-08-10"],
    [36, "Carry Bag", "アクセサリー", "pending", "2026-08-11"],
    [37, "Keyboard Cover", "キーボード", "pending", "2026-08-12"],
    [38, "AC Adapter", "電源機器", "rejected", "2026-08-13"],
    [39, "Camera Plate", "カメラ", "loaned", "2026-08-14"],
    [42, "Silent Wireless Mouse", "マウス", "loaned", "2026-08-15"],
    [40, "Webカメラ 1080p", "会議機器", "loaned", "2026-08-16"],
    [41, "タブレットスタンド", "タブレット", "loaned", "2026-08-17"],
    [44, "Docking Station", "アクセサリー", "pending", "2026-08-18"],
    [43, "USB-C Hub 7-in-1", "アクセサリー", "loaned", "2026-08-19"],
    [45, "Approved USB-C Hub", "アクセサリー", "approved", "2026-08-20"],
  ];

  return rows
    .map(([id, name, category, status, startDate, endDate = "2026-08-31", quantity]) => ({
      ...createRequest(id, name, category, status, startDate, quantity),
      end_date: endDate,
    }))
    .reverse();
}

function createSummaryRequests(): ActiveAssetLoanRequest[] {
  return createActiveRequests();
}

function mockActiveRequests(requests = createActiveRequests()) {
  server.use(
    http.get(`${API_BASE_URL}/api/requests/me/active`, () =>
      HttpResponse.json({ success: true, data: requests, error: null }),
    ),
  );
}

function renderMyLoanRequest(initialEntries = ["/my-requests"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<h1>備品一覧画面</h1>} path="/" />
        <Route element={<MyLoanRequestPage />} path="/my-requests" />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoadedMyLoanRequest(
  requests = createActiveRequests(),
  initialEntries = ["/my-requests"],
) {
  mockActiveRequests(requests);
  renderMyLoanRequest(initialEntries);
  await screen.findByRole("table");
}

function tableRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

function getSummaryLabel(label: string) {
  return screen.getByText(label, { selector: "p" });
}

function expectPagination({
  start,
  end,
  total,
  currentPage,
  pages,
  previousDisabled,
  nextDisabled,
}: {
  start: number;
  end: number;
  total: number;
  currentPage: number;
  pages: number[];
  previousDisabled: boolean;
  nextDisabled: boolean;
}) {
  expect(screen.getByText(`${start} - ${end} / ${total}`)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "前のページ" })).toHaveProperty("disabled", previousDisabled);
  expect(screen.getByRole("button", { name: "次のページ" })).toHaveProperty("disabled", nextDisabled);
  expect(
    screen
      .getAllByRole("button")
      .filter((button) => /^\d+$/.test(button.textContent ?? ""))
      .map((button) => Number(button.textContent)),
  ).toEqual(pages);

  pages.forEach((page) => {
    const button = screen.getByRole("button", { name: String(page) });
    expect(button).toBeEnabled();

    if (page === currentPage) {
      expect(button).toHaveAttribute("aria-current", "page");
      expect(button).toHaveClass("bg-teal-700");
      return;
    }

    expect(button).not.toHaveAttribute("aria-current");
    expect(button).toHaveClass("bg-white");
  });
}

function expectDisplayedRowsSorted() {
  const sortKeys = tableRows().map((row) => {
    const cells = within(row).getAllByRole("cell");
    const requestId = Number(cells[1].textContent);
    const startDate = cells[5].textContent?.split(" - ")[0] ?? "";
    return `${startDate}:${String(requestId).padStart(5, "0")}`;
  });

  expect(sortKeys).toEqual([...sortKeys].sort());
}

function expectProcessingControlsDisabled() {
  expect(screen.getByRole("combobox", { name: "ステータスで絞り込み" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "カテゴリで絞り込み" })).toBeDisabled();
  expect(screen.getByPlaceholderText("備品名で検索...")).toBeDisabled();
  expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
  screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());

  const assetListLink = screen.getByRole("link", { name: "備品一覧" });
  expect(assetListLink).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(assetListLink);
  expect(screen.getByRole("heading", { name: "マイ貸出状況" })).toBeInTheDocument();
}

function mockApiError(status: number, message: string) {
  return HttpResponse.json(
    { success: false, data: null, error: { code: "REQUEST_FAILED", message } },
    { status },
  );
}

async function confirmReturn() {
  fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "返却" }));
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
}

async function confirmCancel() {
  fireEvent.click(within(tableRows()[11]).getByRole("button", { name: "キャンセル" }));
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("MyLoanRequestPage", () => {
  it("001: AssetFlow が表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByText("AssetFlow")).toBeInTheDocument();
  });

  it("002: マイ貸出状況が表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByRole("heading", { name: "マイ貸出状況" })).toBeInTheDocument();
  });

  it("003: 承認待ちが表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認待ち")).toBeInTheDocument(); });
  it("004: APIから取得した承認待ち件数10が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認待ち").parentElement?.lastElementChild).toHaveTextContent("10"); });
  it("005: 承認済みが表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認済み")).toBeInTheDocument(); });
  it("006: APIから取得した承認済み件数3が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認済み").parentElement?.lastElementChild).toHaveTextContent("3"); });
  it("007: 承認却下が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認却下")).toBeInTheDocument(); });
  it("008: APIから取得した承認却下件数2が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("承認却下").parentElement?.lastElementChild).toHaveTextContent("2"); });
  it("009: 貸出中が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("貸出中")).toBeInTheDocument(); });
  it("010: APIから取得した貸出中件数29が表示されている", async () => { await renderLoadedMyLoanRequest(createSummaryRequests()); expect(getSummaryLabel("貸出中").parentElement?.lastElementChild).toHaveTextContent("29"); });

  it("011: 備品一覧リンクが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByRole("link", { name: "備品一覧" })).toBeInTheDocument();
  });

  it("012: ステータスプルダウンが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "ステータスで絞り込み" });
    expect(select).toBeInTheDocument();
  });
  it("013: ステータスの初期値はすべての状態である", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "ステータスで絞り込み" });
    expect(select).toHaveValue("all");
  });
  it("014: ステータスの選択肢が台帳どおりの順に表示される", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "ステータスで絞り込み" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "すべての状態", "承認済み", "承認却下", "貸出中", "承認待ち",
    ]);
  });

  it("015: カテゴリプルダウンが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "カテゴリで絞り込み" });
    expect(select).toBeInTheDocument();
  });
  it("016: カテゴリの初期値はすべてのカテゴリである", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "カテゴリで絞り込み" });
    expect(select).toHaveValue("");
  });
  it("017: カテゴリの選択肢が台帳どおりの順に表示される", async () => {
    await renderLoadedMyLoanRequest();
    const select = screen.getByRole("combobox", { name: "カテゴリで絞り込み" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "すべてのカテゴリ", "アクセサリー", "カメラ", "キーボード", "ストレージ", "タブレット", "パソコン", "ヘッドセット", "マウス", "モニター", "会議機器", "家具", "周辺機器", "電源機器",
    ]);
  });

  it("017-2: 定義外のカテゴリも選択肢に表示される", async () => {
    mockActiveRequests([
      ...createActiveRequests(),
      createRequest(46, "LEDクリップライト", "照明", "pending", "2026-08-21", 1),
    ]);
    renderMyLoanRequest();

    const select = await screen.findByRole("combobox", { name: "カテゴリで絞り込み" });
    expect(within(select).getByRole("option", { name: "照明" })).toBeInTheDocument();
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "すべてのカテゴリ", "アクセサリー", "カメラ", "キーボード", "ストレージ", "タブレット", "パソコン", "ヘッドセット", "マウス", "モニター", "会議機器", "家具", "周辺機器", "電源機器", "照明",
    ]);
  });

  it("018: 備品名検索欄が表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByPlaceholderText("備品名で検索...")).toBeInTheDocument();
  });
  it("019: 虫眼鏡アイコンが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(document.querySelector("svg.lucide-search")).toBeInTheDocument();
  });
  it("020: 備品名検索のプレースホルダーが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByPlaceholderText("備品名で検索...")).toBeInTheDocument();
  });

  it("021: クリアボタンが表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByRole("button", { name: "クリア" })).toBeInTheDocument();
  });

  it("022: 一覧表が表示されている", async () => {
    await renderLoadedMyLoanRequest();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("023: 一覧表の列ヘッダーが台帳どおりに表示される", async () => {
    await renderLoadedMyLoanRequest();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "No.", "申請ID", "備品名", "カテゴリ", "数量", "貸出期間", "状態", "操作",
    ]);
  });

  it("024: 1行目に Logitech MX Keys の申請データが表示される", async () => {
    await renderLoadedMyLoanRequest();
    expect(within(tableRows()[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "1", "00019", "Logitech MX Keys", "キーボード", "1", "2026-07-08 - 2026-07-26", "貸出中", "返却",
    ]);
  });

  it("025: 10行目に Herman Miller Aeron の申請データが表示される", async () => {
    await renderLoadedMyLoanRequest();
    expect(within(tableRows()[9]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "10", "00005", "Herman Miller Aeron", "家具", "2", "2026-07-12 - 2026-07-30", "貸出中", "返却",
    ]);
  });

  it("026: 20行目に HP EliteBook 840 の申請データが表示される", async () => {
    await renderLoadedMyLoanRequest();
    expect(within(tableRows()[19]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "20", "00012", "HP EliteBook 840", "パソコン", "3", "2026-07-27 - 2026-08-01", "貸出中", "返却",
    ]);
  });

  it("027: 読み込み中は読み込み中...を表示する", () => {
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => new Promise(() => undefined)));
    renderMyLoanRequest();
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("028: 空配列では空状態メッセージを表示し一覧表を表示しない", async () => {
    mockActiveRequests([]);
    renderMyLoanRequest();
    expect(await screen.findByText("現在、あなたが借りている備品はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("029: 備品一覧リンクで備品一覧に遷移する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.click(screen.getByRole("link", { name: "備品一覧" }));
    expect(screen.getByRole("heading", { name: "備品一覧画面" })).toBeInTheDocument();
  });

  it("030: 貸出中で絞り込むと29件を台帳の並び順とページングで表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByRole("combobox", { name: "ステータスで絞り込み" }), { target: { value: "loaned" } });
    await waitFor(() => expect(tableRows()).toHaveLength(20));
    expect(tableRows()[0]).toHaveTextContent("Logitech MX Keys");
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 20, total: 29, currentPage: 1, pages: [1, 2],
      previousDisabled: true, nextDisabled: false,
    });
  });

  it("031: 承認待ちで絞り込むと10件を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByRole("combobox", { name: "ステータスで絞り込み" }), { target: { value: "pending" } });
    await waitFor(() => expect(tableRows()).toHaveLength(10));
    expect(tableRows().every((row) => row.textContent?.includes("承認待ち"))).toBe(true);
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 10, total: 10, currentPage: 1, pages: [1],
      previousDisabled: true, nextDisabled: true,
    });
  });

  it("032: パソコンで絞り込むと4件を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリで絞り込み" }), { target: { value: "パソコン" } });
    await waitFor(() => expect(tableRows()).toHaveLength(4));
    expect(tableRows().every((row) => row.textContent?.includes("パソコン"))).toBe(true);
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 4, total: 4, currentPage: 1, pages: [1],
      previousDisabled: true, nextDisabled: true,
    });
  });

  it("033: 小文字 p のキーワード検索で15件を表示する", async () => {
    const requests = createActiveRequests().map((request, index) => ({
      ...request,
      asset_name: index < 15 ? `p-item-${index + 1}` : `item-${index + 1}`,
    }));
    await renderLoadedMyLoanRequest(requests);
    fireEvent.change(screen.getByPlaceholderText("備品名で検索..."), { target: { value: "p" } });
    await waitFor(() => expect(tableRows()).toHaveLength(15));
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 15, total: 15, currentPage: 1, pages: [1],
      previousDisabled: true, nextDisabled: true,
    });
  });

  it("034: 該当なしのキーワード検索では空状態メッセージを表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByPlaceholderText("備品名で検索..."), { target: { value: "あ" } });
    expect(await screen.findByText("検索条件に一致する申請はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expectPagination({
      start: 0, end: 0, total: 0, currentPage: 1, pages: [1],
      previousDisabled: true, nextDisabled: true,
    });
  });

  it("035: 備品名検索は60文字まで入力できる", async () => {
    await renderLoadedMyLoanRequest();
    const input = screen.getByPlaceholderText("備品名で検索...");
    await userEvent.setup().type(input, "a".repeat(61));
    expect(input).toHaveValue("a".repeat(60));
  });

  it("036: 貸出中・キーボード・h の複合検索で3件を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByRole("combobox", { name: "ステータスで絞り込み" }), { target: { value: "loaned" } });
    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリで絞り込み" }), { target: { value: "キーボード" } });
    fireEvent.change(screen.getByPlaceholderText("備品名で検索..."), { target: { value: "h" } });
    await waitFor(() => expect(tableRows()).toHaveLength(3));
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 3, total: 3, currentPage: 1, pages: [1],
      previousDisabled: true, nextDisabled: true,
    });
  });

  it("037: クリアで検索条件を初期化して全44件の先頭20件へ戻す", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.change(screen.getByRole("combobox", { name: "ステータスで絞り込み" }), { target: { value: "loaned" } });
    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリで絞り込み" }), { target: { value: "キーボード" } });
    fireEvent.change(screen.getByPlaceholderText("備品名で検索..."), { target: { value: "h" } });
    await waitFor(() => expect(tableRows()).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));
    expect(screen.getByRole("combobox", { name: "ステータスで絞り込み" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "カテゴリで絞り込み" })).toHaveValue("");
    expect(screen.getByPlaceholderText("備品名で検索...")).toHaveValue("");
    expect(tableRows()).toHaveLength(20);
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 20, total: 44, currentPage: 1, pages: [1, 2, 3],
      previousDisabled: true, nextDisabled: false,
    });
  });

  it("038: ページングの2で21〜40行目を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(screen.getByText("21 - 40 / 44")).toBeInTheDocument());
    expect(tableRows()[0]).toHaveTextContent("静音ワイヤレスマウス");
    expect(tableRows()[19]).toHaveTextContent("Webカメラ 1080p");
    expectDisplayedRowsSorted();
    expectPagination({
      start: 21, end: 40, total: 44, currentPage: 2, pages: [1, 2, 3],
      previousDisabled: false, nextDisabled: false,
    });
  });

  it("039: 2ページ目の前のページで1ページ目を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "前のページ" }));
    await waitFor(() => expect(screen.getByText("1 - 20 / 44")).toBeInTheDocument());
    expect(tableRows()[0]).toHaveTextContent("Logitech MX Keys");
    expect(tableRows()[19]).toHaveTextContent("HP EliteBook 840");
    expectDisplayedRowsSorted();
    expectPagination({
      start: 1, end: 20, total: 44, currentPage: 1, pages: [1, 2, 3],
      previousDisabled: true, nextDisabled: false,
    });
  });

  it("040: 2ページ目の次のページで3ページ目を表示する", async () => {
    await renderLoadedMyLoanRequest();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    await waitFor(() => expect(screen.getByText("41 - 44 / 44")).toBeInTheDocument());
    expect(tableRows()[0]).toHaveTextContent("タブレットスタンド");
    expect(tableRows()[3]).toHaveTextContent("Approved USB-C Hub");
    expectDisplayedRowsSorted();
    expectPagination({
      start: 41, end: 44, total: 44, currentPage: 3, pages: [1, 2, 3],
      previousDisabled: false, nextDisabled: true,
    });
  });

  it("041: 1行目の返却で確認ダイアログを表示し、キャンセルでは API を呼ばない", async () => {
    const returnHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, returnHandler));
    await renderLoadedMyLoanRequest();
    expect(screen.getByText("1 - 20 / 44")).toBeInTheDocument();
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "返却" }));
    const dialog = screen.getByRole("dialog", { name: "返却確認" });
    expect(dialog.querySelector("svg.lucide-circle-help")).toBeInTheDocument();
    expect(within(dialog).getByText("この備品を返却してもよろしいですか？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "OK" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(returnHandler).not.toHaveBeenCalled();
    expect(screen.getByText("1 - 20 / 44")).toBeInTheDocument();
    expect(tableRows()[0]).toHaveTextContent("Logitech MX Keys");
  });

  it("042: 12行目のキャンセルで確認ダイアログを表示し、キャンセルでは API を呼ばない", async () => {
    const cancelHandler = vi.fn();
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, cancelHandler));
    await renderLoadedMyLoanRequest();
    expect(screen.getByText("1 - 20 / 44")).toBeInTheDocument();
    fireEvent.click(within(tableRows()[11]).getByRole("button", { name: "キャンセル" }));
    const dialog = screen.getByRole("dialog", { name: "キャンセル確認" });
    expect(dialog.querySelector("svg.lucide-circle-help")).toBeInTheDocument();
    expect(within(dialog).getByText("この申請をキャンセルしてもよろしいですか？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "OK" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(cancelHandler).not.toHaveBeenCalled();
    expect(screen.getByText("1 - 20 / 44")).toBeInTheDocument();
    expect(tableRows()[11]).toHaveTextContent("360 Meeting Camera");
  });

  it("043: 返却登録後に再取得し、処理中表示とトーストを表示する", async () => {
    const initialRequests = createActiveRequests();
    const requestsAfterReturn = initialRequests.filter((request) => request.id !== 19);
    let resolveReturn: (() => void) | undefined;
    const returnHandler = vi.fn(({ request }: { request: Request }) => new Promise<ReturnType<typeof HttpResponse.json>>((resolve) => {
      resolveReturn = () => resolve(HttpResponse.json({
        success: true,
        data: initialRequests.find((loanRequest) => loanRequest.id === 19),
        error: null,
      }));
    }));
    let getCount = 0;
    const getHandler = vi.fn(() => {
      getCount += 1;
      return HttpResponse.json({
        success: true,
        data: getCount === 1 ? initialRequests : requestsAfterReturn,
        error: null,
      });
    });
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, getHandler), http.post(`${API_BASE_URL}/api/requests/19/return`, returnHandler));
    renderMyLoanRequest();
    await screen.findByRole("table");
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "返却" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "返却中" })).toBeDisabled());
    expectProcessingControlsDisabled();
    expect(returnHandler).toHaveBeenCalledTimes(1);
    expect(returnHandler.mock.calls[0][0].request.method).toBe("POST");
    expect(returnHandler.mock.calls[0][0].request.url).toBe(`${API_BASE_URL}/api/requests/19/return`);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resolveReturn?.();
    await waitFor(() => {
      expect(getHandler).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Logitech MX Keys")).not.toBeInTheDocument();
      expect(screen.getByText("返却を受け付けました。申請ID：00019")).toHaveClass(
        "translate-y-0",
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.queryByText("返却を受け付けました。申請ID：00019")).not.toBeInTheDocument();
  });

  it("044: 申請キャンセル後に再取得し、処理中表示とトーストを表示する", async () => {
    const initialRequests = createActiveRequests();
    const requestsAfterCancel = initialRequests.filter((request) => request.id !== 28);
    let resolveCancel: (() => void) | undefined;
    const cancelHandler = vi.fn(({ request }: { request: Request }) => new Promise<ReturnType<typeof HttpResponse.json>>((resolve) => {
      resolveCancel = () => resolve(HttpResponse.json({
        success: true,
        data: initialRequests.find((loanRequest) => loanRequest.id === 28),
        error: null,
      }));
    }));
    let getCount = 0;
    const getHandler = vi.fn(() => {
      getCount += 1;
      return HttpResponse.json({
        success: true,
        data: getCount === 1 ? initialRequests : requestsAfterCancel,
        error: null,
      });
    });
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, getHandler), http.post(`${API_BASE_URL}/api/requests/28/cancel`, cancelHandler));
    renderMyLoanRequest();
    await screen.findByRole("table");
    fireEvent.click(within(tableRows()[11]).getByRole("button", { name: "キャンセル" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "処理中" })).toBeDisabled());
    expectProcessingControlsDisabled();
    expect(cancelHandler).toHaveBeenCalledTimes(1);
    expect(cancelHandler.mock.calls[0][0].request.method).toBe("POST");
    expect(cancelHandler.mock.calls[0][0].request.url).toBe(`${API_BASE_URL}/api/requests/28/cancel`);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resolveCancel?.();
    await waitFor(() => {
      expect(getHandler).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("360 Meeting Camera")).not.toBeInTheDocument();
      expect(screen.getByText("キャンセルを受け付けました。申請ID：00028")).toHaveClass(
        "translate-y-0",
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.queryByText("キャンセルを受け付けました。申請ID：00028")).not.toBeInTheDocument();
  });

  it("049: 貸出状況取得APIが500の場合、取得失敗メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => mockApiError(500, "backend error")));
    renderMyLoanRequest(["/my-requests?error=1"]);
    expect(
      await screen.findByText(/サーバーエラーのため、貸出状況の取得に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("050: 貸出状況取得APIが503の場合、取得失敗メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => mockApiError(503, "backend error")));
    renderMyLoanRequest(["/my-requests?error=1"]);
    expect(
      await screen.findByText(
        /サービスが一時的に利用できないため、貸出状況の取得に失敗しました。\s+貸出状況を再読み込みしてください。/,
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("051: 貸出状況取得APIが504の場合、取得失敗メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => mockApiError(504, "backend error")));
    renderMyLoanRequest(["/my-requests?error=1"]);
    expect(
      await screen.findByText(/タイムアウトが発生したため、貸出状況の取得に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("052: 貸出状況取得APIのレスポンス形式が不正な場合、読み込み失敗メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => new HttpResponse("invalid json")));
    renderMyLoanRequest(["/my-requests?error=1"]);
    expect(
      await screen.findByText(/貸出状況データの読み込みに失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("053: 貸出状況取得APIで想定外のエラーが発生した場合、想定外エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.get(`${API_BASE_URL}/api/requests/me/active`, () => HttpResponse.error()));
    renderMyLoanRequest(["/my-requests?error=1"]);
    expect(
      await screen.findByText(/予期しないエラーが発生したため、貸出状況の取得に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("055: No.1 の申請が確認後に削除されると返却登録APIの404メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    let databaseRequests = createActiveRequests();
    server.use(
      http.get(`${API_BASE_URL}/api/requests/me/active`, () =>
        HttpResponse.json({ success: true, data: databaseRequests, error: null }),
      ),
      http.post(`${API_BASE_URL}/api/requests/19/return`, () =>
        databaseRequests.some((request) => request.id === 19)
          ? HttpResponse.json({ success: true, data: null, error: null })
          : mockApiError(404, "対象の貸出申請が見つかりません。"),
      ),
    );
    renderMyLoanRequest(["/my-requests?error=1"]);
    await screen.findByRole("table");
    expect(tableRows()[0]).toHaveTextContent("Logitech MX Keys");
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "返却" }));
    expect(screen.getByRole("dialog", { name: "返却確認" })).toBeInTheDocument();
    databaseRequests = databaseRequests.filter((request) => request.id !== 19);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      await screen.findByText(/対象の貸出申請が見つかりません。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("056: No.1 の申請状態が確認後に変わると返却登録APIの409メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    let databaseRequests = createActiveRequests();
    server.use(
      http.get(`${API_BASE_URL}/api/requests/me/active`, () =>
        HttpResponse.json({ success: true, data: databaseRequests, error: null }),
      ),
      http.post(`${API_BASE_URL}/api/requests/19/return`, () =>
        databaseRequests.find((request) => request.id === 19)?.status === "loaned"
          ? HttpResponse.json({ success: true, data: null, error: null })
          : mockApiError(409, "貸出中の備品のみ返却できます。"),
      ),
    );
    renderMyLoanRequest(["/my-requests?error=1"]);
    await screen.findByRole("table");
    expect(tableRows()[0]).toHaveTextContent("Logitech MX Keys");
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "返却" }));
    expect(screen.getByRole("dialog", { name: "返却確認" })).toBeInTheDocument();
    databaseRequests = databaseRequests.map((request) =>
      request.id === 19 ? { ...request, status: "returned" as const } : request,
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      await screen.findByText(/貸出中の備品のみ返却できます。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("058: 返却登録APIが500の場合、主メッセージと再読み込み案内を表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, () => mockApiError(500, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmReturn();
    expect(
      await screen.findByText(/サーバーエラーのため、返却処理に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("059: 返却登録APIが503の場合、主メッセージと再読み込み案内を表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, () => mockApiError(503, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmReturn();
    expect(
      await screen.findByText(
        /サービスが一時的に利用できないため、返却処理に失敗しました。\s+貸出状況を再読み込みしてください。/,
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("060: 返却登録APIが504の場合、主メッセージと再読み込み案内を表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, () => mockApiError(504, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmReturn();
    expect(
      await screen.findByText(/タイムアウトが発生したため、返却処理に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("061: 返却登録APIのレスポンス形式が不正な場合、主メッセージと再読み込み案内を表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, () => new HttpResponse("invalid json")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmReturn();
    expect(await screen.findByText(/返却結果データの読み込みに失敗しました。\s+貸出状況を再読み込みしてください。/)).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("062: 返却登録APIで想定外のエラーが発生した場合、想定外エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/19/return`, () => HttpResponse.error()));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmReturn();
    expect(
      await screen.findByText(/予期しないエラーが発生したため、返却処理に失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("064: No.12 の申請が確認後に削除されると申請キャンセルAPIの404メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    let databaseRequests = createActiveRequests();
    server.use(
      http.get(`${API_BASE_URL}/api/requests/me/active`, () =>
        HttpResponse.json({ success: true, data: databaseRequests, error: null }),
      ),
      http.post(`${API_BASE_URL}/api/requests/28/cancel`, () =>
        databaseRequests.some((request) => request.id === 28)
          ? HttpResponse.json({ success: true, data: null, error: null })
          : mockApiError(404, "対象の貸出申請が見つかりません。"),
      ),
    );
    renderMyLoanRequest(["/my-requests?error=1"]);
    await screen.findByRole("table");
    expect(tableRows()[11]).toHaveTextContent("360 Meeting Camera");
    fireEvent.click(within(tableRows()[11]).getByRole("button", { name: "キャンセル" }));
    expect(screen.getByRole("dialog", { name: "キャンセル確認" })).toBeInTheDocument();
    databaseRequests = databaseRequests.filter((request) => request.id !== 28);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      await screen.findByText(/対象の貸出申請が見つかりません。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("065: No.12 の申請状態が確認後に変わると申請キャンセルAPIの409メッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    let databaseRequests = createActiveRequests();
    server.use(
      http.get(`${API_BASE_URL}/api/requests/me/active`, () =>
        HttpResponse.json({ success: true, data: databaseRequests, error: null }),
      ),
      http.post(`${API_BASE_URL}/api/requests/28/cancel`, () =>
        databaseRequests.find((request) => request.id === 28)?.status === "pending"
          ? HttpResponse.json({ success: true, data: null, error: null })
          : mockApiError(409, "承認待ちの申請のみキャンセルできます。"),
      ),
    );
    renderMyLoanRequest(["/my-requests?error=1"]);
    await screen.findByRole("table");
    expect(tableRows()[11]).toHaveTextContent("360 Meeting Camera");
    fireEvent.click(within(tableRows()[11]).getByRole("button", { name: "キャンセル" }));
    expect(screen.getByRole("dialog", { name: "キャンセル確認" })).toBeInTheDocument();
    databaseRequests = databaseRequests.map((request) =>
      request.id === 28 ? { ...request, status: "loaned" as const } : request,
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      await screen.findByText(/承認待ちの申請のみキャンセルできます。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("067: 申請キャンセルAPIが500の場合、エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, () => mockApiError(500, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmCancel();
    expect(
      await screen.findByText(/サーバーエラーのため、申請キャンセルに失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("068: 申請キャンセルAPIが503の場合、エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, () => mockApiError(503, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmCancel();
    expect(
      await screen.findByText(
        /サービスが一時的に利用できないため、申請キャンセルに失敗しました。\s+貸出状況を再読み込みしてください。/,
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("069: 申請キャンセルAPIが504の場合、エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, () => mockApiError(504, "backend error")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmCancel();
    expect(
      await screen.findByText(/タイムアウトが発生したため、申請キャンセルに失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("070: 申請キャンセルAPIのレスポンス形式が不正な場合、主メッセージと再読み込み案内を表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, () => new HttpResponse("invalid json")));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmCancel();
    expect(await screen.findByText(/申請キャンセル結果データの読み込みに失敗しました。\s+貸出状況を再読み込みしてください。/)).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });

  it("071: 申請キャンセルAPIで想定外のエラーが発生した場合、想定外エラーメッセージを表示する", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    server.use(http.post(`${API_BASE_URL}/api/requests/28/cancel`, () => HttpResponse.error()));
    await renderLoadedMyLoanRequest(createActiveRequests(), ["/my-requests?error=1"]);
    await confirmCancel();
    expect(
      await screen.findByText(/予期しないエラーが発生したため、申請キャンセルに失敗しました。\s+貸出状況を再読み込みしてください。/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/my-requests");
    });
  });
});
