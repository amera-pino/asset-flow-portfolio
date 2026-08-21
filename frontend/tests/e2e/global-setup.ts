import type { FullConfig } from "@playwright/test";

import { ensureE2eServicesReady } from "./helpers/compose";

async function globalSetup(_config: FullConfig) {
  await ensureE2eServicesReady({
    startServices: process.env.PLAYWRIGHT_MANAGED_SERVICES !== "false",
  });
}

export default globalSetup;
