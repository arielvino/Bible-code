self.onmessage = function(e) {
    const { asked, text, firstSkip, lastSkip } = e.data;
    const x = asked.length;
    const results = {};
    const maxSkip = Math.min(lastSkip, Math.floor((text.length - 1) / (x - 1)));

    for (let y = firstSkip; y <= maxSkip; y++) {
        const limit = text.length - y * (x - 1);
        for (let i = 0; i < limit; i++) {
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
                const key = i + '_' + y;
                results[key] = { key, skip: y, startPos: i, rows };
            }
        }
    }

    self.postMessage(results);
};
