#!/usr/bin/env node
// Extract raw Hebrew letters (Torah-format) from Project Ben-Yehuda sources.
// - Keeps only letters U+05D0..U+05EA
// - Normalizes final forms (ם→מ, ן→נ, ץ→צ, ף→פ, ך→כ)
// - Removes all whitespace, punctuation, nikud, cantillation
// - Records chapter offsets in the resulting string

const fs = require('fs');
const path = require('path');

const FINAL_MAP = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

function toLetters(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 0x05D0 && code <= 0x05EA) {
      out += FINAL_MAP[ch] || ch;
    }
  }
  return out;
}

const HEB_ORDINALS = {
  'ראשון': 1, 'שני': 2, 'שלישי': 3, 'רביעי': 4, 'חמישי': 5,
  'ששי': 6, 'שביעי': 7, 'שמיני': 8, 'תשיעי': 9, 'עשירי': 10,
  'אחד עשר': 11, 'שנים עשר': 12, 'שלשה עשר': 13, 'ארבעה עשר': 14,
  'חמשה עשר': 15, 'ששה עשר': 16, 'שבעה עשר': 17, 'שמנה עשר': 18,
  'תשעה עשר': 19, 'עשרים': 20, 'עשרים ואחד': 21, 'עשרים ושנים': 22,
  'עשרים ושלשה': 23, 'עשרים וארבעה': 24,
};

function extract({ inputPath, outDir, classify, footerCut, dropPreMarker, titleHe, titleEn, author, translator, sourceUrl, originalLang, originalTitle }) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  // Cut footer (Project Ben-Yehuda attribution) if present
  let body = raw;
  if (footerCut) {
    const idx = body.indexOf(footerCut);
    if (idx > 0) body = body.slice(0, idx);
  } else {
    // Generic footer: "את הטקסט[ים] לעיל הפיקו מתנדבי"
    const idx = body.indexOf('את הטקסט');
    if (idx > 0) {
      // make sure this is the footer, not an early occurrence
      const tail = body.slice(idx, idx + 200);
      if (tail.includes('פרויקט בן') || tail.includes('בן־יהודה') || tail.includes('בן יהודה')) {
        body = body.slice(0, idx);
      }
    }
  }
  // First non-empty line is the title — drop it
  const firstNl = body.indexOf('\n');
  body = body.slice(firstNl + 1);

  const lines = body.split('\n');
  let out = '';
  const index = []; // {pos, chapter, section, sectionEn?}
  let currentSection = null;
  let currentSectionEn = null;
  let seenFirstMarker = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const tag = classify(trimmed);
    if (tag) {
      if (dropPreMarker && !seenFirstMarker) {
        out = ''; // discard any preface text accumulated before first marker
      }
      seenFirstMarker = true;
      if (tag.kind === 'section') {
        currentSection = tag.section;
        currentSectionEn = tag.sectionEn || null;
        // collapse with an immediately-following chapter at same pos
        const prev = index[index.length - 1];
        if (!(prev && prev.pos === out.length && prev.kind === 'section')) {
          index.push({
            pos: out.length,
            kind: 'section',
            chapter: tag.label || tag.section,
            section: currentSection,
            sectionEn: currentSectionEn,
          });
        }
      } else if (tag.kind === 'chapter') {
        // collapse duplicate at same pos (e.g. "חלק ראשון" then "I" at pos 0)
        const prev = index[index.length - 1];
        if (prev && prev.pos === out.length && prev.kind === 'section') {
          // overwrite chapter label combining both
          prev.chapter = `${prev.section} – ${tag.label}`;
          prev.kind = 'chapter';
        } else {
          index.push({
            pos: out.length,
            kind: 'chapter',
            chapter: tag.label,
            section: currentSection,
            sectionEn: currentSectionEn,
          });
        }
      }
      continue;
    }
    if (dropPreMarker && !seenFirstMarker) continue; // skip preface lines entirely
    out += toLetters(line);
  }
  // Strip the internal "kind" field from index entries
  for (const e of index) delete e.kind;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'text.txt'), out);
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));

  const uniq = [...new Set(out)];
  const meta = {
    titleHe,
    titleEn,
    originalTitle,
    originalLang,
    author,
    translator,
    sourceUrl,
    sourceProject: 'Project Ben-Yehuda (https://benyehuda.org)',
    license: 'Public domain',
    charCount: out.length,
    chapterCount: index.length,
    uniqueLetters: uniq.length,
    uniqueLettersList: uniq.join(''),
    notes: 'Raw Hebrew letters only (U+05D0..U+05EA), final forms normalized to regular forms (ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ). All whitespace, punctuation, nikud, and cantillation stripped. Mirrors the format of bible-text.js in this repo.',
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(meta, null, 2));

  return { chars: out.length, chapters: index.length, uniqueLetters: uniq.length };
}

// === Classifiers ===

// Don Quixote (Bialik): "ספר ראשון" / "ספר שני" sections; "פרק <ordinal>: <title>" chapters
const reDqSection = /^ספר (ראשון|שני)$/;
const reDqChapter = /^פרק ([א-ת ]+):\s*(.+)$/;
function classifyDQ(line) {
  if (!line) return null;
  let m = line.match(reDqSection);
  if (m) return { kind: 'section', section: 'ספר ' + m[1], sectionEn: m[1] === 'ראשון' ? 'Book One' : 'Book Two', label: 'ספר ' + m[1] };
  m = line.match(reDqChapter);
  if (m) {
    const ord = m[1].trim();
    if (HEB_ORDINALS[ord] != null) {
      return { kind: 'chapter', label: `פרק ${ord}: ${m[2].trim()}` };
    }
  }
  return null;
}

// Zarathustra (Frischmann): "חלק <ordinal>" / "חלק רביעי ואחרון" — only parts as chapters
const reZaPart = /^חלק (ראשון|שני|שלישי|רביעי ואחרון|רביעי)$/;
function classifyZA(line) {
  if (!line) return null;
  const m = line.match(reZaPart);
  if (m) {
    const ord = m[1];
    const en = ord === 'ראשון' ? 'Part One' :
               ord === 'שני' ? 'Part Two' :
               ord === 'שלישי' ? 'Part Three' :
               'Part Four';
    return { kind: 'section', section: 'חלק ' + ord, sectionEn: en, label: 'חלק ' + ord };
  }
  return null;
}

// Crime and Punishment (Brenner): "חלק ראשון..ששי" + "אפילוג" sections; roman chapter markers I, II, III, IV...
const reCpSection = /^(חלק (ראשון|שני|שלישי|רביעי|חמישי|ששי)|אפילוג)$/;
const reCpChapter = /^([IVX]+)\.?$/;
function classifyCP(line) {
  if (!line) return null;
  let m = line.match(reCpSection);
  if (m) {
    const en = line === 'אפילוג' ? 'Epilogue' :
               line === 'חלק ראשון' ? 'Part One' :
               line === 'חלק שני' ? 'Part Two' :
               line === 'חלק שלישי' ? 'Part Three' :
               line === 'חלק רביעי' ? 'Part Four' :
               line === 'חלק חמישי' ? 'Part Five' :
               'Part Six';
    return { kind: 'section', section: line, sectionEn: en, label: line };
  }
  m = line.match(reCpChapter);
  if (m) return { kind: 'chapter', label: m[1] };
  return null;
}

// === Run ===

const SRC = process.env.PBY_DIR || '/tmp/pby';

const results = [];

results.push(['Don Quixote', extract({
  inputPath: path.join(SRC, 'txt_stripped/p89/m11229.txt'),
  outDir: path.join(__dirname, '..', 'hebrew-books', 'don-quixote'),
  classify: classifyDQ,
  titleHe: 'דון קישוט איש למנשא',
  titleEn: 'Don Quixote',
  originalTitle: 'Don Quixote de la Mancha',
  originalLang: 'es',
  author: 'מיגל דה סרוואנטס (Miguel de Cervantes Saavedra, 1547–1616)',
  translator: 'חיים נחמן ביאליק (Hayim Nahman Bialik, 1873–1934)',
  sourceUrl: 'https://benyehuda.org/read/11229',
  dropPreMarker: true,
})]);

results.push(['Thus Spoke Zarathustra', extract({
  inputPath: path.join(SRC, 'txt_stripped/p142/m3951.txt'),
  outDir: path.join(__dirname, '..', 'hebrew-books', 'zarathustra'),
  classify: classifyZA,
  titleHe: 'כה אמר סרתוסטרא',
  titleEn: 'Thus Spoke Zarathustra',
  originalTitle: 'Also sprach Zarathustra',
  originalLang: 'de',
  author: 'פרידריך ניטשה (Friedrich Nietzsche, 1844–1900)',
  translator: 'דוד פרישמן (David Frischmann, 1859–1922)',
  sourceUrl: 'https://benyehuda.org/read/3951',
})]);

results.push(['Crime and Punishment', extract({
  inputPath: path.join(SRC, 'txt_stripped/p66/m380.txt'),
  outDir: path.join(__dirname, '..', 'hebrew-books', 'crime-and-punishment'),
  classify: classifyCP,
  titleHe: 'החטא ועונשו',
  titleEn: 'Crime and Punishment',
  originalTitle: 'Преступление и наказание',
  originalLang: 'ru',
  author: 'פיודור דוסטויבסקי (Fyodor Dostoyevsky, 1821–1881)',
  translator: 'יוסף חיים ברנר (Yosef Haim Brenner, 1881–1921)',
  sourceUrl: 'https://benyehuda.org/read/380',
})]);

console.log('Book               | chars   | chapters | unique-letters');
console.log('-------------------+---------+----------+----------------');
for (const [name, r] of results) {
  console.log(name.padEnd(18) + ' | ' + String(r.chars).padStart(7) + ' | ' + String(r.chapters).padStart(8) + ' | ' + r.uniqueLetters);
}
console.log('\nTorah reference  : 304948 chars, 54 chapters, 22 unique letters');
