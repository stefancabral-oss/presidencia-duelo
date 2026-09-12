import { initGame } from "../../front/src/game.js";
import "../../front/src/styles.css";
import { registerServiceWorker } from "./register-sw.js";

registerServiceWorker();
initGame({ requireApi: true });
