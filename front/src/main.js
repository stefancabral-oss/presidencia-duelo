import { initGame } from "./game.js";
import { installTournamentRestartGuard } from "./restart-confirm.js";
import { installFrontendEnhancements } from "./frontend-enhancements.js";
import { installDuelV2Layout } from "./duel-v2-install.js";
import { installTournamentV2 } from "./tournament-v2-install.js";
import "./styles.css";
import "./malaquita.css";
import "./malaquita-shell.css";
import "./duel-v2.css";
import "./tournament-v2.css";

installTournamentRestartGuard();
initGame().then(() => {
  installDuelV2Layout();
  installTournamentV2();
  installFrontendEnhancements();
});
