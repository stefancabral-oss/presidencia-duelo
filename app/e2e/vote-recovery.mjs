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
 *
 * O servidor aqui é falso, mas guarda estado: versão, contagem de rodadas e os
 * roundIds já vistos. Sem isso nenhum dos cinco cenários é observável.
 */
import { chromium, webkit } from "playwright";

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
    round: { id: roundId, status: "created", winnerDelta: 45, zebra: false, comparisons: 3, rankingEvent: "overtake" },
    vote: {
      id: roundId,
      status: "created",
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

    if (pathname === "/api/round-vote" && request.method() === "POST") {
      const { roundId, winnerId, candidateIds, playerVersion } = request.postDataJSON();
      servidor.requests.push({ roundId, winnerId, playerVersion });

      // Repetição: devolve o resultado guardado sem contar de novo, como o
      // servidor real faz com a trava consultiva e o UNIQUE em round_id.
      const guardada = servidor.rounds.get(roundId);
      if (guardada) return route.fulfill({ status: 200, json: guardada });

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
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  const coach = page.getByRole("button", { name: "Começar rodada" });
  if (await coach.count()) await coach.click();
}

const votar = (page) => page.locator(".candidate-card").first().click();
const chaveGuardada = (page) => page.evaluate(() => localStorage.getItem("polimatch:v3:recovery-key"));
const instrucao = async (page) => (await page.locator(".round-instruction").innerText()).trim();

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
    if (await page.locator("#retry-vote").count() !== 1) {
      throw new Error("a falha do voto não ofereceu Tentar de novo");
    }

    // O ponto central: o app precisa voltar a votar sem recarregar a página.
    await page.locator("#retry-vote").click();
    await page.waitForTimeout(2200);
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
    await votar(page);
    await page.waitForTimeout(ALEM_DO_TEMPO_LIMITE + 1500);
    const duelsDepoisDaPrimeira = servidor.duels;

    await page.locator("#retry-vote").click();
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
    if (pageErrors.length) throw new Error(`erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  console.log(`${browserName}: recuperação de voto validada — timeout, 503, 401, 409 e repetição idempotente`);
} finally {
  await browser.close();
}
