import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AssetListPage } from "./AssetListPage";
import { AssetLoanRequestPage } from "./AssetLoanRequestPage";
import type { Asset } from "../types/asset";
import type { AssetPageResponse } from "../types/assetList";
import { server } from "../test/server";

const API_BASE_URL = "http://localhost:8000";
const CATEGORY_OPTIONS = [
  "アクセサリー",
  "オーディオ",
  "カメラ",
  "キーボード",
  "ストレージ",
  "タブレット",
  "ネットワーク",
  "パソコン",
  "ヘッドセット",
  "マウス",
  "モニター",
  "会議機器",
  "周辺機器",
  "家具",
  "電源機器",
];

// createAsset の概要
// MSW が返す 1行分の備品データのベース
// 1. 一覧表の1行分として使う、標準の備品データを1件作る。
// 2. これを MSW のレスポンスのベースデータとして使う。
// 3. テストケースごとに、必要な項目だけ上書きできるようにしてある。
//
// コード解説
// - overrides: Partial<Asset>
//   - Asset の一部だけ渡してよい、という意味。
//   - category だけ、total_stock だけ、のように必要な項目だけ差し替えられる。
// - = {}
//   - 引数が渡されなかったときの初期値。
//   - 何も指定しなくても、この関数はそのまま動く。
// - ...overrides
//   - ここで渡された値を、標準データの上に重ねて上書きする。
//   - たとえば { category: "パソコン" } を渡すと、category だけが変わる。
function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1,
    name: "会議用モニター",
    category: "映像機器",
    total_stock: 10,
    consuming_quantity: 2,
    effective_stock: 8,
    status: "available",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function createFirstPageAssets(): Asset[] {
  return [
    createAsset({
      id: 1,
      name: 'MacBook Pro 14"',
      category: "パソコン",
      total_stock: 6,
      effective_stock: 6,
    }),
    createAsset({
      id: 2,
      name: 'Dell 27" 4K Monitor',
      category: "モニター",
      total_stock: 5,
      effective_stock: 5,
    }),
    createAsset({
      id: 3,
      name: "HHKB Studio",
      category: "キーボード",
      total_stock: 2,
      effective_stock: 2,
    }),
    createAsset({
      id: 4,
      name: "Magic Mouse",
      category: "マウス",
      total_stock: 10,
      effective_stock: 10,
    }),
    createAsset({
      id: 5,
      name: "Herman Miller Aeron",
      category: "家具",
      total_stock: 2,
      effective_stock: 2,
    }),
    createAsset({
      id: 6,
      name: "Jabra Speak2 75",
      category: "会議機器",
      total_stock: 4,
      effective_stock: 4,
    }),
    createAsset({
      id: 7,
      name: "Sony WH-1000XM5",
      category: "ヘッドセット",
      total_stock: 6,
      effective_stock: 6,
    }),
    createAsset({
      id: 8,
      name: "Anker 737 Power Bank",
      category: "アクセサリー",
      total_stock: 8,
      effective_stock: 8,
    }),
    createAsset({
      id: 9,
      name: "Apple MacBook Air 13",
      category: "パソコン",
      total_stock: 7,
      effective_stock: 7,
    }),
    createAsset({
      id: 10,
      name: "Surface Laptop 6",
      category: "パソコン",
      total_stock: 5,
      effective_stock: 5,
    }),
    createAsset({
      id: 11,
      name: "ThinkPad X1 Carbon",
      category: "パソコン",
      total_stock: 4,
      effective_stock: 4,
    }),
    createAsset({
      id: 12,
      name: "HP EliteBook 840",
      category: "パソコン",
      total_stock: 6,
      effective_stock: 6,
    }),
    createAsset({
      id: 13,
      name: "ASUS Zenbook 14",
      category: "パソコン",
      total_stock: 3,
      effective_stock: 3,
    }),
    createAsset({
      id: 14,
      name: "4K Display 32",
      category: "モニター",
      total_stock: 8,
      effective_stock: 8,
    }),
    createAsset({
      id: 15,
      name: "2K Portable Monitor",
      category: "モニター",
      total_stock: 5,
      effective_stock: 5,
    }),
    createAsset({
      id: 16,
      name: "液晶ディスプレイ 24インチ",
      category: "モニター",
      total_stock: 9,
      effective_stock: 9,
    }),
    createAsset({
      id: 17,
      name: "BenQ ScreenBar Halo",
      category: "周辺機器",
      total_stock: 4,
      effective_stock: 4,
    }),
    createAsset({
      id: 18,
      name: "モニターアーム シングル",
      category: "周辺機器",
      total_stock: 11,
      effective_stock: 11,
    }),
    createAsset({
      id: 19,
      name: "Logitech MX Keys",
      category: "キーボード",
      total_stock: 6,
      effective_stock: 6,
    }),
    createAsset({
      id: 20,
      name: "Keychron K3 Pro",
      category: "キーボード",
      total_stock: 0,
      effective_stock: 0,
    }),
  ].map((asset, index) => ({
    ...asset,
    created_at: `2026-07-${String(21 - index).padStart(2, "0")}T00:00:00.000Z`,
  }));
}

function mockFirstPageLoad() {
  mockInitialLoad({
    assets: createFirstPageAssets(),
    pageResponseOverrides: {
      filtered_item_count: 55,
      total_item_count: 55,
      total_item_stock: 342,
      total_effective_stock: 254,
      low_stock_item_count: 37,
      total_pages: 3,
    },
  });
}

// createPageResponse の概要
// MSW が返す 1ページ分の一覧レスポンスのベース
// 1. 一覧APIが返す 1ページ分のレスポンスを作る。
// 2. items に入れた備品データから、件数や在庫数の集計値をまとめる。
// 3. テストケースごとに、必要な項目だけ上書きできるようにしてある。
//
// コード解説
// - items: Asset[]
//   - 一覧に表示する備品の配列。
//   - これをもとに、件数や在庫数を計算する。
// - overrides: Partial<AssetPageResponse>
//   - AssetPageResponse の一部だけ渡してよい、という意味。
//   - page や total_pages など、必要な項目だけ差し替えられる。
// - ...overrides
//   - 標準のレスポンスに対して、渡された値を上書きする。
//   - たとえば page: 2 を渡すと、2ページ目のレスポンスにできる。
function createPageResponse(
  items: Asset[],
  overrides: Partial<AssetPageResponse> = {},
): AssetPageResponse {
  return {
    items,
    filtered_item_count: items.length,
    total_item_count: items.length,
    // reduce = 配列をまとめる（配列の中身を1つずつ見ながら、最後に1つの値にまとめる関数）
    // 最初の合計値を 0 から始める
    // items に入っている各備品の total_stock を合計する。
    // sum はこれまでの合計、asset は今見ている1件の備品。
    // つまり、一覧全体の総在庫数を計算している。
    total_item_stock: items.reduce((sum, asset) => sum + asset.total_stock, 0),
    total_effective_stock: items.reduce((sum, asset) => sum + asset.effective_stock, 0),
    // items の中から、有効在庫数が 5 以下の備品だけを取り出す。
    // filter は、条件に合うものだけを残すための関数。
    // その件数を length で数えて、要確認品目数にしている。
    // .lengthは改行しているが、JavaScript は、基本的には改行しても問題ない（return の場合は例外として改行するとundefiendが返されるのでNG）
    low_stock_item_count: items.filter((asset) => asset.effective_stock <= 5)
      .length,
    // 一覧APIレスポンスに含まれる現在ページ番号
    page: 1,
    page_size: 20,
    total_pages: 1,
    // ...overrides は、overrides オブジェクトの中身をここに展開する書き方。
    // この行より上に同じキーが定義されている場合は、overrides 側の値で上書きされる。
    // 例: 上に category: "映像機器" があり、overrides に category: "パソコン" がある場合、
    //     最終的な category は "パソコン" になる。
    // ... はスプレッド構文と呼ばれ、配列やオブジェクトの中身を展開する書き方。
    // 一方、関数の引数定義で使う場合:function foo(...args) {}は、レストパラメータと呼ぶことが多いです。
    ...overrides,
  };
}

// renderAssetList の概要
// 1. AssetListPage を、ルーティング込みでテストできる形で描画する。
// 2. 備品一覧画面だけでなく、備品貸出申請画面への遷移もテストできるようにする。
// 3. 初期表示だけでなく、画面遷移を含むテストで共通利用する。
//
// コード解説
// - initialEntries: Array<string | { pathname: string; state?: unknown }>
//   - MemoryRouter に渡す初期URLの一覧。
//    - 文字列でも、pathname と state を持つオブジェクトでも渡せる。
//    - state はオプションなので、必要なときだけ指定する。
//    - state?: unknown は、「何でも受け取れるけど、雑には使えないようにしておく」
//     - unknown にしておくと、うかつに中身を触れない
//     - そのまま使おうとすると TypeScript が型チェックで止める
//     - だから any より安全
//   = ["/"]
//    - 既定値の ["/"] は、最初に "/" から始めるという意味。
// - MemoryRouter
//   - React Router のテスト用ルーター。
//   - ブラウザの URL を使わず、メモリ上でルーティング状態を持つ。
// - <Routes> / <Route>
//   - "/" では AssetListPage を表示する。
//   - "/requests/:assetId" では AssetLoanRequestPage を表示する。
// - render(...)
//   - React Testing Library の描画関数。
//   - ルーティング込みの画面を jsdom 上に表示する。
function renderAssetList(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/"],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<AssetListPage />} path="/" />
        <Route element={<AssetLoanRequestPage />} path="/requests/:assetId" />
        <Route element={<h1>マイ貸出状況</h1>} path="/my-requests" />
      </Routes>
    </MemoryRouter>,
  );
}

// mockInitialLoad の概要
// 1. 備品一覧画面の初期表示で必要になる API 通信を、まとめて MSW でモックする
// 2. カテゴリ取得と一覧取得の2本の API を、テストケースごとに差し替えやすくする。
// 3. categories / assets / 集計値を必要に応じて上書きできるようにしている。
//
// コード解説
// - options: { categories?: string[]; assets?: Asset[]; pageResponseOverrides?: Partial<AssetPageResponse> } = {}
//   - テストごとに渡すモック用の設定。
//   - categories はカテゴリ一覧、assets は一覧APIで返す備品データ。
//   - pageResponseOverrides は一覧APIレスポンスの集計値などを差し替える設定。
//   - ?: なので、どれも省略できる。
//   - = {} は、何も渡さなかったときの初期値。
// - const { categories = ["映像機器", "PC"], assets = [createAsset()], pageResponseOverrides } = options;
//   - options から categories / assets / pageResponseOverrides を取り出す。
//   - ただし、options = {} のときは、分割代入で実質こうなります。
//    - categories = ["映像機器", "PC"];
//    - assets = [createAsset()];
//    - pageResponseOverrides = undefined;
//   - 何も指定しなくても、最低限の初期表示テストが動くようにするため
//   - 毎回 categories や assets を全部書かなくても、標準のモックデータでテストできるようにするため
//   - 004 / 006 / 008 のように、件数や集計値だけを差し替えたい場合は pageResponseOverrides を使う。
// - server.use(...)
//  - server.listen()は、MSW を有効にして通信を横取りできる状態にする
//  - server.use(...)は、MSW に、このテストで使うモック通信ルールを登録する
//   - ここで categories API と assets API の返答内容を決める。
// - http.get(`${API_BASE_URL}/api/assets/categories`, ...)
//   - カテゴリ一覧 API のモック。
//   - 第2引数の関数は、MSW では resolver（返答を作る関数）という役割。
//   - ここではリクエスト内容を見なくてもよいので、引数なしの () => ... で固定レスポンスを返す。
//   - 呼ばれたら、categories を JSON で返す。
//   - アロー関数は、 {} を使わない場合（複数行でない）、"return"を書かなくてもreturnされる。
// - http.get(`${API_BASE_URL}/api/assets`, ({ request }) => { ... })
//   - 一覧 API のモック。
//   - 第2引数の関数は、上と同じく MSW の resolver（返答を作る関数）。
//   - ここではリクエスト内容を確認したいので、MSW から渡される request を受け取る。
//   - ({ request }) は、MSW が渡す情報オブジェクトから request だけを取り出す分割代入。
//   - request は、実際に AssetListPage.tsx から送られた API 通信の情報。
//   - request.url からクエリパラメータを取り出して確認する。
// - const url = new URL(request.url);
//   - リクエストURLを分解して、page / category / q / sort を読めるようにする。
// - expect(...)
//   - 初期表示の一覧取得で、想定どおりのクエリが送られているかを確認する必要があるため、expectで検証をしている。
//   - ここでは page=1 で、category / q / sort が未指定であることを見ている。
// - HttpResponse.json(...)
//   - MSW が返す JSON レスポンスを作る。
//   - 成功時のレスポンス形式をテスト用に再現している。
//   - アロー関数は、 複数行の処理を書く場合は、{}で囲って"return"を書かなくてはならない。
function mockInitialLoad(
  options: {
    categories?: string[];
    assets?: Asset[];
    pageResponseOverrides?: Partial<AssetPageResponse>;
  } = {},
) {
  const {
    categories = ["映像機器", "PC"],
    assets = [createAsset()],
    pageResponseOverrides,
  } = options;

  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () =>
      HttpResponse.json({ success: true, data: categories, error: null }),
    ),
    http.get(`${API_BASE_URL}/api/assets`, ({ request }) => {
      const url = new URL(request.url);

      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("category")).toBeNull();
      expect(url.searchParams.get("q")).toBeNull();
      expect(url.searchParams.get("sort")).toBeNull();

      return HttpResponse.json({
        success: true,
        data: createPageResponse(assets, pageResponseOverrides),
        error: null,
      });
    }),
  );
}

function mockLoadingState() {
  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () =>
      HttpResponse.json({ success: true, data: [], error: null }),
    ),
    http.get(`${API_BASE_URL}/api/assets`, () => new Promise(() => undefined)),
  );
}

function mockCategoryApiError(status: number, message: string) {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () =>
      HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: "CATEGORY_LIST_FETCH_FAILED", message },
        },
        { status },
      ),
    ),
  );
}

function mockAssetListApiError(status: number, message: string) {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets`, () =>
      HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: "ASSET_LIST_FETCH_FAILED", message },
        },
        { status },
      ),
    ),
  );
}

function mockUnexpectedCategoryApiError() {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () => HttpResponse.error()),
  );
}

function mockInvalidCategoryApiResponse() {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () =>
      new HttpResponse("invalid json"),
    ),
  );
}

function mockUnexpectedAssetListApiError() {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets`, () => HttpResponse.error()),
  );
}

function mockInvalidAssetListApiResponse() {
  mockInitialLoad();
  server.use(
    http.get(`${API_BASE_URL}/api/assets`, () => new HttpResponse("invalid json")),
  );
}

function createCatalogPageResponse(
  items: Asset[],
  overrides: Partial<AssetPageResponse> = {},
) {
  return createPageResponse(items, {
    filtered_item_count: 55,
    total_item_count: 55,
    total_item_stock: 342,
    total_effective_stock: 254,
    low_stock_item_count: 37,
    total_pages: 3,
    ...overrides,
  });
}

function createSecondPageAssets(): Asset[] {
  return Array.from({ length: 20 }, (_, index) => {
    const itemNumber = index + 21;

    return createAsset({
      id: itemNumber,
      name:
        itemNumber === 21
          ? "日本語配列キーボード"
          : itemNumber === 40
            ? "延長電源タップ"
            : `備品${itemNumber}`,
      category: itemNumber === 40 ? "電源機器" : "周辺機器",
      effective_stock: 6,
      total_stock: 6,
    });
  });
}

function createThirdPageAssets(): Asset[] {
  return Array.from({ length: 15 }, (_, index) => {
    const itemNumber = index + 41;

    return createAsset({
      id: itemNumber,
      name:
        itemNumber === 41
          ? "iPad Pro 11"
          : itemNumber === 55
            ? "Blue Yeti Microphone"
            : `備品${itemNumber}`,
      category: itemNumber === 41 ? "タブレット" : "オーディオ",
      effective_stock: 6,
      total_stock: 6,
    });
  });
}

function mockCatalogLoad() {
  const firstPageAssets = createFirstPageAssets();
  const secondPageAssets = createSecondPageAssets();
  const thirdPageAssets = createThirdPageAssets();
  const accessoryAssets = [
    createAsset({
      id: 58,
      name: "USB-C Hub",
      category: "アクセサリー",
      created_at: "2026-07-04T00:00:00.000Z",
    }),
    createAsset({
      id: 57,
      name: "Laptop Stand",
      category: "アクセサリー",
      created_at: "2026-07-03T00:00:00.000Z",
    }),
    createAsset({
      id: 56,
      name: "Anker 737 Power Bank",
      category: "アクセサリー",
      created_at: "2026-07-02T00:00:00.000Z",
    }),
    createAsset({
      id: 55,
      name: "Cable Organizer",
      category: "アクセサリー",
      created_at: "2026-07-02T00:00:00.000Z",
    }),
  ];
  const macAssets = [
    createAsset({
      id: 59,
      name: 'MacBook Pro 14"',
      category: "パソコン",
      created_at: "2026-07-04T00:00:00.000Z",
    }),
    createAsset({
      id: 58,
      name: "Apple MacBook Air 13",
      category: "パソコン",
      created_at: "2026-07-03T00:00:00.000Z",
    }),
  ];
  const pcSuAssets = [
    createAsset({
      id: 60,
      name: "Surface Laptop 6",
      category: "パソコン",
      created_at: "2026-07-04T00:00:00.000Z",
    }),
    createAsset({
      id: 59,
      name: "Surface Pro 10",
      category: "パソコン",
      created_at: "2026-07-03T00:00:00.000Z",
    }),
  ];
  const networkLanAssets = [
    createAsset({ id: 61, name: "LANケーブル 5m", category: "ネットワーク" }),
  ];
  const nameAscendingAssets = [
    createAsset({ id: 62, name: "100W GaN Charger", category: "電源機器" }),
    createAsset({ id: 63, name: 'MacBook Pro 14"', category: "パソコン" }),
  ];
  const nameDescendingAssets = [
    createAsset({ id: 64, name: "静音ワイヤレスマウス", category: "マウス" }),
    createAsset({ id: 65, name: "100W GaN Charger", category: "電源機器" }),
  ];

  server.use(
    http.get(`${API_BASE_URL}/api/assets/categories`, () =>
      HttpResponse.json({ success: true, data: CATEGORY_OPTIONS, error: null }),
    ),
    http.get(`${API_BASE_URL}/api/assets`, ({ request }) => {
      const url = new URL(request.url);
      const page = url.searchParams.get("page") ?? "1";
      const category = url.searchParams.get("category");
      const query = url.searchParams.get("q");
      const sort = url.searchParams.get("sort");

      if (category === "アクセサリー") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(accessoryAssets, {
            filtered_item_count: 4,
            page: 1,
            total_pages: 1,
          }),
          error: null,
        });
      }

      if (category === "ネットワーク" && query === "LAN") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(networkLanAssets, {
            filtered_item_count: 1,
            page: 1,
            total_pages: 1,
          }),
          error: null,
        });
      }

      if (category === "パソコン" && query === "su") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(pcSuAssets, {
            filtered_item_count: 2,
            page: 1,
            total_pages: 1,
          }),
          error: null,
        });
      }

      if (query === "mac") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(macAssets, {
            filtered_item_count: 2,
            page: 1,
            total_pages: 1,
          }),
          error: null,
        });
      }

      if (query === "存在しない備品名") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse([], {
            filtered_item_count: 0,
            page: 1,
            total_pages: 1,
          }),
          error: null,
        });
      }

      if (sort === "name_asc") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(nameAscendingAssets, {
            page: 1,
          }),
          error: null,
        });
      }

      if (sort === "name_desc") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(nameDescendingAssets, {
            page: 1,
          }),
          error: null,
        });
      }

      if (page === "2") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(secondPageAssets, {
            page: 2,
          }),
          error: null,
        });
      }

      if (page === "3") {
        return HttpResponse.json({
          success: true,
          data: createCatalogPageResponse(thirdPageAssets, {
            page: 3,
          }),
          error: null,
        });
      }

      return HttpResponse.json({
        success: true,
        data: createCatalogPageResponse(firstPageAssets, {
          page: 1,
        }),
        error: null,
      });
    }),
  );
}

function getTableRowByAssetName(assetName: string): HTMLTableRowElement {
  const row = screen.getByText(assetName).closest("tr");

  if (row === null) {
    throw new Error(`${assetName} のテーブル行が見つかりませんでした。`);
  }

  return row;
}

function getTableBodyRows(): HTMLTableRowElement[] {
  const table = screen.getByRole("table");

  return within(table).getAllByRole("row").slice(1) as HTMLTableRowElement[];
}

function expectTableBodyAssetOrder(assetNames: string[]) {
  expect(
    getTableBodyRows().map(
      (row) => within(row).getAllByRole("cell")[1].textContent?.trim(),
    ),
  ).toEqual(assetNames);
}

function expectAssetRowNumber(assetName: string, itemNumber: number) {
  expect(
    within(getTableRowByAssetName(assetName)).getAllByRole("cell")[0],
  ).toHaveTextContent(new RegExp(`^${itemNumber}$`));
}

// 備品一覧画面の初期表示で、画面上の主要な見え方を確認する
describe("AssetListPage", () => {
  it("001: AssetFlow が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect(await screen.findByText("AssetFlow")).toBeInTheDocument();
  });

  it("002: 備品一覧 が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // 備品一覧は h1 タグなので、heading ロールとして表示されていることを確認する。
    expect(
      await screen.findByRole("heading", { name: "備品一覧" }),
    ).toBeInTheDocument();
  });

  it("003: 取扱品目数 という文字列が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect(await screen.findByText("取扱品目数")).toBeInTheDocument();
  });

  it("004: 55 が表示されている", async () => {
    // mockInitialLoad に渡している引数は、1つのオブジェクトです。
    // キー: pageResponseOverrides
    // 値: { total_item_count: 55 }
    mockInitialLoad({
      pageResponseOverrides: {
        total_item_count: 55,
      },
    });
    renderAssetList();

    expect(await screen.findByText("55")).toBeInTheDocument();
  });

  it("005: 総在庫数 という文字列が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect(await screen.findByText("総在庫数")).toBeInTheDocument();
  });

  it("006: 342 が表示されている", async () => {
    mockInitialLoad({
      pageResponseOverrides: {
        total_item_stock: 342,
      },
    });
    renderAssetList();

    expect(await screen.findByText("342")).toBeInTheDocument();
  });

  it("007: 有効在庫数 という文字列が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect((await screen.findAllByText("有効在庫数")).length).toBeGreaterThanOrEqual(2);
  });

  it("008: 254 が表示されている", async () => {
    mockInitialLoad({
      pageResponseOverrides: {
        total_effective_stock: 254,
      },
    });
    renderAssetList();

    expect(await screen.findByText("254")).toBeInTheDocument();
  });

  it("009: 要確認品目数 という文字列が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect(await screen.findByText("要確認品目数")).toBeInTheDocument();
  });

  it("010: 37 が表示されている", async () => {
    mockInitialLoad({
      pageResponseOverrides: {
        low_stock_item_count: 37,
      },
    });
    renderAssetList();

    expect(await screen.findByText("37")).toBeInTheDocument();
  });

  it("011: マイ貸出状況ボタンが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // マイ貸出状況は、画面上ではボタンのように見える。
    // ただし実装は <button> ではなく、React Router の <Link>。
    // <Link> は最終的に <a href="..."> として描画されるため、
    // アクセシビリティ上の役割は button ではなく link になる。
    // そのため findByRole の第1引数には "button" ではなく "link" を指定する。
    expect(
      await screen.findByRole("link", { name: "マイ貸出状況" }),
    ).toBeInTheDocument();
  });

  it("012: カテゴリプルダウンが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // <select> はアクセシビリティ上 combobox ロールとして扱われる。
    // そのため、文字列だけではなく「プルダウンとして存在すること」を確認する。
    expect(
      // "カテゴリで絞り込み" は select の aria-label。
      // 画面表示ではなく、アクセシビリティ上の名前でプルダウンを探している。
      await screen.findByRole("combobox", { name: "カテゴリで絞り込み" }),
    ).toBeInTheDocument();
  });

  it("013: すべてのカテゴリ が選択されている", async () => {
    mockInitialLoad();
    renderAssetList();

    const categorySelect = await screen.findByRole("combobox", {
      name: "カテゴリで絞り込み",
    });

    expect(categorySelect).toHaveDisplayValue("すべてのカテゴリ");
  });

  it("014: カテゴリプルダウンのアイテムがこの順で表示されている", async () => {
    mockInitialLoad({
      categories: CATEGORY_OPTIONS,
    });
    renderAssetList();

    // option: プルダウンの中の選択肢;
    // combobox: プルダウン本体;
    // findByRole: 非同期で表示されるまで待って探す;
    // getAllByRole: 今あるものをすぐ取得する;

    // カテゴリ一覧はAPI取得後に追加される。
    // そのため、最後のカテゴリが表示されるまで待ってから全optionの並びを確認する。
    await screen.findByRole("option", { name: "電源機器" });
    const options = screen.getAllByRole("option");

    // ...CATEGORY_OPTIONS は、CATEGORY_OPTIONS 配列の中身をここに展開する書き方。
    // 例: ["A", "B"] なら、"すべてのカテゴリ", "A", "B" のように並ぶ。
    // ... を付けないと、配列そのものが1要素として入ってしまう。
    // ... はスプレッド構文と呼ばれ、配列やオブジェクトの中身を展開する書き方。
    // 一方、関数の引数定義で使う場合:function foo(...args) {}は、レストパラメータと呼ぶことが多いです。
    expect(options.map((option) => option.textContent)).toEqual([
      "すべてのカテゴリ",
      ...CATEGORY_OPTIONS,
    ]);
  });

  it("015: 備品名検索テキストボックスが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // input type="search" は、アクセシビリティ上 searchbox ロールとして扱われる。
    // そのため、テキストボックスの中身ではなく「検索入力欄そのもの」を確認している。
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  });

  it("016: 虫眼鏡アイコンが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // 虫眼鏡アイコンは装飾用のSVGなので、roleや表示文字では探しづらい。
    // ここではテスト用の data-testid を使って、アイコン要素が描画されていることを確認する。
    expect(await screen.findByTestId("asset-search-icon")).toBeInTheDocument();
  });

  it("017: 備品名で検索 というプレースホルダーが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // プレースホルダーは入力前にテキストボックス内へ薄く表示される案内文。
    // findByPlaceholderText で placeholder="備品名で検索" の入力欄を確認する。
    expect(
      await screen.findByPlaceholderText("備品名で検索"),
    ).toBeInTheDocument();
  });

  it("018: クリアボタンが表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    // ボタンとリンクの使い分けメモ
    // - 別ページ・別URLへ移動するものは link（例: マイ貸出状況）
    // - 同じ画面内で何か処理をするものは button（例: クリア）
    // - 見た目がボタン風でも、実装が <Link> なら findByRole では "link" で探す
    // - 実装が <button> なら findByRole では "button" で探す
    expect(
      await screen.findByRole("button", { name: "クリア" }),
    ).toBeInTheDocument();
  });

  it("019: 一覧表が表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("020: テーブルヘッダーがこの順で表示されている", async () => {
    mockInitialLoad();
    renderAssetList();

    const table = await screen.findByRole("table");
    const columnHeaders = within(table).getAllByRole("columnheader");

    // まず、テーブルヘッダーの表示文字が左から期待順に並んでいることを確認する。
    // 備品名列は、表示文字「備品名」と並び替えアイコン「↕」が一体で textContent に入る。
    expect(columnHeaders.map((header) => header.textContent?.trim())).toEqual([
      "No.",
      "備品名↕",
      "カテゴリ",
      "有効在庫数",
      "状態",
      "操作",
    ]);

    // 備品名↕ は見た目はヘッダーラベルだが、実装はクリック可能な <button>。
    // そのため、表示文字だけでなく button ロールとして存在することも確認する。
    expect(
      within(columnHeaders[1]).getByRole("button", { name: "備品名↕" }),
    ).toBeInTheDocument();
  });

  it("021: 1行目の備品データが表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText('MacBook Pro 14"');
    const row = getTableRowByAssetName('MacBook Pro 14"');

    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(within(row).getByText('MacBook Pro 14"')).toBeInTheDocument();
    expect(within(row).getByText("パソコン")).toBeInTheDocument();
    expect(within(row).getByText("6")).toHaveClass("text-slate-900");
    expect(within(row).getByText("貸出可能")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "貸出申請" })).toHaveClass(
      "opacity-0",
    );
  });

  it("022: 10行目の備品データが表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("Surface Laptop 6");
    const row = getTableRowByAssetName("Surface Laptop 6");

    expect(within(row).getByText("10")).toBeInTheDocument();
    expect(within(row).getByText("Surface Laptop 6")).toBeInTheDocument();
    expect(within(row).getByText("パソコン")).toBeInTheDocument();
    expect(within(row).getByText("5")).toHaveClass("text-red-600");
    expect(within(row).getByText("貸出可能")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "貸出申請" })).toHaveClass(
      "opacity-0",
    );
  });

  it("023: 20行目の備品データが表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("Keychron K3 Pro");
    const row = getTableRowByAssetName("Keychron K3 Pro");

    expect(within(row).getByText("20")).toBeInTheDocument();
    expect(within(row).getByText("Keychron K3 Pro")).toBeInTheDocument();
    expect(within(row).getByText("キーボード")).toBeInTheDocument();
    expect(within(row).getByText("0")).toHaveClass("text-red-700");
    expect(within(row).getByText("予約満了")).toBeInTheDocument();
    expect(
      within(row).queryByRole("link", { name: "貸出申請" }),
    ).not.toBeInTheDocument();
  });

  it("024: 1 - 20 / 55 が表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    expect(await screen.findByText("1 - 20 / 55")).toBeInTheDocument();
  });

  it("025: 非活性の前のページボタンが表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("1 - 20 / 55");
    // "前のページ" は button の aria-label。
    const previousPageButton = screen.getByRole("button", {
      name: "前のページ",
    });

    expect(previousPageButton).toBeDisabled();
  });

  it("026: 活性で背景色が緑色の 1 が表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("1 - 20 / 55");
    const pageOneButton = screen.getByRole("button", { name: "1" });

    expect(pageOneButton).toBeEnabled();
    expect(pageOneButton).toHaveClass("bg-teal-700");
  });

  it("027: 活性で背景色が白色の 2 が表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("1 - 20 / 55");
    const pageTwoButton = screen.getByRole("button", { name: "2" });

    expect(pageTwoButton).toBeEnabled();
    expect(pageTwoButton).toHaveClass("bg-white");
  });

  it("028: 活性で背景色が白色の 3 が表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("1 - 20 / 55");
    const pageThreeButton = screen.getByRole("button", { name: "3" });

    expect(pageThreeButton).toBeEnabled();
    expect(pageThreeButton).toHaveClass("bg-white");
  });

  it("029: 活性の次のページボタンが表示されている", async () => {
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText("1 - 20 / 55");
    // "次のページ は button の aria-label。
    const nextPageButton = screen.getByRole("button", {
      name: "次のページ",
    });

    expect(nextPageButton).toBeEnabled();
  });

  it("030: ローディング状態が表示されている", async () => {
    mockLoadingState();
    renderAssetList();

    expect(await screen.findByText("読み込み中...")).toBeInTheDocument();
  });

  it("031: マイ貸出状況の画面に遷移する", async () => {
    const user = userEvent.setup();
    mockFirstPageLoad();
    renderAssetList();

    await user.click(await screen.findByRole("link", { name: "マイ貸出状況" }));

    expect(
      await screen.findByRole("heading", { name: "マイ貸出状況" }),
    ).toBeInTheDocument();
  });

  it("032: 貸出申請リンクを押すと備品貸出申請に遷移する", async () => {
    const user = userEvent.setup();
    mockFirstPageLoad();
    renderAssetList();

    await screen.findByText('MacBook Pro 14"');
    const row = getTableRowByAssetName('MacBook Pro 14"');
    await user.click(within(row).getByRole("link", { name: "貸出申請" }));

    expect(
      await screen.findByRole("heading", { name: "備品貸出申請" }),
    ).toBeInTheDocument();
  });

  it("033: カテゴリでアクセサリーを選択すると該当する備品4件が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "カテゴリで絞り込み" }),
      "アクセサリー",
    );

    expect(await screen.findByText("1 - 4 / 4")).toBeInTheDocument();
    expect(screen.getByText("USB-C Hub")).toBeInTheDocument();
    expect(screen.getByText("Laptop Stand")).toBeInTheDocument();
    expect(screen.getByText("Anker 737 Power Bank")).toBeInTheDocument();
    expect(screen.getByText("Cable Organizer")).toBeInTheDocument();
    expectTableBodyAssetOrder([
      "USB-C Hub",
      "Laptop Stand",
      "Anker 737 Power Bank",
      "Cable Organizer",
    ]);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("034: 小文字のmacで検索すると一致する備品2件が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.type(await screen.findByRole("searchbox"), "mac");

    expect(await screen.findByText("1 - 2 / 2")).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 14"')).toBeInTheDocument();
    expect(screen.getByText("Apple MacBook Air 13")).toBeInTheDocument();
    expectTableBodyAssetOrder(['MacBook Pro 14"', "Apple MacBook Air 13"]);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("035: 存在しない備品名で検索すると空状態が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.type(await screen.findByRole("searchbox"), "存在しない備品名");

    expect(
      await screen.findByText(
        "該当する備品が見つかりませんでした。条件を変えて検索してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("0 - 0 / 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("036: 備品名検索は60文字までに制限される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    const searchInput = await screen.findByRole("searchbox");
    await user.type(searchInput, "あ".repeat(61));

    expect(searchInput).toHaveValue("あ".repeat(60));
  });

  it("037: カテゴリと備品名を指定すると両方に一致する備品2件が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "カテゴリで絞り込み" }),
      "パソコン",
    );
    await user.type(screen.getByRole("searchbox"), "su");

    expect(await screen.findByText("1 - 2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Surface Laptop 6")).toBeInTheDocument();
    expect(screen.getByText("Surface Pro 10")).toBeInTheDocument();
    expectTableBodyAssetOrder(["Surface Laptop 6", "Surface Pro 10"]);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("038: クリアを押すと検索条件と一覧が初期表示に戻る", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    const categorySelect = await screen.findByRole("combobox", {
      name: "カテゴリで絞り込み",
    });
    const searchInput = screen.getByRole("searchbox");
    await user.selectOptions(categorySelect, "ネットワーク");
    await user.type(searchInput, "LAN");
    expect(await screen.findByText("1 - 1 / 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "クリア" }));

    expect(await screen.findByText("1 - 20 / 55")).toBeInTheDocument();
    expect(categorySelect).toHaveDisplayValue("すべてのカテゴリ");
    expect(searchInput).toHaveValue("");
    expect(screen.getByText('MacBook Pro 14"')).toBeInTheDocument();
    expect(screen.getByText("Keychron K3 Pro")).toBeInTheDocument();
    expectTableBodyAssetOrder([
      'MacBook Pro 14"',
      'Dell 27" 4K Monitor',
      "HHKB Studio",
      "Magic Mouse",
      "Herman Miller Aeron",
      "Jabra Speak2 75",
      "Sony WH-1000XM5",
      "Anker 737 Power Bank",
      "Apple MacBook Air 13",
      "Surface Laptop 6",
      "ThinkPad X1 Carbon",
      "HP EliteBook 840",
      "ASUS Zenbook 14",
      "4K Display 32",
      "2K Portable Monitor",
      "液晶ディスプレイ 24インチ",
      "BenQ ScreenBar Halo",
      "モニターアーム シングル",
      "Logitech MX Keys",
      "Keychron K3 Pro",
    ]);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("039: 備品名並び替えボタンで昇順と降順に切り替わる", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    const sortButton = await screen.findByRole("button", { name: "備品名↕" });
    await user.click(sortButton);
    expect(await screen.findByText("100W GaN Charger")).toBeInTheDocument();
    expectTableBodyAssetOrder(['100W GaN Charger', 'MacBook Pro 14"']);
    expectAssetRowNumber("100W GaN Charger", 1);

    await user.click(screen.getByRole("button", { name: "備品名▲" }));
    expect(await screen.findByText("静音ワイヤレスマウス")).toBeInTheDocument();
    expectTableBodyAssetOrder(["静音ワイヤレスマウス", "100W GaN Charger"]);
    expectAssetRowNumber("静音ワイヤレスマウス", 1);
  });

  it("040: ページングの2を押すと2ページ目が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.click(await screen.findByRole("button", { name: "2" }));

    expect(await screen.findByText("日本語配列キーボード")).toBeInTheDocument();
    expect(screen.getByText("21 - 40 / 55")).toBeInTheDocument();
    expect(screen.getByText("延長電源タップ")).toBeInTheDocument();
    expectAssetRowNumber("日本語配列キーボード", 21);
    expectAssetRowNumber("延長電源タップ", 40);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("041: ページングの3を押すと3ページ目が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.click(await screen.findByRole("button", { name: "3" }));

    expect(await screen.findByText("41 - 55 / 55")).toBeInTheDocument();
    expect(screen.getByText("iPad Pro 11")).toBeInTheDocument();
    expect(screen.getByText("Blue Yeti Microphone")).toBeInTheDocument();
    expectAssetRowNumber("iPad Pro 11", 41);
    expectAssetRowNumber("Blue Yeti Microphone", 55);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("042: 3ページ目からページングの1を押すと1ページ目が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.click(await screen.findByRole("button", { name: "3" }));
    expect(await screen.findByText("41 - 55 / 55")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "1" }));

    expect(await screen.findByText("1 - 20 / 55")).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 14"')).toBeInTheDocument();
    expect(screen.getByText("Keychron K3 Pro")).toBeInTheDocument();
    expectAssetRowNumber('MacBook Pro 14"', 1);
    expectAssetRowNumber("Keychron K3 Pro", 20);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("043: 2ページ目で前のページを押すと1ページ目が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.click(await screen.findByRole("button", { name: "2" }));
    expect(await screen.findByText("21 - 40 / 55")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "前のページ" }));

    expect(await screen.findByText("1 - 20 / 55")).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 14"')).toBeInTheDocument();
    expect(screen.getByText("Keychron K3 Pro")).toBeInTheDocument();
    expectAssetRowNumber('MacBook Pro 14"', 1);
    expectAssetRowNumber("Keychron K3 Pro", 20);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("044: 2ページ目で次のページを押すと3ページ目が表示される", async () => {
    const user = userEvent.setup();
    mockCatalogLoad();
    renderAssetList();

    await user.click(await screen.findByRole("button", { name: "2" }));
    expect(await screen.findByText("21 - 40 / 55")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次のページ" }));

    expect(await screen.findByText("41 - 55 / 55")).toBeInTheDocument();
    expect(screen.getByText("iPad Pro 11")).toBeInTheDocument();
    expect(screen.getByText("Blue Yeti Microphone")).toBeInTheDocument();
    expectAssetRowNumber("iPad Pro 11", 41);
    expectAssetRowNumber("Blue Yeti Microphone", 55);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "2" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("bg-teal-700");
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("045: 申請IDを持って戻った場合は申請受付トーストが表示される", async () => {
    mockFirstPageLoad();
    renderAssetList([{ pathname: "/", state: { assetLoanRequestId: 123 } }]);

    expect(
      await screen.findByText("✅ 申請を受け付けました。 申請ID: 123"),
    ).toBeInTheDocument();
  });

  it("046: 申請せずに戻った場合は申請受付トーストが表示されない", async () => {
    mockFirstPageLoad();
    renderAssetList([{ pathname: "/", state: null }]);

    await screen.findByRole("heading", { name: "備品一覧" });

    expect(
      screen.queryByText(/申請を受け付けました。 申請ID:/),
    ).not.toBeInTheDocument();
  });

  it("047: カテゴリ一覧APIが500エラーの場合はエラーメッセージを表示する", async () => {
    mockCategoryApiError(
      500,
      "サーバーエラーのため、カテゴリ一覧の取得に失敗しました。",
    );
    renderAssetList();

    expect(
      await screen.findByText(
        "サーバーエラーのため、カテゴリ一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("048: カテゴリ一覧APIが503エラーの場合はエラーメッセージを表示する", async () => {
    mockCategoryApiError(
      503,
      "サービスが一時的に利用できないため、カテゴリ一覧の取得に失敗しました。",
    );
    renderAssetList();

    expect(
      await screen.findByText(
        "サービスが一時的に利用できないため、カテゴリ一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("049: カテゴリ一覧APIのレスポンス形式が異常な場合はエラーメッセージを表示する", async () => {
    mockInvalidCategoryApiResponse();
    renderAssetList();

    expect(
      await screen.findByText("APIレスポンスの読み込みに失敗しました。"),
    ).toBeInTheDocument();
  });

  it("050: カテゴリ一覧APIが想定外エラーの場合は救済メッセージを表示する", async () => {
    mockUnexpectedCategoryApiError();
    renderAssetList();

    expect(
      await screen.findByText(
        "予期しないエラーが発生したため、カテゴリ一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("051: 備品一覧APIが500エラーの場合はエラーメッセージを表示する", async () => {
    mockAssetListApiError(
      500,
      "サーバーエラーのため、備品一覧の取得に失敗しました。",
    );
    renderAssetList();

    expect(
      await screen.findByText(
        "サーバーエラーのため、備品一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("052: 備品一覧APIが503エラーの場合はエラーメッセージを表示する", async () => {
    mockAssetListApiError(
      503,
      "サービスが一時的に利用できないため、備品一覧の取得に失敗しました。",
    );
    renderAssetList();

    expect(
      await screen.findByText(
        "サービスが一時的に利用できないため、備品一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("053: 備品一覧APIが504エラーの場合はエラーメッセージを表示する", async () => {
    mockAssetListApiError(
      504,
      "タイムアウトが発生したため、備品一覧の取得に失敗しました。",
    );
    renderAssetList();

    expect(
      await screen.findByText(
        "タイムアウトが発生したため、備品一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });

  it("054: 備品一覧APIのレスポンス形式が異常な場合はエラーメッセージを表示する", async () => {
    mockInvalidAssetListApiResponse();
    renderAssetList();

    expect(
      await screen.findByText("APIレスポンスの読み込みに失敗しました。"),
    ).toBeInTheDocument();
  });

  it("055: 備品一覧APIが想定外エラーの場合は救済メッセージを表示する", async () => {
    mockUnexpectedAssetListApiError();
    renderAssetList();

    expect(
      await screen.findByText(
        "予期しないエラーが発生したため、備品一覧の取得に失敗しました。",
      ),
    ).toBeInTheDocument();
  });
});
