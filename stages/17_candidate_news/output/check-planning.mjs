import fs from 'node:fs/promises';
import path from 'node:path';

const stage = 'stages/17_candidate_news';
const referenceKey = value => value.replace(/\\([\\[\]])/g, '$1').trim().replace(/\s+/g, ' ').toLowerCase();

function markdownText(source) {
  let fence = null;
  const lines = source.split('\n').map(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (marker && !fence) { fence = marker[1]; return ''; }
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(line)) fence = null;
      return '';
    }
    return line.replace(/(`+)([\s\S]*?)\1/g, '');
  });
  return lines.join('\n');
}

function closeBracket(text, begin) {
  let depth = 1;
  for (let i = begin + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '[') depth++;
    if (text[i] === ']' && --depth === 0) return i;
    if (text[i] === ']' && depth < 0) return -1;
  }
  return -1;
}

function inlineDestination(text, begin) {
  let i = begin + 1;
  while (/\s/.test(text[i] || '') && i < text.length) i++;
  if (text[i] === '<') {
    const end = text.indexOf('>', i + 1);
    if (end < 0) return null;
    const close = text.indexOf(')', end + 1);
    return close < 0 ? null : { target: text.slice(i + 1, end), end: close };
  }
  const start = i;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '(') depth++;
    if (text[i] === ')') {
      if (depth === 0) return { target: text.slice(start, i), end: i };
      depth--;
    }
    if (/\s/.test(text[i]) && depth === 0) {
      const close = text.indexOf(')', i + 1);
      return close < 0 ? null : { target: text.slice(start, i), end: close };
    }
  }
  return null;
}

export function extractMarkdownLinks(source) {
  const text = markdownText(source);
  const definitions = new Map();
  const definitionRows = new Set();
  for (const match of text.matchAll(/^ {0,3}\[([^\]\n]+)\]:\s*(?:<([^>\n]*)>|([^\s]+))/gm)) {
    definitions.set(referenceKey(match[1]), match[2] ?? match[3]);
    definitionRows.add(text.slice(0, match.index).split('\n').length);
  }
  const links = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '[') continue;
    const row = text.slice(0, i).split('\n').length;
    if (definitionRows.has(row)) continue;
    const close = closeBracket(text, i);
    if (close < 0) continue;
    const label = text.slice(i + 1, close);
    let result = null;
    if (text[close + 1] === '(') result = inlineDestination(text, close + 1);
    else if (text[close + 1] === '[') {
      const referenceEnd = closeBracket(text, close + 1);
      if (referenceEnd >= 0) {
        const key = referenceKey(text.slice(close + 2, referenceEnd) || label);
        if (definitions.has(key)) result = { target: definitions.get(key), end: referenceEnd };
      }
    } else {
      const key = referenceKey(label);
      if (definitions.has(key)) result = { target: definitions.get(key), end: close };
    }
    if (result) { links.push({ target: result.target.replace(/\\([\\()\[\] ])/g, '$1'), line: row }); i = result.end; }
  }
  return links;
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files.sort();
}

export async function verifyPlanning(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const files = await markdownFiles(path.join(root, stage));
  const errors = [];
  const localLinks = [];
  for (const file of files) {
    const body = await fs.readFile(file, 'utf8');
    for (const link of extractMarkdownLinks(body)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link.target)) continue;
      const relative = path.relative(root, file).replaceAll('\\', '/');
      const targetPath = link.target.split(/[?#]/)[0];
      let decoded;
      try { decoded = decodeURIComponent(targetPath); }
      catch { errors.push({ check: 'relative-link', file: relative, line: link.line, target: link.target, reason: 'invalid URI encoding' }); continue; }
      const resolved = decoded.startsWith('/') ? path.resolve(root, '.' + decoded) : path.resolve(path.dirname(file), decoded || path.basename(file));
      const relResolved = path.relative(root, resolved).replaceAll('\\', '/');
      localLinks.push({ file: relative, line: link.line, target: link.target, resolved: relResolved });
      if (relResolved === '..' || relResolved.startsWith('../')) {
        errors.push({ check: 'relative-link', file: relative, line: link.line, target: link.target, reason: 'outside repository root' }); continue;
      }
      try { await fs.access(resolved); }
      catch { errors.push({ check: 'relative-link', file: relative, line: link.line, target: link.target, reason: 'target missing' }); }
    }
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, stage, 'manifest.json'), 'utf8'));
  const steps = manifest.lanes.flatMap(lane => lane.steps);
  const byCode = new Map(steps.map(step => [step.code, step]));
  for (const lane of manifest.lanes) {
    try { await fs.access(path.join(root, stage, lane.agent)); }
    catch { errors.push({ check: 'agent-guide', path: lane.agent }); }
    for (const step of lane.steps) {
      try {
        const body = await fs.readFile(path.join(root, stage, step.markdown), 'utf8');
        const sections = ['## Objetivo', '## Dependências', '## Passo a passo', '## Entregáveis', '## Critérios de aceite', '## Fora de escopo', '## Gate humano pendente'];
        for (const section of sections) if (!body.includes(section)) errors.push({ check: 'required-section', code: step.code, section });
        if (!/^1\. /m.test(body) || !/^2\. /m.test(body)) errors.push({ check: 'numbered-steps', code: step.code });
      } catch { errors.push({ check: 'microissue-markdown', code: step.code, path: step.markdown }); }
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(code) {
    if (visiting.has(code)) { errors.push({ check: 'dependency-cycle', code }); return; }
    if (visited.has(code)) return;
    if (!byCode.has(code)) { errors.push({ check: 'unresolved-dependency', code }); return; }
    visiting.add(code);
    const step = byCode.get(code);
    for (const dependency of new Set([...(step.dependsOn || []), ...(step.completionDependsOn || [])])) visit(dependency);
    visiting.delete(code); visited.add(code);
  }
  for (const step of steps) visit(step.code);
  const order = new Map(manifest.executionOrder.map((code, index) => [code, index]));
  if (order.size !== steps.length || manifest.executionOrder.length !== steps.length) errors.push({ check: 'execution-order-count' });
  for (const step of steps) {
    if (!order.has(step.code)) errors.push({ check: 'execution-order-missing', code: step.code });
    for (const dependency of new Set([...(step.dependsOn || []), ...(step.completionDependsOn || [])])) {
      if (!(order.get(dependency) < order.get(step.code))) errors.push({ check: 'execution-order-dependency', code: step.code, dependency });
    }
  }
  return {
    checkedAt: new Date().toISOString(),
    scope: 'planning-documentation-only',
    counts: { lanes: manifest.lanes.length, agentGuides: manifest.lanes.length, microissues: steps.length, markdownFiles: files.length, localLinksChecked: localLinks.length },
    checks: {
      requiredSectionsAndNumberedSteps: !errors.some(error => /required-section|numbered-steps|microissue-markdown|agent-guide/.test(error.check)),
      relativeLinks: !errors.some(error => error.check === 'relative-link'),
      resolvedReferences: !errors.some(error => /unresolved-dependency|agent-guide|microissue-markdown/.test(error.check)),
      dependencyGraphAcyclic: !errors.some(error => error.check === 'dependency-cycle'),
      executionOrder: !errors.some(error => error.check.startsWith('execution-order'))
    },
    status: errors.length ? 'failed' : 'passed',
    errors,
    localLinks
  };
}
