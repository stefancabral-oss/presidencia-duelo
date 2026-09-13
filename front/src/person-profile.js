import PERSON_PROFILES from "../../shared/person-profiles.json" with { type: "json" };

const PROFILES_BY_ID = new Map(PERSON_PROFILES.map((profile) => [profile.id, profile]));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function personProfile(id) {
  return PROFILES_BY_ID.get(id) || null;
}

export function formatProfileDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "data não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function personProfileHtml(candidate, profile, topic) {
  const role = profile?.role || "Atuação atual ainda não informada.";
  const party = profile?.party || candidate.party || "Nenhum vínculo partidário informado.";
  const currentMoment = profile?.currentMoment
    ? `<p>${escapeHtml(profile.currentMoment)}</p>`
    : '<p class="profile-unavailable">Ainda não há notícia atual com fonte vinculada para esta pessoa.</p>';
  const sources = profile?.sources?.length
    ? profile.sources.map((source) => `
        <li>
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>
          <span>${escapeHtml(source.publisher)} · ${escapeHtml(formatProfileDate(source.publishedAt || source.accessedAt))}</span>
        </li>
      `).join("")
    : '<li class="profile-unavailable">Nenhuma fonte cadastrada.</li>';

  return `
    <dl class="profile-facts">
      <div><dt>Atuação atual</dt><dd>${escapeHtml(role)}</dd></div>
      <div><dt>Partido ou vínculo</dt><dd>${escapeHtml(party)}</dd></div>
      <div><dt>Tópico deste duelo</dt><dd>${escapeHtml(topic.label)}</dd></div>
    </dl>
    <section class="profile-moment" aria-labelledby="person-profile-moment-title">
      <h3 id="person-profile-moment-title">Momento atual</h3>
      ${currentMoment}
    </section>
    <section class="profile-sources" aria-labelledby="person-profile-sources-title">
      <h3 id="person-profile-sources-title">Fontes</h3>
      <ul>${sources}</ul>
    </section>
    <p class="profile-updated">Atualizado em <time datetime="${escapeHtml(profile?.updatedAt || "")}">${escapeHtml(formatProfileDate(profile?.updatedAt))}</time>.</p>
  `;
}

export function openPersonProfile({ dialog, title, body, candidate, topic, trigger }) {
  const profile = personProfile(candidate.id);
  title.textContent = candidate.name;
  body.innerHTML = personProfileHtml(candidate, profile, topic);
  dialog.dataset.returnFocus = trigger.id;
  dialog.showModal();
  dialog.querySelector("[data-profile-close]")?.focus();
}

export function restorePersonProfileFocus(dialog, documentObject = document) {
  const target = dialog.dataset.returnFocus;
  if (target) documentObject.getElementById(target)?.focus();
  delete dialog.dataset.returnFocus;
}
