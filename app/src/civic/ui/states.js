// Painel de estados compartilhado pelas telas cívicas (FRONT · F01 · #217).
//
// Estados cobertos: carregando, vazio, erro com repetição ou retorno, parcial,
// não reconciliado, pendente, desatualizado, corrigido, retirado, restrito e
// avisos de parâmetros ignorados. Um único nó vivo (`role="status"`) anuncia a
// mudança principal; avisos secundários ficam em lista estática.
import { readErrorModel } from "../view-models.js";
import { el, reconcileList, setAttr, setHidden, setText } from "./dom.js";

export const NOTICE_TONES = Object.freeze(["info", "warning", "pending", "stale", "corrected", "withdrawn", "restricted"]);

export function notice(tone, text, { key } = {}) {
  return { tone: NOTICE_TONES.includes(tone) ? tone : "info", text, key: key ?? `${tone}:${text}` };
}

export function createStatePanel({ area, onRetry, onBack, backLabel = "Voltar" } = {}) {
  const status = el("p", { class: "civic-state-status", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const errorTitle = el("strong", { class: "civic-state-title" });
  const errorDetail = el("span", { class: "civic-state-detail" });
  const retry = el("button", { class: "civic-button", type: "button", dataset: { civicAction: "retry", civicArea: area ?? "" }, onclick: () => onRetry?.() }, "Tentar de novo");
  const back = el("button", { class: "civic-button is-secondary", type: "button", dataset: { civicAction: "back" }, onclick: () => onBack?.() }, backLabel);
  const errorBlock = el("div", { class: "civic-state-error", role: "group", hidden: true }, el("p", {}, errorTitle, " ", errorDetail), el("div", { class: "civic-state-actions" }, retry, back));
  const empty = el("p", { class: "civic-state-empty", hidden: true });
  const notices = el("ul", { class: "civic-notices", hidden: true });
  const root = el("div", { class: "civic-state", dataset: { civicState: "idle" } }, status, errorBlock, empty, notices);
  let countdown = null;

  function stopCountdown() {
    if (countdown) clearInterval(countdown);
    countdown = null;
  }

  function renderNotices(items) {
    setHidden(notices, items.length === 0);
    reconcileList(notices, items, {
      key: (item) => item.key,
      create: () => el("li", { class: "civic-notice" }),
      update: (node, item) => {
        setAttr(node, "data-tone", item.tone);
        setText(node, item.text);
      },
    });
  }

  function update({ status: state = "idle", error = null, emptyText = "Nada publicado para este recorte.", loadingText = "Carregando…", notices: items = [], now = Date.now } = {}) {
    stopCountdown();
    root.dataset.civicState = state;
    setHidden(errorBlock, state !== "error");
    setHidden(empty, state !== "empty");
    if (state === "loading") setText(status, loadingText);
    else if (state === "empty") {
      setText(status, "");
      setText(empty, emptyText);
    } else if (state === "error" && error) {
      const model = readErrorModel(error, { now });
      setText(errorTitle, model.title);
      setText(errorDetail, model.detail);
      setText(status, `${model.title}. ${model.detail}`.trim());
      setHidden(retry, !["retry", "wait"].includes(model.action));
      setHidden(back, model.action === "none");
      if (model.action === "wait") {
        retry.disabled = model.waitSeconds > 0;
        setText(retry, model.waitSeconds > 0 ? `Aguardar ${model.waitSeconds} s` : "Tentar de novo");
        if (model.waitSeconds > 0) {
          countdown = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((error.retryAt - now()) / 1000));
            setText(retry, remaining > 0 ? `Aguardar ${remaining} s` : "Tentar de novo");
            retry.disabled = remaining > 0;
            if (remaining <= 0) stopCountdown();
          }, 1000);
        }
      } else {
        retry.disabled = false;
        setText(retry, "Tentar de novo");
      }
    } else setText(status, "");
    renderNotices(items);
    return root;
  }

  return { root, update, destroy: stopCountdown };
}

/** Avisos padrão a partir do estado de uma área do store e da rota. */
export function noticesFor({ area, route, model = {} } = {}) {
  const items = [];
  for (const problem of route?.problems ?? []) {
    const text = {
      "unknown-parameter": `Parâmetro ignorado: ${problem.detail ?? "desconhecido"}.`,
      uf: `Recorte "${problem.detail ?? ""}" não existe; mostrando o recorte escolhido.`,
      contest: "Disputa inválida no endereço; escolha uma disputa.",
      ids: "Só é possível comparar entre duas e três candidaturas; IDs extras ou inválidos foram ignorados.",
      revision: "Revisão inválida no endereço; mostrando a versão atual.",
      text: `Filtro "${problem.detail ?? ""}" ignorado por exceder o limite.`,
      query: "Parte do endereço não pôde ser lida.",
    }[problem.code] ?? "Parte do endereço foi ignorada.";
    items.push(notice("warning", text, { key: `route:${problem.code}:${problem.detail ?? ""}` }));
  }
  if (area?.stale) items.push(notice("stale", model.freshness?.label || "Dados desatualizados: mostrando a última versão permitida, com data explícita.", { key: "stale" }));
  if (model.coverageSummary?.state === "unreconciled") items.push(notice("warning", model.coverageSummary.label, { key: "unreconciled" }));
  if (model.coverageSummary?.state === "partial") items.push(notice("info", model.coverageSummary.label, { key: "partial" }));
  if (model.history?.corrected) items.push(notice("corrected", `Corrigido em ${model.history.last.atLabel}: ${model.history.last.reason}`, { key: "corrected" }));
  if (model.pendingCount > 0) items.push(notice("pending", `${model.pendingCount} ${model.pendingCount === 1 ? "registro aguarda" : "registros aguardam"} revisão editorial e não ${model.pendingCount === 1 ? "é exibido" : "são exibidos"}.`, { key: "pending" }));
  if (model.withdrawnCount > 0) items.push(notice("withdrawn", `${model.withdrawnCount} ${model.withdrawnCount === 1 ? "registro foi retirado" : "registros foram retirados"} pela redação.`, { key: "withdrawn" }));
  if (area?.error && area.status === "ready") {
    const failure = readErrorModel(area.error);
    items.push(notice("warning", `${failure.title}: ${failure.detail}`, { key: `soft-error:${area.error.kind}` }));
  }
  return items;
}
