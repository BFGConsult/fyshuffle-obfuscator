import { copyFile } from 'node:fs/promises';

await copyFile('dist/FYShuffle.d.ts', 'dist/FYShuffle.d.cts');
