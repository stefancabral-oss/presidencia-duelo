export const VICE_STORAGE_KEY = "presidencia-duelo-vices-v1";
export const MODES = {
  presidentes: { label: "Pessoas", singular: "pessoa", mate: "Vice", prompt: "Toque na pessoa preferida" },
  vices: { label: "Vices", singular: "vice", mate: "Presidente", prompt: "Toque no vice preferido" },
};

export function parseVice(value = "") {
  const text = String(value).trim();
  const match = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const name = (match?.[1] || text || "Vice não informado").trim();
  const party = (match?.[2] || "—").trim();
  const words = name.split(/\s+/).filter(Boolean);
  const initials = `${words[0]?.[0] || "V"}${words.at(-1)?.[0] || ""}`.toUpperCase();
  return { name, party, initials };
}

export function candidateForMode(candidate, mode) {
  if (mode !== "vices") {
    return { ...candidate, mateLabel: "Vice" };
  }
  const vice = parseVice(candidate.vice);
  return {
    ...candidate,
    ...vice,
    photo: null,
    vice: `${candidate.name} (${candidate.party})`,
    mateLabel: "Presidente",
  };
}
