import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(here, "..", "migrations"));
  return {
    plugins: [
      cloudflareTest({
        main: path.join(here, "src", "index.ts"),
        miniflare: {
          compatibilityDate: "2026-11-23",
          d1Databases: ["DB"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            SECRET_KEY: "test-secret-only-should-be-at-least-thirty-two-characters",
            INITIAL_ADMIN_EMAIL: "admin@example.com",
            INITIAL_ADMIN_MOBILE: "+919999999999",
            INITIAL_ADMIN_PASSWORD: "AdminPass123!",
            INITIAL_STAFF_PASSWORD: "FixtureStaffPass123!",
          },
        },
      }),
    ],
    test: { include: ["worker/test/**/*.test.ts"], root: path.join(here, ".."), testTimeout: 60000, hookTimeout: 120000 },
  };
});
