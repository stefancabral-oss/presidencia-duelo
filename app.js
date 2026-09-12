(() => {
  "use strict";

  const STORAGE_KEY = "presidencia-duelo-v1";
  const ELO_K = 32;
  const ELO_START = 1000;

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

  const CANDIDATES = [
    {
      id: "lula",
      name: "Luiz Inácio Lula da Silva",
      party: "PT",
      vice: "Geraldo Alckmin (PSB)",
      photo: "candidates/lula.jpg",
      initials: "LS",
    },
    {
      id: "flavio-bolsonaro",
      name: "Flávio Bolsonaro",
      party: "PL",
      vice: "Alfredo Gaspar (PL)",
      photo: "candidates/flavio-bolsonaro.jpg",
      initials: "FB",
    },
    {
      id: "caiado",
      name: "Ronaldo Caiado",
      party: "PSD",
      vice: "Gilberto Kassab (PSD)",
      photo: "candidates/caiado.jpg",
      initials: "RC",
    },
    {
      id: "zema",
      name: "Romeu Zema",
      party: "Novo",
      vice: "Eduardo Girão (Novo)",
      photo: "candidates/zema.jpg",
      initials: "RZ",
    },
    {
      id: "renan-santos",
      name: "Renan Santos",
      party: "Missão",
      vice: "Aroldo Medina (Missão)",
      photo: "candidates/renan-santos.jpg",
      initials: "RS",
    },
    {
      id: "cury",
      name: "Augusto Cury",
      party: "Avante",
      vice: "Júlio Delgado (Avante)",
      photo: "candidates/cury.jpg",
      initials: "AC",
    },
    {
      id: "rui-costa-pimenta",
      name: "Rui Costa Pimenta",
      party: "PCO",
      vice: "Antônio Carlos (PCO)",
      photo: "candidates/rui-costa-pimenta.jpg",
      initials: "RP",
    },
    {
      id: "samara-martins",
      name: "Samara Martins",
      party: "UP",
      vice: "Raquel Brício (UP)",
      photo: "candidates/samara-martins.jpg",
      initials: "SM",
    },
    {
      id: "hertz-dias",
      name: "Hertz Dias",
      party: "PSTU",
      vice: "Vanessa Portugal (PSTU)",
      photo: "candidates/hertz-dias.jpg",
      initials: "HD",
    },
    {
      id: "edmilson-costa",
      name: "Edmilson Costa",
      party: "PCB",
      vice: "Cleusa Santos (PCB)",
      photo: "candidates/edmilson-costa.jpg",
      initials: "EC",
    },
    {
      id: "wilson-grassi",
      name: "Wilson Grassi",
      party: "Democrata",
      vice: "Suêd Haidar (Democrata)",
      photo: "candidates/wilson-grassi.jpg",
      initials: "WG",
    },
    {
      id: "clariana-barao",
      name: "Clariana Barão",
      party: "DC",
      vice: "Fabiana Torquato (DC)",
      photo: "candidates/clariana-barao.jpg",
      initials: "CB",
    },
  ];

  const byId = Object.fromEntries(CANDIDATES.map((c) => [c.id, c]));

  function defaultState() {
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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ratings: { ...base.ratings, ...(parsed.ratings || {}) },
        wins: { ...base.wins, ...(parsed.wins || {}) },
        losses: { ...base.losses, ...(parsed.losses || {}) },
        duels: parsed.duels || 0,
        lastPair: parsed.lastPair || null,
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

  function applyElo(state, winnerId, loserId) {
    const ra = state.ratings[winnerId];
    const rb = state.ratings[loserId];
    const ea = expectedScore(ra, rb);
    const eb = expectedScore(rb, ra);
    state.ratings[winnerId] = Math.round(ra + ELO_K * (1 - ea));
    state.ratings[loserId] = Math.round(rb + ELO_K * (0 - eb));
    state.wins[winnerId] += 1;
    state.losses[loserId] += 1;
    state.duels += 1;
  }

  function randomPair(state) {
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
        (state.lastPair &&
          ((state.lastPair[0] === a && state.lastPair[1] === b) ||
            (state.lastPair[0] === b && state.lastPair[1] === a)))) &&
      tries < 40
    );
    if (a === b) {
      b = ids[(ids.indexOf(a) + 1) % ids.length];
    }
    return [a, b];
  }

  function winRate(state, id) {
    const w = state.wins[id] || 0;
    const l = state.losses[id] || 0;
    const t = w + l;
    if (!t) return 0;
    return Math.round((100 * w) / t);
  }

  function duelsPlayed(state, id) {
    return (state.wins[id] || 0) + (state.losses[id] || 0);
  }

  // Líder isolado da tabela, com duelos suficientes para valer a coroa.
  // Retorna null enquanto houver empate no topo ou amostra pequena.
  function findLeaderId(state) {
    let leader = null;
    let bestElo = -Infinity;
    let tied = false;
    CANDIDATES.forEach((c) => {
      const elo = state.ratings[c.id];
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
    if (duelsPlayed(state, leader) < CROWN_MIN_DUELS) return null;
    return leader;
  }

  function rarityFor(state, id, leaderId) {
    if (id === leaderId) return LEGENDARY;
    const elo = state.ratings[id];
    return RARITY_TIERS.find((t) => elo >= t.min) || RARITY_TIERS[RARITY_TIERS.length - 1];
  }

  // DOM
  const els = {
    panelDuel: document.getElementById("panel-duel"),
    panelRank: document.getElementById("panel-rank"),
    tabDuel: document.getElementById("tab-duel"),
    tabRank: document.getElementById("tab-rank"),
    duelCount: document.getElementById("duel-count"),
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
    rankList: document.getElementById("rank-list"),
    resetBtn: document.getElementById("reset-ranking"),
  };

  let state = loadState();
  let currentPair = null;
  let locked = false;

  function setTab(name) {
    const duel = name === "duel";
    els.panelDuel.classList.toggle("active", duel);
    els.panelRank.classList.toggle("active", !duel);
    els.tabDuel.classList.toggle("active", duel);
    els.tabRank.classList.toggle("active", !duel);
    if (!duel) renderRanking();
  }

  function renderCard(el, id, leaderId) {
    const c = byId[id];
    const elo = state.ratings[id];
    const wr = winRate(state, id);
    const rarity = rarityFor(state, id, leaderId);
    const crowned = id === leaderId;
    el.dataset.id = id;
    el.dataset.rarity = rarity.id;
    el.classList.remove("picked-win", "picked-lose");
    resetTilt(el);
    el.innerHTML = `
      <div class="card-top">
        <div class="card-name">${c.name}</div>
        <div class="party-chip">${c.party}</div>
      </div>
      <div class="art-frame">
        <img src="${c.photo}" alt="Foto de ${c.name}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
        <div class="placeholder" style="display:none">${c.initials}</div>
        <div class="holo" aria-hidden="true"></div>
        <div class="rarity-chip">${crowned ? "&#9819; " : ""}${rarity.label}</div>
      </div>
      <div class="card-bottom">
        <div class="vice">Vice: <strong>${c.vice}</strong></div>
        <div class="hp-bar" aria-hidden="true"><div class="hp-fill" style="width:${Math.min(100, Math.max(18, wr || 55))}%"></div></div>
        <div class="elo-mini">Elo ${elo} · ${wr}% vitórias</div>
      </div>
    `;
  }

  function nextDuel() {
    locked = false;
    currentPair = randomPair(state);
    state.lastPair = currentPair;
    saveState(state);
    const leaderId = findLeaderId(state);
    renderCard(els.cardA, currentPair[0], leaderId);
    renderCard(els.cardB, currentPair[1], leaderId);
    els.duelCount.textContent = String(state.duels);
  }

  function pick(winnerEl) {
    if (locked || !currentPair) return;
    locked = true;
    const winnerId = winnerEl.dataset.id;
    const loserId = currentPair[0] === winnerId ? currentPair[1] : currentPair[0];
    const loserEl = winnerEl === els.cardA ? els.cardB : els.cardA;

    applyElo(state, winnerId, loserId);
    saveState(state);

    winnerEl.classList.add("picked-win");
    loserEl.classList.add("picked-lose");
    els.duelCount.textContent = String(state.duels);

    setTimeout(nextDuel, 420);
  }

  function renderRanking() {
    const leaderId = findLeaderId(state);
    const ranked = CANDIDATES.slice().sort((a, b) => {
      const ea = state.ratings[a.id] - state.ratings[b.id];
      if (ea !== 0) return -ea;
      return (state.wins[b.id] || 0) - (state.wins[a.id] || 0);
    });

    els.rankList.innerHTML = ranked
      .map((c, i) => {
        const w = state.wins[c.id] || 0;
        const l = state.losses[c.id] || 0;
        const elo = state.ratings[c.id];
        const wr = winRate(state, c.id);
        const rarity = rarityFor(state, c.id, leaderId);
        return `
        <li class="rank-item" data-rarity="${rarity.id}">
          <div class="rank-pos">${i + 1}º</div>
          <img src="${c.photo}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
          <div class="rank-ph" style="display:none">${c.initials}</div>
          <div>
            <div class="rank-name">${c.name}</div>
            <div class="rank-meta">
              <span class="rarity-tag">${c.id === leaderId ? "&#9819; " : ""}${rarity.label}</span>
              ${c.party} · vice ${c.vice} · ${w}V / ${l}D
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
    if (!confirm("Zerar ranking e duelos salvos neste aparelho?")) return;
    state = defaultState();
    saveState(state);
    nextDuel();
    renderRanking();
  });

  nextDuel();
})();
