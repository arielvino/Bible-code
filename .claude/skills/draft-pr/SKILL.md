---
name: draft-pr
description: >-
  Open (or update) a draft pull request for the current branch. Use this
  automatically right after pushing work to a feature branch — in Bible-code,
  every branch is expected to have a draft PR; you do not need the user to ask
  first. Also use it when asked to "open a PR", "make a draft PR", or "update
  the PR description".
---

# draft-pr

Opens a **draft** pull request for the branch you're on (or updates the
existing one). In this repo a draft PR is the default state of any feature
branch — open it without waiting to be asked.

Repository: `arielvino/bible-code` (owner `arielvino`, repo `bible-code`).
Base branch: `main`.

> **Don't add the preview link to the PR body.** `deploy-preview.yml` already
> posts it as a single sticky comment on every push (`gh pr comment
> --edit-last`), so the link is always present and byte-correct. Adding it to
> the description is redundant and risks a stale slug — let the bot own it.

## Steps

1. **Make sure the branch is pushed.** Push the current branch first so the
   PR has commits and the preview deploy fires:

   ```sh
   git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
   ```

   On network errors, retry up to 4 times with exponential backoff
   (2s, 4s, 8s, 16s). Never push to `main` — only the feature branch.

2. **Check for an existing PR for this branch** with
   `mcp__github__list_pull_requests` (`owner: arielvino`, `repo: bible-code`,
   `head: arielvino:<branch>`, `state: open`).

   - **If one exists:** update it with `mcp__github__update_pull_request`
     (refresh the title/body). Do **not** open a second PR.
   - **If none exists:** create one with `mcp__github__create_pull_request`
     using `draft: true`, `base: main`, `head: <branch>`.

3. **Write the body** so it includes, in this order:
   - A short summary of what changed.
   - The required footer (kept exactly):

     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     https://claude.ai/code/session_017xR52nSet826AdA25DEBeb
     ```

   Do **not** include the preview URL — the deploy workflow comments it.

## Rules

- **Always a draft** (`draft: true`). Never open it ready-for-review — the user
  promotes it when ready.
- **One PR per branch.** Always check for an existing PR before creating.
- **No preview link in the body.** The `deploy-preview.yml` workflow posts and
  maintains it as a sticky PR comment.
- After opening a fresh PR, offer to watch it for CI/review activity via
  `subscribe_pr_activity` (don't subscribe without the user's go-ahead).
