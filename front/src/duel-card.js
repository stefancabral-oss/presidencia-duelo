import { rarityForElo } from "./rarity.js";

export const DUEL_CARD_SKELETON = `
      <div class="card-brand-row">
        <div class="card-brand">◆ PoliMatch</div>
        <div class="rarity-badge"></div>
      </div>
      <div class="art-frame">
        <img alt="" />
        <div class="placeholder" style="display:none"></div>
        <div class="card-foil"></div>
      </div>
      <div class="card-porcelain">
        <div class="card-name"></div>
        <div class="party-chip"></div>
      </div>
      <div class="card-legacy-metrics">
        <div class="vice">Vice: <strong></strong></div>
        <div class="hp-bar"><div class="hp-fill"></div></div>
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

export function fillDuelCard(el, candidate, { elo, wr, barWidth }) {
  if (!hasDuelPhoto(el)) el.innerHTML = DUEL_CARD_SKELETON;

  const rarity = rarityForElo(elo);
  if (el.dataset) el.dataset.rarity = rarity.id;

  el.querySelector(".card-name").textContent = candidate.name;
  el.querySelector(".party-chip").textContent = candidate.party || "Brasil";
  const rarityBadge = el.querySelector(".rarity-badge");
  if (rarityBadge) {
    rarityBadge.textContent = rarity.symbol;
    rarityBadge.title = rarity.label;
  }

  const mateRow = el.querySelector(".vice");
  if (mateRow?.firstChild) mateRow.firstChild.textContent = `${candidate.mateLabel || "Vice"}: `;
  el.querySelector(".vice strong").textContent = candidate.vice;
  el.querySelector(".elo-mini").textContent = `Elo ${elo} · ${wr}% vitórias`;
  el.querySelector(".hp-fill").style.width = `${barWidth}%`;

  const placeholder = el.querySelector(".placeholder");
  placeholder.textContent = candidate.initials;
  placeholder.style.display = candidate.photo ? "none" : "grid";

  const img = el.querySelector(".art-frame img");
  img.removeAttribute("loading");
  img.alt = `Foto de ${candidate.name}`;
  img.style.display = candidate.photo ? "" : "none";
  img.onerror = () => showPhotoError(img, placeholder);
  if (candidate.photo && img.getAttribute("src") !== candidate.photo) {
    img.src = candidate.photo;
  } else if (!candidate.photo) {
    img.removeAttribute("src");
  }
}
