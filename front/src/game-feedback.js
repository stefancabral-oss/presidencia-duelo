export const POLIMATCH_FEEDBACK_EVENT = "polimatch:feedback";

export function rankingFeedbackKind({ before, after, total, zebra = false, combo = 0 }) {
  if (after === 1 && before === 1) return "leader-defense";
  if (after === 1 && before > 1) return "leader";
  if (after <= 3 && before > 3) return "top-3";
  if (after <= 10 && before > 10) return "top-10";
  if (before === total && after < total) return "comeback";
  if (after < before) return "overtake";
  if (zebra) return "zebra";
  if (combo >= 2) return "combo";
  return "success";
}

export function dispatchPoliMatchFeedback(kind, detail = {}, documentObject = globalThis.document) {
  if (!kind || !documentObject?.dispatchEvent || typeof globalThis.CustomEvent !== "function") return false;
  documentObject.dispatchEvent(new CustomEvent(POLIMATCH_FEEDBACK_EVENT, { detail: { kind, ...detail } }));
  return true;
}
