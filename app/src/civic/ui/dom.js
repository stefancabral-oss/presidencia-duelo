// Utilitários de DOM para as telas cívicas (FRONT · F01 · #217).
//
// Regras: conteúdo externo entra sempre como texto (`textContent`), nunca como
// HTML; listas são reconciliadas por chave para preservar nós e foco; atributos
// só mudam quando o valor muda, para não disparar reanúncios de leitor de tela.
import { safeHttpsUrl } from "../view-models.js";

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
  return node;
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (["hidden", "disabled", "checked", "selected", "required", "open"].includes(key)) node[key] = Boolean(value);
    else if (key === "value") node.value = String(value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  return append(node, children);
}

export function setText(node, value) {
  const next = value === null || value === undefined ? "" : String(value);
  if (node.textContent !== next) node.textContent = next;
  return node;
}

export function setHidden(node, hidden) {
  const next = Boolean(hidden);
  if (node.hidden !== next) node.hidden = next;
  return node;
}

export function setAttr(node, name, value) {
  if (value === null || value === undefined || value === false) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
    return node;
  }
  const next = value === true ? "" : String(value);
  if (node.getAttribute(name) !== next) node.setAttribute(name, next);
  return node;
}

export function replaceChildren(node, ...children) {
  node.replaceChildren();
  return append(node, children);
}

/**
 * Mantém os nós existentes cuja chave permanece, cria os novos e remove os
 * ausentes, na ordem dos itens. Foco dentro de um item preservado não se perde.
 */
export function reconcileList(container, items, { key, create, update }) {
  const existing = new Map([...container.children].map((child) => [child.dataset.key, child]));
  const nodes = items.map((item, index) => {
    const id = String(key(item, index));
    let node = existing.get(id);
    if (node) existing.delete(id);
    else {
      node = create(item, index);
      node.dataset.key = id;
    }
    update?.(node, item, index);
    return node;
  });
  for (const orphan of existing.values()) orphan.remove();
  nodes.forEach((node, index) => {
    if (container.children[index] !== node) container.insertBefore(node, container.children[index] ?? null);
  });
  return nodes;
}

const FOCUSABLE = /^(a|button|input|select|textarea|summary)$/i;

export function focusElement(node, { preventScroll = false } = {}) {
  if (!node || typeof node.focus !== "function") return false;
  if (!FOCUSABLE.test(node.tagName) && !node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
  node.focus({ preventScroll });
  return document.activeElement === node;
}

/** Link externo só com HTTPS validado; caso contrário, texto com aviso. */
export function externalLink(href, label, { className = "civic-link" } = {}) {
  const safe = safeHttpsUrl(href);
  if (!safe) return el("span", { class: `${className} is-unavailable` }, label, " (endereço indisponível)");
  return el("a", { class: className, href: safe, target: "_blank", rel: "noreferrer noopener" }, label);
}

export function internalLink(href, label, props = {}) {
  return el("a", { class: "civic-link", href, ...props }, label);
}

export function srOnly(text) {
  return el("span", { class: "visually-hidden" }, text);
}
