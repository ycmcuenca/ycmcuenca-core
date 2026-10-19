// The workspace's shared lint rules, plus the boundary that keeps this package
// a pure core: no Cloudflare, database or UI import may reach it (design D1).
import base from "@ycmcuenca/eslint-config/base";

export default [
  ...base,
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "cloudflare:*",
                "pg",
                "drizzle-orm",
                "svelte",
                "@sveltejs/*",
              ],
              message:
                "cms-core is pure TypeScript (design D1); adapters depend on it, never the other way round.",
            },
          ],
        },
      ],
    },
  },
];
