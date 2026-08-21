import { test as base } from "@playwright/test";

import { resetE2eDatabase } from "../helpers/reset";

type E2eFixtures = {
  resetDatabase: void;
};

export const test = base.extend<E2eFixtures>({
  resetDatabase: [
    async ({}, use) => {
      await resetE2eDatabase();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
