const { useState, useCallback } = React;

const FINAL_FORMS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const VALID_LETTERS = new Set('אבגדהוזחטיכלמנסעפצקרשת');

function normalizeWord(input) {
    let result = '';
    for (const ch of input) {
        if (ch in FINAL_FORMS) result += FINAL_FORMS[ch];
        else if (VALID_LETTERS.has(ch)) result += ch;
    }
    return result;
}

// Binary-search BIBLE_INDEX (sorted by pos) → returns the parasha entry covering `pos`
function lookupLocation(pos) {
    const idx = window.BIBLE_INDEX;
    let lo = 0, hi = idx.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (idx[mid].pos <= pos) lo = mid;
        else hi = mid - 1;
    }
    return idx[lo];
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

function doSearch(asked, text, firstSkip, lastSkip) {
    const x = asked.length;
    const results = [];
    const maxSkip = Math.min(lastSkip, (text.length - 1) / (x - 1));
    for (let y = firstSkip; y <= maxSkip; y++) {
        for (let i = 0; i < text.length - y * (x - 1); i++) {
            let match = true;
            for (let xx = 0; xx < x; xx++) {
                if (text[i + xx * y] !== asked[xx]) { match = false; break; }
            }
            if (match) {
                const rows = [];
                for (let xx = 0; xx < x; xx++) {
                    const center = i + xx * y;
                    const cells = [];
                    for (let ll = -15; ll < 16; ll++) {
                        const pos = center + ll;
                        cells.push({
                            char: (pos >= 0 && pos < text.length) ? text[pos] : '',
                            isMatch: ll === 0,
                        });
                    }
                    rows.push({ cells, centerPos: center });
                }
                results.push({ skip: y, rows });
            }
        }
    }
    return results;
}

function StatCard({ label, value, colorClass }) {
    return (
        <div className={`stat-card ${colorClass}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}

function ResultCard({ result, index }) {
    return (
        <div className="result-card">
            <div className="result-header">
                <span className="result-index">#{index + 1}</span>
                <span className="result-skip">דילוג של {result.skip}</span>
            </div>
            <div className="result-table-wrapper">
                <table className="result-table">
                    <tbody>
                        {result.rows.map((row, ri) => {
                            const loc = lookupLocation(row.centerPos);
                            return (
                                <tr key={ri}>
                                    <td className="location-cell">
                                        <span className="loc-book">{loc.book}</span>
                                        <span className="loc-dot">·</span>
                                        <span className="loc-parasha">{loc.parasha}</span>
                                    </td>
                                    {row.cells.map((cell, ci) => (
                                        <td key={ci} className={cell.isMatch ? 'match-cell' : 'context-cell'}>
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
    const [word, setWord] = useState('');
    const [firstSkip, setFirstSkip] = useState(2);
    const [lastSkip, setLastSkip] = useState(100);
    const [results, setResults] = useState(null);
    const [stats, setStats] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = useCallback(() => {
        const asked = normalizeWord(word);
        if (!asked) return;

        setIsSearching(true);
        setResults(null);
        setStats(null);

        setTimeout(() => {
            const text = window.BIBLE_TEXT;
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

            const searchResults = doSearch(asked, text, firstSkip, lastSkip);

            setStats({
                probability,
                totalResults: searchResults.length,
                rarity: options === 0 ? 'N/A' : '1 / ' + options.toFixed(0),
                attempts,
            });
            setResults(searchResults);
            setIsSearching(false);
        }, 50);
    }, [word, firstSkip, lastSkip]);

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>בוחן קודי התורה</h1>
                <p className="app-subtitle">
                    חיפוש דילוגי אותיות בתורה וחישוב הסיכוי הסטטיסטי — כדי לבחון האם המופעים חריגים מבחינה מתמטית
                </p>
                <div className="header-note">
                    כמות המופעים הצפויה = ניסיונות ÷ נדירות המילה. כשהיחס קרוב ל-1, הממצא אינו מפתיע סטטיסטית.
                </div>
            </header>

            <div className="search-panel">
                <div className="form-group">
                    <label className="form-label">הכנס מילה בעברית</label>
                    <input
                        type="text"
                        className="word-input"
                        value={word}
                        onChange={e => setWord(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="לדוגמה: תורה"
                        dir="rtl"
                        autoComplete="off"
                    />
                </div>

                <div className="skip-row">
                    <div className="form-group skip-group">
                        <label className="form-label">דילוג מינימלי</label>
                        <input
                            type="number"
                            className="skip-input"
                            value={firstSkip}
                            onChange={e => setFirstSkip(Math.max(2, parseInt(e.target.value) || 2))}
                            min="2"
                        />
                    </div>
                    <div className="skip-separator">—</div>
                    <div className="form-group skip-group">
                        <label className="form-label">דילוג מקסימלי</label>
                        <input
                            type="number"
                            className="skip-input"
                            value={lastSkip}
                            onChange={e => setLastSkip(Math.max(2, parseInt(e.target.value) || 2))}
                            min="2"
                        />
                    </div>
                </div>

                <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={isSearching || !word.trim()}
                >
                    {isSearching
                        ? <span className="btn-content"><span className="btn-spinner"></span>מחפש...</span>
                        : <span className="btn-content">חיפוש</span>
                    }
                </button>
            </div>

            {stats && (
                <div className="stats-grid">
                    <StatCard label="סיכוי שהביטוי יופיע" value={stats.probability} colorClass="blue" />
                    <StatCard label="מופעים בפועל" value={stats.totalResults} colorClass="green" />
                    <StatCard label="נדירות המילה" value={stats.rarity} colorClass="purple" />
                    <StatCard label="מספר הניסיונות" value={stats.attempts.toLocaleString()} colorClass="amber" />
                </div>
            )}

            <div className="results-panel">
                {isSearching && (
                    <div className="state-placeholder">
                        <div className="large-spinner"></div>
                        <p>מחפש בתורה...</p>
                    </div>
                )}

                {!isSearching && results === null && (
                    <div className="state-placeholder muted">
                        <div className="placeholder-icon">📖</div>
                        <p>הכנס מילה ולחץ על חיפוש</p>
                    </div>
                )}

                {!isSearching && results !== null && results.length === 0 && (
                    <div className="state-placeholder">
                        <div className="placeholder-icon">🔎</div>
                        <p className="no-results-text">לא נמצאו תוצאות</p>
                    </div>
                )}

                {!isSearching && results && results.length > 0 && (
                    <>
                        <div className="results-header">
                            <span className="results-count-badge">{results.length} תוצאות</span>
                        </div>
                        {results.map((result, i) => (
                            <ResultCard key={i} result={result} index={i} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
