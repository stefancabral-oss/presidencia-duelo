import { rarityForElo } from "./rarity.js";

/**
 * Card do Duelo v2. Preserva seletores usados pela lógica existente,
 * mas a anatomia visual passa a ser imagem dominante + informação inferior.
 */
export const DUEL_CARD_SKELETON = `
      <div class="art-frame pm-card__media">
        <img alt="" />
        <div class="placeholder" style="display:none"></div>
        <div class="pm-card__brand" aria-hidden="true">◆ PoliMatch</div>
        <div class="pm-card__rarity" aria-hidden="true"></div>
      </div>
      <div class="card-top pm-card__body">
        <div class="card-name pm-card__name"></div>
        <div class="pm-card__role"></div>
        <div class="pm-card__description"></div>
        <div class="party-chip pm-card__meta"></div>
      </div>
      <div class="card-bottom" hidden>
        <div class="vice">Vice: <strong></strong></div>
        <div class="hp-bar" aria-hidden="true"><div class="hp-fill"></div></div>
        <div class="elo-mini"></div>
      </div>
    `;

export function hasDuelPhoto(el) {
  return Boolean(el.querySelector(".art-frame img"));
}

function showPhotoError(img, placeholder) {
  img.style.display = "none";
  if (placeholder) placeholder.style.display = "grid";
}

function candidateRole(candidate) {
  return candidate.role || candidate.title || candidate.office || "";
}

function candidateDescription(candidate) {
  return candidate.summary || candidate.description || candidate.bio || "";
}

export function fillDuelCard(el, candidate, { elo, wr, barWidth }) {
  if (!hasDuelPhoto(el)) el.innerHTML = DUEL_CARD_SKELETON;

  const rarity = rarityForElo(elo);
  if (el.dataset) el.dataset.rarity = rarity.id;

  el.querySelector(".card-name").textContent = candidate.name;
  el.querySelector(".party-chip").textContent = candidate.party || "";

  const role = el.querySelector(".pm-card__role");
  if (role) role.textContent = candidateRole(candidate);
  const description = el.querySelector(".pm-card__description");
  if (description) description.textContent = candidateDescription(candidate);
  const rarityBadge = el.querySelector(".pm-card__rarity");
  if (rarityBadge) {
    rarityBadge.textContent = rarity.symbol;
    rarityBadge.title = rarity.label;
  }

  const mateRow = el.querySelector(".vice");
  if (mateRow?.firstChild) mateRow.firstChild.textContent = `${candidate.mateLabel || "Vice"}: `;
  const mateStrong = el.querySelector(".vice strong");
  if (mateStrong) mateStrong.textContent = candidate.vice || "";
  const eloMini = el.querySelector(".elo-mini");
  if (eloMini) eloMini.textContent = `Elo ${elo} · ${wr}% vitórias`;
  const hpFill = el.querySelector(".hp-fill");
  if (hpFill) hpFill.style.width = `${barWidth}%`;

  const placeholder = el.querySelector(".placeholder");
  placeholder.textContent = candidate.initials;
  placeholder.style.display = candidate.photo ? "none" : "grid";

  const img = el.querySelector(".art-frame img");
  img.removeAttribute("loading");
  img.alt = `Foto de ${candidate.name}`;
  img.style.display = candidate.photo ? "" : "none";
  img.onerror = () => showPhotoError(img, placeholder);
  if (candidate.photo && img.getAttribute("src") !== candidate.photo) img.src = candidate.photo;
  else if (!candidate.photo) img.removeAttribute("src");
}
