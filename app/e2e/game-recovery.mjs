import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only application review. Every API request is intercepted: no live votes.
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../../', import.meta.url)));
const base = process.argv[3] || process.env.POLIMATCH_E2E_URL || 'http://127.0.0.1:4173';
const moduleAt = relative => import(pathToFileURL(path.join(root, relative)).href);
const engines = await moduleAt('app/node_modules/playwright/index.mjs');
const chromium = engines[process.env.POLIMATCH_E2E_BROWSER || 'chromium'];
const { approvedEditorialCandidates } = await moduleAt('app/e2e/editorial-fixtures.mjs');
const { completedDailySession } = await moduleAt('app/e2e/daily-fixture.mjs');
const { capabilityFixture, voteResponseV2 } = await moduleAt('app/e2e/aggregate-fixture.mjs');
const catalog = JSON.parse(await readFile(path.join(root, 'shared/elections-2026.json'), 'utf8'));
const candidates = approvedEditorialCandidates(catalog.slice(0, 8));
const ids = candidates.slice(0, 2).map(p => p.id);
const roundId = '550e8400-e29b-41d4-a716-000000000101';
const rank = (played = false) => candidates.map((person, index) => ({ ...person,
  elo: played && index < 2 ? index === 0 ? 1016 : 984 : 1000,
  wins: played && index === 0 ? 1 : 0, losses: played && index === 1 ? 1 : 0,
  decisions: played && index < 2 ? 1 : 0, winRate: played && index === 0 ? 100 : 0,
  rank: played && index < 2 ? index + 1 : null,
}));
const receipt = request => {
  const feedback = { primaryEvent: 'confirm', rankingEvent: 'confirm', zebra: false,
    outcomes: ids.map(id => ({ id, result: id === request.winnerId ? 'winner' : 'loser',
      delta: id === request.winnerId ? 16 : -16, elo: id === request.winnerId ? 1016 : 984,
      previousTier: {id:'contender',label:'No páreo',level:2}, tier:{id:'contender',label:'No páreo',level:2}, tierChange:null,
    })) };
  const round = { id: request.roundId, status:'created', winnerId:request.winnerId, candidateIds:ids,
    comparisons:1, personalFeedback:feedback, feedbackScope:'personal', zebra:false };
  return voteResponseV2({ player:{version:1,duels:1,ranking:rank(true)}, round, vote:round }, {aggregate:false});
};
const browser = await chromium.launch();
const results = [];
async function scenario(name, check, { predictions = false, unauthorized = false, holdVote = false, mirrorExpires = false, finishAfterVote = false } = {}) {
  const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  console.log('Probing: ' + name);
  let releaseVote, releaseDiscard;
  const voteGate = new Promise(resolve => {releaseVote=resolve;});
  const discardGate = new Promise(resolve => {releaseDiscard=resolve;});
  const observed = { pairRequests:[], votes:[], discards:[], errors:[], creates:0 };
  const validUntil = new Date(Date.now() + 3000).toISOString();
  page.on('pageerror', error => observed.errors.push(error.message));
  await page.route(/\/api(?:\/|$)/, async route => {
    const req = route.request(), url = new URL(req.url());
    const payload = req.method() === 'POST' ? req.postDataJSON() || {} : {};
    let body;
    if (url.pathname === '/api/capabilities') body = mirrorExpires ? capabilityFixture(['mirror-comparison'], {validUntil}) : capabilityFixture(predictions ? ['prediction-reveal'] : []);
    else if (url.pathname === '/api/game-capabilities') body = {version:1,pairs:true,discard:true,collection:true,mirror:true};
    else if (url.pathname === '/api/candidates') body = {candidates};
    else if (url.pathname === '/api/player') body = {recoveryKey:`probe-player-${++observed.creates}`};
    else if (url.pathname === '/api/player/state') body = {version:0,duels:0,ranking:rank()};
    else if (url.pathname === '/api/daily-session') body = completedDailySession(candidates);
    else if (url.pathname === '/api/mirror-comparison') body = {status:'published', comparison:{date:'2026-09-16',aligned:5,rounds:10,tied:0,completedPlayers:12}};
    else if (url.pathname === '/api/discard-offer') body = {...payload,offered:true};
    else if (url.pathname === '/api/pair-round') {
      observed.pairRequests.push({payload,identity:req.headers().authorization});
      body = {status:'active',mode:payload.mode,remaining:3,round:{id:roundId,candidateIds:ids}};
      if (finishAfterVote && observed.votes.length) body = {status:'completed',mode:payload.mode,remaining:0,round:null};
    } else if (url.pathname === '/api/pair-vote') {
      observed.votes.push({payload,identity:req.headers().authorization});
      if (unauthorized && observed.votes.length === 1) return route.fulfill({status:401,json:{error:'identidade expirada',code:'PLAYER_NOT_FOUND'}});
      if (holdVote) await voteGate;
      body = receipt(payload);
    } else if (url.pathname === '/api/round-discard') {
      observed.discards.push(payload);
      await discardGate;
      body = {...payload,status:'created',rankingEffect:'none'};
    } else return route.fulfill({status:404,json:{error:'unmocked endpoint'}});
    await route.fulfill({status:200,json:body});
  });
  await page.route('https://accounts.google.com/**', route => route.abort());
  try {
    await page.goto(base, {waitUntil:'networkidle'});
    await page.locator('.nav-button[data-screen="duel"]').click();
    await page.locator('.arena-pair [data-vote]').first().waitFor({state:'visible'});
    const details = await check({page, observed, releaseVote, releaseDiscard, validUntil});
    results.push({name,pass:true,details});
  } catch(error) {results.push({name,pass:false,error:error.message,observed}); console.log(error.message);}
  finally { releaseVote(); releaseDiscard(); await context.close(); }
}
try {
  await scenario('pair exit is blocked while its vote is pending', async ({page,observed,releaseVote}) => {
    await page.locator('.arena-pair [data-vote]').first().click();
    await page.waitForFunction(() => document.querySelector('[data-duel-arena] [data-vote]')?.getAttribute('aria-disabled') === 'true');
    const leave = page.locator('#leave-pair');
    const blocked = await leave.isDisabled() || await leave.getAttribute('aria-disabled') === 'true';
    if (!blocked) await leave.press('Enter');
    releaseVote();
    assert.ok(blocked, 'Leave button permits changing mode while pair-vote is in flight');
    return {votes:observed.votes.length};
  }, {holdVote:true});
  await scenario('discard preserves focused control while confirmation is pending', async ({page}) => {
    await page.locator('.arena-pair [data-vote]').first().click();
    const skip = page.locator('[data-discard=""]');
    await skip.waitFor({state:'visible'});
    await skip.focus();
    await skip.evaluate(button => {window.__probeDiscardButton = button;});
    await skip.press('Enter');
    const focus = await page.evaluate(() => ({connected:window.__probeDiscardButton.isConnected,same:document.activeElement === window.__probeDiscardButton,active:document.activeElement.outerHTML.slice(0,150)}));
    assert.ok(focus.connected && focus.same, JSON.stringify(focus));
    return focus;
  });
  await scenario('new anonymous identity receives its own issued pair after 401', async ({page,observed}) => {
    await page.locator('.arena-pair [data-vote]').first().click();
    const restore = page.getByRole('button', {name:/Restabelecer|Restaurar sessão/});
    await restore.waitFor({timeout:5000});
    await restore.click();
    await page.waitForFunction(() => !document.body.innerText.includes('Restabelecendo sua sessão'));
    assert.ok(observed.pairRequests.some(request => request.identity === 'Bearer probe-player-2'), JSON.stringify(observed));
    return {pairRequests:observed.pairRequests.length};
  }, {unauthorized:true});
  await scenario('refreshing aggregate permissions preserves pair cards', async ({page}) => {
    const before = await page.locator('.arena-pair [data-vote]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.vote));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(120);
    const after = await page.locator('.arena-pair [data-vote]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.vote));
    assert.deepEqual(after, before, 'Refreshing permissions replaced the issued pair with daily session state');
    return {before,after};
  }, {predictions:true});
  await scenario('pair exit control is reachable by touch above fixed navigation', async ({page}) => {
    const leave = page.locator('#leave-pair');
    await leave.scrollIntoViewIfNeeded();
    const hit = await leave.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {reachable:button === top || button.contains(top),buttonTop:rect.top,buttonBottom:rect.bottom,hit:top?.outerHTML.slice(0,180)};
    });
    assert.ok(hit.reachable, JSON.stringify(hit));
    return hit;
  });
  await scenario('mirror comparison disappears when its independent permission expires', async ({page,validUntil}) => {
    await page.locator('#leave-pair').click();
    await page.locator('#mirror-comparison').click();
    await page.locator('.mirror-comparison').getByText(/5 de 10 rodadas/).waitFor();
    await page.waitForTimeout(Math.max(0, Date.parse(validUntil)-Date.now()+200));
    assert.equal(await page.locator('.mirror-comparison:visible').count(), 0, 'Expired aggregate comparison remains in the visible DOM');
    return {validUntil};
  }, {mirrorExpires:true});
  await scenario('last discard moves keyboard focus to visible completion content', async ({page,releaseDiscard}) => {
    await page.locator('.arena-pair [data-vote]').first().click();
    const skip = page.locator('[data-discard=""]');
    await skip.waitFor({state:'visible'});
    await skip.focus();
    releaseDiscard();
    await skip.press('Enter');
    await page.getByText('Aquecimento concluído. Agora vêm as dez escolhas do dia.').waitFor();
    const focused = await page.evaluate(() => ({tag:document.activeElement.tagName,id:document.activeElement.id,hidden:Boolean(document.activeElement.closest('[hidden]')),text:document.activeElement.textContent.slice(0,80)}));
    assert.ok(focused.tag !== 'BODY' && !focused.hidden, JSON.stringify(focused));
    return focused;
  }, {finishAfterVote:true});
} finally { await browser.close(); }
const report = {reviewedAt:new Date().toISOString(),base,results};
console.log(JSON.stringify(report,null,2));
if (process.env.POLIMATCH_GAME_REPORT) await writeFile(process.env.POLIMATCH_GAME_REPORT,JSON.stringify(report,null,2)+'\n');
process.exitCode = results.every(result => result.pass) ? 0 : 1;
