// Acquisition/inspection only. An observed row count is never an official denominator.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { acquireOfficialArchive } from '../src/civic-acquisition.js';
import { parseTseCsv, sha256, tseGeneration } from '../src/civic-import.js';

const [yearArgument,outputArgument]=process.argv.slice(2);
if(!/^\d{4}$/.test(yearArgument||'')||!outputArgument||process.argv.length!==4)throw new Error('Usage: node back/scripts/civic-acquire.mjs year output-directory');
const year=Number(yearArgument),directory=join(resolve(outputArgument),randomUUID());
await mkdir(directory,{recursive:true});
const receipt={version:1,year,publication:'inspection_only',acquired:[],failures:[]};
for(const [kind,prefix] of [['candidates','consulta_cand'],['vacancies','consulta_vagas'],['complementary','consulta_cand_complementar'],['historical','historico_candidatura']]) {
  try {
    const archive=join(directory,prefix+'.zip');
    const download=await acquireOfficialArchive({kind,year,destination:archive});
    const member=`${prefix}_${year}_BRASIL.csv`,csv=join(directory,prefix+'.csv');
    await promisify(execFile)(process.env.CIVIC_PYTHON||(process.platform==='win32'?'python':'python3'),[fileURLToPath(new URL('./civic-unzip.py',import.meta.url)),archive,member,csv],{timeout:60000,maxBuffer:16384});
    const bytes=await readFile(csv),rows=parseTseCsv(bytes);
    const generations=[...new Set(rows.map(r=>tseGeneration(r.DT_GERACAO,r.HH_GERACAO)))];
    receipt.acquired.push({kind,...download,locator:member,csvSha256:sha256(bytes),inspectionEncoding:'latin1 (verify the official layout before import)',columns:Object.keys(rows[0]||{}),observedRows:rows.length,generations,electionKeys:[...new Set(rows.filter(r=>r.NR_TURNO===undefined||r.NR_TURNO==='1').map(r=>r.CD_ELEICAO))].filter(Boolean)});
  } catch(error) {
    // Do not include any source row, embedded page or full command stderr in logs.
    receipt.failures.push({kind,code:error.code||'CIVIC_ACQUISITION_FAILED',message:error instanceof Error&&error.name==='CivicImportError'?error.message:'Source transport, ZIP or layout validation failed'});
  }
  await writeFile(join(directory,'inspection.json'),JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify({directory,...receipt},null,2));
if(receipt.failures.length)process.exitCode=1;
