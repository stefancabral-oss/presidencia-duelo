// Only structured snapshot values are read. Missing/unreviewed values remain unknown.
export function sessionMirror(session) {
  if (session?.status !== "completed" || !Array.isArray(session.answers)
      || session.answers.length !== session.progress?.total) return null;
  const byId = new Map(session.catalog.map(person => [person.id, person]));
  const chosen = session.answers.map(answer => byId.get(answer.winnerId));
  if (chosen.some(person => !person)) throw new TypeError("Espelho: escolha fora do catálogo");
  const total = chosen.length;
  const axis = (id, label, field) => {
    const known = chosen.filter(person => person.publication?.content?.status === "approved" && person.taxonomyProvenance?.[field]?.status === "extracted" && person[field]);
    const counts = new Map();
    for (const person of known) counts.set(person[field], (counts.get(person[field]) || 0) + 1);
    const values = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .map(([value, count]) => ({ value, count }));
    return { id, label, known: known.length, unknown: total - known.length, values,
      text: known.length ? `Suas escolhas incluem ${values.length} ${label.toLowerCase()} em ${known.length} de ${total} rodadas com informação confirmada.`
        : `Ainda não há informação confirmada suficiente para comparar ${label.toLowerCase()} nas suas escolhas.` };
  };
  const groups = chosen.filter(person => person.publication?.content?.status === "approved" && ["politica", "influencia_debate"].includes(person.mirrorGroup));
  const political = groups.filter(person => person.mirrorGroup === "politica").length;
  return { version: 1, editionId: session.edition.id, total,
    axes: [axis("area", "Áreas de atuação", "primaryArea"), axis("party", "Partidos", "party"),
      { id: "group", label: "Política e influência", known: groups.length, unknown: total - groups.length,
        values: [{ value: "Política", count: political }, { value: "Influência no debate", count: groups.length - political }],
        text: groups.length ? `Nas ${groups.length} escolhas com classificação confirmada, você escolheu ${political} pessoas da política e ${groups.length - political} de influência no debate.`
          : "Este recorte ainda não tem classificações confirmadas entre política e influência no debate." }],
    notice: "Este retrato descreve suas escolhas nesta sessão. Não estima ideologia nem representa o eleitorado.",
  };
}
