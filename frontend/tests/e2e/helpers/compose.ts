import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const frontendBaseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
const backendBaseUrl = (process.env.PLAYWRIGHT_BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

type ExecFileError = Error & {
  stderr?: unknown;
  stdout?: unknown;
};

function formatCommandOutput(error: ExecFileError) {
  return [
    String(error.stdout ?? "").trim(),
    String(error.stderr ?? "").trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runDockerCompose(args: string[]) {
  try {
    await execFileAsync("docker", ["compose", ...args], {
      cwd: repoRoot,
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof Error) {
      const commandOutput = formatCommandOutput(error as ExecFileError);

      throw new Error(
        commandOutput
          ? `docker compose failed:\n${commandOutput}`
          : "docker compose failed.",
      );
    }

    throw error;
  }
}

export async function waitForHttpReady(
  url: string,
  options: {
    expectedStatus?: number;
    timeoutMs?: number;
  } = {},
) {
  const expectedStatus = options.expectedStatus ?? 200;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          url,
        ],
        {
          cwd: repoRoot,
          timeout: 10_000,
        },
      );
      const status = Number(stdout.trim());

      if (status === expectedStatus) {
        return;
      }

      lastError = new Error(
        `unexpected status ${status} for ${url}`,
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "");
  throw new Error(`Timed out waiting for ${url}. ${detail}`.trim());
}

type EnsureE2eServicesReadyOptions = {
  startServices?: boolean;
};

export async function ensureE2eServicesReady(
  options: EnsureE2eServicesReadyOptions = {},
) {
  if (options.startServices ?? true) {
    await runDockerCompose(["up", "-d", "db", "backend", "frontend"]);
  }

  await waitForHttpReady(`${backendBaseUrl}/health`);
  await waitForHttpReady(`${frontendBaseUrl}/login`);
}
