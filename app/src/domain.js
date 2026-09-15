export function catalogForTopic(candidates, ids = []) {
  if (!ids.length) return [...candidates];
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export function nextPair(candidates, previousPair = [], random = Math.random) {
  if (candidates.length < 2) throw new Error("São necessárias pelo menos duas pessoas");
  const previousKey = [...previousPair].sort().join(":");
  let pair;
  let attempts = 0;
  do {
    const firstIndex = Math.floor(random() * candidates.length);
    let secondIndex = Math.floor(random() * (candidates.length - 1));
    if (secondIndex >= firstIndex) secondIndex += 1;
    pair = [candidates[firstIndex], candidates[secondIndex]];
    attempts += 1;
  } while (candidates.length > 2 && pair.map(({ id }) => id).sort().join(":") === previousKey && attempts < 12);
  return pair;
}

export function shuffledCandidates(candidates, random = Math.random) {
  const result = [...candidates];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function nextBalancedPair(candidates, queue = [], previousPair = [], random = Math.random) {
  const next = nextBalancedGroup(candidates, queue, previousPair, 2, random);
  return { pair: next.group, queue: next.queue };
}

export function nextBalancedGroup(candidates, queue = [], previousGroup = [], size = 4, random = Math.random) {
  if (candidates.length < size) throw new Error(`São necessárias pelo menos ${size} pessoas`);
  const availableIds = new Set(candidates.map(({ id }) => id));
  const seen = new Set();
  let remaining = queue.filter(({ id }) => availableIds.has(id) && !seen.has(id) && seen.add(id));
  if (remaining.length < size) {
    const preserved = new Set(remaining.map(({ id }) => id));
    remaining = [...remaining, ...shuffledCandidates(candidates.filter(({ id }) => !preserved.has(id)), random)];
  }
  const previous = new Set(previousGroup);
  const fresh = remaining.filter(({ id }) => !previous.has(id));
  const repeated = remaining.filter(({ id }) => previous.has(id));
  const ordered = fresh.length >= size ? [...fresh, ...repeated] : remaining;
  return { group: ordered.slice(0, size), queue: ordered.slice(size) };
}

export function rankingForCatalog(snapshot, candidates) {
  const allowed = new Set(candidates.map(({ id }) => id));
  return (snapshot?.ranking || []).filter(({ id }) => allowed.has(id));
}

export function displayRanking(ranking, { personal = false } = {}) {
  const played = ranking.filter(({ decisions = 0 }) => decisions > 0);
  const unplayed = personal ? [] : ranking.filter(({ decisions = 0 }) => decisions === 0);
  let previousScore = null;
  let previousRank = 0;
  const ranked = played.map((person, index) => {
    const score = `${person.elo}:${person.wins}:${person.losses}`;
    if (score !== previousScore) previousRank = index + 1;
    previousScore = score;
    return { ...person, displayRank: previousRank };
  });
  return [...ranked, ...unplayed.map((person) => ({ ...person, displayRank: null }))];
}

export function filterRanking(ranking, query = "") {
  const normalized = String(query).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!normalized) return ranking;
  return ranking.filter((person) => [person.name, person.displayName, person.affiliation, person.party]
    .filter(Boolean)
    .some((value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized)));
}

export function rankingHighlights(ranking, limit = 3) {
  const played = ranking.filter(({ decisions = 0 }) => decisions > 0);
  return {
    chosen: [...played]
      .filter(({ wins = 0 }) => wins > 0)
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.elo - a.elo)
      .slice(0, limit),
    rejected: [...played]
      .filter(({ losses = 0 }) => losses > 0)
      .sort((a, b) => b.losses - a.losses || (b.losses / b.decisions) - (a.losses / a.decisions) || a.elo - b.elo)
      .slice(0, limit),
  };
}

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function shortName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts.at(-1)}`;
}

export function eloTier(elo) {
  const score = Number(elo);
  if (score < 900) return { id: "recovery", label: "Zona de recuperação", level: 0 };
  if (score < 980) return { id: "pressure", label: "Sob pressão", level: 1 };
  if (score < 1050) return { id: "contender", label: "No páreo", level: 2 };
  if (score < 1125) return { id: "rising", label: "Em ascensão", level: 3 };
  if (score < 1225) return { id: "seeded", label: "Cabeça de chave", level: 4 };
  return { id: "elite", label: "Elite", level: 5 };
}

export function roundFeedbackFromRankings(beforeRanking = [], afterRanking = [], candidateIds = [], winnerId = "", { rankingEvent = "confirm", zebra = false } = {}) {
  const before = new Map(beforeRanking.map((candidate) => [candidate.id, candidate]));
  const after = new Map(afterRanking.map((candidate) => [candidate.id, candidate]));
  const outcomes = candidateIds.flatMap((id) => {
    const previous = before.get(id);
    const current = after.get(id);
    if (!previous || !current || !Number.isFinite(Number(previous.elo)) || !Number.isFinite(Number(current.elo))) return [];
    const previousTier = eloTier(previous.elo);
    const tier = eloTier(current.elo);
    return [{
      id,
      result: id === winnerId ? "winner" : "loser",
      delta: Number(current.elo) - Number(previous.elo),
      elo: Number(current.elo),
      previousTier,
      tier,
      tierChange: tier.level > previousTier.level ? "up" : tier.level < previousTier.level ? "down" : null,
    }];
  });
  const winner = outcomes.find((outcome) => outcome.id === winnerId);
  const dropped = outcomes.filter((outcome) => outcome.tierChange === "down");
  let primaryEvent = rankingEvent || "confirm";
  if (zebra) primaryEvent = "zebra";
  else if (!["leader", "leaderDefense", "podium", "top10"].includes(primaryEvent)) {
    if (winner?.tierChange === "up") primaryEvent = "tierUp";
    else if (dropped.some(({ tier }) => tier.id === "recovery")) primaryEvent = "lowElo";
    else if (dropped.length) primaryEvent = "tierDown";
  }
  return outcomes.length ? { rankingEvent, primaryEvent, zebra: Boolean(zebra), outcomes } : null;
}

export function roundOutcome(feedback, candidates = [], winnerId = "") {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const outcomes = Array.isArray(feedback?.outcomes) ? feedback.outcomes.map((outcome) => {
    const candidate = byId.get(outcome.id) || {};
    const tier = outcome.tier || eloTier(outcome.elo);
    const winner = outcome.id === winnerId || outcome.result === "winner";
    const tierChanged = outcome.tierChange === "up" || outcome.tierChange === "down";
    return {
      ...outcome,
      name: candidate.displayName || shortName(candidate.name || outcome.id),
      winner,
      tone: winner ? "gain" : "loss",
      shortMessage: tierChanged
        ? `${outcome.tierChange === "up" ? "Subiu" : "Caiu"} · ${tier.label}`
        : winner ? "Levou a rodada" : "Levou a pior",
    };
  }) : [];
  const winner = outcomes.find((outcome) => outcome.winner);
  const dropped = outcomes.find((outcome) => outcome.tierChange === "down");
  const primaryEvent = feedback ? feedback.primaryEvent || feedback.rankingEvent || "confirm" : null;
  let message = winner ? `${winner.name} levou +${winner.delta} Elo. Os outros três sentiram.` : "Escolha confirmada.";
  if (feedback?.zebra && winner) message = `${winner.name} virou o jogo. Zebra na mesa.`;
  else if (primaryEvent === "leader" && winner) message = `${winner.name} tomou a liderança. Agora segura.`;
  else if (primaryEvent === "leaderDefense" && winner) message = `${winner.name} segurou a liderança. Por enquanto.`;
  else if (primaryEvent === "podium" && winner) message = `${winner.name} entrou no pódio. Chegou chegando.`;
  else if (primaryEvent === "top10" && winner) message = `${winner.name} invadiu o Top 10.`;
  else if (primaryEvent === "overtake" && winner) message = `${winner.name} passou alguém no ranking. Sem pedir licença.`;
  else if (primaryEvent === "recovery" && winner) message = `${winner.name} saiu da lanterna. Respirou.`;
  else if (winner?.tierChange === "up") message = `${winner.name} subiu de patente: ${winner.tier.label}.`;
  else if (dropped) message = `${dropped.name} escorregou para ${dropped.tier.label}. O ranking não perdoa.`;
  return { outcomes, message, primaryEvent };
}

export function hapticPattern(event) {
  return ({
    zebra: [20, 28, 20, 28, 52],
    leader: [18, 24, 48],
    podium: [16, 22, 38],
    top10: [14, 20, 30],
    tierUp: [16, 24, 42],
    tierDown: [34, 38, 18],
    lowElo: [48, 30, 24],
    overtake: [15, 18, 28],
    recovery: [24, 22, 35],
  })[event] || 16;
}

export function voteFeedback(name, { winnerDelta, zebra, winRate } = {}) {
  const parts = [`${name} confirmado`];
  const delta = Number(winnerDelta);
  if (Number.isFinite(delta)) parts.push(`${delta >= 0 ? "+" : ""}${delta} Elo`);
  const rate = Number(winRate);
  if (Number.isFinite(rate)) parts.push(`${rate}% nas comparações`);
  if (zebra) parts.push("Zebra!");
  return parts.join(" · ");
}
