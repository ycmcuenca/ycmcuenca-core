// The workspace's shared lint rules, plus the Drizzle 0.45.4 boundary this
// package owns (design D1): only Drizzle's core SQL-like query builder, never
// the Relational Queries v1 API that Drizzle 1.0 removes. The restrictions
// apply to the package's source; the migration scripts talk to `pg` directly.
import base from "@ycmcuenca/eslint-config/base";

export default [
  ...base,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/test-helpers.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='query']",
          message:
            "Use Drizzle's core query builder (db.select, db.insert, db.update), never db.query (design D1, Q5).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm/relations",
              message:
                "Drizzle's Relational Queries v1 API is removed in 1.0 (design D1, Q5).",
            },
            {
              name: "drizzle-orm",
              importNames: ["relations"],
              message:
                "Drizzle's Relational Queries v1 API is removed in 1.0 (design D1, Q5).",
            },
          ],
        },
      ],
    },
  },
];
