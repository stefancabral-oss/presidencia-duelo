/**
 * Width (%) of the duel-card HP bar.
 * Unplayed candidates stay at a neutral 55%.
 * After at least one match, width follows win rate, floored at 18% so a 0% bar stays visible.
 */
export function hpFillWidth(wins = 0, losses = 0, wr = 0) {
  const played = wins + losses > 0;
  return played ? Math.min(100, Math.max(18, wr)) : 55;
}
