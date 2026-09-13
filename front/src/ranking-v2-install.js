export function installRankingV2() {
  const panel = document.getElementById("panel-rank");
  if (!panel || panel.dataset.rankingV2 === "1") return false;
  panel.dataset.rankingV2 = "1";
  panel.classList.add("pm-ranking-v2");

  panel.querySelector(".topic-picker")?.classList.add("pm-ranking-v2__topics");
  panel.querySelector(".ranking-toolbar")?.classList.add("pm-ranking-v2__hero");
  panel.querySelector(".ranking-actions")?.classList.add("pm-ranking-v2__actions");
  panel.querySelector(".rank-sort-toolbar")?.classList.add("pm-ranking-v2__sort");
  panel.querySelector("#rank-list")?.classList.add("pm-ranking-v2__list");
  panel.querySelector(".achievements-panel")?.classList.add("pm-ranking-v2__achievements");
  panel.querySelector(".player-recovery")?.classList.add("pm-ranking-v2__recovery");
  panel.querySelector("#server-rank-wrap")?.classList.add("pm-ranking-v2__server");
  return true;
}
