import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const nodeMajorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true
  },
  test: {
    // Vitestはブラウザの代わりにjsdom上でReactを動かして確認する。
    environment: "jsdom",
    // testファイル内で describe / it / expect を毎回importしなくてよい設定。
    globals: true,
    // テスト開始前に、MSWなどの共通準備を読み込む。
    setupFiles: ["./src/test/setup.ts"],
    // Playwright E2E は専用 runner で実行するため、Vitest の収集対象から外す。
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    // Node 25 の Web Storage と jsdom の Web Storage が競合して出る警告を防ぐ。
    execArgv: nodeMajorVersion >= 25 ? ["--no-webstorage"] : []
  }
});
