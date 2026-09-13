export function installTournamentV2() {
  const panel = document.getElementById("panel-tournament");
  if (!panel || panel.dataset.tournamentV2 === "1") return false;
  panel.dataset.tournamentV2 = "1";
  panel.classList.add("pm-tournament-v2");

  panel.querySelector(".topic-picker")?.classList.add("pm-tournament-v2__topics");
  panel.querySelector(".tournament-toolbar")?.classList.add("pm-tournament-v2__toolbar");
  panel.querySelector(".tournament-stage")?.classList.add("pm-tournament-v2__stage");
  panel.querySelector(".tournament-round")?.classList.add("pm-tournament-v2__round");
  panel.querySelector("#tournament-duel")?.classList.add("pm-tournament-v2__duel");
  panel.querySelector(".tournament-winner")?.classList.add("pm-tournament-v2__winner");
  panel.querySelector(".tournament-bracket-details")?.classList.add("pm-tournament-v2__bracket");
  for (const card of panel.querySelectorAll(".poke-card")) card.classList.add("pm-tournament-v2__card");
  for (const info of panel.querySelectorAll(".card-info")) info.classList.add("pm-tournament-v2__info");
  return true;
}
