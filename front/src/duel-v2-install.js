function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function addClass(selector, className, root = document) {
  const node = root.querySelector(selector);
  if (node) node.classList.add(...className.split(" ").filter(Boolean));
  return node;
}

export function installDuelV2Layout() {
  const panel = document.getElementById("panel-duel");
  if (!panel || panel.dataset.duelV2 === "1") return false;

  panel.dataset.duelV2 = "1";
  panel.classList.add("pm-duel-v2");

  const topicPicker = panel.querySelector(".topic-picker");
  const modeSwitch = panel.querySelector(".mode-switch");
  const combo = document.getElementById("combo-banner");
  const stats = panel.querySelector(".duel-stats");
  const prompt = document.getElementById("duel-prompt");
  const duelCount = document.getElementById("duel-count");
  const progress = document.getElementById("duel-progress");
  const progressText = document.getElementById("duel-progress-text");
  const progressBar = document.getElementById("duel-progress-bar");
  const progressFill = document.getElementById("duel-progress-fill");
  const goal = document.getElementById("goal-modal");
  const quick = document.getElementById("quick-controls-hint");
  const arena = document.getElementById("duel-cards");
  const status = document.getElementById("skip-duel-status");
  const hint = panel.querySelector(".hint");

  const topline = el("div", "pm-duel-v2__topline");
  const topics = el("div", "pm-duel-v2__topics");
  const counter = el("div", "pm-duel-v2__counter");
  counter.append("Duelo ");
  if (duelCount) counter.appendChild(duelCount);
  if (topicPicker) topics.appendChild(topicPicker);
  topline.append(topics, counter);

  const controls = el("div", "pm-duel-v2__controls");
  if (modeSwitch) {
    modeSwitch.classList.add("pm-duel-v2__mode");
    controls.appendChild(modeSwitch);
  }
  if (combo) {
    combo.classList.add("pm-duel-v2__combo");
    controls.appendChild(combo);
  }

  const questionRow = el("div", "pm-duel-v2__question-row");
  if (prompt) questionRow.appendChild(prompt);
  if (progressText) {
    progressText.classList.add("pm-duel-v2__goal-copy");
    questionRow.appendChild(progressText);
  }

  if (progress) progress.classList.add("pm-duel-v2__progress");
  if (progressBar) progressBar.classList.add("pm-duel-v2__progress-track");
  if (progressFill) progressFill.classList.add("pm-duel-v2__progress-fill");

  if (goal) {
    goal.classList.add("pm-duel-v2__achievement");
    addClass(".goal-modal-card", "pm-duel-v2__achievement-card", goal);
    addClass(".goal-modal-actions", "pm-duel-v2__achievement-actions", goal);
    const card = goal.querySelector(".goal-modal-card");
    if (card && !card.querySelector(".pm-duel-v2__achievement-copy")) {
      const copy = el("div", "pm-duel-v2__achievement-copy");
      for (const selector of [".goal-modal-title", ".goal-modal-lead", ".goal-modal-leader"]) {
        const node = card.querySelector(selector);
        if (node) copy.appendChild(node);
      }
      card.prepend(copy);
    }
  }

  if (arena) {
    arena.classList.add("pm-duel-v2__arena");
    for (const shell of arena.querySelectorAll(".duel-card-shell")) shell.classList.add("pm-duel-v2__card-shell");
    for (const card of arena.querySelectorAll(".poke-card")) card.classList.add("pm-duel-card");
    for (const info of arena.querySelectorAll(".card-info")) info.classList.add("pm-duel-v2__info");
    addClass(".duel-center", "pm-duel-v2__center", arena);
    addClass(".vs-badge", "pm-duel-v2__vs", arena);
    addClass(".skip-duel", "pm-duel-v2__skip", arena);
  }

  if (hint) hint.classList.add("pm-duel-v2__footnote");

  if (stats) stats.remove();

  const ordered = [topline, controls, questionRow, progress, goal, quick, arena, status, hint].filter(Boolean);
  for (const node of ordered) panel.appendChild(node);

  return true;
}
