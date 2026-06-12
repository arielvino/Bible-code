# Bible-code

Simple code for finding words coded in the bible — and calculates the
probability of their existence.

## Development

Requires Node.js 20+.

```sh
npm install      # install dependencies
npm run dev      # start the local dev server (http://localhost:5173)
npm run build    # produce the static site in dist/
npm run preview  # serve the built dist/ locally
```

The app is built with [Vite](https://vitejs.dev/) + React. `npm run build`
emits a fully static bundle to `dist/`, which is what GitHub Pages serves —
the deploy workflows build the site before publishing. The Vite `base` is
relative (`./`), so the same build works at the project root and inside
per-branch preview folders without rebuilding.

## Live

- Main: <https://arielvino.github.io/Bible-code/>
- This branch's preview: <https://arielvino.github.io/Bible-code/preview/claude-extract-hebrew-books-kMSua/>

Previews are published automatically by `.github/workflows/deploy-preview.yml`
on every push to a non-`main` branch (slug = branch name with `/` → `-`),
and torn down by `cleanup-preview.yml` when the PR closes.

## Corpus

The search runs against one of two raw-letter Hebrew corpora (Torah-format:
22 letters, finals normalised, no whitespace/punctuation/nikud).

| Corpus | Source | Chars |
| --- | --- | ---: |
| Torah | `bible-text.js` / `bible-index.js` | 304,948 |
| כה אמר זרתוסטרא (Nietzsche, tr. D. Frischmann) | `hebrew-books/zarathustra/` | 295,362 |

Switch corpora with the pill toggle in the header. See
[`hebrew-books/README.md`](hebrew-books/README.md) for the full corpus,
including additional public-domain Hebrew works.
