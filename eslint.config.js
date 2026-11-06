// Repository-wide lint entry point. ESLint 10 resolves the nearest
// eslint.config.* for every linted file, so files inside each app use the
// app's own config and this file covers the root files and config-less
// packages. See packages/eslint-config and design D3/D5 in
// openspec/changes/archive/2026-10-17-bootstrap-monorepo/design.md.
import { globalIgnores } from "eslint/config";
import base from "@ycmcuenca/eslint-config/base";

export default [
  ...base,
  // The owner's personal CV lives here during a job search and is kept out of
  // this public repository (see .gitignore). It is not project content, so its
  // own Markdown style must not fail the repository's lint.
  globalIgnores(["cv_resume/**"]),
];
