#!/usr/bin/env node
// Build the Westminster Leningrad Codex (WLC) Torah edition — a clean, pure
// *ketiv* consonantal text with an exact perek/pasuk + parasha index.
//
// Emits three files (window globals, matching the repo's existing data shape):
//   bible-wlc-text.js          window.WLC_TEXT         (one 304,850-letter string)
//   bible-wlc-verse-index.js   window.WLC_VERSE_INDEX  ([{pos,perek,pasuk}] ×5846)
//   bible-wlc-index.js         window.WLC_INDEX        ([{pos,parasha,book,bookEn}] ×54)
//
// WHY THIS EDITION. The Leningrad Codex (1008 CE) is the oldest *complete*
// Masoretic codex and the base of BHS. OpenScriptures/morphhb is its digital
// text, proofread letter-by-letter against photo-facsimiles by the Westminster/
// Groves Center. It marks ketiv vs qere explicitly, so we can take the written
// (ketiv) consonantal text exactly — no guessing.
//
// HOW.
//   - TEXT: concatenate every morphhb <w> word's consonants per verse, keeping
//     seg-wrapped large/small/suspended letters (e.g. the large ע/ד of the
//     Shema, the large ו of גחון = the traditional middle letter of the Torah)
//     and dropping the standalone פ/ס paragraph markers, qere notes, nikud and
//     cantillation. This is pure ketiv.
//   - DIVISION: morphhb's own verse division uses ta'am ha'elyon for the two
//     Decalogues (Exod 20 = 26 verses, Deut 5 = 33) plus the Pinchas split
//     (Num 25 = 19), totalling 5,853. For citations we want the universal
//     ta'am ha'tachton division (5,846). We obtain it from Sefaria's verse
//     structure and snap every boundary onto the exact morphhb boundary it
//     corresponds to. The standard division is then a clean COARSENING of
//     morphhb's: it merges exactly 7 boundaries (Exod 20:14/15/16,
//     Deut 5:18/19/20 — the four short commandments — and Num 26:1).
//
// EVERY boundary is verified (the build refuses to emit otherwise):
//   a. char set is exactly the 22 Hebrew letters;
//   b. 5,846 verses / 187 chapters / per-book 1533·1210·859·1288·956;
//   c. every standard boundary coincides with an exact morphhb boundary, and
//      exactly 7 morphhb boundaries are merged away (the known Decalogue/Pinchas);
//   d. all 54 parasha starts land on a verse boundary at the canonical ref;
//   e. all 67 ketiv/qere verses carry the ketiv (not qere) form;
//   f. landmark verses are correct (Shema, Decalogue, Birkat Kohanim, …).
//
// Network: morphhb (GitHub, stable) + Sefaria (verse structure only; its text
// fetch is non-deterministic, so the run retries until the audit passes). Not
// run by CI — manual reproduction:  node scripts/build-torah-wlc.cjs

const fs = require('fs');
const path = require('path');
const https = require('https');

const FINAL = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
function toLetters(s) {
    let o = '';
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if (c >= 0x05d0 && c <= 0x05ea) o += FINAL[ch] || ch;
    }
    return o;
}
function get(url) {
    return new Promise((res, rej) => {
        https
            .get(url, { headers: { 'User-Agent': 'node' } }, (r) => {
                // Collect raw Buffers and decode ONCE — decoding per-chunk would
                // corrupt any UTF-8 character split across a chunk boundary.
                const chunks = [];
                r.on('data', (c) => chunks.push(c));
                r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
            })
            .on('error', rej);
    });
}
async function getRetry(url, tries = 4) {
    for (let i = 0; i < tries; i++) {
        try {
            return await get(url);
        } catch (e) {
            if (i === tries - 1) throw e;
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

const BOOKS = [
    ['Gen', 'Genesis', 'בראשית'],
    ['Exod', 'Exodus', 'שמות'],
    ['Lev', 'Leviticus', 'ויקרא'],
    ['Num', 'Numbers', 'במדבר'],
    ['Deut', 'Deuteronomy', 'דברים'],
];

// Canonical start (book, perek, pasuk) of each of the 54 parashiyot.
const PARASHA = [
    ['בראשית', 'Genesis', 'בראשית', 1, 1],
    ['נח', 'Genesis', 'בראשית', 6, 9],
    ['לך לך', 'Genesis', 'בראשית', 12, 1],
    ['וירא', 'Genesis', 'בראשית', 18, 1],
    ['חיי שרה', 'Genesis', 'בראשית', 23, 1],
    ['תולדות', 'Genesis', 'בראשית', 25, 19],
    ['ויצא', 'Genesis', 'בראשית', 28, 10],
    ['וישלח', 'Genesis', 'בראשית', 32, 4],
    ['וישב', 'Genesis', 'בראשית', 37, 1],
    ['מקץ', 'Genesis', 'בראשית', 41, 1],
    ['ויגש', 'Genesis', 'בראשית', 44, 18],
    ['ויחי', 'Genesis', 'בראשית', 47, 28],
    ['שמות', 'Exodus', 'שמות', 1, 1],
    ['וארא', 'Exodus', 'שמות', 6, 2],
    ['בא', 'Exodus', 'שמות', 10, 1],
    ['בשלח', 'Exodus', 'שמות', 13, 17],
    ['יתרו', 'Exodus', 'שמות', 18, 1],
    ['משפטים', 'Exodus', 'שמות', 21, 1],
    ['תרומה', 'Exodus', 'שמות', 25, 1],
    ['תצוה', 'Exodus', 'שמות', 27, 20],
    ['כי תשא', 'Exodus', 'שמות', 30, 11],
    ['ויקהל', 'Exodus', 'שמות', 35, 1],
    ['פקודי', 'Exodus', 'שמות', 38, 21],
    ['ויקרא', 'Leviticus', 'ויקרא', 1, 1],
    ['צו', 'Leviticus', 'ויקרא', 6, 1],
    ['שמיני', 'Leviticus', 'ויקרא', 9, 1],
    ['תזריע', 'Leviticus', 'ויקרא', 12, 1],
    ['מצורע', 'Leviticus', 'ויקרא', 14, 1],
    ['אחרי מות', 'Leviticus', 'ויקרא', 16, 1],
    ['קדושים', 'Leviticus', 'ויקרא', 19, 1],
    ['אמור', 'Leviticus', 'ויקרא', 21, 1],
    ['בהר', 'Leviticus', 'ויקרא', 25, 1],
    ['בחקותי', 'Leviticus', 'ויקרא', 26, 3],
    ['במדבר', 'Numbers', 'במדבר', 1, 1],
    ['נשא', 'Numbers', 'במדבר', 4, 21],
    ['בהעלותך', 'Numbers', 'במדבר', 8, 1],
    ['שלח', 'Numbers', 'במדבר', 13, 1],
    ['קרח', 'Numbers', 'במדבר', 16, 1],
    ['חקת', 'Numbers', 'במדבר', 19, 1],
    ['בלק', 'Numbers', 'במדבר', 22, 2],
    ['פינחס', 'Numbers', 'במדבר', 25, 10],
    ['מטות', 'Numbers', 'במדבר', 30, 2],
    ['מסעי', 'Numbers', 'במדבר', 33, 1],
    ['דברים', 'Deuteronomy', 'דברים', 1, 1],
    ['ואתחנן', 'Deuteronomy', 'דברים', 3, 23],
    ['עקב', 'Deuteronomy', 'דברים', 7, 12],
    ['ראה', 'Deuteronomy', 'דברים', 11, 26],
    ['שופטים', 'Deuteronomy', 'דברים', 16, 18],
    ['כי תצא', 'Deuteronomy', 'דברים', 21, 10],
    ['כי תבא', 'Deuteronomy', 'דברים', 26, 1],
    ['נצבים', 'Deuteronomy', 'דברים', 29, 9],
    ['וילך', 'Deuteronomy', 'דברים', 31, 1],
    ['האזינו', 'Deuteronomy', 'דברים', 32, 1],
    ['וזאת הברכה', 'Deuteronomy', 'דברים', 33, 1],
];

// Parse one morphhb OSIS book: returns per-verse ketiv consonants and the
// ketiv/qere list. Words live in <w>…</w> (their seg-wrapped large letters are
// kept); qere readings sit in <note> (dropped); פ/ס markers sit outside <w>.
function parseMorphhb(xml) {
    const verses = [];
    const kq = [];
    const vre = /<verse osisID="([^"]+)">([\s\S]*?)<\/verse>/g;
    let m;
    while ((m = vre.exec(xml))) {
        const mm = m[1].match(/\.(\d+)\.(\d+)$/);
        const perek = +mm[1],
            pasuk = +mm[2],
            raw = m[2];
        const kre =
            /<w type="x-ketiv"[^>]*>([\s\S]*?)<\/w>\s*<note[\s\S]*?<rdg type="x-qere">([\s\S]*?)<\/rdg>/g;
        let km;
        while ((km = kre.exec(raw)))
            kq.push({
                perek,
                pasuk,
                ketiv: toLetters(km[1].replace(/<[^>]*>/g, '')),
                qere: toLetters(km[2].replace(/<[^>]*>/g, '')),
            });
        const body = raw.replace(/<note[\s\S]*?<\/note>/g, '');
        const ketiv = toLetters(
            [...body.matchAll(/<w\b[^>]*>([\s\S]*?)<\/w>/g)]
                .map((x) => x[1].replace(/<[^>]*>/g, ''))
                .join(''),
        );
        verses.push({ perek, pasuk, ketiv });
    }
    return { verses, kq };
}

// Banded edit-distance alignment of a onto b; returns map[i] = index in b
// aligned to position i in a (endpoints pinned). Used only to ESTIMATE where a
// Sefaria boundary lands; the estimate is then snapped to an exact morphhb
// boundary, so small fetch noise cannot move a boundary.
function bandedAlign(a, b, B) {
    const n = a.length,
        m = b.length,
        INF = 1e9;
    const tb = [];
    let prev, plo;
    {
        const hi = Math.min(m, B);
        const row = new Float64Array(hi + 1);
        for (let j = 0; j <= hi; j++) row[j] = j;
        prev = row;
        plo = 0;
        tb.push(null);
    }
    for (let i = 1; i <= n; i++) {
        const c = Math.round((i * m) / n),
            lo = Math.max(0, c - B),
            hi = Math.min(m, c + B);
        const row = new Float64Array(hi - lo + 1).fill(INF);
        const t = new Int8Array(hi - lo + 1).fill(-1);
        for (let j = lo; j <= hi; j++) {
            let bb = INF,
                bt = -1;
            if (j >= plo && j - plo < prev.length) {
                const v = prev[j - plo] + 1;
                if (v < bb) {
                    bb = v;
                    bt = 1;
                }
            }
            if (j - 1 >= plo && j - 1 - plo < prev.length) {
                const v = prev[j - 1 - plo] + (a[i - 1] === b[j - 1] ? 0 : 10);
                if (v < bb) {
                    bb = v;
                    bt = 0;
                }
            }
            if (j - 1 >= lo) {
                const v = row[j - 1 - lo] + 1;
                if (v < bb) {
                    bb = v;
                    bt = 2;
                }
            }
            row[j - lo] = bb;
            t[j - lo] = bt;
        }
        prev = row;
        plo = lo;
        tb.push({ lo, t });
    }
    const map = new Int32Array(n + 1).fill(-1);
    let i = n,
        j = m;
    map[n] = m;
    while (i > 0 || j > 0) {
        if (i === 0) {
            j--;
            continue;
        }
        const e = tb[i];
        const bt = j - e.lo >= 0 && j - e.lo < e.t.length ? e.t[j - e.lo] : -1;
        if (bt === 0) {
            i--;
            j--;
            map[i] = j;
        } else if (bt === 1) {
            i--;
            map[i] = j;
        } else if (bt === 2) {
            j--;
        } else {
            if (i > 0) {
                i--;
                map[i] = j;
            } else j--;
        }
    }
    map[0] = 0;
    return map;
}
const skel = (s) => s.replace(/[וי]/g, '');

(async () => {
    const root = path.join(__dirname, '..');

    // --- 1. morphhb: ketiv TEXT + exact morphhb boundaries + k/q (stable) -----
    let K = '';
    const bookKStart = {};
    const mhBoundary = new Set(); // exact morphhb verse-start positions in K
    const mhOffByBook = {};
    const allKQ = [];
    const morphhbVerses = {};
    for (const [f, en, he] of BOOKS) {
        const xml = await getRetry(
            `https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${f}.xml`,
        );
        const { verses, kq } = parseMorphhb(xml);
        bookKStart[en] = K.length;
        const offs = [];
        let o = 0;
        for (const v of verses) {
            offs.push(o);
            mhBoundary.add(K.length + o);
            o += v.ketiv.length;
        }
        mhOffByBook[en] = offs.slice().sort((x, y) => x - y);
        morphhbVerses[en] = verses;
        K += verses.map((v) => v.ketiv).join('');
        for (const q of kq) allKQ.push({ book: he, perek: q.perek, pasuk: q.pasuk, ...q });
    }
    console.log('morphhb ketiv text:', K.length, 'letters; k/q:', allKQ.length);

    // --- 2. impose the standard (ta'am tachton) division, with retry ----------
    function attempt(sefByBook) {
        const V = [];
        for (const [, en, he] of BOOKS) {
            const sv = sefByBook[en];
            const Sconcat = sv.map((v) => v.text).join('');
            const Ktext = K.slice(
                bookKStart[en],
                en === 'Deuteronomy'
                    ? K.length
                    : bookKStart[BOOKS[BOOKS.findIndex((b) => b[1] === en) + 1][1]],
            );
            const map = bandedAlign(Sconcat, Ktext, 400);
            const offs = mhOffByBook[en];
            let so = 0,
                prev = -1;
            for (const v of sv) {
                const approx = map[so];
                so += v.text.length;
                const L = v.text[0],
                    hs = skel(v.text.slice(0, 30));
                let best = -1,
                    bestScore = -2,
                    bestDist = 1e9;
                for (const c of offs) {
                    if (c <= prev || c < approx - 15) continue;
                    if (c > approx + 15) break;
                    if (Ktext[c] !== L) continue;
                    let p = 0;
                    const ks = skel(Ktext.slice(c, c + 30));
                    while (p < ks.length && p < hs.length && ks[p] === hs[p]) p++;
                    const d = Math.abs(c - approx);
                    if (p > bestScore || (p === bestScore && d < bestDist)) {
                        bestScore = p;
                        best = c;
                        bestDist = d;
                    }
                }
                if (best < 0)
                    throw new Error(`snap failed ${he} ${v.perek}:${v.pasuk} (approx ${approx})`);
                V.push({
                    pos: bookKStart[en] + best,
                    perek: v.perek,
                    pasuk: v.pasuk,
                    book: he,
                    bookEn: en,
                });
                prev = best;
            }
        }
        audit(V);
        return V;
    }

    function audit(V) {
        const must = (c, msg) => {
            if (!c) throw new Error('AUDIT FAILED: ' + msg);
        };
        must(new Set(K).size === 22 && [...K].every((c) => c >= 'א' && c <= 'ת'), 'char set');
        must(V.length === 5846, 'verse count 5846 (' + V.length + ')');
        must(V[0].pos === 0 && V.every((e, i) => i === 0 || e.pos > V[i - 1].pos), 'monotonic');
        const pb = {};
        for (const v of V) pb[v.bookEn] = (pb[v.bookEn] || 0) + 1;
        must(
            pb.Genesis === 1533 &&
                pb.Exodus === 1210 &&
                pb.Leviticus === 859 &&
                pb.Numbers === 1288 &&
                pb.Deuteronomy === 956,
            'per-book counts',
        );
        const ch = {};
        for (const v of V) ch[v.bookEn + ' ' + v.perek] = 1;
        must(Object.keys(ch).length === 187, '187 chapters');
        // every boundary is a morphhb boundary; exactly 7 merged away
        const Vpos = new Set(V.map((v) => v.pos));
        must(
            [...Vpos].every((p) => mhBoundary.has(p)),
            'every boundary coincides with morphhb',
        );
        must(
            [...mhBoundary].filter((p) => !Vpos.has(p)).length === 7,
            'exactly 7 boundaries merged',
        );
        // parasha anchors
        const refPos = {};
        for (const v of V) refPos[v.bookEn + ' ' + v.perek + ':' + v.pasuk] = v.pos;
        for (const p of PARASHA)
            must(p[1] + ' ' + p[3] + ':' + p[4] in refPos, 'parasha anchor ' + p[0]);
        // ketiv purity
        const vtext = (book, perek, pasuk) => {
            const i = V.findIndex((v) => v.book === book && v.perek === perek && v.pasuk === pasuk);
            return K.slice(V[i].pos, i + 1 < V.length ? V[i + 1].pos : K.length);
        };
        for (const q of allKQ)
            must(
                vtext(q.book, q.perek, q.pasuk).includes(q.ketiv),
                'ketiv ' + q.book + ' ' + q.perek + ':' + q.pasuk,
            );
        // landmarks
        const lm = [
            ['בראשית', 1, 1, 'בראשיתבראאלהימ'],
            ['שמות', 20, 2, 'אנכייהוהאלהיכ'],
            ['ויקרא', 19, 18, 'לאתקמ'],
            ['במדבר', 6, 24, 'יברככיהוהוישמרכ'],
            ['דברים', 6, 4, 'שמעישראליהוהאלהינויהוהאחד'],
        ];
        for (const [b, p, k, exp] of lm)
            must(vtext(b, p, k).startsWith(exp), 'landmark ' + b + ' ' + p + ':' + k);
    }

    let V = null;
    for (let t = 1; t <= 8 && !V; t++) {
        console.log(`attempt ${t}: fetching Sefaria verse structure …`);
        try {
            const sefByBook = {};
            for (const [, en] of BOOKS) {
                const j = JSON.parse(
                    await getRetry(
                        `https://www.sefaria.org/api/v3/texts/${en}?version=hebrew|Tanach%20with%20Text%20Only&return_format=text_only`,
                    ),
                );
                const chs = j.versions[0].text;
                const sv = [];
                for (let ci = 0; ci < chs.length; ci++)
                    for (let vi = 0; vi < chs[ci].length; vi++)
                        sv.push({ perek: ci + 1, pasuk: vi + 1, text: toLetters(chs[ci][vi]) });
                sefByBook[en] = sv;
            }
            V = attempt(sefByBook);
        } catch (e) {
            console.log('  rejected:', e.message, '— retrying');
        }
    }
    if (!V) throw new Error('could not produce a verified division in 8 tries');
    console.log('verified standard division:', V.length, 'verses');

    // --- 3. parasha index from canonical starts -------------------------------
    const refPos = {};
    for (const v of V) refPos[v.bookEn + ' ' + v.perek + ':' + v.pasuk] = v.pos;
    const PIDX = PARASHA.map(([parasha, bookEn, book, perek, pasuk]) => ({
        pos: refPos[bookEn + ' ' + perek + ':' + pasuk],
        parasha,
        book,
        bookEn,
    }));

    // --- 4. emit --------------------------------------------------------------
    const verseData = V.map((v) => ({ pos: v.pos, perek: v.perek, pasuk: v.pasuk }));
    fs.writeFileSync(
        path.join(root, 'bible-wlc-text.js'),
        '// Westminster Leningrad Codex (WLC) Torah — pure ketiv consonantal text.\n' +
            '// ' +
            K.length +
            ' letters. Source: OpenScriptures/morphhb (CC BY 4.0). Generated by\n' +
            '// scripts/build-torah-wlc.cjs — do not hand-edit.\n' +
            'window.WLC_TEXT = ' +
            JSON.stringify(K) +
            ';\n',
    );
    fs.writeFileSync(
        path.join(root, 'bible-wlc-verse-index.js'),
        '// WLC Torah: exact character position of every verse (perek/pasuk), standard\n' +
            '// (ta’am tachton) division, ' +
            V.length +
            ' verses. Generated by build-torah-wlc.cjs.\n' +
            'window.WLC_VERSE_INDEX = ' +
            JSON.stringify(verseData) +
            ';\n',
    );
    fs.writeFileSync(
        path.join(root, 'bible-wlc-index.js'),
        '// WLC Torah: the 54 parasha boundaries. Generated by build-torah-wlc.cjs.\n' +
            'window.WLC_INDEX = ' +
            JSON.stringify(PIDX) +
            ';\n',
    );
    console.log('wrote bible-wlc-text.js, bible-wlc-verse-index.js, bible-wlc-index.js');
})().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
