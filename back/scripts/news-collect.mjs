import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectNewsOutlet } from '../src/news-collection.js';
import { saveNewsCollection } from '../src/news-collection-store.js';
import { newsPilotInventory } from '../src/news-registry.js';
const [registryArgument,outputArgument]=process.argv.slice(2);
if(!registryArgument||!outputArgument||process.argv.length!==4)throw new Error('Usage: node back/scripts/news-collect.mjs registry.json output-directory');
const registry=JSON.parse(await readFile(resolve(registryArgument),'utf8'));
if(registry.version!==1||!Array.isArray(registry.outlets)||registry.outlets.length>30)throw new Error('Registry version/limit');
const inventory=newsPilotInventory(registry.outlets),results=[];
for(const outlet of registry.outlets){const result=await collectNewsOutlet(outlet),stored=await saveNewsCollection(resolve(outputArgument),result);results.push({outletId:outlet.id,status:result.status,error:result.error??null,metadata:result.observations.length,report:result.report??null,repeated:stored.repeated});}
console.log(JSON.stringify({publication:'staging_only',inventory,results},null,2));
