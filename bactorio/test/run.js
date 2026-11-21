// node test/run.js [filter]   — runs every *.test.js in this folder
import { readdirSync } from 'node:fs';
import { runAll } from './helpers.js';

const dir = new URL('.', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.test.js')).sort()) await import(new URL(f, dir));
process.exit((await runAll(process.argv[2])) ? 1 : 0);
