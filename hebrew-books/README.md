# Hebrew books — Torah-format corpus

Public-domain Hebrew works, processed into the same raw-letters format as
`bible-text.js` in this repository. Each book lives in its own folder with:

- `text.txt` — one long string of Hebrew letters only (`U+05D0..U+05EA`).
  All whitespace, punctuation, nikud and cantillation are stripped, and
  final forms are normalised to their regular forms
  (`ך→כ`, `ם→מ`, `ן→נ`, `ף→פ`, `ץ→צ`). 22 unique letters, identical to
  the Torah file.
- `index.json` — array of `{pos, chapter, section, sectionEn}` entries
  marking chapter boundaries (analogous to `bible-index.js`).
- `metadata.json` — title, author, translator, source URL, character
  count and provenance.

## Books

| Folder | Title (Hebrew) | Title (English) | Translator | Chars | Chapters |
| --- | --- | --- | --- | ---: | ---: |
| `don-quixote/` | דון קישוט איש למנשא | Don Quixote | ח״נ ביאליק (1873–1934) | 347,343 | 45 |
| `zarathustra/` | כה אמר סרתוסטרא | Thus Spoke Zarathustra | דוד פרישמן (1859–1922) | 295,362 | 4 |
| `crime-and-punishment/` | החטא ועונשו | Crime and Punishment | י״ח ברנר (1881–1921) | 637,886 | 40 |

Torah reference: **304,948 chars, 54 chapters, 22 unique letters**.

## Source & licence

All raw texts taken from
[Project Ben-Yehuda](https://benyehuda.org)'s
[`public_domain_dump`](https://github.com/projectbenyehuda/public_domain_dump),
folder `txt_stripped/` (nikud already removed). The Hebrew translations
are public domain in Israel and in countries with a 70-year `pma` term.

Reproduce:

```
git clone --depth=1 https://github.com/projectbenyehuda/public_domain_dump /tmp/pby
node scripts/extract.cjs
```
