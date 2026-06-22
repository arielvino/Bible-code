import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './styles.css';

// Side-effect imports: each attaches its corpus data to `window`
// (window.WLC_TEXT, window.WLC_INDEX, window.ZARATHUSTRA_TEXT, ...).
import './bible-wlc-text.js';
import './bible-wlc-index.js';
import './bible-wlc-verse-index.js';
import './hebrew-books/zarathustra/text.js';
import './hebrew-books/zarathustra/index.js';

const { useState, useCallback, useRef, useMemo, useEffect } = React;

const FINAL_FORMS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const VALID_LETTERS = new Set('אבגדהוזחטיכלמנסעפצקרשת');

// Standard Israeli Hebrew keyboard layout: an English letter is mapped to the
// Hebrew letter printed on the same physical key, so a user typing on a QWERTY
// layout still gets the Hebrew letter they mean (e.g. `a`/`A` → ש, `r`/`R` → ר).
// Case-insensitive; keys that don't carry a Hebrew letter (q, w) are omitted.
const ENGLISH_TO_HEBREW = {
    e: 'ק',
    r: 'ר',
    t: 'א',
    y: 'ט',
    u: 'ו',
    i: 'ן',
    o: 'ם',
    p: 'פ',
    a: 'ש',
    s: 'ד',
    d: 'ג',
    f: 'כ',
    g: 'ע',
    h: 'י',
    j: 'ח',
    k: 'ל',
    l: 'ך',
    z: 'ז',
    x: 'ס',
    c: 'ב',
    v: 'ה',
    b: 'נ',
    n: 'מ',
    m: 'צ',
};

function normalizeWord(input) {
    let result = '';
    for (const ch of input) {
        if (ch in FINAL_FORMS) result += FINAL_FORMS[ch];
        else if (VALID_LETTERS.has(ch)) result += ch;
    }
    return result;
}

// Keep only Hebrew letters (incl. final forms) and whitespace as the user
// types. Whitespace is preserved here so phrases display naturally; it is
// stripped at search time by normalizeWord.
function sanitizeInput(input) {
    let result = '';
    for (const ch of input) {
        const mapped = ENGLISH_TO_HEBREW[ch.toLowerCase()];
        if (mapped) result += mapped;
        else if (ch in FINAL_FORMS || VALID_LETTERS.has(ch) || /\s/.test(ch)) result += ch;
    }
    return result;
}

const CORPORA = {
    wlc: {
        id: 'wlc',
        nameHe: 'תורה',
        searchVerb: 'בתורה',
        get text() {
            return window.WLC_TEXT;
        },
        get index() {
            return window.WLC_INDEX;
        },
        get verseIndex() {
            return window.WLC_VERSE_INDEX;
        },
    },
    zarathustra: {
        id: 'zarathustra',
        nameHe: 'כה אמר זרתוסטרא',
        searchVerb: 'בכה אמר זרתוסטרא',
        get text() {
            return window.ZARATHUSTRA_TEXT;
        },
        get index() {
            return window.ZARATHUSTRA_INDEX;
        },
    },
};

function lookupLocation(idx, pos) {
    let lo = 0,
        hi = idx.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (idx[mid].pos <= pos) lo = mid;
        else hi = mid - 1;
    }
    return idx[lo];
}

// Render a number as a Hebrew numeral (gematria), e.g. 1→א, 15→טו, 24→כד
// (no geresh/gershayim). Torah perakim go up to 50 and pesukim up to 89.
const HEB_NUM = [
    [400, 'ת'],
    [300, 'ש'],
    [200, 'ר'],
    [100, 'ק'],
    [90, 'צ'],
    [80, 'פ'],
    [70, 'ע'],
    [60, 'ס'],
    [50, 'נ'],
    [40, 'מ'],
    [30, 'ל'],
    [20, 'כ'],
    [10, 'י'],
    [9, 'ט'],
    [8, 'ח'],
    [7, 'ז'],
    [6, 'ו'],
    [5, 'ה'],
    [4, 'ד'],
    [3, 'ג'],
    [2, 'ב'],
    [1, 'א'],
];
function hebrewNumeral(n) {
    let out = '';
    let rem = n;
    for (const [val, letter] of HEB_NUM) {
        // 15 and 16 are written טו / טז, never יה / יו (avoid spelling the Name)
        if (rem === 15) {
            out += 'טו';
            rem = 0;
            break;
        }
        if (rem === 16) {
            out += 'טז';
            rem = 0;
            break;
        }
        while (rem >= val) {
            out += letter;
            rem -= val;
        }
    }
    return out;
}

// For corpora that carry a verse index, format "perek:pasuk" in Hebrew numerals.
function lookupVerse(verseIndex, pos) {
    if (!verseIndex) return null;
    const v = lookupLocation(verseIndex, pos);
    return `${hebrewNumeral(v.perek)}:${hebrewNumeral(v.pasuk)}`;
}

function calcOptions(asked, text) {
    if (!text.length) return 0;
    let d = 1;
    for (const ch of asked) {
        let count = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ch) count++;
        }
        if (count === 0) return 0;
        d *= count / text.length;
    }
    return 1 / d;
}

function calcAttempts(asked, text, firstSkip, lastSkip) {
    const x = asked.length;
    if (x === 0) return -1;
    if (x === 1) return text.length;
    let r = 0;
    const maxSkip = Math.min(lastSkip, (text.length - 1) / (x - 1));
    for (let y = firstSkip; y <= maxSkip; y++) {
        r += text.length - y * (x - 1);
    }
    return r;
}

function StatCard({ label, value, colorClass }) {
    return (
        <div className={`stat-card ${colorClass}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}

function buildRows(text, startPos, skip, letterCount) {
    const rows = [];
    for (let xx = 0; xx < letterCount; xx++) {
        const center = startPos + xx * skip;
        const cells = [];
        for (let ll = -15; ll < 16; ll++) {
            const pos = center + ll;
            cells.push({
                char: pos >= 0 && pos < text.length ? text[pos] : '',
                isMatch: ll === 0,
            });
        }
        rows.push({ cells, centerPos: center });
    }
    return rows;
}

function ResultCard({ result, index, corpus }) {
    const rows = buildRows(corpus.text, result.startPos, result.skip, result.letterCount);
    return (
        <div className="result-card">
            <div className="result-header">
                <span className="result-index">#{index + 1}</span>
                <span className="result-skip">דילוג של {result.skip}</span>
            </div>
            <div className="result-table-wrapper">
                <table className="result-table">
                    <tbody>
                        {rows.map((row, ri) => {
                            const loc = lookupLocation(corpus.index, row.centerPos);
                            const verseRef = lookupVerse(corpus.verseIndex, row.centerPos);
                            return (
                                <tr key={ri}>
                                    <td className="location-cell">
                                        <span className="loc-book">{loc.book}</span>
                                        <span className="loc-dot">·</span>
                                        <span className="loc-parasha">{loc.parasha}</span>
                                        {verseRef && (
                                            <>
                                                <span className="loc-dot">·</span>
                                                <span className="loc-verse">{verseRef}</span>
                                            </>
                                        )}
                                    </td>
                                    {row.cells.map((cell, ci) => (
                                        <td
                                            key={ci}
                                            className={cell.isMatch ? 'match-cell' : 'context-cell'}
                                        >
                                            {cell.char}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function App() {
    const [corpusId, setCorpusId] = useState('wlc');
    const corpus = CORPORA[corpusId];
    const [word, setWord] = useState('');
    const [firstSkip, setFirstSkip] = useState(2);
    const [lastSkip, setLastSkip] = useState(100);
    const [resultsMap, setResultsMap] = useState(null);
    const [stats, setStats] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [groupBy, setGroupBy] = useState('skip');
    const [expandedKeys, setExpandedKeys] = useState(new Set());
    const searchIdRef = useRef(0);
    const workersRef = useRef([]);

    const cancelWorkers = () => {
        workersRef.current.forEach((w) => w.terminate());
        workersRef.current = [];
    };

    const handleSearch = useCallback(() => {
        const asked = normalizeWord(word);
        if (!asked) return;

        cancelWorkers();
        const searchId = ++searchIdRef.current;

        setIsSearching(true);
        setResultsMap(null);
        setStats(null);
        setProgress(0);
        setExpandedKeys(new Set());

        const text = corpus.text;
        const attempts = calcAttempts(asked, text, firstSkip, lastSkip);
        const options = calcOptions(asked, text);

        let probability;
        if (options === 0) {
            probability = 'N/A';
        } else if (attempts >= options) {
            probability = (attempts / options).toFixed(2);
        } else {
            probability = '1 / ' + (options / attempts).toFixed(2);
        }

        const x = asked.length;
        const maxSkip = Math.min(lastSkip, Math.floor((text.length - 1) / (x - 1)));
        const totalSkips = Math.max(0, maxSkip - firstSkip + 1);

        if (totalSkips === 0) {
            setStats({
                probability,
                totalResults: 0,
                rarity: options === 0 ? 'N/A' : '1 / ' + options.toFixed(0),
                attempts,
            });
            setResultsMap({});
            setIsSearching(false);
            return;
        }

        const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);
        const skipsPerWorker = Math.ceil(totalSkips / numWorkers);
        const workerUrl = new URL('./search-worker.js', import.meta.url);

        const merged = {};
        let finishedWorkers = 0;
        let doneSkips = 0;
        const spawnedWorkers = [];

        for (let w = 0; w < numWorkers; w++) {
            const wFirstSkip = firstSkip + w * skipsPerWorker;
            const wLastSkip = Math.min(wFirstSkip + skipsPerWorker - 1, maxSkip);
            if (wFirstSkip > maxSkip) break;

            const worker = new Worker(workerUrl);
            spawnedWorkers.push(worker);

            const assignedSkips = wLastSkip - wFirstSkip + 1;

            worker.onmessage = (e) => {
                if (searchIdRef.current !== searchId) return;

                Object.assign(merged, e.data);
                doneSkips += assignedSkips;
                finishedWorkers++;
                setProgress(Math.round((doneSkips / totalSkips) * 100));

                if (finishedWorkers === spawnedWorkers.length) {
                    setStats({
                        probability,
                        totalResults: Object.keys(merged).length,
                        rarity: options === 0 ? 'N/A' : '1 / ' + options.toFixed(0),
                        attempts,
                    });
                    setResultsMap({ ...merged });
                    setIsSearching(false);
                    workersRef.current = [];
                }
            };

            worker.onerror = (err) => {
                console.error('Worker error:', err);
            };

            worker.postMessage({ asked, text, firstSkip: wFirstSkip, lastSkip: wLastSkip });
        }

        workersRef.current = spawnedWorkers;
    }, [word, firstSkip, lastSkip, corpus]);

    // Cancel any in-flight search and clear results when corpus changes
    const prevCorpusRef = useRef(corpusId);
    useEffect(() => {
        if (prevCorpusRef.current !== corpusId) {
            cancelWorkers();
            searchIdRef.current++;
            setIsSearching(false);
            setResultsMap(null);
            setStats(null);
            setProgress(0);
            setExpandedKeys(new Set());
            prevCorpusRef.current = corpusId;
        }
    }, [corpusId]);

    const resultsList = useMemo(() => {
        if (!resultsMap) return [];
        const arr = Object.values(resultsMap);
        arr.sort((a, b) => a.startPos - b.startPos);
        return arr;
    }, [resultsMap]);

    const skipGroups = useMemo(() => {
        if (groupBy !== 'skip') return null;
        const map = new Map();
        for (const r of resultsList) {
            if (!map.has(r.skip)) map.set(r.skip, []);
            map.get(r.skip).push(r);
        }
        return Array.from(map.entries()).map(([skip, items]) => ({
            key: 's_' + skip,
            skip,
            items,
        }));
    }, [resultsList, groupBy]);

    const locationGroups = useMemo(() => {
        if (groupBy !== 'location') return null;
        const bookMap = new Map();
        for (const r of resultsList) {
            const loc = lookupLocation(corpus.index, r.startPos);
            if (!bookMap.has(loc.book)) bookMap.set(loc.book, new Map());
            const parashaMap = bookMap.get(loc.book);
            if (!parashaMap.has(loc.parasha)) parashaMap.set(loc.parasha, []);
            parashaMap.get(loc.parasha).push(r);
        }
        return Array.from(bookMap.entries()).map(([book, parashaMap]) => ({
            key: 'b_' + book,
            book,
            parashas: Array.from(parashaMap.entries()).map(([parasha, items]) => ({
                key: 'p_' + book + '_' + parasha,
                parasha,
                items,
            })),
        }));
    }, [resultsList, groupBy, corpus]);

    const toggleCollapse = useCallback((key) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const hasResults = resultsMap !== null;
    const totalResults = hasResults ? resultsList.length : 0;

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>בוחן קודי האותיות</h1>
                <p className="app-subtitle">
                    חיפוש דילוגי אותיות {corpus.searchVerb} וחישוב הסיכוי הסטטיסטי — כדי לבחון האם
                    המופעים חריגים מבחינה מתמטית
                </p>
                <div className="header-note">
                    כמות המופעים הצפויה = ניסיונות ÷ נדירות המילה. כשהיחס קרוב ל-1, הממצא אינו מפתיע
                    סטטיסטית.
                </div>
                <div className="corpus-toggle" role="tablist" aria-label="בחירת ספר">
                    {Object.values(CORPORA).map((c) => (
                        <button
                            key={c.id}
                            role="tab"
                            aria-selected={corpusId === c.id}
                            className={'corpus-btn' + (corpusId === c.id ? ' active' : '')}
                            onClick={() => setCorpusId(c.id)}
                        >
                            {c.nameHe}
                            <span className="corpus-len">
                                {c.text.length.toLocaleString()} אותיות
                            </span>
                        </button>
                    ))}
                </div>
            </header>

            <div className="search-panel">
                <div className="form-group">
                    <label className="form-label">הכנס מילה בעברית</label>
                    <input
                        type="text"
                        className="word-input"
                        value={word}
                        onChange={(e) => setWord(sanitizeInput(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="לדוגמה: תורה"
                        dir="rtl"
                        autoComplete="off"
                    />
                </div>

                <div className="skip-row">
                    <div className="form-group skip-group">
                        <label className="form-label">דילוג מינימלי</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="skip-input"
                            value={firstSkip}
                            onChange={(e) =>
                                setFirstSkip(Math.max(2, parseInt(e.target.value) || 2))
                            }
                        />
                    </div>
                    <div className="skip-separator">—</div>
                    <div className="form-group skip-group">
                        <label className="form-label">דילוג מקסימלי</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="skip-input"
                            value={lastSkip}
                            onChange={(e) =>
                                setLastSkip(Math.max(2, parseInt(e.target.value) || 2))
                            }
                        />
                    </div>
                </div>

                <div className="skip-hint">
                    הדילוג הוא המרחק בין אות לאות ברצף — דילוג 2 מדלג על אות אחת (כל אות שנייה),
                    דילוג 3 מדלג על שתי אותיות, וכן הלאה.
                </div>

                <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={isSearching || !word.trim()}
                >
                    {isSearching ? (
                        <span className="btn-content">
                            <span className="btn-spinner"></span>מחפש... {progress}%
                        </span>
                    ) : (
                        <span className="btn-content">חיפוש</span>
                    )}
                </button>
            </div>

            {stats && (
                <div className="stats-grid">
                    <StatCard
                        label="סיכוי שהביטוי יופיע"
                        value={stats.probability}
                        colorClass="blue"
                    />
                    <StatCard label="מופעים בפועל" value={stats.totalResults} colorClass="green" />
                    <StatCard label="נדירות המילה" value={stats.rarity} colorClass="purple" />
                    <StatCard
                        label="מספר הניסיונות"
                        value={stats.attempts.toLocaleString()}
                        colorClass="amber"
                    />
                </div>
            )}

            <div className="results-panel">
                {isSearching && (
                    <div className="state-placeholder">
                        <div className="large-spinner"></div>
                        <p>
                            מחפש {corpus.searchVerb}... {progress}%
                        </p>
                    </div>
                )}

                {!isSearching && !hasResults && (
                    <div className="state-placeholder muted">
                        <div className="placeholder-icon">📖</div>
                        <p>הכנס מילה ולחץ על חיפוש</p>
                    </div>
                )}

                {!isSearching && hasResults && totalResults === 0 && (
                    <div className="state-placeholder">
                        <div className="placeholder-icon">🔎</div>
                        <p className="no-results-text">לא נמצאו תוצאות</p>
                    </div>
                )}

                {!isSearching && hasResults && totalResults > 0 && (
                    <>
                        <div className="results-header">
                            <span className="results-count-badge">{totalResults} תוצאות</span>
                            <div className="sort-controls">
                                <label className="ctrl-label">קיבוץ:</label>
                                <select
                                    className="ctrl-select"
                                    value={groupBy}
                                    onChange={(e) => {
                                        setGroupBy(e.target.value);
                                        setExpandedKeys(new Set());
                                    }}
                                >
                                    <option value="skip">לפי דילוג</option>
                                    <option value="location">לפי ספר / פרשה</option>
                                </select>
                            </div>
                        </div>

                        {groupBy === 'skip' &&
                            skipGroups.map(({ key, skip, items }) => {
                                const collapsed = !expandedKeys.has(key);
                                return (
                                    <div key={key} className="skip-group-section">
                                        <div
                                            className="skip-group-header collapsible"
                                            onClick={() => toggleCollapse(key)}
                                        >
                                            <span className="collapse-arrow">
                                                {collapsed ? '▶' : '▼'}
                                            </span>
                                            <span>דילוג {skip}</span>
                                            <span className="skip-group-count">
                                                {items.length} תוצאות
                                            </span>
                                        </div>
                                        {!collapsed &&
                                            items.map((result, i) => (
                                                <ResultCard
                                                    key={result.key}
                                                    result={result}
                                                    index={i}
                                                    corpus={corpus}
                                                />
                                            ))}
                                    </div>
                                );
                            })}

                        {groupBy === 'location' &&
                            locationGroups.map(({ key: bookKey, book, parashas }) => {
                                const bookCollapsed = !expandedKeys.has(bookKey);
                                return (
                                    <div key={bookKey} className="book-group-section">
                                        <div
                                            className="book-group-header collapsible"
                                            onClick={() => toggleCollapse(bookKey)}
                                        >
                                            <span className="collapse-arrow">
                                                {bookCollapsed ? '▶' : '▼'}
                                            </span>
                                            <span className="loc-book-label">{book}</span>
                                            <span className="skip-group-count">
                                                {parashas.reduce((s, p) => s + p.items.length, 0)}{' '}
                                                תוצאות
                                            </span>
                                        </div>
                                        {!bookCollapsed &&
                                            parashas.map(({ key: pKey, parasha, items }) => {
                                                const pCollapsed = !expandedKeys.has(pKey);
                                                return (
                                                    <div
                                                        key={pKey}
                                                        className="parasha-group-section"
                                                    >
                                                        <div
                                                            className="parasha-group-header collapsible"
                                                            onClick={() => toggleCollapse(pKey)}
                                                        >
                                                            <span className="collapse-arrow">
                                                                {pCollapsed ? '▶' : '▼'}
                                                            </span>
                                                            <span>{parasha}</span>
                                                            <span className="skip-group-count">
                                                                {items.length} תוצאות
                                                            </span>
                                                        </div>
                                                        {!pCollapsed &&
                                                            items.map((result, i) => (
                                                                <ResultCard
                                                                    key={result.key}
                                                                    result={result}
                                                                    index={i}
                                                                    corpus={corpus}
                                                                />
                                                            ))}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                );
                            })}
                    </>
                )}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
