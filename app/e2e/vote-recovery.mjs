/**
 * Recuperação do voto quando a rede falha.
 *
 * Caminhos que só aparecem na conversa entre cliente e servidor:
 *
 *   1. Resposta que chega depois do tempo limite. O servidor gravou; o cliente
 *      desistiu. Antes, a versão pessoal ficava para trás e todo voto seguinte
 *      recebia 409 até alguém recarregar a página.
 *   2. Indisponibilidade passageira ao iniciar. Antes, qualquer falha de
 *      `/api/player/state` apagava a chave de recuperação — a única credencial
 *      do jogador — e o histórico ficava órfão.
 *   3. Credencial realmente inválida. Um 401 precisa continuar criando um
 *      jogador novo, para a proteção contra 503 não ir longe demais.
 *   4. Conflito real de versão. O servidor rejeita a escolha antes de gravá-la;
 *      o cliente precisa ressincronizar e manter a mesma escolha para retry.
 *   5. Repetição do mesmo voto. O `roundId` precisa nascer com a rodada, senão
 *      a idempotência do servidor não reconhece a segunda tentativa.
 *   6. Resposta 200 truncada. Sem o contrato completo do servidor, a interface
 *      não pode inventar confirmação, contadores nem deltas nas cartas.
 *   7. Replay legado. Só o evento público persistido pode reaparecer; o app
 *      precisa dizer honestamente que o detalhe pessoal antigo não existe.
 *
 * O servidor aqui é falso, mas guarda estado: versão, contagem de rodadas e os
 * roundIds já vistos. Sem isso nenhum dos sete cenários é observável.
 */
import { chromium, webkit } from "playwright";
import { completedDailySession } from "./daily-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

/** Acima de `TIMEOUT_MS` de app/src/api.js, para o cliente desistir primeiro. */
const ALEM_DO_TEMPO_LIMITE = 9000;
const RECOVERY_KEY = "pm2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const personalRankingPolicy = {
  id: "pairwise-majority-scc-v1",
  label: "maioria nos confrontos observados",
  explanation: "A ordem usa os confrontos diretos e mantém empates sem usar exposição.",
};

const candidates = ["lula", "jair-bolsonaro", "anitta", "neymar-jr"].map((id, index) => ({
  personId: index + 1,
  id,
  name: `Pessoa De Teste ${index + 1}`,
  displayName: `Pessoa ${index + 1}`,
  party: "XX",
  role: "Cargo de teste",
  office: "Cargo de teste",
  summary: "Resumo de teste.",
  bio: "Perfil editorial de teste.",
}));

/** Servidor falso com estado — é o estado que torna os cenários observáveis. */
function criarServidor() {
  return {
    version: 0,
    duels: 0,
    rounds: new Map(),
    requests: [],
    chaves: new Set([RECOVERY_KEY]),
    /** Resposta HTTP forçada para a próxima tentativa de voto. */
    falhaNoProximoVoto: null,
    /** Falha a ser aplicada na próxima chamada de /api/player/state. */
    falhaNoEstado: null,
    ranking() {
      return candidates.map((candidate) => ({
        ...candidate,
        elo: 1000,
        wins: 0,
        losses: 0,
        decisions: 0,
        winRate: 0,
        rank: null,
      }));
    },
  };
}

function corpoDaRodada(servidor, roundId, winnerId, candidateIds) {
  return {
    topicId: "eleicoes-2026",
    duels: servidor.duels,
    ranking: servidor.ranking(),
    player: { version: servidor.version, duels: servidor.duels, rankingPolicy: personalRankingPolicy, ranking: servidor.ranking() },
    round: {
      id: roundId,
      status: "created",
      winnerId,
      candidateIds: [...candidateIds],
      winnerDelta: 45,
      zebra: false,
      comparisons: 3,
      rankingEvent: "overtake",
    },
    vote: {
      id: roundId,
      status: "created",
      winnerId,
      candidateIds: [...candidateIds],
      winnerDelta: 45,
      zebra: false,
      comparisons: 3,
      rankingEvent: "overtake",
      feedback: {
        primaryEvent: "overtake",
        rankingEvent: "overtake",
        zebra: false,
        outcomes: candidateIds.map((id) => ({
          id,
          result: id === winnerId ? "winner" : "loser",
          delta: id === winnerId ? 45 : -15,
          elo: id === winnerId ? 1045 : 985,
          previousTier: { id: "contender", label: "No páreo", level: 2 },
          tier: { id: "contender", label: "No páreo", level: 2 },
          tierChange: null,
        })),
      },
      personalFeedback: {
        primaryEvent: "overtake",
        rankingEvent: "overtake",
        zebra: false,
        outcomes: candidateIds.map((id) => ({
          id,
          result: id === winnerId ? "winner" : "loser",
          delta: id === winnerId ? 45 : -15,
          elo: id === winnerId ? 1045 : 985,
          previousTier: { id: "contender", label: "No páreo", level: 2 },
          tier: { id: "contender", label: "No páreo", level: 2 },
          tierChange: null,
        })),
      },
      feedbackScope: "personal",
      globalEvent: null,
    },
  };
}

async function instalarServidor(page, servidor) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
    if (pathname === "/api/ranking") {
      return route.fulfill({ status: 200, json: { topicId: "eleicoes-2026", duels: servidor.duels, ranking: servidor.ranking() } });
    }
    if (pathname === "/api/player" && request.method() === "POST") {
      const nova = `pm2_${"b".repeat(43)}`;
      servidor.chaves.add(nova);
      return route.fulfill({ status: 201, json: { recoveryKey: nova } });
    }

    if (pathname === "/api/player/state") {
      const falha = servidor.falhaNoEstado;
      if (falha) {
        servidor.falhaNoEstado = null;
        return route.fulfill({ status: falha, json: { error: `falha forçada ${falha}` } });
      }
      return route.fulfill({
        status: 200,
        json: { topicId: "eleicoes-2026", duels: servidor.duels, rankingPolicy: personalRankingPolicy, ranking: servidor.ranking(), version: servidor.version },
      });
    }
    if (pathname === "/api/daily-session") {
      return route.fulfill({ status: 200, json: completedDailySession(candidates) });
    }

    if (pathname === "/api/round-vote" && request.method() === "POST") {
      const { roundId, winnerId, candidateIds, playerVersion } = request.postDataJSON();
      servidor.requests.push({ roundId, winnerId, candidateIds, playerVersion });

      const falha = servidor.falhaNoProximoVoto;
      if (falha) {
        servidor.falhaNoProximoVoto = null;
        const body = typeof falha.body === "function"
          ? falha.body({ roundId, winnerId, candidateIds, playerVersion })
          : falha.body;
        return route.fulfill({ status: falha.status, json: body });
      }

      // Repetição: devolve o resultado guardado sem contar de novo, como o
      // servidor real faz com a trava consultiva e o UNIQUE em round_id.
      const guardada = servidor.rounds.get(roundId);
      if (guardada) {
        const repetida = structuredClone(guardada);
        repetida.round.status = "alreadyProcessed";
        repetida.vote.status = "alreadyProcessed";
        return route.fulfill({ status: 200, json: repetida });
      }

      if (Number(playerVersion) !== servidor.version) {
        return route.fulfill({
          status: 409,
          json: { error: "ranking pessoal mais recente disponível", code: "PLAYER_VERSION_CONFLICT", current: servidor.version },
        });
      }

      servidor.version += 1;
      servidor.duels += 1;
      const corpo = corpoDaRodada(servidor, roundId, winnerId, candidateIds);
      servidor.rounds.set(roundId, corpo);

      if (servidor.atrasarProximaRodada) {
        servidor.atrasarProximaRodada = false;
        // A gravação já aconteceu; só a resposta demora. É exatamente o caso
        // em que dizer "seu voto não foi contado" seria mentira.
        await new Promise((resolve) => setTimeout(resolve, ALEM_DO_TEMPO_LIMITE));
      }
      return route.fulfill({ status: 200, json: corpo });
    }

    return route.fulfill({ status: 404, json: { error: "rota não encontrada" } });
  });
}

async function abrirDuelo(page) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Duelo" }).click();
  await page.getByRole("button", { name: "Continuar no modo livre" }).click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  const coach = page.getByRole("button", { name: "Começar rodada" });
  if (await coach.count()) await coach.click();
  const retry = page.locator("#retry-vote");
  if (await retry.count() !== 1 || !await retry.isHidden()) {
    throw new Error("o controle persistente de repetição deveria existir oculto antes de uma falha");
  }
  await retry.evaluate((node) => { window.__polimatchRetryNode = node; });
}

const votar = (page) => page.locator(".candidate-card").first().click();
const chaveGuardada = (page) => page.evaluate(() => localStorage.getItem("polimatch:v3:recovery-key"));
const instrucao = async (page) => (await page.locator(".round-instruction").innerText()).trim();

async function exigirPerfisBloqueados(page, contexto) {
  const bloqueios = await page.locator(".profile-trigger").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-disabled"))
  ));
  if (bloqueios.length !== 4 || bloqueios.some((value) => value !== "true")) {
    throw new Error(`${contexto}: os perfis não herdaram o bloqueio da rodada pendente (${bloqueios.join(", ")})`);
  }
  const perfil = page.locator(".profile-trigger").first();
  await perfil.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  if (await page.locator("#modal").evaluate((dialog) => dialog.open)) {
    throw new Error(`${contexto}: um perfil abriu durante a recuperação da escolha pendente`);
  }
}

async function novaSessao(browser, servidor, { chaveInicial = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await instalarServidor(page, servidor);
  if (chaveInicial) {
    await page.addInitScript((key) => localStorage.setItem("polimatch:v3:recovery-key", key), chaveInicial);
  }
  return { context, page, pageErrors };
}

const browser = await browserType.launch();

try {
  // ------------------------------------------------------------ cenário 1
  // Resposta que chega tarde demais: o voto contou, o cliente não soube.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);

    servidor.atrasarProximaRodada = true;
    const versaoAntes = servidor.version;
    await votar(page);
    await page.waitForTimeout(ALEM_DO_TEMPO_LIMITE + 1500);

    if (servidor.version !== versaoAntes + 1) {
      throw new Error("o cenário não reproduziu: o servidor deveria ter gravado a rodada lenta");
    }
    const mensagem = await instrucao(page);
    if (/não foi contado/i.test(mensagem)) {
      throw new Error(`a mensagem afirma falsamente que o voto não contou: "${mensagem}"`);
    }
    if (await page.locator(".round-instruction.is-error").count() !== 1) {
      throw new Error("a falha do voto não recebeu grafia de erro");
    }
    if (!await page.locator("#retry-vote").isVisible()) {
      throw new Error("a falha do voto não ofereceu Tentar de novo");
    }
    if (!await page.evaluate(() => window.__polimatchRetryNode === document.querySelector("#retry-vote"))) {
      throw new Error("a falha substituiu o controle persistente Tentar de novo");
    }

    // O ponto central: o app precisa voltar a votar sem recarregar a página.
    await page.locator("#retry-vote").click();
    await page.waitForTimeout(2200);
    if (!await page.locator("#retry-vote").isHidden()) {
      throw new Error("Tentar de novo continuou exposto depois de a repetição ser confirmada");
    }
    for (let rodada = 0; rodada < 3; rodada += 1) {
      const antes = servidor.duels;
      await votar(page);
      await page.waitForTimeout(2000);
      if (servidor.duels <= antes) {
        throw new Error(`o app travou depois do tempo esgotado: o voto ${rodada + 1} não foi registrado`);
      }
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 2
  // Indisponibilidade passageira não pode apagar a credencial do jogador.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);
    await votar(page);
    await page.waitForTimeout(1800);

    const duelsAntes = servidor.duels;
    servidor.falhaNoEstado = 503;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    if (await chaveGuardada(page) !== RECOVERY_KEY) {
      throw new Error("um 503 passageiro apagou a chave de recuperação do jogador");
    }
    if (servidor.duels !== duelsAntes) {
      throw new Error("o histórico do jogador foi perdido depois do 503");
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 3
  // Um 401 de verdade continua trocando a chave. Guarda contra a correção do
  // cenário 2 ter ido longe demais.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);

    servidor.falhaNoEstado = 401;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const depois = await chaveGuardada(page);
    if (!depois || depois === RECOVERY_KEY) {
      throw new Error("um 401 real deveria descartar a chave e criar um jogador novo");
    }
    await abrirDuelo(page);
    if (await page.locator(".candidate-card").count() !== 4) {
      throw new Error("o app não voltou a ficar utilizável depois do 401");
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 4
  // Um 409 real rejeita a rodada antes de gravá-la. Depois de ressincronizar,
  // o app deve preservar escolha e roundId para uma nova confirmação explícita.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);

    // Simula outra aba avançando a versão depois que esta tela carregou.
    servidor.version = 1;
    await votar(page);
    await page.waitForTimeout(900);

    if (servidor.duels !== 0 || servidor.rounds.size !== 0) {
      throw new Error("o servidor não deveria gravar a escolha rejeitada por conflito de versão");
    }
    if (await page.locator("#retry-vote").count() !== 1) {
      throw new Error("o 409 descartou a escolha em vez de oferecer nova confirmação");
    }

    await page.locator("#retry-vote").click();
    await page.waitForTimeout(2200);

    if (servidor.duels !== 1 || servidor.rounds.size !== 1) {
      throw new Error("a escolha não foi registrada uma única vez depois da ressincronização");
    }
    const [rejeitada, confirmada] = servidor.requests;
    if (!rejeitada || !confirmada) throw new Error("o cenário 409 não realizou as duas tentativas esperadas");
    if (rejeitada.roundId !== confirmada.roundId || rejeitada.winnerId !== confirmada.winnerId) {
      throw new Error("o retry do 409 trocou a rodada ou a escolha original");
    }
    if (Number(rejeitada.playerVersion) !== 0 || Number(confirmada.playerVersion) !== 1) {
      throw new Error("o retry do 409 não usou a versão pessoal ressincronizada");
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 5
  // O roundId nasce com a rodada: repetir o mesmo voto não conta duas vezes.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);

    servidor.atrasarProximaRodada = true;
    const candidataPendente = page.locator(".candidate-card").first();
    await candidataPendente.evaluate((node) => { window.__polimatchPendingCandidateNode = node; });
    await votar(page);
    await page.waitForTimeout(ALEM_DO_TEMPO_LIMITE + 1500);
    const duelsDepoisDaPrimeira = servidor.duels;

    const retry = page.locator("#retry-vote");
    await retry.focus();
    if (!await retry.evaluate((node) => document.activeElement === node)) {
      throw new Error("Tentar de novo não recebeu foco antes da repetição por teclado");
    }
    await page.keyboard.press("Enter");
    if (!await page.evaluate(() => document.activeElement === window.__polimatchPendingCandidateNode)) {
      throw new Error("o retry ocultou o botão focado antes de transferir o foco para a carta pendente");
    }
    await page.waitForTimeout(2200);

    if (servidor.duels !== duelsDepoisDaPrimeira) {
      throw new Error(
        `a repetição virou uma segunda rodada (duels ${duelsDepoisDaPrimeira} -> ${servidor.duels}); `
        + "o roundId precisa nascer com a rodada, não com a requisição",
      );
    }
    if (servidor.rounds.size !== 1) {
      throw new Error(`a repetição criou ${servidor.rounds.size} rodadas no servidor; deveria reaproveitar a mesma`);
    }
    const focoDepoisDaNovaRodada = await page.evaluate(() => ({
      preservouNo: document.activeElement === window.__polimatchPendingCandidateNode,
      classe: document.activeElement?.className || "",
      voto: document.activeElement?.dataset?.vote || "",
    }));
    if (!focoDepoisDaNovaRodada.preservouNo) {
      throw new Error(
        "Tentar de novo foi ocultado sem preservar o foco na carta persistente "
        + `(foco final: ${focoDepoisDaNovaRodada.classe || "nenhum"}, voto: ${focoDepoisDaNovaRodada.voto || "nenhum"})`,
      );
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 6
  // Um status 200 não confirma nada quando faltam os campos consumidos pela
  // interface. A mesma escolha deve permanecer congelada e repetível.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);
    const rodadaAntes = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => card.dataset.vote));
    const progressoAntes = (await page.locator(".progress-pill").innerText()).trim();
    servidor.falhaNoProximoVoto = {
      status: 200,
      body: { duels: 1, ranking: [], player: { duels: 1, version: 1, ranking: [] } },
    };

    await votar(page);
    await page.locator("#retry-vote").waitFor();
    if (await instrucao(page) !== "Não foi possível confirmar agora.") {
      throw new Error(`200 truncado recebeu mensagem inesperada: ${await instrucao(page)}`);
    }
    const rodadaDepois = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => card.dataset.vote));
    const progressoDepois = (await page.locator(".progress-pill").innerText()).trim();
    if (JSON.stringify(rodadaDepois) !== JSON.stringify(rodadaAntes) || progressoDepois !== progressoAntes) {
      throw new Error("o 200 truncado alterou cartas ou progresso sem confirmação íntegra");
    }
    if (await page.locator(".card-outcome:visible").count()) {
      throw new Error("o 200 truncado produziu feedback visual de confirmação");
    }
    if (!await page.locator(".candidate-card").evaluateAll((cards) => cards.every((card) => card.getAttribute("aria-disabled") === "true" && !card.disabled))) {
      throw new Error("o 200 truncado deixou a rodada pendente editável");
    }
    await exigirPerfisBloqueados(page, "200 truncado");
    const pedidosAntesDoCliqueBloqueado = servidor.requests.length;
    await page.locator(".candidate-card").nth(1).evaluate((card) => card.click());
    await page.waitForTimeout(100);
    if (servidor.requests.length !== pedidosAntesDoCliqueBloqueado) {
      throw new Error("uma carta aria-disabled enviou outro voto enquanto a rodada estava pendente");
    }
    if (servidor.duels !== 0) throw new Error("o mock truncado não deveria gravar progresso");

    await page.locator("#retry-vote").click();
    await page.waitForTimeout(2200);
    if (servidor.duels !== 1 || servidor.requests.length !== 2) {
      throw new Error("o retry depois do 200 truncado não confirmou uma única rodada");
    }
    const [truncada, confirmada] = servidor.requests;
    if (truncada.roundId !== confirmada.roundId
      || truncada.winnerId !== confirmada.winnerId
      || JSON.stringify(truncada.candidateIds) !== JSON.stringify(confirmada.candidateIds)) {
      throw new Error("o retry do 200 truncado trocou a rodada ou a escolha original");
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  // ------------------------------------------------------------ cenário 7
  // Rodadas anteriores à separação dos canais não têm resultado pessoal para
  // reconstruir. O evento público continua público, sem virar dado do jogador.
  {
    const servidor = criarServidor();
    const { context, page, pageErrors } = await novaSessao(browser, servidor, { chaveInicial: RECOVERY_KEY });
    await abrirDuelo(page);
    servidor.falhaNoProximoVoto = {
      status: 200,
      body: ({ roundId, winnerId, candidateIds }) => {
        servidor.version = 1;
        servidor.duels = 1;
        const replay = corpoDaRodada(servidor, roundId, winnerId, candidateIds);
        const globalFeedback = {
          ...replay.vote.personalFeedback,
          rankingEvent: "top10",
          primaryEvent: "top10",
        };
        const neutralPersonalFeedback = {
          rankingEvent: "confirm",
          primaryEvent: "confirm",
          zebra: false,
          outcomes: [],
        };
        replay.round.status = "alreadyProcessed";
        Object.assign(replay.vote, {
          status: "alreadyProcessed",
          feedbackScope: "legacy-global",
          feedback: neutralPersonalFeedback,
          personalFeedback: neutralPersonalFeedback,
          globalEvent: {
            scope: "global",
            rankingEvent: "top10",
            winnerDelta: 45,
            zebra: false,
            feedback: globalFeedback,
          },
        });
        return replay;
      },
    };

    await votar(page);
    await page.getByText("Escolha já confirmada. O detalhamento pessoal desta rodada anterior não está disponível.", { exact: true }).waitFor();
    if (!await page.getByText("No seu ranking", { exact: true }).isVisible()) {
      throw new Error("o replay legado perdeu o rótulo do canal pessoal indisponível");
    }
    if (!await page.getByText("No placar do público", { exact: true }).isVisible()) {
      throw new Error("o replay legado ocultou ou relabelou o evento público persistido");
    }
    if ((await page.locator("body").innerText()).includes("confirmado no seu ranking")) {
      throw new Error("o replay legado inventou detalhamento pessoal para a rodada anterior");
    }
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  console.log(`${browserName}: recuperação validada — timeout, 503, 401, 409, idempotência, 200 truncado e replay legado`);
} finally {
  await browser.close();
}
