# AGENTS.md

Telegram bot.

Instructions for contributors and coding agents in this repository.

## Repository Boundaries

- Edit this repository directly: `goals-tracker-bot`.
- Treat `goals-tracker-api` as reference-only in this workflow.
- Read related API files and docs via the relative path: `../goals-tracker-api`.

## Working Rules

- Make only the minimum necessary changes and avoid unnecessary refactoring.
- Preserve bot-to-API integration contracts unless a change is explicitly requested.
- For non-trivial tasks, provide a short action plan before making changes.
- Call out assumptions and risks when they affect implementation choices.
- After changes, provide a brief summary of what was changed, which files were touched, and how changes were verified.
- Use `gh` for GitHub-related operations (for example, creating/viewing PRs) when `gh` is available in the environment.
- If the user asks to make changes, create a PR or push a commit to an existing PR unless the user explicitly asks not to create/update a PR.
- If the user says "good job Jarvis", treat it as task completion, squash commits into one when later commits are just fixes to earlier commits, then force-push the updated branch to the PR.

## Scope

- These rules apply to all new tasks in this repository.
