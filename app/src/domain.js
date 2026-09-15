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

export function rankingSoundEvent(beforeRanking, afterRanking, winnerId, { zebra = false } = {}) {
  if (zebra) return "zebra";
  const before = displayRanking(beforeRanking).find(({ id }) => id === winnerId);
  const after = displayRanking(afterRanking).find(({ id }) => id === winnerId);
  const beforeRank = before?.displayRank ?? Infinity;
  const afterRank = after?.displayRank ?? Infinity;
  if (!Number.isFinite(afterRank)) return "confirm";
  if (afterRank === 1) return beforeRank === 1 ? "leaderDefense" : "leader";
  if (afterRank <= 3 && beforeRank > 3) return "podium";
  if (afterRank <= 10 && beforeRank > 10) return "top10";
  const previousPlayed = displayRanking(beforeRanking).filter(({ displayRank }) => Number.isFinite(displayRank));
  const previousLastRank = Math.max(0, ...previousPlayed.map(({ displayRank }) => displayRank));
  if (beforeRank === previousLastRank && afterRank < beforeRank) return "recovery";
  if (afterRank < beforeRank) return "overtake";
  return "confirm";
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

export function voteFeedback(name, { winnerDelta, zebra, winRate } = {}) {
  const parts = [`${name} confirmado`];
  const delta = Number(winnerDelta);
  if (Number.isFinite(delta)) parts.push(`${delta >= 0 ? "+" : ""}${delta} Elo`);
  const rate = Number(winRate);
  if (Number.isFinite(rate)) parts.push(`${rate}% nas comparações`);
  if (zebra) parts.push("Zebra!");
  return parts.join(" · ");
}
