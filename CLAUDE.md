# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

A static, client-side web app that searches for words hidden in Hebrew
corpora via **equidistant letter sequences (ELS)** — picking every _n_-th
letter — and estimates how statistically surprising each find is. The whole
thing is Hebrew/RTL and runs entirely in the browser; there is no backend.

Stack: **Vite + React 18**, plain JSX (no TypeScript), one CSS file. The
build emits a fully static bundle to `dist/`, served by GitHub Pages.

## Layout

| Path                  | What it is                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`          | Entry point; mounts `app.jsx` into `#root`. RTL, lang=he.                                                                         |
| `app.jsx`             | The entire React UI + search orchestration. One file, no components split out beyond what's here.                                 |
| `search-worker.js`    | Web Worker that does the actual ELS scan. Pure function: receives `{asked, text, firstSkip, lastSkip}`, returns a map of matches. |
| `styles.css`          | All styling.                                                                                                                      |
| `bible-text.js`       | Torah corpus: `window.BIBLE_TEXT` = one 304,948-char string of raw Hebrew letters.                                                |
| `bible-index.js`      | `window.BIBLE_INDEX` = array of `{pos, parasha, book, bookEn}` marking the 54 parasha boundaries.                                 |
| `hebrew-books/`       | Additional public-domain Hebrew corpora (see below).                                                                              |
| `scripts/extract.cjs` | One-off tool that converts Project Ben-Yehuda source texts into the raw-letter format. Not part of the build.                     |
| `.github/workflows/`  | CI (lint/format/build/audit) + GitHub Pages deploy.                                                                               |

## How the search works

1. The user's input is normalized: only the 22 Hebrew letters are kept and
   final forms are folded to their regular forms (`ך→כ`, `ם→מ`, `ן→נ`,
   `ף→פ`, `ץ→צ`). The corpora are stored in this same normalized,
   whitespace/nikud-free "Torah format", so a literal letter-by-letter
   comparison is all the search needs.
2. The skip range (`firstSkip`..`lastSkip`) is split across up to 8 Web
   Workers (`navigator.hardwareConcurrency`, capped at 8). Each worker scans
   its slice of skip values for the pattern `text[i + k*skip] === asked[k]`.
3. Results are merged on the main thread and rendered grouped by skip or by
   book/parasha. `lookupLocation` does a binary search over the index to
   label each position.
4. **Statistics** (`calcOptions`, `calcAttempts` in `app.jsx`): "rarity" is
   roughly `1 / P(word appears at one position)` from per-letter
   frequencies; "attempts" is the number of candidate ELS windows scanned.
   Expected occurrences ≈ attempts ÷ rarity — when that ratio is near 1 a
   find is statistically unremarkable. This framing is the point of the app.

### Corpus wiring (important gotcha)

Corpora are attached to `window` via **side-effect imports** at the top of
`app.jsx` (e.g. `import './bible-text.js'` sets `window.BIBLE_TEXT`). The
`CORPORA` object in `app.jsx` then reads them through getters.

A book under `hebrew-books/` is **only selectable in the app if it has
both `text.js` and `index.js` wrappers AND an entry in `CORPORA`**.
Currently only **Torah** and **zarathustra** are wired in. `don-quixote`
and `crime-and-punishment` have extracted data (`text.txt` / `index.json` /
`metadata.json`) but **no `.js` wrappers and no `CORPORA` entry**, so they
do not appear in the UI yet. To add one:

1. Generate `text.js` (assigning `window.<NAME>_TEXT = "..."`) and
   `index.js` (assigning `window.<NAME>_INDEX = [...]`) from the `.txt` /
   `.json` files, matching the zarathustra wrappers' shape.
2. Add the two side-effect imports in `app.jsx`.
3. Add an entry to `CORPORA` with `id`, `nameHe`, `searchVerb`, and
   `text`/`index` getters.

Note the `index.json` files use `chapter`/`section` keys, while the app's
`lookupLocation` and `ResultCard` expect `book`/`parasha`. The zarathustra
`index.js` was written with `book`/`parasha`/`bookEn` keys — keep that shape
when wiring a new book.

## Regenerating corpora

`scripts/extract.cjs` rebuilds the `hebrew-books/*` `.txt`/`.json` files from
Project Ben-Yehuda's public-domain dump. It is **not** run by the build or
CI — it's a manual reproduction step:

```sh
git clone --depth=1 https://github.com/projectbenyehuda/public_domain_dump /tmp/pby
npm run extract            # reads from $PBY_DIR (default /tmp/pby)
```

It does not emit the `.js` wrappers — those are produced/maintained
separately (see corpus wiring above). See `hebrew-books/README.md` for the
book list and provenance.

## Development

Requires Node 20+ (CI uses 22).

```sh
npm install
npm run dev           # dev server at http://localhost:5173
npm run build         # static bundle -> dist/
npm run preview       # serve the built dist/
npm run lint          # ESLint  (must pass CI)
npm run format        # Prettier --write
npm run format:check  # Prettier --check  (must pass CI)
```

### Conventions

- **Prettier + ESLint are enforced in CI** (`pr-checks.yml`). Run
  `npm run format` before committing or the Prettier job will fail. The
  large generated data files are excluded via `.prettierignore`.
- Prettier config: 4-space indent, single quotes (see `.prettierrc.json`).
- Vite `base` is relative (`'./'`) on purpose, so the same build works at
  the Pages project root and inside per-branch preview sub-paths without
  rebuilding — don't change it to an absolute base.
- The corpus string literals are huge; `chunkSizeWarningLimit` is raised in
  `vite.config.js` so the build log stays quiet. Expected, not a problem.
- All UI text is Hebrew and the layout is RTL.

## Deploy

GitHub Pages, served from the `gh-pages` branch (built, never hand-edited).

- **Push to `main`** → `deploy-main.yml` builds and rsyncs `dist/` to the
  `gh-pages` root, preserving the `preview/` folder.
- **Push to any other branch** → `deploy-preview.yml` builds and publishes
  to `gh-pages/preview/<slug>/` (slug = branch name with non-alphanumerics
  → `-`) and comments the preview URL on the PR.
- **PR closed** → `cleanup-preview.yml` removes that preview folder.

Live: <https://arielvino.github.io/Bible-code/>

### PR descriptions

**Always include the branch's preview link in the PR description.** The
preview URL is:

```
https://arielvino.github.io/Bible-code/preview/<slug>/
```

where `<slug>` is the branch name with every non-alphanumeric character
replaced by `-` (same slug `deploy-preview.yml` computes). The workflow also
auto-comments this URL on the PR, but it should be in the description too so
reviewers have it up front.
</content>
</invoke>
