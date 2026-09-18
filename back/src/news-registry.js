import { safeNewsUrl, NewsCollectionError } from './news-safety.js';
const fail = field => { throw new NewsCollectionError('invalid_registry',field); };
const text = x => typeof x==='string' && x.trim().length>0 && x.length<=4096 && !x.includes('\0');
export const newsInstant = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString()===x;
export function validateNewsOutlet(outlet) {
  if (!outlet || !text(outlet.id)||!text(outlet.name)||!text(outlet.newsroom)||!text(outlet.owner)||!/^[A-Z]{2}$/.test(outlet.country)||!text(outlet.language)||typeof outlet.synthetic!=='boolean') fail('identity');
  for (const field of ['feedHosts','articleHosts']) if (!Array.isArray(outlet[field])||!outlet[field].length||outlet[field].length>20||new Set(outlet[field]).size!==outlet[field].length||outlet[field].some(h=>typeof h!=='string'||!/^([a-z0-9]+(?:-[a-z0-9]+)*\.)+[a-z]{2,63}$/.test(h))) fail('hosts');
  if (!['rss','atom','json'].includes(outlet.adapter)) fail('adapter');
  if(outlet.feedUrl!==null)safeNewsUrl(outlet.feedUrl,outlet.feedHosts);
  else if(outlet.permission?.state==='permitted')fail('permitted channel missing');
  const classification=outlet.classification;
  if (!classification || !Number.isSafeInteger(classification.version)||classification.version<1||!['right','left','center','mixed','unclassified'].includes(classification.orientation)||!['pending','approved','contested','rejected'].includes(classification.review)||!text(classification.methodology)||!Array.isArray(classification.evidence)||classification.evidence.some(e=>!text(e))) fail('classification');
  if (classification.review==='approved' && (!text(classification.responsible)||!newsInstant(classification.reviewedAt)||!newsInstant(classification.reviewDueAt)||classification.reviewDueAt<=classification.reviewedAt||!classification.evidence.length)) fail('classification evidence');
  if(classification.source && (!text(classification.source.url)||!text(classification.source.locator)||!text(classification.source.license)||!newsInstant(classification.source.sourceAt)))fail('methodology source');
  const p=outlet.permission;
  if (!p || !['pending','permitted','denied'].includes(p.state)||!(p.termsUrl===null||text(p.termsUrl))||!['metadata_only','full'].includes(p.content)||!Number.isSafeInteger(p.retentionDays)||p.retentionDays<1||p.retentionDays>7) fail('permission');
  if (p.state==='permitted' && (!text(p.termsUrl)||!text(p.license)||!text(p.responsible)||!text(p.locator)||!newsInstant(p.checkedAt)||!newsInstant(p.expiresAt)||p.expiresAt<=p.checkedAt||!text(p.attribution))) fail('permission evidence');
  if (!Array.isArray(outlet.evidence)||outlet.evidence.some(e=>!text(e.url)||!text(e.locator)||!newsInstant(e.checkedAt))) fail('inventory evidence');
  return outlet;
}
export function eligibleNewsSlots(outlet, now=new Date().toISOString()) {
  validateNewsOutlet(outlet); if (!newsInstant(now)) fail('now');
  const c=outlet.classification,p=outlet.permission;
  if (p.state!=='permitted'||p.checkedAt>now||p.expiresAt<=now||c.review!=='approved'||c.reviewedAt>now||c.reviewDueAt<=now) return [];
  return [...(['right','left'].includes(c.orientation)?[c.orientation]:[]),...(outlet.country!=='BR'?['international']:[])];
}
export function newsPilotInventory(outlets, now=new Date().toISOString()) {
  const ids=new Set();for(const outlet of outlets){validateNewsOutlet(outlet);if(ids.has(outlet.id))fail('duplicate outlet');ids.add(outlet.id);}
  return Object.fromEntries(['right','left','international'].map(slot=>{const options=outlets.filter(o=>eligibleNewsSlots(o,now).includes(slot)).map(o=>({id:o.id,owner:o.owner,version:o.classification.version}));return [slot,{options,eligible:options.length,required:2,sufficient:options.length>=2,independentOwners:new Set(options.map(o=>o.owner)).size}];}));
}
