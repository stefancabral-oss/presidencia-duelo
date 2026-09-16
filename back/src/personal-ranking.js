export const PERSONAL_RANKING_POLICY = Object.freeze({
  id: "pairwise-majority-scc-v1",
  label: "maioria nos confrontos observados",
  explanation: "A ordem usa quem venceu mais vezes cada confronto direto. Ciclos e comparações ainda insuficientes compartilham posição; Elo e quantidade de aparições não desempatarão sua preferência.",
});

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function compareId(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pairKey(firstId, secondId) {
  return firstId < secondId ? `${firstId}\u0000${secondId}` : `${secondId}\u0000${firstId}`;
}

function normalizedPair(firstId, secondId) {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

export function pairRowsWithPending(pairRows = [], pendingComparisons = []) {
  const pairs = new Map();
  for (const row of pairRows) {
    const aId = String(row.a_id || "");
    const bId = String(row.b_id || "");
    if (!aId || !bId || aId === bId) continue;
    const [firstId, secondId] = normalizedPair(aId, bId);
    const rowFirstWins = aId === firstId ? numeric(row.a_wins) : numeric(row.b_wins);
    const rowSecondWins = aId === firstId ? numeric(row.b_wins) : numeric(row.a_wins);
    const key = pairKey(firstId, secondId);
    const current = pairs.get(key) || { a_id: firstId, b_id: secondId, a_wins: 0, b_wins: 0 };
    current.a_wins += rowFirstWins;
    current.b_wins += rowSecondWins;
    pairs.set(key, current);
  }

  for (const comparison of pendingComparisons) {
    const winnerId = String(comparison?.winnerId || "");
    const loserId = String(comparison?.loserId || "");
    if (!winnerId || !loserId || winnerId === loserId) continue;
    const [firstId, secondId] = normalizedPair(winnerId, loserId);
    const key = pairKey(firstId, secondId);
    const current = pairs.get(key) || { a_id: firstId, b_id: secondId, a_wins: 0, b_wins: 0 };
    if (winnerId === firstId) current.a_wins += 1;
    else current.b_wins += 1;
    pairs.set(key, current);
  }

  return [...pairs.values()].sort((a, b) => compareId(a.a_id, b.a_id) || compareId(a.b_id, b.b_id));
}

function stronglyConnectedComponents(nodeIds, edges) {
  let cursor = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowLinks = new Map();
  const components = [];

  function visit(nodeId) {
    indexes.set(nodeId, cursor);
    lowLinks.set(nodeId, cursor);
    cursor += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const nextId of [...(edges.get(nodeId) || [])].sort()) {
      if (!indexes.has(nextId)) {
        visit(nextId);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), lowLinks.get(nextId)));
      } else if (onStack.has(nextId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), indexes.get(nextId)));
      }
    }

    if (lowLinks.get(nodeId) !== indexes.get(nodeId)) return;
    const members = [];
    while (stack.length) {
      const member = stack.pop();
      onStack.delete(member);
      members.push(member);
      if (member === nodeId) break;
    }
    components.push(members.sort());
  }

  for (const nodeId of [...nodeIds].sort()) {
    if (!indexes.has(nodeId)) visit(nodeId);
  }
  return components;
}

function majorityLayers(nodeIds, edges) {
  const components = stronglyConnectedComponents(nodeIds, edges);
  const componentByNode = new Map();
  components.forEach((members, componentId) => members.forEach((nodeId) => componentByNode.set(nodeId, componentId)));
  const outgoing = new Map(components.map((_, componentId) => [componentId, new Set()]));
  const indegree = new Map(components.map((_, componentId) => [componentId, 0]));

  for (const [winnerId, loserIds] of edges) {
    const winnerComponent = componentByNode.get(winnerId);
    for (const loserId of loserIds) {
      const loserComponent = componentByNode.get(loserId);
      if (winnerComponent === loserComponent || outgoing.get(winnerComponent).has(loserComponent)) continue;
      outgoing.get(winnerComponent).add(loserComponent);
      indegree.set(loserComponent, indegree.get(loserComponent) + 1);
    }
  }

  const remaining = new Set(components.map((_, componentId) => componentId));
  const ranked = new Map();
  let layer = 0;
  let competitionRank = 1;
  while (remaining.size) {
    const frontier = [...remaining]
      .filter((componentId) => indegree.get(componentId) === 0)
      .sort((left, right) => compareId(components[left][0], components[right][0]));
    if (!frontier.length) throw new Error("grafo de preferência condensado inválido");
    const frontierSize = frontier.reduce((total, componentId) => total + components[componentId].length, 0);
    for (const componentId of frontier) {
      const members = components[componentId];
      const rankBasis = members.length > 1
        ? "majority-cycle"
        : frontier.length > 1 ? "unresolved-frontier" : "strict-frontier";
      for (const nodeId of members) {
        ranked.set(nodeId, { rank: competitionRank, preferenceScore: layer === 0 ? 0 : -layer, rankBasis, layer });
      }
    }
    for (const componentId of frontier) {
      remaining.delete(componentId);
      for (const target of outgoing.get(componentId)) indegree.set(target, indegree.get(target) - 1);
    }
    competitionRank += frontierSize;
    layer += 1;
  }
  return ranked;
}

export function personalRankingFromRows(topicId, duels, candidates, statRows = [], pairRows = [], { pendingComparisons = [] } = {}) {
  const catalogIds = new Set(candidates.map(({ id }) => id));
  const stats = new Map(statRows.map((row) => [row.candidate_id, row]));
  const counts = new Map(candidates.map(({ id }) => [id, { wins: 0, losses: 0 }]));
  const edges = new Map(candidates.map(({ id }) => [id, new Set()]));
  const mergedPairs = pairRowsWithPending(pairRows, pendingComparisons)
    .filter(({ a_id: aId, b_id: bId }) => catalogIds.has(aId) && catalogIds.has(bId));

  for (const pair of mergedPairs) {
    const aWins = numeric(pair.a_wins);
    const bWins = numeric(pair.b_wins);
    counts.get(pair.a_id).wins += aWins;
    counts.get(pair.a_id).losses += bWins;
    counts.get(pair.b_id).wins += bWins;
    counts.get(pair.b_id).losses += aWins;
    if (aWins > bWins) edges.get(pair.a_id).add(pair.b_id);
    else if (bWins > aWins) edges.get(pair.b_id).add(pair.a_id);
  }

  const playedIds = candidates
    .map(({ id }) => id)
    .filter((id) => counts.get(id).wins + counts.get(id).losses > 0);
  const positions = majorityLayers(playedIds, edges);
  const ranking = candidates.map((candidate) => {
    const row = stats.get(candidate.id) || {};
    const { wins, losses } = counts.get(candidate.id);
    const decisions = wins + losses;
    const position = positions.get(candidate.id);
    return {
      personId: candidate.personId,
      id: candidate.id,
      name: candidate.name,
      displayName: candidate.displayName,
      affiliation: candidate.affiliation,
      party: candidate.party,
      primaryArea: candidate.primaryArea,
      photo: candidate.photo,
      elo: Number(row.rating) || 1000,
      wins,
      losses,
      decisions,
      zebras: 0,
      winRate: decisions ? Math.round((wins * 100) / decisions) : 0,
      rank: position?.rank ?? null,
      preferenceScore: position?.preferenceScore ?? null,
      rankBasis: position?.rankBasis || "unplayed",
      layer: position?.layer ?? null,
    };
  }).sort((left, right) => {
    if (left.layer === null || right.layer === null) {
      if (left.layer !== right.layer) return left.layer === null ? 1 : -1;
    } else if (left.layer !== right.layer) return left.layer - right.layer;
    return compareId(left.id, right.id);
  });

  return {
    topicId,
    duels: Number(duels) || 0,
    rankingPolicy: PERSONAL_RANKING_POLICY,
    ranking,
  };
}
