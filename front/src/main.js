import { initGame } from "./game.js";
import { installTournamentRestartGuard } from "./restart-confirm.js";
import { installFrontendEnhancements } from "./frontend-enhancements.js";
import { installDuelV2Layout } from "./duel-v2-install.js";
import { installInteractionSound } from "./interaction-sound.js";
import { installChromaEntry } from "./chroma-entry.js";
import { installRankingV2 } from "./ranking-v2-install.js";
import { installTournamentV2 } from "./tournament-v2-install.js";
import "./styles.css";
import "./malaquita.css";
import "./malaquita-shell.css";
import "./duel-v2.css";
import "./home-v2.css";
import "./nav-v2.css";
import "./chroma-entry.css";
import "./ranking-v2.css";
import "./tournament-v2.css";

installTournamentRestartGuard();
initGame().then(() => {
  installDuelV2Layout();
  installRankingV2();
  installTournamentV2();
  installFrontendEnhancements();
  installChromaEntry();
  installInteractionSound();
});
