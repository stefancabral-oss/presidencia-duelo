import { mkdir, open, readFile, rename, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { NewsCollectionError } from './news-safety.js';
import { newsInstant, validateNewsOutlet } from './news-registry.js';
import { newsContentId } from './news-collection.js';
import { validateCivicDataset } from '../../shared/civic-contract.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const key=value=>{if(!/^[a-f0-9]{64}$/.test(value))throw new NewsCollectionError('stored_identity');return value;};
async function optionalJson(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function atomicJson(path,value) {
  const temp=path+'.'+randomUUID()+'.tmp',handle=await open(temp,'wx');
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();await handle.close();await rename(temp,path);}
  catch(error){await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});throw error;}
}
function validateSnapshot(value) {
  if(value.version!==1||value.status!=='collected'||value.publication!=='staging_only'||!newsInstant(value.fetchedAt)||!newsInstant(value.expiresAt)||value.expiresAt<=value.fetchedAt||typeof value.synthetic!=='boolean')throw new NewsCollectionError('stored_snapshot');
  key(value.contentId);validateCivicDataset(value.dataset);
  validateNewsOutlet(value.registrySnapshot);
  const permission=value.registrySnapshot.permission;
  const expectedExpiry=new Date(Math.min(Date.parse(value.fetchedAt)+permission.retentionDays*86400000,Date.parse(permission.expiresAt))).toISOString();
  if(permission.state!=='permitted'||permission.checkedAt>value.fetchedAt||permission.expiresAt<=value.fetchedAt||value.expiresAt!==expectedExpiry||value.dataset.synthetic!==value.synthetic)throw new NewsCollectionError('stored_permission');
  if(Object.entries(value.dataset.records).some(([kind,rows])=>!['sources','outlets','articles'].includes(kind)&&rows.length))throw new NewsCollectionError('staging_boundary');
  if(value.observations.some(i=>i.publication!=='draft'||i.review!=='pending'||i.body!==null||i.summary!==null||i.images.length||i.bodyRead!==false)||value.dataset.records.articles.some(i=>i.publication!=='draft'||i.review!=='pending'))throw new NewsCollectionError('staging_boundary');
  if(value.contentId!==newsContentId(value)||value.registrySnapshot.id!==value.outletId||value.synthetic!==value.registrySnapshot.synthetic)throw new NewsCollectionError('stored_fingerprint');
}
export async function saveNewsCollection(root, result) {
  if(!newsInstant(result.fetchedAt)||typeof result.outletId!=='string'||!result.outletId)throw new NewsCollectionError('collection_identity');
  if(result.status==='collected')validateSnapshot(result);
  else if(!['collection_failed','permission_pending','restricted'].includes(result.status))throw new NewsCollectionError('collection_state');
  const directory=join(root,hash(result.outletId)),batches=join(directory,'batches');await mkdir(batches,{recursive:true});
  const lockPath=join(directory,'.collection.lock'),lock=await open(lockPath,'wx');
  try {
    const path=join(directory,'state.json'),state=await optionalJson(path);
    if(state&&(state.outletId!==result.outletId||state.version!==1))throw new NewsCollectionError('stored_outlet');
    if(state&&result.fetchedAt<state.checkedAt)throw new NewsCollectionError('older_collection');
    let latest=state?.latestBatch??null,previous;
    if(latest){previous=await optionalJson(join(batches,key(latest)+'.json'));if(!previous)throw new NewsCollectionError('missing_stored_snapshot');validateSnapshot(previous);if(previous.synthetic!==result.synthetic&&result.status==='collected')throw new NewsCollectionError('synthetic_boundary');}
    // Retention is enforced on every run, including a provider failure.
    for(const file of await readdir(batches))if(/^[a-f0-9]{64}\.json$/.test(file)){const archived=await optionalJson(join(batches,file));validateSnapshot(archived);if(archived.expiresAt<=result.fetchedAt){await unlink(join(batches,file));if(latest===file.slice(0,-5))latest=null;}}
    let repeated=false;
    if(result.status==='collected') {
      const id=hash(JSON.stringify({contentId:result.contentId,fetchedAt:result.fetchedAt,expiresAt:result.expiresAt})),archive=join(batches,id+'.json');
      const stored=await optionalJson(archive);repeated=Boolean(stored);
      if(stored)validateSnapshot(stored);else await atomicJson(archive,result);
      latest=id;
    }
    const next={version:1,outletId:result.outletId,publication:'staging_only',latestBatch:latest,checkedAt:result.fetchedAt,lastStatus:result.status,error:result.error??null};
    await atomicJson(path,next);return {state:next,repeated};
  }finally{await lock.close();await unlink(lockPath);}
}
export async function readCurrentNewsCollection(root,outletId,now=new Date().toISOString()) {
  if(!newsInstant(now))throw new NewsCollectionError('read_date');
  const directory=join(root,hash(outletId)),state=await optionalJson(join(directory,'state.json'));
  if(!state?.latestBatch)return {state:state??null,batch:null};
  const batch=await optionalJson(join(directory,'batches',key(state.latestBatch)+'.json'));
  if(!batch)throw new NewsCollectionError('missing_stored_snapshot');validateSnapshot(batch);
  return {state,batch:batch.expiresAt>now?batch:null};
}
