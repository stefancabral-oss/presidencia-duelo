import { initGame } from "../../front/src/game.js";
import { installTournamentRestartGuard } from "../../front/src/restart-confirm.js";
import { installFrontendEnhancements } from "../../front/src/frontend-enhancements.js";
import { installDuelV2Layout } from "../../front/src/duel-v2-install.js";
import { installRankingV2 } from "../../front/src/ranking-v2-install.js";
import "../../front/src/styles.css";
import "../../front/src/malaquita.css";
import "../../front/src/malaquita-shell.css";
import "../../front/src/duel-v2.css";
import "../../front/src/ranking-v2.css";
import { registerServiceWorker } from "./register-sw.js";

installTournamentRestartGuard();
registerServiceWorker();
initGame().then(() => {
  installDuelV2Layout();
  installRankingV2();
  installFrontendEnhancements();
});
