const OUTCOME_CLASSES = ["gain", "loss"];
const CARD_STATE_CLASSES = ["is-selected", "is-round-winner", "is-round-loser"];

function setBooleanAttribute(element, name, enabled) {
  if (enabled) element.setAttribute(name, "true");
  else element.removeAttribute(name);
}

export function showPersistentPanel(panels, activeName) {
  Object.entries(panels).forEach(([name, panel]) => {
    const active = name === activeName;
    panel.hidden = !active;
    if (active) panel.removeAttribute("aria-hidden");
    else panel.setAttribute("aria-hidden", "true");
  });
}

export function patchCandidateSlot(slot, model) {
  const { root, button, fallback, image, name, affiliation, office, summary, outcome, outcomeValue, outcomeMessage } = slot;
  root.hidden = !model;
  if (!model) {
    button.dataset.vote = "";
    button.setAttribute("aria-disabled", "true");
    return slot;
  }

  button.dataset.vote = model.id;
  button.setAttribute("aria-label", model.accessibleName);
  button.setAttribute("aria-disabled", String(Boolean(model.busy)));
  setBooleanAttribute(button, "aria-busy", model.busy);

  CARD_STATE_CLASSES.forEach((className) => button.classList.toggle(className, Boolean(model.classes?.includes(className))));

  fallback.textContent = model.initials;
  if (model.photo) {
    if (image.getAttribute("src") !== model.photo) image.setAttribute("src", model.photo);
    image.setAttribute("alt", model.photoAlt);
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.setAttribute("alt", "");
    image.hidden = true;
  }

  name.textContent = model.name;
  affiliation.textContent = model.affiliation;
  office.textContent = model.office;
  summary.textContent = model.summary;

  const hasOutcome = Boolean(model.outcome);
  outcome.hidden = !hasOutcome;
  OUTCOME_CLASSES.forEach((className) => outcome.classList.toggle(className, model.outcome?.tone === className));
  outcomeValue.textContent = model.outcome?.value || "";
  outcomeMessage.textContent = model.outcome?.message || "";
  return slot;
}
