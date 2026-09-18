import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { CivicImportError } from './civic-import.js';

export function officialArchiveUrl(kind, year) {
  const resource = { candidates: 'consulta_cand', vacancies: 'consulta_vagas', complementary:'consulta_cand_complementar', historical:'historico_candidatura' }[kind];
  if (!resource || !Number.isSafeInteger(year) || year < 2026 || year > 2100) throw new CivicImportError('Official archive selector');
  return `https://cdn.tse.jus.br/estatistica/sead/odsele/${resource}/${resource}_${year}.zip`;
}

export async function acquireOfficialArchive({ kind, year, destination, expectedSha256, maxBytes = 64 * 1024 * 1024, timeoutMs = 60000, fetchImpl = fetch }) {
  if (expectedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new CivicImportError('Expected archive hash');
  const url = officialArchiveUrl(kind, year);
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'PoliMatch-Staging/1.0 (public TSE data; no publication)' } });
  if (!response.ok || !response.body) throw new CivicImportError(`Official acquisition failed: HTTP ${response.status}`);
  const announced = response.headers.get('content-length');
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > maxBytes)) throw new CivicImportError('Official archive announced size limit');
  await mkdir(dirname(destination), { recursive: true });
  const temp = destination + '.' + randomUUID() + '.part';
  const handle = await open(temp, 'wx');
  const digest = createHash('sha256'); let bytes = 0, magic = Buffer.alloc(0);
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length; if (bytes > maxBytes) throw new CivicImportError('Official archive streaming size limit');
      if (magic.length < 4) magic = Buffer.concat([magic, Buffer.from(chunk)]).subarray(0,4);
      digest.update(chunk); await handle.writeFile(chunk);
    }
    if (bytes < 4 || !magic.equals(Buffer.from([0x50,0x4b,0x03,0x04]))) throw new CivicImportError('Official response is not a ZIP');
    if (announced && Number(announced) !== bytes) throw new CivicImportError('Official response truncated');
    const hash = digest.digest('hex');
    if (expectedSha256 && hash !== expectedSha256) throw new CivicImportError('Official archive checksum mismatch');
    await handle.sync(); await handle.close();
    await rename(temp, destination);
    return { url, sha256: hash, bytes, fetchedAt: new Date().toISOString() };
  } catch (error) { await handle.close().catch(() => {}); await unlink(temp).catch(() => {}); throw error; }
}
