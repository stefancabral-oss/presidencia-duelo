import { createGoogleIdentityVerifier } from "./google-auth.js";
import { createHttpApp } from "./http-app.js";
import { createTopicStore } from "./topic-store.js";

const PORT = Number(process.env.PORT) || 3001;
const store = createTopicStore();
const googleIdentity = createGoogleIdentityVerifier();
const app = createHttpApp({ store, googleIdentity });

const migration = await store.init();
console.log("PostgreSQL Eleições 2026 inicializado", migration);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`PoliMatch API em http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} recebido; encerrando API`);
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
