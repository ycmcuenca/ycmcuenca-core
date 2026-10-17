// Commit messages must be Conventional Commits: release-please computes
// versions and changelogs from them in ci-release-pipeline (design D8).
// `config-conventional` fixes the type list (feat, fix, docs, ...) but has no
// scope list, so any scope is fine (A3).
export default {
  extends: ["@commitlint/config-conventional"],
};
