/**
 * Accessible name for a duel-card vote button.
 * A static "Candidato A/B" aria-label would hide the rendered name from screen readers.
 */
export function cardAriaLabel(candidate) {
  const affiliation = candidate.party ? ` (${candidate.party})` : "";
  return `Votar em ${candidate.name}${affiliation}`;
}

export function applyCardAriaLabel(el, candidate) {
  el.setAttribute("aria-label", cardAriaLabel(candidate));
}
