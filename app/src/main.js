import { initGame } from "../../front/src/game.js";
import { installTournamentRestartGuard } from "../../front/src/restart-confirm.js";
import "../../front/src/styles.css";
import { registerServiceWorker } from "./register-sw.js";

installTournamentRestartGuard();
registerServiceWorker();
// Temporary compatibility mode: keep aggregate API voting available while
// avoiding a hard dependency on player-sync endpoints during rollout.
initGame();
