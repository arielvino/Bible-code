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

| Path                          | What it is                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                  | Entry point; mounts `app.jsx` into `#root`. RTL, lang=he.                                                                         |
| `app.jsx`                     | The entire React UI + search orchestration. One file, no components split out beyond what's here.                                 |
| `search-worker.js`            | Web Worker that does the actual ELS scan. Pure function: receives `{asked, text, firstSkip, lastSkip}`, returns a map of matches. |
| `styles.css`                  | All styling.                                                                                                                      |
| `bible-wlc-text.js`           | Torah corpus: `window.WLC_TEXT` = 304,850-char pure _ketiv_ consonantal text of the Leningrad Codex (OpenScriptures/morphhb).     |
| `bible-wlc-index.js`          | `window.WLC_INDEX` = the 54 parasha boundaries for the WLC edition.                                                               |
| `bible-wlc-verse-index.js`    | `window.WLC_VERSE_INDEX` = `{pos, perek, pasuk}` for all 5,846 WLC verses (standard ta'am-tachton division).                      |
| `hebrew-books/`               | Additional public-domain Hebrew corpora (see below).                                                                              |
| `scripts/extract.cjs`         | One-off tool that converts Project Ben-Yehuda source texts into the raw-letter format. Not part of the build.                     |
| `scripts/build-torah-wlc.cjs` | One-off tool that builds the WLC edition (`bible-wlc-*.js`) from OpenScriptures/morphhb, with a full self-audit. Not in build.    |
| `.github/workflows/`          | CI (lint/format/build/audit) + GitHub Pages deploy.                                                                               |

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
   label each position. For the Torah, `lookupVerse` does a second binary
   search over `WLC_VERSE_INDEX` to add a `perek:pasuk` reference (rendered
   as Hebrew numerals via `hebrewNumeral`).
4. **Statistics** (`calcOptions`, `calcAttempts` in `app.jsx`): "rarity" is
   roughly `1 / P(word appears at one position)` from per-letter
   frequencies; "attempts" is the number of candidate ELS windows scanned.
   Expected occurrences ≈ attempts ÷ rarity — when that ratio is near 1 a
   find is statistically unremarkable. This framing is the point of the app.

### Corpus wiring (important gotcha)

Corpora are attached to `window` via **side-effect imports** at the top of
`app.jsx` (e.g. `import './bible-wlc-text.js'` sets `window.WLC_TEXT`). The
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

### Regenerating the WLC edition (the Torah corpus)

`scripts/build-torah-wlc.cjs` rebuilds the three `bible-wlc-*.js` files from
OpenScriptures/**morphhb** (the Westminster/Groves digitisation of the
Leningrad Codex, proofread against photo-facsimiles). Needs network; **not** in
the build or CI:

```sh
node scripts/build-torah-wlc.cjs
```

It takes the pure **ketiv** consonants from morphhb's `<w>` words — keeping the
large/small/suspended letters (the Shema's large ע/ד, the large ו of גחון = the
Torah's middle letter) and dropping the standalone פ/ס paragraph markers and
the qere notes. The result is **deterministic** and independently cross-checks
letter-for-letter against Sefaria's Leningrad text, differing only at the 67
ketiv/qere places (304,850 letters total). morphhb's verse division uses
ta'am ha'elyon for the two Decalogues + the Pinchas split (5,853); the script
re-segments to the standard ta'am-tachton division (5,846) by snapping every
boundary onto the exact morphhb boundary it coarsens. It refuses to emit unless
the char set, counts, all 54 parashiyot, ketiv purity, the 7 expected merges,
and landmark verses all check out.

Two important gotchas this script encodes: (1) fetch bodies must be collected
as Buffers and decoded **once** — decoding per-chunk corrupts UTF-8 characters
split across TCP chunk boundaries (this silently dropped letters); (2) morphhb
stores the Torah's special large letters inside `<w>` as `<seg>` and the
פ/ס markers outside `<w>`, so the parser keeps the former and excludes the latter.

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
  to `gh-pages/preview/<slug>/` (slug = branch name with every character
  outside `[A-Za-z0-9._-]` → `-`) and comments the preview URL on the PR.
- **PR closed** → `cleanup-preview.yml` removes that preview folder.

Live: <https://arielvino.github.io/Bible-code/>

### PR descriptions

**Always include the branch's preview link in the PR description — and always
compute it fresh from the _current_ branch.** Never copy a preview URL from the
README, a previous PR, or another branch: that is exactly how a stale/wrong
slug ends up in a description.

The preview URL is:

```
https://arielvino.github.io/Bible-code/preview/<slug>/
```

`<slug>` must match what `deploy-preview.yml` computes byte-for-byte: the
branch name with every character **outside** `[A-Za-z0-9._-]` replaced by `-`
(so `/` → `-`, but dots, underscores and existing hyphens are kept — it is
**not** "all non-alphanumerics"). Derive it mechanically, don't hand-write it:

```sh
# preview URL for the branch you're on
echo "https://arielvino.github.io/Bible-code/preview/$(git rev-parse --abbrev-ref HEAD | sed 's/[^A-Za-z0-9._-]/-/g')/"
```

e.g. `claude/inspiring-cerf-pq91v5` → `claude-inspiring-cerf-pq91v5`. The
workflow also auto-comments this URL on the PR, but include it in the
description too so reviewers have it up front.
