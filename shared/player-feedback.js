import { isZebra } from "./elo.js";

export function roundWinProbability(winnerRating, opponentRatings) {
  if (!Number.isFinite(winnerRating) || !opponentRatings.length || opponentRatings.some(rating => !Number.isFinite(rating))) return 1;
  return 1 / (1 + opponentRatings.reduce((sum, rating) => sum + 10 ** ((rating - winnerRating) / 400), 0));
}

export function isRoundZebra(winnerRating, opponentRatings) {
  // max(opponents) alone is equivalent to OR over the pairwise tests. The
  // round's normalized win probability must also describe an unlikely win.
  return isZebra(winnerRating, Math.max(...opponentRatings)) && roundWinProbability(winnerRating, opponentRatings) <= 0.10;
}

export const CHOICE_MESSAGES = Object.freeze([
  "{name} foi sua escolha nesta rodada.", "Você preferiu {name} entre estas pessoas.",
  "Mais uma escolha sua: {name}.", "Nesta mesa, sua preferência foi {name}.",
  "Você ficou com {name}.", "Escolha registrada para {name}.",
  "Seu retrato ganha uma escolha: {name}.",
]);
export function choiceMessage(name, count, { zebra = false } = {}) {
  if (zebra) return `${name} venceu uma rodada improvável no seu histórico.`;
  return CHOICE_MESSAGES[Math.max(0, Number(count) - 1) % CHOICE_MESSAGES.length].replace("{name}", name);
}
