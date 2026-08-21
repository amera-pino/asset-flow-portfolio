import { runDockerCompose } from "./compose";

export async function resetE2eDatabase() {
  await runDockerCompose([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "assetflow",
    "-d",
    "assetflow",
    "-c",
    "TRUNCATE TABLE user_sessions, asset_loan_requests, assets, users RESTART IDENTITY CASCADE;",
  ]);

  await runDockerCompose([
    "exec",
    "-T",
    "-e",
    "PYTHONPATH=.",
    "backend",
    "python",
    "app/seeds.py",
  ]);

  await runDockerCompose([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "assetflow",
    "-d",
    "assetflow",
    "-c",
    [
      "SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);",
      "SELECT setval('assets_id_seq', COALESCE((SELECT MAX(id) FROM assets), 1), true);",
      "SELECT setval('asset_loan_requests_id_seq', COALESCE((SELECT MAX(id) FROM asset_loan_requests), 1), true);",
    ].join(" "),
  ]);
}
