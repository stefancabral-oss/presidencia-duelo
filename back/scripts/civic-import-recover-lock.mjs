import { resolve } from 'node:path';
import { recoverCivicImportLock } from '../src/civic-import-store.js';
const [directory] = process.argv.slice(2);
if (!directory || process.argv.length !== 3) throw new Error('Usage: node back/scripts/civic-import-recover-lock.mjs staging-directory');
console.log(JSON.stringify(await recoverCivicImportLock(resolve(directory)),null,2));
