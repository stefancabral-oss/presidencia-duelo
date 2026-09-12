/**
 * Accessible name for a duel-card vote button.
 * A static "Candidato A/B" aria-label would hide the rendered name from screen readers.
 */
export function cardAriaLabel(candidate) {
  return `Votar em ${candidate.name} (${candidate.party})`;
}

export function applyCardAriaLabel(el, candidate) {
  el.setAttribute("aria-label", cardAriaLabel(candidate));
}
