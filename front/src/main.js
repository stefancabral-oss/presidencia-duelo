import { initGame } from "./game.js";
import { installTournamentRestartGuard } from "./restart-confirm.js";
import { installFrontendEnhancements } from "./frontend-enhancements.js";
import { installDuelV2Layout } from "./duel-v2-install.js";
import { installInteractionSound } from "./interaction-sound.js";
import "./styles.css";
import "./malaquita.css";
import "./malaquita-shell.css";
import "./duel-v2.css";
import "./interaction-sound.css";

installTournamentRestartGuard();
initGame().then(() => {
  installDuelV2Layout();
  installFrontendEnhancements();
  installInteractionSound();
});
