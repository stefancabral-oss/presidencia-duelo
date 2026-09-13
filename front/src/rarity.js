export const ELO_START = 1000;
export const CROWN_MIN_DUELS = 6;

export const RARITY_TIERS = [
  { id: "chroma-comemorativa", label: "Chroma comemorativa", family: "Chroma", symbol: "★", prismatic: true, min: 1220 },
  { id: "chroma-suprema", label: "Chroma suprema", family: "Chroma", symbol: "★★★", min: 1180 },
  { id: "chroma-especial", label: "Chroma especial", family: "Chroma", symbol: "★★", min: 1150 },
  { id: "chroma-ilustrada", label: "Chroma ilustrada", family: "Chroma", symbol: "★", min: 1120 },
  { id: "ultra", label: "Ultra", family: "Rara", symbol: "✦", min: 1100 },
  { id: "rara-dupla", label: "Rara dupla", family: "Rara", symbol: "★★", min: 1070 },
  { id: "rara", label: "Rara", family: "Rara", symbol: "★", min: 1040 },
  { id: "incomum", label: "Incomum", family: "Comum", symbol: "◆", min: 1015 },
  { id: "basica", label: "Básica", family: "Comum", symbol: "●", min: -Infinity },
];

export function findLeaderId(candidateIds, state) {
  let leader = null;
  let best = -Infinity;
  let tied = false;
  for (const id of candidateIds) {
    const elo = Number(state?.ratings?.[id] ?? ELO_START);
    if (elo > best) {
      best = elo;
      leader = id;
      tied = false;
    } else if (elo === best) {
      tied = true;
    }
  }
  if (!leader || tied || best <= ELO_START) return null;
  const duels = Number(state?.wins?.[leader] || 0) + Number(state?.losses?.[leader] || 0);
  return duels >= CROWN_MIN_DUELS ? leader : null;
}

export function rarityForElo(elo) {
  const value = Number(elo);
  const safe = Number.isFinite(value) ? value : ELO_START;
  return RARITY_TIERS.find((tier) => safe >= tier.min) || RARITY_TIERS.at(-1);
}

export function rarityFor(state, id, leaderId = null) {
  const elo = Number(state?.ratings?.[id] ?? ELO_START);
  if (id === leaderId && elo >= 1120) return RARITY_TIERS[0];
  return rarityForElo(elo);
}
