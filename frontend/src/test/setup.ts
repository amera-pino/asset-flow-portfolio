import "@testing-library/jest-dom/vitest";

import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./server";

// テスト全体の前処理。
beforeAll(() => {
  // jsdom にはない window.scrollTo を、テストで使えるように差し替える。
  // テストでは本物のブラウザを使わず、jsdom という仮の画面環境で動かす。
  // そのため、画面をスクロールする window.scrollTo は最初から用意されていない。
  // ここでは「スクロールしたことにするだけ」のダミー関数を入れて、テストが止まらないようにしている。
  Object.defineProperty(window, "scrollTo", {
    value: vi.fn(),
    writable: true,
  });

  // 1. server.listen() で MSW を起動する。
  // 2. テスト中の通信を MSW が横取りできる状態にする。
  // 3. http.get() などで書いたモックレスポンスがあれば、それを返す。
  // 4. 想定していない API 通信が来たら、onUnhandledRequest: "error" により見逃さず失敗させる。
  // listen の意味を一言でいうと、MSW の監視を開始する、ということ。
  server.listen({ onUnhandledRequest: "error" });
});

// 各テストが終わるたびに、通信のモック設定を初期状態に戻す。
// 例:
// 1. テストAの中で server.use(http.get(...)) を追加する。
// 2. テストAがそのモックを使ってAPI通信を確認する。
// 3. テストAが終わる。
// 4. afterEach で server.resetHandlers() が呼ばれる。
// 5. そのテストで追加したモック設定が消え、次のテストはまっさらな状態から始まる。
// こうしておくと、1つ前のテストで使ったモックが次のテストに残らない。
// テスト同士が干渉しないようにするための片付け処理。
afterEach(() => {
  server.resetHandlers();
});

// すべてのテストが終わったら、MSWを停止する。
afterAll(() => {
  server.close();
});
