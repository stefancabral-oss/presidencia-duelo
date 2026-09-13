import { TOPICS } from "../../shared/topics.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function topicSelectorHtml(label = "Escolha o assunto") {
  return `
    <section class="topic-picker" data-topic-selector aria-label="${escapeHtml(label)}">
      <div class="topic-picker-heading">
        <strong>${escapeHtml(label)}</strong>
        <span data-topic-count>360 pessoas</span>
      </div>
      <div class="topic-list" role="group" aria-label="Tópico">
        ${TOPICS.map((topic, index) => `
          <button
            type="button"
            class="topic-btn${index === 0 ? " active" : ""}"
            data-topic="${escapeHtml(topic.id)}"
            aria-pressed="${index === 0 ? "true" : "false"}"
          ><span aria-hidden="true">${topic.icon}</span>${escapeHtml(topic.label)}</button>
        `).join("")}
      </div>
      <p class="topic-description" data-topic-description>${escapeHtml(TOPICS[0].description)}</p>
    </section>`;
}
