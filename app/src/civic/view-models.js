// Modelos de apresentação das áreas cívicas (contrato FRONT ⇄ APP; F01 · #217, A02 · #224).
//
// Funções puras: recebem registros já validados pelo contrato B01 e devolvem
// objetos prontos para as telas, com estados explícitos. Nada aqui infere
// candidatura, aprovação, posição política, mérito ou relação de chapa; o que não
// está publicado e aprovado aparece como indisponível ou pendente, sem texto
// inventado. Sem cores ou ordenações de mérito: a ordem é a do contrato.
import { SLOTS, UFS } from "../../../shared/civic-contract.js";
import { civicHref } from "./router.js";

export const UF_NAMES = Object.freeze({
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
});

export const JURISDICTION_OPTIONS = Object.freeze([
  { value: "BR", label: "Brasil (Presidência)" },
  ...UFS.map((uf) => ({ value: uf, label: `${UF_NAMES[uf]} (${uf})` })),
]);

export const OFFICE_LABELS = Object.freeze({ president: "Presidência da República", governor: "Governo do estado", senator: "Senado" });
export const ROLE_LABELS = Object.freeze({ holder: "Titular", vice: "Vice", substitute: "Suplente" });
export const CLAIM_KIND_LABELS = Object.freeze({
  proposal: "Proposta",
  recorded_vote: "Voto registrado",
  executed_measure: "Medida executada",
  observed_result: "Resultado observado",
  biography: "Biografia",
});
// Distinção textual entre fato documentado, declaração de campanha e registro
// oficial; nunca por cor de mérito.
export const CLAIM_NATURE = Object.freeze({
  proposal: "declaração de campanha",
  recorded_vote: "registro oficial",
  executed_measure: "fato documentado",
  observed_result: "fato documentado",
  biography: "registro biográfico",
});
export const SLOT_LABELS = Object.freeze({ right: "Espaço à direita", left: "Espaço à esquerda", international: "Espaço internacional" });
export const COVERAGE_STATE_LABELS = Object.freeze({
  present: "Cobertura encontrada",
  not_found: "Nenhuma matéria encontrada",
  collection_failed: "Falha na coleta",
  restricted: "Acesso restrito",
  pending: "Classificação pendente",
  contested: "Classificação contestada",
  withdrawn: "Matéria retirada",
});
export const ARTICLE_KIND_LABELS = Object.freeze({ reporting: "Reportagem", opinion: "Opinião", analysis: "Análise", interview: "Entrevista", press_release: "Comunicado oficial" });
export const ACCESS_LABELS = Object.freeze({ full: "Acesso livre", metadata_only: "Só metadados", paywall: "Conteúdo pago", unavailable: "Indisponível" });
export const ORIENTATION_LABELS = Object.freeze({ right: "Direita", left: "Esquerda", center: "Centro", mixed: "Mista", unclassified: "Não classificada" });
export const REVIEW_LABELS = Object.freeze({ pending: "Pendente de revisão", approved: "Revisado", contested: "Contestado", rejected: "Rejeitado" });
export const PUBLICATION_LABELS = Object.freeze({ draft: "Rascunho", published: "Publicado", withdrawn: "Retirado" });
export const HISTORY_ACTION_LABELS = Object.freeze({ publish: "Publicado", correct: "Corrigido", withdraw: "Retirado" });

const TIME_ZONE = "America/Sao_Paulo";

export function formatInstant(value, { withTime = true } = {}) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "long", ...(withTime ? { timeStyle: "short" } : {}) }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

export function formatCivilDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00.000Z`));
  } catch {
    return value;
  }
}

export function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function jurisdictionLabel(code) {
  if (code === "BR") return "Brasil";
  return UF_NAMES[code] ? `${UF_NAMES[code]} (${code})` : String(code ?? "");
}

function indexBy(rows = []) {
  return new Map(rows.map((row) => [row.id, row]));
}

export function isPublished(record) {
  return Boolean(record) && record.publication === "published" && record.review === "approved";
}

export function publishingModel(record) {
  if (!record) return null;
  return {
    review: record.review,
    reviewLabel: REVIEW_LABELS[record.review] ?? record.review,
    publication: record.publication,
    publicationLabel: PUBLICATION_LABELS[record.publication] ?? record.publication,
    revision: record.revision,
    updatedAt: record.updatedAt,
    updatedAtLabel: formatInstant(record.updatedAt),
    published: isPublished(record),
  };
}

export function sourceModel(sourceId, sources) {
  const source = indexBy(sources).get(sourceId);
  if (!source) return { id: sourceId, publisher: "Fonte não informada", url: null, locator: null, fetchedAtLabel: "", kindLabel: "", synthetic: false };
  return {
    id: source.id,
    publisher: source.publisher,
    url: safeHttpsUrl(source.url),
    locator: source.locator,
    kind: source.kind,
    kindLabel: { official: "Fonte oficial", campaign: "Material de campanha", newsroom: "Redação", synthetic: "Dado sintético de teste" }[source.kind] ?? source.kind,
    license: source.license,
    sourceAtLabel: formatInstant(source.sourceAt),
    fetchedAtLabel: formatInstant(source.fetchedAt),
    synthetic: source.kind === "synthetic",
    collectionState: source.collectionState,
  };
}

export function contestModel(contest, elections = []) {
  if (!contest) return null;
  const election = indexBy(elections).get(contest.electionId);
  const office = OFFICE_LABELS[contest.office] ?? contest.office;
  const scope = contest.jurisdiction === "BR" ? "" : ` · ${contest.jurisdiction}`;
  const year = election ? ` · ${election.year}` : "";
  const vacancies = contest.office === "senator" ? ` · ${contest.vacancies} ${contest.vacancies === 1 ? "vaga" : "vagas"}` : "";
  return { id: contest.id, office: contest.office, officeLabel: office, jurisdiction: contest.jurisdiction, year: election?.year ?? null, label: `${office}${scope}${year}${vacancies}`, vacancies: contest.vacancies };
}

export function photoModel(personId, photographs = [], sources = []) {
  const rows = photographs.filter((photo) => photo.personId === personId);
  const permitted = rows.find((photo) => isPublished(photo) && photo.rights === "permitted");
  if (permitted) {
    return { state: "permitted", url: safeHttpsUrl(permitted.url), credit: permitted.credit, source: sourceModel(permitted.sourceId, sources), label: "Fotografia documental autorizada" };
  }
  if (rows.some((photo) => photo.rights === "pending" || photo.review === "pending")) return { state: "pending", url: null, credit: null, source: null, label: "Fotografia aguarda revisão de direitos" };
  if (rows.some((photo) => photo.rights === "denied" || photo.review === "rejected")) return { state: "denied", url: null, credit: null, source: null, label: "Fotografia sem autorização de uso" };
  return { state: "absent", url: null, credit: null, source: null, label: "Sem fotografia documental" };
}

export function initialsOf(name = "") {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
}

export function candidacyCardModel(candidacy, { persons = [], contests = [], elections = [], photographs = [], sources = [] } = {}) {
  if (!candidacy) return null;
  const person = indexBy(persons).get(candidacy.personId);
  const contest = contestModel(indexBy(contests).get(candidacy.contestId), elections);
  return {
    id: candidacy.id,
    href: civicHref({ kind: "candidacy", params: { id: candidacy.id } }),
    name: candidacy.ballotName,
    initials: initialsOf(candidacy.ballotName),
    number: candidacy.ballotNumber,
    party: candidacy.party,
    partyLabel: candidacy.party ?? "Sem partido informado",
    personName: person?.displayName ?? null,
    personId: candidacy.personId,
    contest,
    officialStatus: candidacy.officialStatus,
    statusAt: candidacy.statusAt,
    statusAtLabel: formatInstant(candidacy.statusAt),
    photo: photoModel(candidacy.personId, photographs, sources),
    source: sourceModel(candidacy.sourceId, sources),
    publishing: publishingModel(candidacy),
  };
}

function expectedPositions(office) {
  return office === "senator" ? [0, 1, 2] : [0, 1];
}

function roleLabel(role, position) {
  if (role === "substitute") return `${position}º suplente`;
  return ROLE_LABELS[role] ?? role;
}

export function ticketModels(candidacy, { tickets = [], members = [], persons = [], contests = [], sources = [] } = {}, { now = Date.now } = {}) {
  if (!candidacy) return [];
  const contest = indexBy(contests).get(candidacy.contestId);
  const personIndex = indexBy(persons);
  const expected = expectedPositions(contest?.office);
  const instant = new Date(now()).toISOString();
  return tickets
    .filter((ticket) => ticket.candidacyId === candidacy.id)
    .sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0))
    .map((ticket) => {
      const rows = members.filter((member) => member.ticketId === ticket.id).sort((a, b) => a.position - b.position);
      const filled = new Set(rows.map((member) => member.position));
      const gaps = expected.filter((position) => !filled.has(position)).map((position) => ({
        position,
        label: position === 0 ? "Titular" : contest?.office === "senator" ? `${position}º suplente` : "Vice",
        note: "Integrante não informado pela fonte",
      }));
      return {
        id: ticket.id,
        validFrom: ticket.validFrom,
        validFromLabel: formatInstant(ticket.validFrom, { withTime: false }),
        validTo: ticket.validTo,
        validToLabel: ticket.validTo ? formatInstant(ticket.validTo, { withTime: false }) : null,
        current: ticket.validFrom <= instant && (ticket.validTo === null || ticket.validTo > instant),
        completeness: ticket.completeness,
        completenessLabel: ticket.completeness === "complete" ? "Composição completa" : "Composição parcial",
        source: sourceModel(ticket.sourceId, sources),
        members: rows.map((member) => ({
          id: member.id,
          role: member.role,
          roleLabel: roleLabel(member.role, member.position),
          position: member.position,
          personId: member.personId,
          personName: personIndex.get(member.personId)?.displayName ?? "Pessoa não identificada",
          initials: initialsOf(personIndex.get(member.personId)?.displayName ?? ""),
        })),
        gaps,
      };
    });
}

export function claimModels(candidacy, { claims = [], sources = [] } = {}) {
  const rows = claims.filter((claim) => !candidacy || claim.candidacyId === candidacy.id);
  const published = rows.filter(isPublished);
  const pending = rows.filter((claim) => !isPublished(claim) && claim.publication !== "withdrawn");
  const withdrawn = rows.filter((claim) => claim.publication === "withdrawn");
  return {
    items: published.map((claim) => ({
      id: claim.id,
      kind: claim.kind,
      kindLabel: CLAIM_KIND_LABELS[claim.kind] ?? claim.kind,
      nature: CLAIM_NATURE[claim.kind] ?? "registro",
      theme: claim.theme,
      text: claim.text,
      locator: claim.locator,
      source: sourceModel(claim.sourceId, sources),
      publishing: publishingModel(claim),
    })),
    pendingCount: pending.length,
    withdrawnCount: withdrawn.length,
    themes: [...new Set(published.map((claim) => claim.theme))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export function historyModel(history = []) {
  const entries = [...history].sort((a, b) => a.revision - b.revision).map((entry) => ({
    revision: entry.revision,
    action: entry.action,
    actionLabel: HISTORY_ACTION_LABELS[entry.action] ?? entry.action,
    at: entry.at,
    atLabel: formatInstant(entry.at),
    reason: entry.reason,
  }));
  const last = entries.at(-1) ?? null;
  return { entries, last, corrected: last?.action === "correct", withdrawn: last?.action === "withdraw" };
}

export function freshnessModel(freshness, { fetchedAt = null, stale = false, now = Date.now } = {}) {
  const collectedAt = freshness?.collectedAt ?? null;
  const staleByContract = Boolean(freshness?.staleAfter && Date.parse(freshness.staleAfter) < now());
  return {
    collectedAt,
    collectedAtLabel: collectedAt ? formatInstant(collectedAt) : "",
    fetchedAt,
    fetchedAtLabel: fetchedAt ? formatInstant(new Date(fetchedAt).toISOString()) : "",
    stale: Boolean(stale || staleByContract),
    label: stale || staleByContract ? "Dados desatualizados: mostrando a última versão permitida" : collectedAt ? `Dados coletados em ${formatInstant(collectedAt)}` : "",
  };
}

export function coverageModel(event, { coverage = [], articles = [], outlets = [], sources = [] } = {}) {
  const articleIndex = indexBy(articles);
  const outletIndex = indexBy(outlets);
  return SLOTS.map((slot) => {
    const row = coverage.find((item) => item.eventId === event?.id && item.slot === slot) ?? null;
    const state = row?.state ?? "not_found";
    const article = row?.articleId ? articleIndex.get(row.articleId) : null;
    const outlet = article ? outletIndex.get(article.outletId) : null;
    const origin = article ? outletIndex.get(article.originOutletId) : null;
    return {
      slot,
      slotLabel: SLOT_LABELS[slot],
      state,
      stateLabel: COVERAGE_STATE_LABELS[state] ?? state,
      present: state === "present" && Boolean(article) && isPublished(article),
      reason: row?.reason ?? (row ? null : "Espaço sem registro de verificação"),
      checkedAtLabel: row ? formatInstant(row.checkedAt) : "",
      relevance: row?.relevance ?? null,
      classificationVersion: row?.classificationVersion ?? null,
      article: article ? {
        id: article.id,
        headline: article.headline,
        kind: article.kind,
        kindLabel: ARTICLE_KIND_LABELS[article.kind] ?? article.kind,
        url: safeHttpsUrl(article.canonicalUrl),
        access: article.access,
        accessLabel: ACCESS_LABELS[article.access] ?? article.access,
        language: article.language,
        sourceAtLabel: formatInstant(article.sourceAt),
        syndicated: Boolean(article.syndicatedFromId),
        translated: Boolean(article.translatedFromId),
        outlet: outlet ? { id: outlet.id, name: outlet.name, country: outlet.country, orientationLabel: ORIENTATION_LABELS[outlet.orientation] ?? outlet.orientation, classificationReviewLabel: REVIEW_LABELS[outlet.classificationReview] ?? outlet.classificationReview, classificationContested: outlet.classificationReview !== "approved", methodology: sourceModel(outlet.methodologySourceId, sources) } : null,
        origin: origin ? { id: origin.id, name: origin.name, country: origin.country, international: origin.country !== "BR" } : null,
        publishing: publishingModel(article),
      } : null,
    };
  });
}

export function eventModel(event, bundle = {}) {
  if (!event) return null;
  return {
    id: event.id,
    href: civicHref({ kind: "event", params: { id: event.id } }),
    title: event.title,
    summary: event.summary,
    theme: event.theme,
    jurisdiction: event.jurisdiction,
    jurisdictionLabel: jurisdictionLabel(event.jurisdiction),
    startsAtLabel: formatInstant(event.startsAt, { withTime: false }),
    endsAtLabel: formatInstant(event.endsAt, { withTime: false }),
    coverage: coverageModel(event, bundle),
    source: sourceModel(event.sourceId, bundle.sources ?? []),
    publishing: publishingModel(event),
  };
}

export function editionModel(edition, bundle = {}) {
  if (!edition) return null;
  const eventIndex = indexBy(bundle.events ?? []);
  const items = (bundle.editionItems ?? [])
    .filter((item) => item.editionId === edition.id)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.id, position: item.position, selectionReason: item.selectionReason, event: eventModel(eventIndex.get(item.eventId), bundle) }))
    .filter((item) => item.event);
  return {
    id: edition.id,
    href: civicHref({ kind: "edition", params: { id: edition.id } }),
    date: edition.date,
    dateLabel: formatCivilDate(edition.date),
    timezone: edition.timezone,
    jurisdiction: edition.jurisdiction,
    jurisdictionLabel: jurisdictionLabel(edition.jurisdiction),
    items,
    publishing: publishingModel(edition),
  };
}

/** Comparação com exposição equivalente: mesmos temas, na mesma ordem, para todas. */
export function comparisonModel(ids = [], bundle = {}) {
  const candidacies = ids.map((id) => (bundle.candidacies ?? []).find((row) => row.id === id)).filter(Boolean);
  const columns = candidacies.map((candidacy) => ({
    card: candidacyCardModel(candidacy, bundle),
    tickets: ticketModels(candidacy, bundle),
    claims: claimModels(candidacy, bundle),
  }));
  const themes = [...new Set(columns.flatMap((column) => column.claims.themes))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const contests = new Set(candidacies.map((row) => row.contestId));
  return {
    ids: [...ids],
    compatible: candidacies.length === ids.length && contests.size <= 1,
    columns,
    themes,
    rows: themes.map((theme) => ({
      theme,
      cells: columns.map((column) => ({
        candidacyId: column.card.id,
        claims: column.claims.items.filter((claim) => claim.theme === theme),
        empty: !column.claims.items.some((claim) => claim.theme === theme),
        emptyLabel: "Nenhuma afirmação publicada sobre este tema",
      })),
    })),
  };
}

export function coverageSummary(coverage) {
  if (!coverage) return { state: "unreconciled", label: "Cobertura oficial ainda não reconciliada", official: null, published: null };
  const state = coverage.unpublished > 0 ? "partial" : "complete";
  return {
    state,
    official: coverage.official,
    imported: coverage.imported,
    published: coverage.published,
    unpublished: coverage.unpublished,
    label: state === "partial"
      ? `${coverage.published} de ${coverage.official} candidaturas oficiais publicadas; ${coverage.unpublished} ainda sem publicação`
      : `${coverage.published} de ${coverage.official} candidaturas oficiais publicadas`,
  };
}

/** Texto e ação para cada falha de leitura, sem jargão técnico na tela. */
export function readErrorModel(error, { now = Date.now } = {}) {
  if (!error) return null;
  const waitSeconds = error.retryAt ? Math.max(0, Math.ceil((error.retryAt - now()) / 1000)) : 0;
  const table = {
    invalid: { title: "Consulta inválida", detail: error.message, action: "back" },
    restricted: { title: "Conteúdo restrito", detail: "Este material só está disponível para a revisão editorial. A consulta pública não exige login.", action: "back" },
    "not-found": { title: "Conteúdo não encontrado", detail: "O endereço pode estar incompleto ou o registro ainda não foi publicado.", action: "back" },
    "stale-cursor": { title: "A lista mudou", detail: "Reiniciamos a paginação para não misturar versões.", action: "retry" },
    withdrawn: { title: "Conteúdo retirado", detail: "A redação retirou este registro. A versão anterior deixou de ser exibida.", action: "back" },
    "rate-limited": { title: "Muitas consultas", detail: waitSeconds ? `Aguarde ${waitSeconds} s antes de tentar de novo.` : "Aguarde um instante antes de tentar de novo.", action: "wait" },
    unavailable: { title: "Consulta indisponível", detail: "O serviço não respondeu. Você pode tentar de novo.", action: "retry" },
    offline: { title: "Sem conexão", detail: "A consulta volta quando a rede voltar. Nada foi enviado.", action: "retry" },
    network: { title: "Sem conexão com o servidor", detail: "Verifique a rede e tente de novo.", action: "retry" },
    timeout: { title: "O servidor demorou", detail: "A consulta demorou demais. Você pode tentar de novo.", action: "retry" },
    schema: { title: "Resposta inesperada", detail: "Os dados não seguem o contrato e não foram exibidos. Código: CIVIC_SCHEMA.", action: "retry" },
    aborted: { title: "Consulta cancelada", detail: "", action: "none" },
  };
  const base = table[error.kind] ?? table.unavailable;
  return { kind: error.kind, ...base, waitSeconds, code: error.code ?? "", entity: error.entity ?? null };
}
