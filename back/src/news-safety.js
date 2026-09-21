import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';

export class NewsCollectionError extends Error {
  constructor(code, message = code) { super(message); this.name = 'NewsCollectionError'; this.code = code; }
}
const fail = code => { throw new NewsCollectionError(code); };
export function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Transport is deliberately limited to ordinary global unicast. Reject mapped
  // IPv4, NAT64, tunnels, local/link scopes and special/documentation ranges.
  if (family === 6) {
    const normalized = new URL(`https://[${address}]/`).hostname.slice(1,-1).toLowerCase();
    const first = parseInt(normalized.split(':')[0],16), second = parseInt(normalized.split(':')[1] || '0',16);
    return first >= 0x2000 && first <= 0x3fff && !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) && first !== 0x2002 && !(first === 0x3fff && second <= 0xfff);
  }
  return false;
}
export function safeNewsUrl(value, hosts) {
  let url; try { url = new URL(value); } catch { fail('unsafe_url'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname.replace(/^\[|\]$/g,'')) || !hosts.includes(url.hostname) || url.href.length > 4096 || url.hostname.endsWith('.')) fail('unsafe_url');
  url.hash = '';
  return url;
}
export async function resolveNewsTarget(value, hosts, resolve = lookup) {
  const url = safeNewsUrl(value, hosts);
  const addresses = await resolve(url.hostname, { all:true, verbatim:true });
  if (!Array.isArray(addresses) || !addresses.length || addresses.length > 64 || addresses.some(a => !publicAddress(a.address) || isIP(a.address) !== a.family)) fail('unsafe_dns');
  return {url, address:addresses.find(a => a.family === 4) || addresses[0]};
}
export function pinnedHttpsResponse(target, { signal, maxBytes }) {
  return new Promise((resolve,reject) => {
    const req = request(target.url, {
      method:'GET', agent:false, signal, maxHeaderSize:16384,
      servername:target.url.hostname,
      headers:{'User-Agent':'PoliMatch-News-Staging/1.0','Accept':'application/rss+xml, application/atom+xml, application/json','Accept-Encoding':'identity'},
      // No second DNS lookup: TLS/Host remain the approved hostname.
      lookup:(_hostname,options,callback) => options.all ? callback(null,[target.address]) : callback(null,target.address.address,target.address.family),
    }, response => {
      const status = response.statusCode;
      if (status !== 200) { response.destroy(); resolve({status,headers:response.headers,bytes:Buffer.alloc(0)}); return; }
      const announced=response.headers['content-length'];
      if(announced!==undefined&&(!/^\d+$/.test(announced)||Number(announced)>maxBytes)){response.destroy();reject(new NewsCollectionError('response_limit'));return;}
      const parts=[]; let size=0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { response.destroy(new NewsCollectionError('response_limit')); return; }
        parts.push(chunk);
      });
      response.on('end', () => {
        const announced=response.headers['content-length'];
        if (!response.complete || (announced !== undefined && (!/^\d+$/.test(announced) || Number(announced)!==size))) { reject(new NewsCollectionError('truncated_response')); return; }
        resolve({status,headers:response.headers,bytes:Buffer.concat(parts)});
      });
      response.on('error',reject);
    });
    req.on('error',reject); req.end();
  });
}
export async function boundedNewsFetch(value, hosts, {resolve=lookup, transport=pinnedHttpsResponse, timeoutMs=10000, maxBytes=1024*1024, retries=2, delay=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  if (!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>2*1024*1024||!Number.isSafeInteger(retries)||retries<0||retries>2) fail('invalid_limits');
  const signal=AbortSignal.timeout(timeoutMs); let url=value, redirects=0, attempts=0;
  const timed=promise=>Promise.race([promise,new Promise((_,reject)=>{const abort=()=>reject(new NewsCollectionError('timeout'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});})]);
  for (;;) {
    const target = await timed(resolveNewsTarget(url,hosts,resolve));
    const response = await timed(transport(target,{signal,maxBytes}));
    if (response.bytes.length > maxBytes || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) fail('response_limit_or_encoding');
    if ([301,302,303,307,308].includes(response.status)) {
      if (++redirects>3 || !response.headers.location) fail('redirect_limit');
      url=safeNewsUrl(new URL(response.headers.location,target.url).href,hosts).href; continue;
    }
    if ((response.status===429 || response.status>=500) && attempts++<retries) {
      const wait=Number(response.headers['retry-after'] ?? 0);
      // Long/date Retry-After is reported, never ignored by immediately retrying.
      if (!Number.isFinite(wait)||wait<0||wait>2) fail('provider_backoff');
      await timed(delay(Math.max(wait*1000,100*attempts))); continue;
    }
    return {...response,url:target.url.href,attempts:attempts+1};
  }
}
