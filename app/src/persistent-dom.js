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

export function markPortraitFailed(image) {
  const source = image.getAttribute("src") || "";
  if (source) image.dataset.failedSrc = source;
  image.hidden = true;
}

export function markPortraitLoaded(image) {
  delete image.dataset.failedSrc;
  image.hidden = false;
}

export function patchCandidateSlot(slot, model) {
  const { root, button, fallback, image, name, affiliation, office, summary, interactionHint, outcome, outcomeValue, outcomeMessage } = slot;
  root.hidden = !model;
  delete button.dataset.vote;
  delete button.dataset.predict;
  if (!model) {
    button.setAttribute("aria-disabled", "true");
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-label");
    CARD_STATE_CLASSES.forEach((className) => button.classList.toggle(className, false));
    interactionHint.textContent = "";
    outcome.hidden = true;
    return slot;
  }

  if (model.actionMode === "prediction") button.dataset.predict = model.id;
  else if (model.actionMode === "vote") button.dataset.vote = model.id;
  button.setAttribute("aria-label", model.accessibleName);
  button.setAttribute("aria-disabled", String(Boolean(model.locked ?? model.busy)));
  setBooleanAttribute(button, "aria-busy", model.busy);

  CARD_STATE_CLASSES.forEach((className) => button.classList.toggle(className, Boolean(model.classes?.includes(className))));

  fallback.textContent = model.initials;
  if (model.photo) {
    if (image.getAttribute("src") !== model.photo) {
      delete image.dataset.failedSrc;
      image.hidden = true;
      image.setAttribute("src", model.photo);
    }
    image.setAttribute("alt", model.photoAlt);
    if (image.dataset.failedSrc === model.photo) image.hidden = true;
  } else {
    delete image.dataset.failedSrc;
    image.removeAttribute("src");
    image.setAttribute("alt", "");
    image.hidden = true;
  }

  name.textContent = model.name;
  affiliation.textContent = model.affiliation;
  office.textContent = model.office;
  summary.textContent = model.summary;
  interactionHint.textContent = model.interactionHint || "";

  const hasOutcome = Boolean(model.outcome);
  outcome.hidden = !hasOutcome;
  OUTCOME_CLASSES.forEach((className) => outcome.classList.toggle(className, model.outcome?.tone === className));
  outcomeValue.textContent = model.outcome?.value || "";
  outcomeMessage.textContent = model.outcome?.message || "";
  return slot;
}
