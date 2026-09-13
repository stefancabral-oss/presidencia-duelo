export function installChromaEntry() {
  const nav = document.querySelector(".tabs");
  if (!nav || nav.querySelector("#tab-chromas")) return false;
  nav.classList.add("has-chroma-tab");
  const button = document.createElement("button");
  button.type = "button";
  button.id = "tab-chromas";
  button.className = "tab chroma-tab";
  button.setAttribute("aria-label", "Abrir Galeria Chroma");
  button.innerHTML = '<span class="tab-icon" aria-hidden="true">✦</span><span>Chromas</span>';
  button.addEventListener("click", () => { window.location.href = "/chromas.html"; });
  const credits = nav.querySelector("#tab-credits");
  nav.insertBefore(button, credits || null);
  return true;
}
