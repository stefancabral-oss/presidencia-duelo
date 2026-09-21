import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { NewsCollectionError, safeNewsUrl, boundedNewsFetch } from './news-safety.js';
import { validateNewsOutlet, newsInstant } from './news-registry.js';
import { CIVIC_RECORDS, validateCivicDataset } from '../../shared/civic-contract.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new NewsCollectionError(code); };
const kinds=['reporting','opinion','analysis','interview','press_release'];
// Plain text only, never innerHTML; executable blocks and formatting are discarded.
export function newsPlainText(value, max=500) {
  if(typeof value!=='string')return '';
  return value.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function parseNewsFeed(bytes, adapter) {
  if (bytes.length>2*1024*1024)fail('feed_limit');
  let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('feed_encoding');}
  if(adapter==='json') {
    const data=JSON.parse(raw);
    if(!data||!Array.isArray(data.items)||data.items.length>500)fail('json_feed_profile');
    return data.items.map(item=>({url:item?.url,title:item?.title,author:item?.author,published:item?.date_published,kind:item?.kind,sponsored:item?.sponsored,originOutletId:item?.origin_outlet_id,syndicatedFromId:item?.syndicated_from_id,language:item?.language,paywall:item?.paywall}));
  }
  if(!['rss','atom'].includes(adapter))fail('feed_adapter');
  const parser=new SaxesParser({xmlns:true}), stack=[], items=[];
  let item=null, depth=0, nodes=0, root;
  parser.on('doctype',()=>fail('xml_doctype'));
  parser.on('error',()=>fail('malformed_xml'));
  parser.on('opentag',node=>{
    if(++depth>24||++nodes>20000)fail('xml_limit');
    if(depth===1){root=node.local;if(root!==(adapter==='rss'?'rss':'feed')||node.uri!==(adapter==='rss'?'':'http://www.w3.org/2005/Atom'))fail('xml_feed_profile');}
    stack.push({node,text:''});
    if ((adapter==='rss'&&depth===3&&node.local==='item'&&stack[1].node.local==='channel')||(adapter==='atom'&&depth===2&&node.local==='entry')) { if(items.length>=500)fail('item_limit');item={_depth:depth}; }
    if(item&&adapter==='atom'&&depth===item._depth+1&&node.local==='link') {
      const attributes=Object.fromEntries(Object.values(node.attributes).map(a=>[a.local,a.value]));
      if(!attributes.rel||attributes.rel==='alternate')item.url=attributes.href;
    }
  });
  const text=value=>{if(stack.length){stack.at(-1).text+=value;if(stack.at(-1).text.length>65536)fail('xml_text_limit');}};
  parser.on('text',text);parser.on('cdata',text);
  parser.on('closetag',()=>{
    const frame=stack.pop(),name=frame.node.local;
    if(item) {
      if(depth===item._depth+1 && (frame.node.uri===(adapter==='rss'?'':'http://www.w3.org/2005/Atom')||(frame.node.uri==='http://purl.org/dc/elements/1.1/'&&name==='creator'))) {
        const field={title:'title',link:adapter==='rss'?'url':null,pubDate:'published',published:'published',creator:'author',author:'author',category:'category'}[name];
        if(field) {if(field==='category')item[field]=[item[field],frame.text].filter(Boolean).join(';');else {if(item[field]!==undefined&&item[field]!==frame.text)fail('ambiguous_feed_field');item[field]=frame.text;}}
      }
      if(depth===item._depth){delete item._depth;items.push(item);item=null;}
    }
    if(stack.length){stack.at(-1).text+=frame.text;if(stack.at(-1).text.length>2*1024*1024)fail('xml_text_limit');}
    depth--;
  });
  parser.write(raw).close();
  if(!root||depth!==0)fail('malformed_xml');
  // RSS does not claim article body access or journalistic type from description.
  return items.map(i=>({...i,kind:undefined}));
}
export function canonicalNewsUrl(value, hosts) {
  const url=safeNewsUrl(value,hosts);
  for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key))url.searchParams.delete(key);
  return url.href;
}
export function prepareNewsCollection({outlet,bytes,fetchedAt=new Date().toISOString(),finalUrl=outlet.feedUrl}) {
  validateNewsOutlet(outlet);if(!newsInstant(fetchedAt))fail('collection_date');
  const permission=outlet.permission;
  if(permission.state!=='permitted'||permission.checkedAt>fetchedAt||permission.expiresAt<=fetchedAt)fail('permission_missing_or_expired');
  safeNewsUrl(finalUrl,outlet.feedHosts);
  const input=parseNewsFeed(bytes,outlet.adapter), records=Object.fromEntries(Object.keys(CIVIC_RECORDS).map(k=>[k,[]])), quarantine=[], observations=[];
  const sourceId=`news:feed:${hash(JSON.stringify({outlet:outlet.id,url:finalUrl,bytes:hash(bytes),license:permission.license}))}`;
  const sourceAtValues=[], seen=new Map(), conflicts=new Set();
  for(let index=0;index<input.length;index++) {
    const item=input[index];
    try {
      const canonicalUrl=canonicalNewsUrl(item.url,outlet.articleHosts),headline=newsPlainText(item.title),author=newsPlainText(item.author,200)||null;
      if(!headline)fail('headline_missing');
      if(item.sponsored===true||/patrocinad|sponsored|advertorial|publicidade/i.test(item.category||''))fail('sponsored_excluded');
      if(item.sponsored!==undefined&&typeof item.sponsored!=='boolean')fail('sponsorship_invalid');
      const parsed=Date.parse(item.published);
      // Never substitute fetch time for an absent/ambiguous origin date.
      if(typeof item.published!=='string'||!/(?:GMT|UTC|[+-]\d{4}|Z|[+-]\d{2}:\d{2})$/i.test(item.published.trim())||!Number.isFinite(parsed)||parsed>Date.parse(fetchedAt))fail('origin_date_missing_or_future');
      const sourceAt=new Date(parsed).toISOString(), id=`news:article:${hash(`${outlet.id}:${canonicalUrl}`)}`;
      if(item.kind!==undefined&&!kinds.includes(item.kind))fail('article_kind_invalid');
      if(item.paywall!==undefined&&typeof item.paywall!=='boolean')fail('access_invalid');
      // Unstructured syndication/type remain unknown observations, never guessed.
      const kind=item.kind??null,originOutletId=item.originOutletId??null;
      const observation={id,canonicalUrl,headline,author,sourceAt,fetchedAt,kind,language:newsPlainText(item.language||outlet.language,32),originOutletId,syndicatedFromId:item.syndicatedFromId??null,access:item.paywall===true?'paywall':'metadata_only',contentRead:'headline_and_feed_metadata',bodyRead:false,body:null,summary:null,images:[],publication:'draft',review:'pending'};
      if(originOutletId!==null&&typeof originOutletId!=='string')fail('origin_identity_invalid');
      const previous=seen.get(id);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(observation)){conflicts.add(id);quarantine.push({index,code:'canonical_conflict'});}
      else if(!previous)seen.set(id,observation);
    } catch(error){quarantine.push({index,code:error instanceof NewsCollectionError?error.code:'invalid_item'});}
  }
  for(const [id,item] of seen)if(!conflicts.has(id)){observations.push(item);sourceAtValues.push(item.sourceAt);}
  const sourceAt=sourceAtValues.sort().at(-1)??null;
  // B01 records are emitted only when all required facts are supplied, while
  // incomplete metadata remains reviewable outside the public contract.
  if(sourceAt) {
    records.sources.push({id:sourceId,url:finalUrl,publisher:outlet.name,kind:outlet.synthetic?'synthetic':'newsroom',locator:`feed sha256=${hash(bytes)}`,sourceAt,fetchedAt,generation:hash(bytes),license:permission.license,access:'open',collectionState:'collected',lastError:null});
    const methodology=outlet.classification.source;
    if(methodology) {
      const methodologySourceId=`news:methodology:${hash(JSON.stringify(methodology))}`;
      records.sources.push({id:methodologySourceId,url:methodology.url,publisher:outlet.classification.responsible||outlet.name,kind:outlet.synthetic?'synthetic':'newsroom',locator:methodology.locator,sourceAt:methodology.sourceAt,fetchedAt,generation:String(outlet.classification.version),license:methodology.license,access:'open',collectionState:'collected',lastError:null});
      records.outlets.push({id:outlet.id,name:outlet.name,country:outlet.country,newsroom:outlet.newsroom,orientation:outlet.classification.orientation,classificationVersion:outlet.classification.version,classificationReview:outlet.classification.review,methodologySourceId,usePermission:'permitted'});
      for(const item of observations)if(item.kind && item.originOutletId===outlet.id && item.syndicatedFromId===null)records.articles.push({id:item.id,outletId:outlet.id,originOutletId:outlet.id,syndicatedFromId:null,canonicalUrl:item.canonicalUrl,headline:item.headline,author:item.author,kind:item.kind,language:item.language,translatedFromId:null,sourceAt:item.sourceAt,fetchedAt,access:item.access,sourceId,publication:'draft',review:'pending',revision:1,updatedAt:fetchedAt});
    }
  }
  validateCivicDataset({version:1,synthetic:outlet.synthetic,records});
  const registrySnapshot={id:outlet.id,name:outlet.name,country:outlet.country,newsroom:outlet.newsroom,owner:outlet.owner,language:outlet.language,synthetic:outlet.synthetic,feedUrl:outlet.feedUrl,feedHosts:outlet.feedHosts,articleHosts:outlet.articleHosts,adapter:outlet.adapter,classification:outlet.classification,permission,evidence:outlet.evidence};
  const report={input:input.length,metadata:observations.length,contractArticles:records.articles.length,quarantine,classificationReview:outlet.classification.review,bodyRead:false,pilotPublicationApproved:false};
  const result={version:1,outletId:outlet.id,synthetic:outlet.synthetic,registrySnapshot,publication:'staging_only',fetchedAt,expiresAt:new Date(Math.min(Date.parse(fetchedAt)+permission.retentionDays*86400000,Date.parse(permission.expiresAt))).toISOString(),status:'collected',observations,dataset:{version:1,synthetic:outlet.synthetic,records},report};
  return {...result,contentId:newsContentId(result)};
}
export function newsContentId(result) {
  const semantic=result.observations.map(({fetchedAt,...item})=>item);
  const records=Object.fromEntries(Object.entries(result.dataset.records).map(([kind,rows])=>[kind,rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['fetchedAt','updatedAt'].includes(key))))]));
  return hash(JSON.stringify({registrySnapshot:result.registrySnapshot,observations:semantic,records,report:result.report}));
}
export async function collectNewsOutlet(outlet, options={}) {
  validateNewsOutlet(outlet);const fetchedAt=options.now??new Date().toISOString(),p=outlet.permission;
  if(!newsInstant(fetchedAt))fail('collection_date');
  const status={version:1,outletId:outlet.id,publication:'staging_only',fetchedAt,observations:[]};
  if(p.state!=='permitted'||p.checkedAt>fetchedAt||p.expiresAt<=fetchedAt)return {...status,status:'permission_pending',error:'permission_missing_or_expired'};
  try {
    const response=await boundedNewsFetch(outlet.feedUrl,outlet.feedHosts,options);
    if(response.status!==200)return {...status,status:[401,402,403].includes(response.status)?'restricted':'collection_failed',httpStatus:response.status,error:`http_${response.status}`};
    const type=response.headers['content-type']??'';
    if(!(outlet.adapter==='json'?/application\/(?:[\w.+-]*\+)?json/i:/\b(?:application|text)\/(?:[\w.+-]*\+)?xml\b/i).test(type))fail('content_type');
    return prepareNewsCollection({outlet,bytes:response.bytes,finalUrl:response.url,fetchedAt});
  }catch(error){return {...status,status:'collection_failed',error:error instanceof NewsCollectionError?error.code:'network_or_feed_failure'};}
}
