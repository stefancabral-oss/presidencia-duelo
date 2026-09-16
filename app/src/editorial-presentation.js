const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatEditorialDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "";
  const [, year, rawMonth, rawDay] = match;
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(Date.UTC(Number(year), month - 1, day));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

export function profileProvenance(candidate = {}) {
  const publication = candidate.publication || {};
  const contentDate = publication.content?.status === "approved"
    ? formatEditorialDate(publication.content.reviewedAt)
    : "";
  const photo = publication.documentaryPhoto || {};
  const cardArt = publication.cardArt || {};
  return Object.freeze({
    content: contentDate ? `Conteúdo revisado em ${contentDate}` : "",
    photo: photo.status === "approved" && photo.source && photo.license
      ? `Foto: ${photo.source} · ${photo.license}`
      : "Foto documental ainda não disponível",
    cardArt: cardArt.status === "approved" && cardArt.version
      ? `Arte da carta: ilustração editorial · ${cardArt.version}`
      : "",
  });
}
