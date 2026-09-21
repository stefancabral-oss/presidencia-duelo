// Componentes das áreas cívicas (FRONT · F01 · #217).
//
// Inventário: fonte/localizador, data de referência, cobertura do recorte,
// situação oficial, fotografia com placeholder neutro, cartão de candidatura,
// cartão de integrante, seção de chapa, afirmação com natureza e fonte, cartão de
// cobertura por espaço, barra de filtros, barra de comparação e cabeçalho de tela.
// Todos recebem modelos de `view-models.js` e nunca inferem nada além deles.
import { JURISDICTION_OPTIONS } from "../view-models.js";
import { el, externalLink, internalLink, reconcileList, replaceChildren, setAttr, setHidden, setText, srOnly } from "./dom.js";

export function sourceChip(source, { locator = null } = {}) {
  if (!source) return el("span", { class: "civic-source is-missing" }, "Fonte não informada");
  const label = source.url ? externalLink(source.url, source.publisher, { className: "civic-source-link" }) : el("span", {}, source.publisher);
  return el("span", { class: "civic-source", dataset: { synthetic: source.synthetic ? "true" : "false" } },
    el("span", { class: "civic-source-kind" }, source.kindLabel),
    " · ",
    label,
    locator || source.locator ? el("span", { class: "civic-source-locator" }, ` · ${locator ?? source.locator}`) : null,
    source.fetchedAtLabel ? el("span", { class: "civic-source-date" }, ` · coletado em ${source.fetchedAtLabel}`) : null,
  );
}

export function referenceDate(label, valueLabel) {
  if (!valueLabel) return null;
  return el("span", { class: "civic-date" }, el("span", { class: "civic-date-label" }, `${label}: `), valueLabel);
}

export function coverageLine(summary) {
  const node = el("p", { class: "civic-coverage" });
  return updateCoverageLine(node, summary);
}

export function updateCoverageLine(node, summary) {
  setAttr(node, "data-state", summary?.state ?? "unknown");
  setText(node, summary?.label ?? "");
  setHidden(node, !summary?.label);
  return node;
}

export function officialStatusBadge(card) {
  return el("p", { class: "civic-status" },
    el("strong", {}, "Situação oficial: "),
    el("span", { class: "civic-status-value" }, card.officialStatus),
    card.statusAtLabel ? el("span", { class: "civic-status-date" }, ` (em ${card.statusAtLabel})`) : null,
  );
}

export function photoFigure(photo, { initials, name, size = "card" } = {}) {
  const figure = el("figure", { class: `civic-photo is-${size}`, dataset: { photoState: photo?.state ?? "absent" } });
  if (photo?.url) {
    figure.append(el("img", { src: photo.url, alt: `Fotografia documental de ${name}`, loading: "lazy", decoding: "async" }));
  } else {
    figure.append(el("span", { class: "civic-photo-placeholder", "aria-hidden": "true" }, initials || "?"));
  }
  figure.append(el("figcaption", { class: "civic-photo-caption" }, photo?.credit ? `${photo.label} · ${photo.credit}` : photo?.label ?? "Sem fotografia documental"));
  return figure;
}

export function candidacyCard(card, { selectable = false, selected = false, onToggle } = {}) {
  const title = el("h3", { class: "civic-card-title" }, internalLink(card.href, card.name, { dataset: { civicCandidacy: card.id } }));
  const meta = el("p", { class: "civic-card-meta" });
  const status = officialStatusBadge(card);
  const source = el("p", { class: "civic-card-source" }, sourceChip(card.source));
  const toggle = el("label", { class: "civic-compare-toggle", hidden: !selectable },
    el("input", { type: "checkbox", dataset: { civicCompare: card.id }, checked: selected, onchange: (event) => onToggle?.(card.id, event.target.checked) }),
    el("span", {}, "Comparar"),
  );
  const article = el("article", { class: "civic-card", dataset: { candidacyId: card.id } },
    photoFigure(card.photo, { initials: card.initials, name: card.name }),
    el("div", { class: "civic-card-body" }, title, meta, status, source, toggle),
  );
  return updateCandidacyCard(article, card, { selectable, selected });
}

export function updateCandidacyCard(article, card, { selectable = false, selected = false } = {}) {
  const link = article.querySelector("[data-civic-candidacy]");
  setText(link, card.name);
  setAttr(link, "href", card.href);
  const meta = article.querySelector(".civic-card-meta");
  setText(meta, `Número ${card.number} · ${card.partyLabel}${card.contest ? ` · ${card.contest.label}` : ""}`);
  setText(article.querySelector(".civic-status-value"), card.officialStatus);
  const statusDate = article.querySelector(".civic-status-date");
  if (statusDate) setText(statusDate, card.statusAtLabel ? ` (em ${card.statusAtLabel})` : "");
  const figure = article.querySelector(".civic-photo");
  if (figure.dataset.photoState !== card.photo.state || figure.querySelector("img")?.getAttribute("src") !== (card.photo.url ?? null)) {
    figure.replaceWith(photoFigure(card.photo, { initials: card.initials, name: card.name }));
  }
  const toggle = article.querySelector(".civic-compare-toggle");
  setHidden(toggle, !selectable);
  const checkbox = toggle.querySelector("input");
  if (checkbox.checked !== selected) checkbox.checked = selected;
  setAttr(checkbox, "aria-label", `Comparar ${card.name}`);
  return article;
}

export function memberCard(member) {
  return el("li", { class: "civic-member", dataset: { role: member.role } },
    el("span", { class: "civic-member-avatar", "aria-hidden": "true" }, member.initials),
    el("span", { class: "civic-member-role" }, member.roleLabel),
    el("span", { class: "civic-member-name" }, member.personName),
  );
}

export function ticketSection(ticket) {
  const period = ticket.validToLabel ? `de ${ticket.validFromLabel} até ${ticket.validToLabel}` : `desde ${ticket.validFromLabel}`;
  return el("section", { class: "civic-ticket", dataset: { current: ticket.current ? "true" : "false", completeness: ticket.completeness } },
    el("h4", { class: "civic-ticket-title" }, ticket.current ? "Composição vigente" : "Composição anterior", el("span", { class: "civic-ticket-period" }, ` · ${period}`)),
    el("p", { class: "civic-ticket-completeness" }, ticket.completenessLabel),
    el("ul", { class: "civic-members" }, ticket.members.map(memberCard), ticket.gaps.map((gap) => el("li", { class: "civic-member is-gap" },
      el("span", { class: "civic-member-avatar", "aria-hidden": "true" }, "–"),
      el("span", { class: "civic-member-role" }, gap.label),
      el("span", { class: "civic-member-name" }, gap.note),
    ))),
    el("p", { class: "civic-ticket-source" }, sourceChip(ticket.source)),
  );
}

export function claimItem(claim) {
  return el("li", { class: "civic-claim", dataset: { nature: claim.kind } },
    el("p", { class: "civic-claim-labels" },
      el("span", { class: "civic-tag is-kind" }, claim.kindLabel),
      el("span", { class: "civic-tag is-nature" }, claim.nature),
      el("span", { class: "civic-tag is-theme" }, claim.theme),
    ),
    el("p", { class: "civic-claim-text" }, claim.text),
    el("p", { class: "civic-claim-source" }, sourceChip(claim.source, { locator: claim.locator })),
  );
}

export function coverageCard(slot) {
  const body = [];
  if (slot.article) {
    const article = slot.article;
    body.push(
      el("h4", { class: "civic-slot-headline" }, article.url ? externalLink(article.url, article.headline) : article.headline),
      el("p", { class: "civic-slot-labels" },
        el("span", { class: "civic-tag is-kind" }, article.kindLabel),
        el("span", { class: "civic-tag" }, article.accessLabel),
        article.outlet ? el("span", { class: "civic-tag is-orientation" }, `Classificação: ${article.outlet.orientationLabel} · v${slot.classificationVersion ?? "?"} · ${article.outlet.classificationReviewLabel}`) : null,
      ),
      el("p", { class: "civic-slot-outlet" },
        article.outlet ? `${article.outlet.name} (${article.outlet.country})` : "Redação não identificada",
        article.origin && article.origin.id !== article.outlet?.id ? ` · origem: ${article.origin.name} (${article.origin.country})` : null,
        article.origin?.international ? " · redação de origem fora do Brasil; não é selo de neutralidade" : null,
      ),
      article.syndicated || article.translated ? el("p", { class: "civic-slot-note" }, [article.syndicated ? "Republicação" : null, article.translated ? "tradução" : null].filter(Boolean).join(" e "), ": não conta como confirmação independente.") : null,
      slot.relevance ? el("p", { class: "civic-slot-relevance" }, el("strong", {}, "Por que está aqui: "), slot.relevance) : null,
      article.outlet?.methodology ? el("p", { class: "civic-slot-method" }, "Metodologia da classificação: ", sourceChip(article.outlet.methodology)) : null,
    );
  }
  if (!slot.present) {
    body.push(el("p", { class: "civic-slot-gap" }, slot.reason ?? "Lacuna sem motivo registrado."));
  }
  return el("article", { class: "civic-slot", dataset: { slot: slot.slot, state: slot.state } },
    el("p", { class: "civic-slot-title" }, el("strong", {}, slot.slotLabel), el("span", { class: "civic-slot-state" }, ` · ${slot.stateLabel}`)),
    ...body,
    slot.checkedAtLabel ? el("p", { class: "civic-slot-checked" }, referenceDate("Verificado em", slot.checkedAtLabel)) : null,
  );
}

export function eventCard(event) {
  const present = event.coverage.filter((slot) => slot.present).length;
  return el("article", { class: "civic-event-card", dataset: { eventId: event.id } },
    el("h3", { class: "civic-event-title" }, internalLink(event.href, event.title, { dataset: { civicEvent: event.id } })),
    el("p", { class: "civic-event-summary" }, event.summary),
    el("p", { class: "civic-event-meta" }, `${event.theme} · ${event.jurisdictionLabel} · ${event.startsAtLabel}${event.endsAtLabel && event.endsAtLabel !== event.startsAtLabel ? ` a ${event.endsAtLabel}` : ""}`),
    el("p", { class: "civic-event-slots" }, `${present} de 3 espaços com cobertura encontrada`, srOnly(". Os espaços vazios são mostrados com o motivo.")),
    el("ul", { class: "civic-slot-dots", "aria-hidden": "true" }, event.coverage.map((slot) => el("li", { dataset: { state: slot.state } }, slot.slotLabel.replace("Espaço ", "")))),
  );
}

export function filterBar({ id = "civic-filters", onSubmit, onReset } = {}) {
  const jurisdiction = el("select", { id: `${id}-uf`, name: "uf", dataset: { civicFilter: "uf" } }, JURISDICTION_OPTIONS.map((option) => el("option", { value: option.value }, option.label)));
  const contest = el("select", { id: `${id}-contest`, name: "disputa", dataset: { civicFilter: "contestId" } });
  const search = el("input", { id: `${id}-search`, name: "busca", type: "search", maxlength: 512, autocomplete: "off", dataset: { civicFilter: "search" }, placeholder: "Nome ou número" });
  const party = el("input", { id: `${id}-party`, name: "partido", type: "text", maxlength: 512, autocomplete: "off", dataset: { civicFilter: "party" } });
  const status = el("input", { id: `${id}-status`, name: "situacao", type: "text", maxlength: 512, autocomplete: "off", dataset: { civicFilter: "officialStatus" } });
  const form = el("form", { class: "civic-filters", role: "search", "aria-label": "Filtrar candidaturas", onsubmit: (event) => { event.preventDefault(); onSubmit?.(); } },
    el("div", { class: "civic-field" }, el("label", { for: jurisdiction.id }, "Recorte"), jurisdiction),
    el("div", { class: "civic-field" }, el("label", { for: contest.id }, "Disputa"), contest),
    el("div", { class: "civic-field" }, el("label", { for: search.id }, "Buscar"), search),
    el("div", { class: "civic-field" }, el("label", { for: party.id }, "Partido"), party),
    el("div", { class: "civic-field" }, el("label", { for: status.id }, "Situação oficial"), status),
    el("div", { class: "civic-filter-actions" },
      el("button", { class: "civic-button", type: "submit" }, "Aplicar filtros"),
      el("button", { class: "civic-button is-secondary", type: "button", onclick: () => onReset?.() }, "Limpar"),
    ),
  );
  return { form, fields: { jurisdiction, contest, search, party, status } };
}

export function setContestOptions(select, contests, selectedId) {
  const options = contests.map((contest) => ({ value: contest.id, label: contest.label }));
  reconcileList(select, options, {
    key: (option) => option.value,
    create: (option) => el("option", { value: option.value }, option.label),
    update: (node, option) => setText(node, option.label),
  });
  if (options.length === 0) replaceChildren(select, el("option", { value: "", dataset: { key: "none" } }, "Nenhuma disputa publicada"));
  const wanted = options.some((option) => option.value === selectedId) ? selectedId : options[0]?.value ?? "";
  if (select.value !== wanted) select.value = wanted;
  select.disabled = options.length === 0;
  return wanted;
}

export function compareBar({ onCompare, onClear } = {}) {
  const count = el("span", { class: "civic-compare-count" });
  const button = el("button", { class: "civic-button", type: "button", dataset: { civicAction: "compare" }, onclick: () => onCompare?.() }, "Comparar");
  const clear = el("button", { class: "civic-button is-secondary", type: "button", onclick: () => onClear?.() }, "Limpar seleção");
  const root = el("div", { class: "civic-compare-bar", hidden: true, role: "region", "aria-label": "Seleção para comparação" }, count, button, clear);
  return {
    root,
    update(selected) {
      const total = selected.length;
      setHidden(root, total === 0);
      setText(count, `${total} de 3 selecionadas`);
      button.disabled = total < 2 || total > 3;
      setAttr(button, "aria-disabled", button.disabled ? "true" : null);
    },
  };
}

export function screenHeader({ eyebrow, title, lead, headingId }) {
  const heading = el("h1", { class: "civic-title", id: headingId, tabindex: "-1" }, title);
  const eyebrowNode = el("p", { class: "eyebrow civic-eyebrow" }, eyebrow);
  const leadNode = el("p", { class: "lead civic-lead" }, lead ?? "");
  setHidden(leadNode, !lead);
  return { root: el("header", { class: "civic-header" }, eyebrowNode, heading, leadNode), heading, eyebrow: eyebrowNode, lead: leadNode };
}

export function actionRow(...buttons) {
  return el("div", { class: "civic-actions" }, buttons);
}

export function button(label, { secondary = false, action, onClick, ...props } = {}) {
  return el("button", { class: `civic-button${secondary ? " is-secondary" : ""}`, type: "button", dataset: action ? { civicAction: action } : undefined, onclick: onClick, ...props }, label);
}
