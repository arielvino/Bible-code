# Bible-code

Simple code for finding words coded in the bible — and calculates the
probability of their existence.

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
