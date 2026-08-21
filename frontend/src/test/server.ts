import { setupServer } from "msw/node";

// テスト中のHTTP通信を横取りする、MSWの仮想サーバーを作る。
export const server = setupServer();
