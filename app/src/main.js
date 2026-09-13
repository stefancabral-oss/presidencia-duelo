import { initGame } from "../../front/src/game.js";
import { installTournamentRestartGuard } from "../../front/src/restart-confirm.js";
import { installFrontendEnhancements } from "../../front/src/frontend-enhancements.js";
import "../../front/src/styles.css";
import "../../front/src/malaquita.css";
import "../../front/src/malaquita-shell.css";
import { registerServiceWorker } from "./register-sw.js";

installTournamentRestartGuard();
registerServiceWorker();
// Temporary compatibility mode: keep aggregate API voting available while
// avoiding a hard dependency on player-sync endpoints during rollout.
initGame().then(() => installFrontendEnhancements());
