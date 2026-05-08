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
                const key = i + '_' + y;
                // Return only coordinates — cell data is built on the main thread at render time
                results[key] = { key, skip: y, startPos: i, letterCount: x };
            }
        }
    }

    self.postMessage(results);
};
