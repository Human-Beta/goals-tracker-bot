# AGENTS.md

Instructions for Codex in this repository.

## 1) General rules

- Make only the minimum necessary changes and avoid unnecessary refactoring.
- Do not break bot-to-API integration contracts unless explicitly requested.
- After changes, provide a short summary of what was changed, which files were touched, and how it was verified.
- Use `gh` for GitHub-related operations (for example, creating/viewing PRs) when `gh` is available in the environment.
- If a PR was created as part of the task, always include a link to that PR in the final report.
- If the user asks to make changes, create a PR or push a commit to an existing PR unless the user explicitly asks not to create/update a PR.
- If the user says "good job Jarvis", treat it as task completion, squash commits into one when later commits are just fixes to earlier commits, then force-push the updated branch to the PR.

## 1.1) Business-context loading (required)

- Start business/domain tasks from `docs/business-spec/README.md`.
- Read only the domain files that match the current change scope (do not load the full fallback doc by default).
- Use `docs/project-business-spec.md` only as a fallback reference.

Business docs map for agents:

- `docs/business-spec/01-bot-role-and-boundaries.md`
- `docs/business-spec/02-auth-and-identity-propagation.md`
- `docs/business-spec/03-endpoints-mapping-mvp.md`
- `docs/business-spec/04-validation-and-user-messages.md`
- `docs/business-spec/05-metrics-rendering-rules.md`
- `docs/business-spec/06-failure-and-retry-policy.md`
- `docs/business-spec/07-post-mvp-roadmap.md`

## 1.2) Technical-context loading

- For implementation/runtime/infrastructure tasks, start from `docs/technical/README.md`.
- Keep technical implementation docs in `docs/technical/`.
- For API integration changes, validate contracts against:
  - `../goals-tracker-api/swagger.yaml`
  - `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`

## 2) Checks before each commit (required)

Before **every** commit creation, run checks that match this repository's CI.

Current temporary baseline (until CI is defined in this repo):

```bash
npm ci
npm run format
npm run typecheck
npm run lint
npm test
```

If scripts are not available yet, explicitly mention that in the final report and keep this section synchronized once CI is added.

## 3) Work format

- For each non-trivial task, provide a short action plan before making changes.
- If there are risks or assumptions, state them explicitly.
- If local checks could not be run, explicitly mention that in the final report.

## 4) Scope

- These rules apply to all new tasks in this repository.
