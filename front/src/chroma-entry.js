export function installChromaEntry() {
  const nav = document.querySelector(".tabs");
  if (!nav || nav.querySelector("#tab-chromas")) return false;
  nav.classList.add("has-chroma-tab");

  const button = document.createElement("button");
  button.type = "button";
  button.id = "tab-chromas";
  button.className = "tab chroma-tab pm-nav-v2__item";
  button.setAttribute("aria-label", "Abrir Galeria Chroma");
  button.innerHTML = `
    <span class="tab-icon pm-nav-v2__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.8 14.3 9l6.2 2.3-6.2 2.3L12 19.8l-2.3-6.2-6.2-2.3L9.7 9 12 2.8Z"/>
      </svg>
    </span>
    <span>Chromas</span>`;
  button.addEventListener("click", () => { window.location.href = "/chromas.html"; });

  const credits = nav.querySelector("#tab-credits");
  nav.insertBefore(button, credits || null);
  return true;
}
