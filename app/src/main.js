import { initGame } from "../../front/src/game.js";
import { installTournamentRestartGuard } from "../../front/src/restart-confirm.js";
import { installFrontendEnhancements } from "../../front/src/frontend-enhancements.js";
import "../../front/src/styles.css";
import "../../front/src/malaquita.css";
import "../../front/src/malaquita-shell.css";
import "../../front/src/design-system.css";
import "../../front/src/design-system-states.css";
import "../../front/src/design-system-bridge.css";
import { registerServiceWorker } from "./register-sw.js";

installTournamentRestartGuard();
registerServiceWorker();
initGame().then(() => installFrontendEnhancements());
