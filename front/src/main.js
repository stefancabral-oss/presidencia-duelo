import { initGame } from "./game.js";
import { installTournamentRestartGuard } from "./restart-confirm.js";
import "./styles.css";

installTournamentRestartGuard();
initGame();
