import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { publicAddress, safeNewsUrl, resolveNewsTarget, boundedNewsFetch } from './news-safety.js';
import { validateNewsOutlet, eligibleNewsSlots, newsPilotInventory } from './news-registry.js';
import { parseNewsFeed, prepareNewsCollection, collectNewsOutlet } from './news-collection.js';
import { saveNewsCollection, readCurrentNewsCollection } from './news-collection-store.js';
import { newsFixtureOutlet, NEWS_FIXTURE_NOW as now, newsFixtureItems, rssFixture, publicFixtureDns } from '../test-support/news-fixture.js';
const items=newsFixtureItems, outlet=newsFixtureOutlet, prepared=()=>prepareNewsCollection({outlet:outlet(),bytes:rssFixture(items()),fetchedAt:now});
const hosts=['feeds.example.test'];
const response=(bytes,status=200,headers={})=>({status,headers:{'content-type':'application/rss+xml',...headers},bytes});
async function temp(t){const root=await mkdtemp(join(tmpdir(),'polimatch-news-'));t.after(async()=>{assert.equal(dirname(root),tmpdir());assert.match(root.split(/[\\/]/).at(-1),/^polimatch-news-/);await rm(root,{recursive:true,force:true});});return root;}

test('B04 denies private, loopback, link, documentation, CGNAT, tunnel and mapped IP addresses',()=>{
  for(const ip of ['0.0.0.0','10.2.3.4','127.0.0.1','169.254.169.254','172.16.0.1','172.31.1.1','192.168.1.1','100.64.0.1','192.0.0.5','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.1.1.1','255.255.255.255','::1','fc00::1','fe80::1','::ffff:127.0.0.1','64:ff9b::a00:1','2001:db8::1','2002:7f00:1::1','3fff::1','not-an-ip'])assert.equal(publicAddress(ip),false,ip);
  for(const ip of ['93.184.215.14','8.8.8.8','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('B04 rejects schemes, credentials, ports, IP literals, encoded localhost, suffixes and unknown hosts',()=>{
  for(const url of ['http://feeds.example.test/','file:///etc/passwd','https://user:pass@feeds.example.test','https://feeds.example.test:8443','https://127.1/','https://2130706433/','https://0x7f000001/','https://[::1]/','https://localhost/','https://feeds.example.test.attacker.test/','https://feeds.example.test./'])assert.throws(()=>safeNewsUrl(url,hosts));
});
test('B04 rejects mixed public/private DNS and pins approved public DNS result',async()=>{
  await assert.rejects(resolveNewsTarget('https://feeds.example.test/',hosts,async()=>[{address:'93.184.215.14',family:4},{address:'10.0.0.2',family:4}]),/unsafe_dns/);
  let calls=0;const target=await resolveNewsTarget('https://feeds.example.test/',hosts,async()=>{calls++;return [{address:'93.184.215.14',family:4}];});assert.equal(calls,1);assert.equal(target.address.address,'93.184.215.14');assert.equal(target.url.hostname,hosts[0]);
});
test('B04 redirect to internal host is rejected before a second transport request',async()=>{
  let calls=0;await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{resolve:publicFixtureDns,transport:async()=>{calls++;return response(Buffer.alloc(0),302,{location:'https://127.0.0.1/admin'});}}),/unsafe_url/);assert.equal(calls,1);
});
test('B04 revalidates DNS after redirect and rejects rebinding',async()=>{
  let dns=0,requests=0;await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{resolve:async()=>++dns===1?[{address:'93.184.215.14',family:4}]:[{address:'127.0.0.1',family:4}],transport:async()=>{requests++;return response(Buffer.alloc(0),302,{location:'/next'});}}),/unsafe_dns/);assert.equal(requests,1);
});
test('B04 retries bounded 429/5xx, honors short Retry-After and reports long backoff',async()=>{
  let calls=0;const waits=[];const r=await boundedNewsFetch('https://feeds.example.test/',hosts,{resolve:publicFixtureDns,transport:async()=>response(Buffer.alloc(0),++calls===3?200:429,{'retry-after':'1'}),delay:async ms=>waits.push(ms)});assert.equal(calls,3);assert.deepEqual(waits,[1000,1000]);assert.equal(r.status,200);
  await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{resolve:publicFixtureDns,transport:async()=>response(Buffer.alloc(0),503,{'retry-after':'3600'})}),/provider_backoff/);
});
test('B04 limits DNS/transport wall time, payload bytes and compressed responses',async()=>{
  await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{timeoutMs:15,resolve:async()=>new Promise(r=>setTimeout(()=>r([]),40))}),/timeout/);
  await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{maxBytes:10,resolve:publicFixtureDns,transport:async()=>response(Buffer.alloc(11))}),/response_limit/);
  await assert.rejects(boundedNewsFetch('https://feeds.example.test/',hosts,{resolve:publicFixtureDns,transport:async()=>response(Buffer.alloc(0),200,{'content-encoding':'gzip'})}),/response_limit_or_encoding/);
});
test('B04 strict XML refuses truncation, DTD/XXE, entity expansion, excessive depth and unsupported roots',()=>{
  for(const xml of ['<rss><channel><item>','<!DOCTYPE rss SYSTEM "file:///etc/passwd"><rss/>','<!DOCTYPE rss [<!ENTITY x "huge">]><rss/>','<rss>'+('<a>'.repeat(30))+('</a>'.repeat(30))+'</rss>','<html/>'])assert.throws(()=>parseNewsFeed(Buffer.from(xml),'rss'));
});
test('B04 reads RSS namespaces/CDATA but never stores description, scripts, images or summary',()=>{
  const r=prepareNewsCollection({outlet:outlet(),bytes:rssFixture([{...items()[0],title:'<script>execute()</script><b>Fato</b>\u202E'}]),fetchedAt:now});const o=r.observations[0];assert.equal(o.headline,'Fato');assert.equal(o.author,'Autoria fictícia');assert.equal(o.body,null);assert.equal(o.summary,null);assert.deepEqual(o.images,[]);assert.equal(o.access,'metadata_only');assert.equal(o.kind,null);assert.equal(o.originOutletId,null);assert.ok(!JSON.stringify(r).includes('não licenciado'));assert.equal(r.dataset.records.articles.length,0);
});
test('B04 Atom accepts nested author and canonical alternate link without following body URLs',()=>{
  const xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Fato</title><link rel="alternate" href="https://articles.example.test/a"/><published>2032-10-01T10:00:00Z</published><author><name>Ana</name></author><content>Texto descartado</content></entry></feed>';
  const r=prepareNewsCollection({outlet:outlet({adapter:'atom'}),bytes:Buffer.from(xml),fetchedAt:now});assert.equal(r.observations[0].author,'Ana');assert.equal(r.observations[0].canonicalUrl,'https://articles.example.test/a');
});
test('B04 JSON API preserves explicit opinion/paywall/syndication but discards private/executable extras',()=>{
  const data={items:[{url:items()[0].url,title:'Fato',date_published:'2032-10-01T10:00:00Z',kind:'opinion',origin_outlet_id:'agency',syndicated_from_id:'agency:article',paywall:true,body:'do not copy',cpf:'private',image:'https://internal.test/a'}]};
  const r=prepareNewsCollection({outlet:outlet({adapter:'json'}),bytes:Buffer.from(JSON.stringify(data)),fetchedAt:now});assert.equal(r.observations[0].kind,'opinion');assert.equal(r.observations[0].originOutletId,'agency');assert.equal(r.observations[0].access,'paywall');assert.equal(r.dataset.records.articles.length,0);assert.ok(!JSON.stringify(r).includes('private'));assert.ok(!JSON.stringify(r).includes('do not copy'));
});
test('B04 complete explicitly sourced JSON metadata conforms to B01 as draft only',()=>{
  const o=outlet({adapter:'json'});o.classification.source={url:'https://terms.example.test/methodology',locator:'Synthetic methodology',sourceAt:'2032-09-01T00:00:00.000Z',license:'Synthetic fixture'};
  const data={items:[{url:items()[0].url,title:'Fato',date_published:'2032-10-01T10:00:00Z',kind:'analysis',origin_outlet_id:o.id}]};
  const r=prepareNewsCollection({outlet:o,bytes:Buffer.from(JSON.stringify(data)),fetchedAt:now});assert.equal(r.dataset.records.articles.length,1);assert.equal(r.dataset.records.articles[0].review,'pending');assert.equal(r.dataset.records.articles[0].publication,'draft');assert.notEqual(r.dataset.records.outlets[0].methodologySourceId,r.dataset.records.articles[0].sourceId);
});
test('B04 excludes sponsored and invalid date/URL items with explicit quarantine',()=>{
  const input=[{...items()[0],category:'Patrocinado'},{...items()[0],published:undefined},{...items()[0],url:'https://127.0.0.1/'},{...items()[0],published:'Fri, 01 Oct 2032 13:00:00 GMT'}];const r=prepareNewsCollection({outlet:outlet(),bytes:rssFixture(input),fetchedAt:now});assert.equal(r.report.quarantine.length,4);assert.equal(r.observations.length,0);
});
test('B04 stable canonical identity removes trackers, deduplicates repeats and quarantines conflicting variants',()=>{
  const a=items()[0],r=prepareNewsCollection({outlet:outlet(),bytes:rssFixture([a,{...a,url:a.url+'?utm_source=x#frag'}]),fetchedAt:now});assert.equal(r.observations.length,1);
  const changed=prepareNewsCollection({outlet:outlet(),bytes:rssFixture([a,{...a,title:'Conflicting version'}]),fetchedAt:now});assert.equal(changed.observations.length,0);assert.equal(changed.report.quarantine[0].code,'canonical_conflict');
});
test('B04 unreviewed, contested, mixed and international are distinct; orientation never guessed',()=>{
  const o=outlet({country:'DE'});assert.deepEqual(eligibleNewsSlots(o,now),[]);
  o.classification={...o.classification,review:'approved',orientation:'mixed',responsible:'Reviewer fictício',reviewedAt:'2032-09-01T00:00:00.000Z',reviewDueAt:'2032-11-01T00:00:00.000Z',evidence:['Synthetic evidence']};assert.deepEqual(eligibleNewsSlots(o,now),['international']);
  o.classification.orientation='left';assert.deepEqual(eligibleNewsSlots(o,now),['left','international']);o.classification.review='contested';assert.deepEqual(eligibleNewsSlots(o,now),[]);
  assert.equal(newsPilotInventory([o],now).left.sufficient,false);assert.throws(()=>newsPilotInventory([o,o],now));
});
test('B04 classifications require responsible/version/evidence/review date and permission expiry',()=>{
  const o=outlet();o.classification.review='approved';assert.throws(()=>validateNewsOutlet(o));
  const p=outlet();p.permission.responsible=null;assert.throws(()=>validateNewsOutlet(p));
});
test('B04 permission pending/expired blocks all DNS and transport calls',async()=>{
  for(const o of [outlet({permission:{...outlet().permission,state:'pending'}}),outlet({permission:{...outlet().permission,expiresAt:'2032-09-02T00:00:00.000Z'}})]){const r=await collectNewsOutlet(o,{now,resolve:()=>assert.fail('DNS must not run'),transport:()=>assert.fail('transport must not run')});assert.equal(r.status,'permission_pending');}
});
test('B04 provider denial/failure and malformed content remain explicit collection states',async()=>{
  for(const [status,expected] of [[403,'restricted'],[404,'collection_failed'],[503,'collection_failed']]){const r=await collectNewsOutlet(outlet(),{now,resolve:publicFixtureDns,retries:0,transport:async()=>response(Buffer.alloc(0),status)});assert.equal(r.status,expected);}
  const bad=await collectNewsOutlet(outlet(),{now,resolve:publicFixtureDns,transport:async()=>response(Buffer.from('<html/>'),200,{'content-type':'text/html'})});assert.equal(bad.error,'content_type');
});
test('B04 persistence preserves successful metadata on provider failure and expires retained snapshots',async t=>{
  const root=await temp(t),batch=prepared();await saveNewsCollection(root,batch);const repeated=await saveNewsCollection(root,batch);assert.equal(repeated.repeated,true);
  const failure={outletId:batch.outletId,fetchedAt:'2032-10-02T00:00:00.000Z',status:'collection_failed',error:'http_503'};await saveNewsCollection(root,failure);assert.equal((await readCurrentNewsCollection(root,batch.outletId,failure.fetchedAt)).batch.observations.length,1);
  assert.equal((await readCurrentNewsCollection(root,batch.outletId,'2032-10-04T00:00:00.000Z')).batch,null);
  await saveNewsCollection(root,{...failure,fetchedAt:'2032-10-04T00:00:00.000Z'});const dirs=await readdir(root);assert.deepEqual(await readdir(join(root,dirs[0],'batches')),[]);
});
test('B04 failed publication boundary and concurrent lock leave prior pointer intact',async t=>{
  const root=await temp(t),batch=prepared();await saveNewsCollection(root,batch);const directory=join(root,(await readdir(root))[0]),statePath=join(directory,'state.json'),before=await readFile(statePath,'utf8');
  const corrupt=structuredClone(batch);corrupt.observations[0].publication='published';await assert.rejects(saveNewsCollection(root,corrupt),/staging_boundary/);assert.equal(await readFile(statePath,'utf8'),before);
  await writeFile(join(directory,'.collection.lock'),'another process');await assert.rejects(saveNewsCollection(root,batch));assert.equal(await readFile(statePath,'utf8'),before);
});
test('B04 archived content tampering is detected and collection selector identity remains stable',async t=>{
  const root=await temp(t),batch=prepared();const saved=await saveNewsCollection(root,batch);const directory=join(root,(await readdir(root))[0]),archive=join(directory,'batches',saved.state.latestBatch+'.json');const corrupted=JSON.parse(await readFile(archive,'utf8'));corrupted.observations[0].headline='Alteração sem hash';await writeFile(archive,JSON.stringify(corrupted));await assert.rejects(readCurrentNewsCollection(root,batch.outletId,now),/stored_fingerprint/);
});
test('B04 modified archive expiry cannot extend the approved retention limit',async t=>{
  const root=await temp(t),batch=prepared();batch.expiresAt='2032-10-20T00:00:00.000Z';await assert.rejects(saveNewsCollection(root,batch),/stored_permission/);
});
test('B04 real CLI records pending permission and all three pilot gaps without network or content publication',async t=>{
  const root=await temp(t),registry=join(root,'registry.json');const o=outlet({permission:{...outlet().permission,state:'pending'}});await writeFile(registry,JSON.stringify({version:1,outlets:[o]}));
  const script=fileURLToPath(new URL('../scripts/news-collect.mjs',import.meta.url));const result=await promisify(execFile)(process.execPath,[script,registry,join(root,'staging')]);const report=JSON.parse(result.stdout);assert.equal(report.results[0].status,'permission_pending');assert.equal(report.publication,'staging_only');for(const slot of ['left','right','international'])assert.equal(report.inventory[slot].eligible,0);
});
