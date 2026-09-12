export const ELO_START = 1000;
export const CROWN_MIN_DUELS = 6;

export const RARITY_TIERS = [
  { id: "lendario", label: "Lendário", min: 1180 },
  { id: "epico", label: "Épico", min: 1100 },
  { id: "raro", label: "Raro", min: 1040 },
  { id: "comum", label: "Comum", min: -Infinity },
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

export function rarityFor(state, id, leaderId = null) {
  if (id === leaderId) return RARITY_TIERS[0];
  const elo = Number(state?.ratings?.[id] ?? ELO_START);
  return RARITY_TIERS.find((tier) => elo >= tier.min) || RARITY_TIERS.at(-1);
}
