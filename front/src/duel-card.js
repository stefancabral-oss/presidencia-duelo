/**
 * Duel-card photo + text. Built once, then updated in place so the <img>
 * is not recreated (and never uses loading="lazy", which delays visible photos).
 */
export const DUEL_CARD_SKELETON = `
      <div class="card-top">
        <div class="card-name"></div>
        <div class="party-chip"></div>
      </div>
      <div class="art-frame">
        <img alt="" />
        <div class="placeholder" style="display:none"></div>
      </div>
      <div class="card-bottom">
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

export function fillDuelCard(el, candidate, { elo, wr, barWidth }) {
  if (!hasDuelPhoto(el)) {
    el.innerHTML = DUEL_CARD_SKELETON;
  }

  el.querySelector(".card-name").textContent = candidate.name;
  el.querySelector(".party-chip").textContent = candidate.party;
  el.querySelector(".vice strong").textContent = candidate.vice;
  el.querySelector(".elo-mini").textContent = `Elo ${elo} · ${wr}% vitórias`;
  el.querySelector(".hp-fill").style.width = `${barWidth}%`;

  const placeholder = el.querySelector(".placeholder");
  placeholder.textContent = candidate.initials;
  placeholder.style.display = "none";

  const img = el.querySelector(".art-frame img");
  img.removeAttribute("loading");
  img.alt = `Foto de ${candidate.name}`;
  img.style.display = "";
  img.onerror = () => showPhotoError(img, placeholder);
  if (img.getAttribute("src") !== candidate.photo) {
    img.src = candidate.photo;
  }
}
