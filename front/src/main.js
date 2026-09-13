import { initGame } from "./game.js";
import { installTournamentRestartGuard } from "./restart-confirm.js";
import { installFrontendEnhancements } from "./frontend-enhancements.js";
import "./styles.css";
import "./malaquita.css";
import "./malaquita-shell.css";
import "./design-system.css";

installTournamentRestartGuard();
initGame().then(() => installFrontendEnhancements());
