import { initGame } from "../../front/src/game.js";
import { installTournamentRestartGuard } from "../../front/src/restart-confirm.js";
import { installFrontendEnhancements } from "../../front/src/frontend-enhancements.js";
import { installDuelV2Layout } from "../../front/src/duel-v2-install.js";
import { installInteractionSound } from "../../front/src/interaction-sound.js";
import { installChromaEntry } from "../../front/src/chroma-entry.js";
import { installRankingV2 } from "../../front/src/ranking-v2-install.js";
import { installTournamentV2 } from "../../front/src/tournament-v2-install.js";
import "../../front/src/styles.css";
import "../../front/src/malaquita.css";
import "../../front/src/malaquita-shell.css";
import "../../front/src/duel-v2.css";
import "../../front/src/home-v2.css";
import "../../front/src/nav-v2.css";
import "../../front/src/chroma-entry.css";
import "../../front/src/ranking-v2.css";
import "../../front/src/tournament-v2.css";
import { registerServiceWorker } from "./register-sw.js";

installTournamentRestartGuard();
registerServiceWorker();
initGame().then(() => {
  installDuelV2Layout();
  installRankingV2();
  installTournamentV2();
  installFrontendEnhancements();
  installChromaEntry();
  installInteractionSound();
});
