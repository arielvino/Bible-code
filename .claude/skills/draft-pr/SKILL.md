---
name: draft-pr
description: >-
  Open (or update) a draft pull request for the current branch, with this
  repo's preview-deploy link in the body. Use this automatically right after
  pushing work to a feature branch — in Bible-code, every branch is expected
  to have a draft PR; you do not need the user to ask first. Also use it when
  asked to "open a PR", "make a draft PR", "update the PR description", or
  "add the preview link to the PR".
---

# draft-pr

Opens a **draft** pull request for the branch you're on (or updates the
existing one), always including the freshly-computed preview-deploy link in the
body. In this repo a draft PR is the default state of any feature branch — open
it without waiting to be asked.

Repository: `arielvino/bible-code` (owner `arielvino`, repo `bible-code`).
Base branch: `main`.

## Steps

1. **Make sure the branch is pushed.** Push the current branch first so the
   PR has commits and the preview deploy fires:

   ```sh
   git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
   ```

   On network errors, retry up to 4 times with exponential backoff
   (2s, 4s, 8s, 16s). Never push to `main` — only the feature branch.

2. **Compute the preview URL mechanically** from the *current* branch (never
   copy one from the README, another PR, or another branch):

   ```sh
   echo "https://arielvino.github.io/Bible-code/preview/$(git rev-parse --abbrev-ref HEAD | sed 's/[^A-Za-z0-9._-]/-/g')/"
   ```

   The slug is the branch name with every character **outside**
   `[A-Za-z0-9._-]` replaced by `-` (so `/` → `-`; dots, underscores and
   existing hyphens are kept). This must match `deploy-preview.yml`
   byte-for-byte.

3. **Check for an existing PR for this branch** with
   `mcp__github__list_pull_requests` (`owner: arielvino`, `repo: bible-code`,
   `head: arielvino:<branch>`, `state: open`).

   - **If one exists:** update it with `mcp__github__update_pull_request`
     (refresh the title/body — make sure the preview link and footer are
     present and correct). Do **not** open a second PR.
   - **If none exists:** create one with `mcp__github__create_pull_request`
     using `draft: true`, `base: main`, `head: <branch>`.

4. **Write the body** so it includes, in this order:
   - A short summary of what changed.
   - A **Preview** section with the URL from step 2, e.g.
     `**Preview:** https://arielvino.github.io/Bible-code/preview/<slug>/`
   - The required footer (kept exactly):

     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     https://claude.ai/code/session_017xR52nSet826AdA25DEBeb
     ```

## Rules

- **Always a draft** (`draft: true`). Never open it ready-for-review — the user
  promotes it when ready.
- **One PR per branch.** Always check for an existing PR before creating.
- **Recompute the preview slug every time** from the current branch; don't
  reuse a previously written URL.
- After opening a fresh PR, offer to watch it for CI/review activity via
  `subscribe_pr_activity` (don't subscribe without the user's go-ahead).
