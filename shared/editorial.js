function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  const capitalized = `${text[0].toLocaleUpperCase("pt-BR")}${text.slice(1)}`;
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

export function editorialSummary(profile) {
  const role = clean(profile?.role) || "Figura pública";
  const area = clean(profile?.area);
  if (!area || role.toLocaleLowerCase("pt-BR").includes(area.toLocaleLowerCase("pt-BR"))) {
    return sentence(role);
  }
  return sentence(`${role} com atuação em ${area.toLocaleLowerCase("pt-BR")}`);
}

export function enrichCandidateEditorial(candidate, profile) {
  return {
    ...candidate,
    role: clean(profile?.role) || "Figura pública",
    summary: editorialSummary(profile),
    area: clean(profile?.area) || "Atuação pública",
    editorialUpdatedAt: clean(profile?.updatedAt) || null,
  };
}

export function validateEditorialProfile(profile) {
  if (!profile || !clean(profile.id) || !clean(profile.role) || !clean(profile.area)) return false;
  if (!Array.isArray(profile.sources) || profile.sources.length === 0) return false;
  return profile.sources.every((source) => (
    clean(source.label)
    && clean(source.publisher)
    && /^https:\/\//.test(clean(source.url))
    && /^\d{4}-\d{2}-\d{2}$/.test(clean(source.publishedAt || source.accessedAt))
  ));
}
