import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base ('./') so the built site works at any sub-path — both the
// GitHub Pages project root (/Bible-code/) and per-branch preview folders
// (/Bible-code/preview/<slug>/) — without rebuilding for each location.
export default defineConfig({
    base: './',
    plugins: [react()],
    build: {
        outDir: 'dist',
        // The corpora are large string literals; raise the inline-warning ceiling
        // so the build log stays quiet rather than flagging expected big chunks.
        chunkSizeWarningLimit: 2000,
    },
});
