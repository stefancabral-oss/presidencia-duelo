(() => {
  "use strict";

  const STORAGE_KEY = "presidencia-duelo-v1";
  const ELO_K = 32;
  const ELO_START = 1000;

  // Dois pools de Elo independentes: a chapa é a mesma, mas presidentes e
  // vices são ranqueados separadamente.
  const MODES = {
    presidentes: { label: "Presidentes", singular: "presidente", mate: "Vice" },
    vices: { label: "Vices", singular: "vice", mate: "Presidente" },
  };
  const DEFAULT_MODE = "presidentes";

  // Raridade derivada apenas de dados do jogo (Elo e duelos). Nada de
  // atributos políticos inventados. Limiares relativos ao Elo inicial.
  const RARITY_TIERS = [
    { id: "lendario", label: "Lendário", min: ELO_START + 180 },
    { id: "epico", label: "Épico", min: ELO_START + 100 },
    { id: "raro", label: "Raro", min: ELO_START + 40 },
    { id: "comum", label: "Comum", min: -Infinity },
  ];
  const LEGENDARY = RARITY_TIERS[0];
  // Duelos mínimos para o líder da tabela receber a coroa de Lendário.
  const CROWN_MIN_DUELS = 6;

  // Cada chapa tem duas pessoas com a mesma forma. Vices ainda não têm foto
  // (photo: null) e caem no placeholder de iniciais; basta preencher o campo
  // quando uma imagem com crédito entrar em candidates/.
  const CANDIDATES = [
    {
      id: "lula",
      head: { name: "Luiz Inácio Lula da Silva", party: "PT", initials: "LS", photo: "candidates/lula.jpg" },
      vice: { name: "Geraldo Alckmin", party: "PSB", initials: "GA", photo: null },
    },
    {
      id: "flavio-bolsonaro",
      head: { name: "Flávio Bolsonaro", party: "PL", initials: "FB", photo: "candidates/flavio-bolsonaro.jpg" },
      vice: { name: "Alfredo Gaspar", party: "PL", initials: "AG", photo: null },
    },
    {
      id: "caiado",
      head: { name: "Ronaldo Caiado", party: "PSD", initials: "RC", photo: "candidates/caiado.jpg" },
      vice: { name: "Gilberto Kassab", party: "PSD", initials: "GK", photo: null },
    },
    {
      id: "zema",
      head: { name: "Romeu Zema", party: "Novo", initials: "RZ", photo: "candidates/zema.jpg" },
      vice: { name: "Eduardo Girão", party: "Novo", initials: "EG", photo: null },
    },
    {
      id: "renan-santos",
      head: { name: "Renan Santos", party: "Missão", initials: "RS", photo: "candidates/renan-santos.jpg" },
      vice: { name: "Aroldo Medina", party: "Missão", initials: "AM", photo: null },
    },
    {
      id: "cury",
      head: { name: "Augusto Cury", party: "Avante", initials: "AC", photo: "candidates/cury.jpg" },
      vice: { name: "Júlio Delgado", party: "Avante", initials: "JD", photo: null },
    },
    {
      id: "rui-costa-pimenta",
      head: { name: "Rui Costa Pimenta", party: "PCO", initials: "RP", photo: "candidates/rui-costa-pimenta.jpg" },
      vice: { name: "Antônio Carlos", party: "PCO", initials: "AC", photo: null },
    },
    {
      id: "samara-martins",
      head: { name: "Samara Martins", party: "UP", initials: "SM", photo: "candidates/samara-martins.jpg" },
      vice: { name: "Raquel Brício", party: "UP", initials: "RB", photo: null },
    },
    {
      id: "hertz-dias",
      head: { name: "Hertz Dias", party: "PSTU", initials: "HD", photo: "candidates/hertz-dias.jpg" },
      vice: { name: "Vanessa Portugal", party: "PSTU", initials: "VP", photo: null },
    },
    {
      id: "edmilson-costa",
      head: { name: "Edmilson Costa", party: "PCB", initials: "EC", photo: "candidates/edmilson-costa.jpg" },
      vice: { name: "Cleusa Santos", party: "PCB", initials: "CS", photo: null },
    },
    {
      id: "wilson-grassi",
      head: { name: "Wilson Grassi", party: "Democrata", initials: "WG", photo: "candidates/wilson-grassi.jpg" },
      vice: { name: "Suêd Haidar", party: "Democrata", initials: "SH", photo: null },
    },
    {
      id: "clariana-barao",
      head: { name: "Clariana Barão", party: "DC", initials: "CB", photo: "candidates/clariana-barao.jpg" },
      vice: { name: "Fabiana Torquato", party: "DC", initials: "FT", photo: null },
    },
  ];

  const byId = Object.fromEntries(CANDIDATES.map((c) => [c.id, c]));

  // Pessoa em disputa na chapa, e a companheira de chapa mostrada no rodapé.
  function personOf(c, mode) {
    return mode === "vices" ? c.vice : c.head;
  }
  function mateOf(c, mode) {
    return mode === "vices" ? c.head : c.vice;
  }

  // Sem foto, dois placeholders cinzas ficariam indistinguíveis, então cada
  // pessoa ganha uma matiz própria. O passo de 150 graus é coprimo com 360
  // em múltiplos de 30: as 12 matizes de um pool ficam distintas e vizinhos
  // da lista caem longe um do outro. Os vices deslocam 15 graus para não
  // repetir a cor do presidente da mesma chapa.
  CANDIDATES.forEach((c, i) => {
    c.head.hue = (i * 150) % 360;
    c.vice.hue = (i * 150 + 15) % 360;
  });

  function emptyPool() {
    const ratings = {};
    const wins = {};
    const losses = {};
    CANDIDATES.forEach((c) => {
      ratings[c.id] = ELO_START;
      wins[c.id] = 0;
      losses[c.id] = 0;
    });
    return { ratings, wins, losses, duels: 0, lastPair: null };
  }

  function normalizePool(raw) {
    const base = emptyPool();
    if (!raw || typeof raw !== "object") return base;
    return {
      ratings: { ...base.ratings, ...(raw.ratings || {}) },
      wins: { ...base.wins, ...(raw.wins || {}) },
      losses: { ...base.losses, ...(raw.losses || {}) },
      duels: raw.duels || 0,
      lastPair: raw.lastPair || null,
    };
  }

  function defaultState() {
    return {
      mode: DEFAULT_MODE,
      pools: { presidentes: emptyPool(), vices: emptyPool() },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // Antes do modo Vices o save tinha um único pool na raiz. Esse formato
      // antigo vira o pool de presidentes, então ninguém perde o ranking.
      const pools = parsed.pools || { presidentes: parsed };
      return {
        mode: MODES[parsed.mode] ? parsed.mode : DEFAULT_MODE,
        pools: {
          presidentes: normalizePool(pools.presidentes),
          vices: normalizePool(pools.vices),
        },
      };
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function expectedScore(ra, rb) {
    return 1 / (1 + Math.pow(10, (rb - ra) / 400));
  }

  function applyElo(pool, winnerId, loserId) {
    const ra = pool.ratings[winnerId];
    const rb = pool.ratings[loserId];
    const ea = expectedScore(ra, rb);
    const eb = expectedScore(rb, ra);
    pool.ratings[winnerId] = Math.round(ra + ELO_K * (1 - ea));
    pool.ratings[loserId] = Math.round(rb + ELO_K * (0 - eb));
    pool.wins[winnerId] += 1;
    pool.losses[loserId] += 1;
    pool.duels += 1;
  }

  function randomPair(pool) {
    const ids = CANDIDATES.map((c) => c.id);
    let a;
    let b;
    let tries = 0;
    do {
      a = ids[Math.floor(Math.random() * ids.length)];
      b = ids[Math.floor(Math.random() * ids.length)];
      tries += 1;
    } while (
      (a === b ||
        (pool.lastPair &&
          ((pool.lastPair[0] === a && pool.lastPair[1] === b) ||
            (pool.lastPair[0] === b && pool.lastPair[1] === a)))) &&
      tries < 40
    );
    if (a === b) {
      b = ids[(ids.indexOf(a) + 1) % ids.length];
    }
    return [a, b];
  }

  function winRate(pool, id) {
    const w = pool.wins[id] || 0;
    const l = pool.losses[id] || 0;
    const t = w + l;
    if (!t) return 0;
    return Math.round((100 * w) / t);
  }

  function duelsPlayed(pool, id) {
    return (pool.wins[id] || 0) + (pool.losses[id] || 0);
  }

  // Líder isolado da tabela, com duelos suficientes para valer a coroa.
  // Retorna null enquanto houver empate no topo ou amostra pequena.
  function findLeaderId(pool) {
    let leader = null;
    let bestElo = -Infinity;
    let tied = false;
    CANDIDATES.forEach((c) => {
      const elo = pool.ratings[c.id];
      if (elo > bestElo) {
        bestElo = elo;
        leader = c.id;
        tied = false;
      } else if (elo === bestElo) {
        tied = true;
      }
    });
    if (!leader || tied) return null;
    if (bestElo <= ELO_START) return null;
    if (duelsPlayed(pool, leader) < CROWN_MIN_DUELS) return null;
    return leader;
  }

  function rarityFor(pool, id, leaderId) {
    if (id === leaderId) return LEGENDARY;
    const elo = pool.ratings[id];
    return RARITY_TIERS.find((t) => elo >= t.min) || RARITY_TIERS[RARITY_TIERS.length - 1];
  }

  // DOM
  const els = {
    panelDuel: document.getElementById("panel-duel"),
    panelRank: document.getElementById("panel-rank"),
    tabDuel: document.getElementById("tab-duel"),
    tabRank: document.getElementById("tab-rank"),
    duelCount: document.getElementById("duel-count"),
    duelPrompt: document.getElementById("duel-prompt"),
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
    rankList: document.getElementById("rank-list"),
    rankMode: document.getElementById("rank-mode"),
    resetBtn: document.getElementById("reset-ranking"),
    modeBtns: {
      presidentes: document.getElementById("mode-presidentes"),
      vices: document.getElementById("mode-vices"),
    },
  };

  let state = loadState();
  let currentPair = null;
  let locked = false;

  function pool() {
    return state.pools[state.mode];
  }

  function setTab(name) {
    const duel = name === "duel";
    els.panelDuel.classList.toggle("active", duel);
    els.panelRank.classList.toggle("active", !duel);
    els.tabDuel.classList.toggle("active", duel);
    els.tabRank.classList.toggle("active", !duel);
    if (!duel) renderRanking();
  }

  function renderModeUi() {
    const mode = MODES[state.mode];
    Object.entries(els.modeBtns).forEach(([id, btn]) => {
      const on = id === state.mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    els.duelPrompt.textContent = `Toque no ${mode.singular} preferido`;
    els.rankMode.textContent = mode.label;
  }

  function setMode(mode) {
    if (!MODES[mode] || mode === state.mode) return;
    state.mode = mode;
    saveState(state);
    renderModeUi();
    nextDuel();
    if (els.panelRank.classList.contains("active")) renderRanking();
  }

  function renderCard(el, id, leaderId) {
    const c = byId[id];
    const p = pool();
    const person = personOf(c, state.mode);
    const mate = mateOf(c, state.mode);
    const elo = p.ratings[id];
    const wr = winRate(p, id);
    const rarity = rarityFor(p, id, leaderId);
    const crowned = id === leaderId;
    el.dataset.id = id;
    el.dataset.rarity = rarity.id;
    el.setAttribute("aria-label", `Votar em ${person.name} (${person.party})`);
    el.classList.remove("picked-win", "picked-lose");
    resetTilt(el);
    const art = person.photo
      ? `<img src="${person.photo}" alt="Foto de ${person.name}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
        <div class="placeholder" style="display:none;--ph-hue:${person.hue}">${person.initials}</div>`
      : `<div class="placeholder" style="--ph-hue:${person.hue}">${person.initials}</div>`;
    el.innerHTML = `
      <div class="card-top">
        <div class="card-name">${person.name}</div>
        <div class="party-chip">${person.party}</div>
      </div>
      <div class="art-frame">
        ${art}
        <div class="holo" aria-hidden="true"></div>
        <div class="rarity-chip">${crowned ? "&#9819; " : ""}${rarity.label}</div>
      </div>
      <div class="card-bottom">
        <div class="vice">${MODES[state.mode].mate}: <strong>${mate.name} (${mate.party})</strong></div>
        <div class="hp-bar" aria-hidden="true"><div class="hp-fill" style="width:${Math.min(100, Math.max(18, wr || 55))}%"></div></div>
        <div class="elo-mini">Elo ${elo} · ${wr}% vitórias</div>
      </div>
    `;
  }

  function nextDuel() {
    locked = false;
    const p = pool();
    currentPair = randomPair(p);
    p.lastPair = currentPair;
    saveState(state);
    const leaderId = findLeaderId(p);
    renderCard(els.cardA, currentPair[0], leaderId);
    renderCard(els.cardB, currentPair[1], leaderId);
    els.duelCount.textContent = String(p.duels);
  }

  function pick(winnerEl) {
    if (locked || !currentPair) return;
    locked = true;
    const winnerId = winnerEl.dataset.id;
    const loserId = currentPair[0] === winnerId ? currentPair[1] : currentPair[0];
    const loserEl = winnerEl === els.cardA ? els.cardB : els.cardA;

    applyElo(pool(), winnerId, loserId);
    saveState(state);

    winnerEl.classList.add("picked-win");
    loserEl.classList.add("picked-lose");
    els.duelCount.textContent = String(pool().duels);

    setTimeout(nextDuel, 420);
  }

  function renderRanking() {
    const p = pool();
    const leaderId = findLeaderId(p);
    const ranked = CANDIDATES.slice().sort((a, b) => {
      const ea = p.ratings[a.id] - p.ratings[b.id];
      if (ea !== 0) return -ea;
      return (p.wins[b.id] || 0) - (p.wins[a.id] || 0);
    });

    els.rankList.innerHTML = ranked
      .map((c, i) => {
        const person = personOf(c, state.mode);
        const mate = mateOf(c, state.mode);
        const w = p.wins[c.id] || 0;
        const l = p.losses[c.id] || 0;
        const elo = p.ratings[c.id];
        const wr = winRate(p, c.id);
        const rarity = rarityFor(p, c.id, leaderId);
            const thumb = person.photo
          ? `<img src="${person.photo}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
            <div class="rank-ph" style="display:none;--ph-hue:${person.hue}">${person.initials}</div>`
          : `<div class="rank-ph" style="--ph-hue:${person.hue}">${person.initials}</div>`;
        return `
        <li class="rank-item" data-rarity="${rarity.id}">
          <div class="rank-pos">${i + 1}º</div>
          ${thumb}
          <div>
            <div class="rank-name">${person.name}</div>
            <div class="rank-meta">
              <span class="rarity-tag">${c.id === leaderId ? "&#9819; " : ""}${rarity.label}</span>
              ${person.party} · ${MODES[state.mode].mate.toLowerCase()} ${mate.name} · ${w}V / ${l}D
            </div>
          </div>
          <div class="rank-score">${elo}<small>${wr}% vitórias</small></div>
        </li>`;
      })
      .join("");
  }

  // ---- Efeito holográfico: o brilho segue o ponteiro (desktop) ou o
  // giroscópio (celulares que não exigem permissão explícita). Sem nenhum
  // dos dois, o CSS mantem um brilho animado suave.
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function setTilt(el, xPct, yPct) {
    if (reduceMotion) return;
    el.style.setProperty("--mx", `${xPct.toFixed(1)}%`);
    el.style.setProperty("--my", `${yPct.toFixed(1)}%`);
    el.style.setProperty("--holo-hl", "0.34");
  }

  function resetTilt(el) {
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
    el.style.removeProperty("--holo-hl");
  }

  function bindPointerTilt(el) {
    let frame = 0;
    el.addEventListener("pointermove", (e) => {
      if (reduceMotion || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        setTilt(
          el,
          clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
          clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)
        );
      });
    });
    el.addEventListener("pointerleave", () => resetTilt(el));
  }

  function bindGyroTilt(cards) {
    const DeviceOrientation = window.DeviceOrientationEvent;
    // No iOS o giroscópio exige requestPermission() a partir de um gesto do
    // usuário; evitamos o diálogo e deixamos o brilho animado do CSS agir.
    if (!DeviceOrientation || typeof DeviceOrientation.requestPermission === "function") return;
    let frame = 0;
    window.addEventListener("deviceorientation", (e) => {
      if (reduceMotion || frame) return;
      if (e.gamma == null || e.beta == null) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = clamp(50 + e.gamma * 1.6, 0, 100);
        const y = clamp(50 + (e.beta - 45) * 1.2, 0, 100);
        cards.forEach((el) => setTilt(el, x, y));
      });
    });
  }

  bindPointerTilt(els.cardA);
  bindPointerTilt(els.cardB);
  bindGyroTilt([els.cardA, els.cardB]);

  els.tabDuel.addEventListener("click", () => setTab("duel"));
  els.tabRank.addEventListener("click", () => setTab("rank"));
  Object.entries(els.modeBtns).forEach(([id, btn]) => {
    btn.addEventListener("click", () => setMode(id));
  });
  els.cardA.addEventListener("click", () => pick(els.cardA));
  els.cardB.addEventListener("click", () => pick(els.cardB));
  els.cardA.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(els.cardA);
    }
  });
  els.cardB.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(els.cardB);
    }
  });

  els.resetBtn.addEventListener("click", () => {
    const label = MODES[state.mode].label.toLowerCase();
    if (!confirm(`Zerar o ranking de ${label} salvo neste aparelho?`)) return;
    state.pools[state.mode] = emptyPool();
    saveState(state);
    nextDuel();
    renderRanking();
  });

  renderModeUi();
  nextDuel();
})();
