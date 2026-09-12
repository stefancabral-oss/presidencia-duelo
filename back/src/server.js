import cors from "cors";
import express from "express";
import { CANDIDATES } from "./candidates.js";
import { createPostgresStore } from "./postgres-store.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const store = createPostgresStore();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await store.health();
    res.json({
      ok: true,
      service: "presidencia-duelo-api",
      database: "postgresql",
      candidates: CANDIDATES.length,
    });
  } catch {
    res.status(503).json({ ok: false, error: "banco indisponível" });
  }
});

app.get("/api/candidates", (_req, res) => {
  res.json({
    candidates: CANDIDATES.map(({ id, name, party, vice, photo, initials }) => ({
      id,
      name,
      party,
      vice,
      photo,
      initials,
    })),
  });
});

app.get("/api/ranking", async (req, res) => {
  try {
    res.json(await store.snapshot(String(req.query.mode || "presidentes")));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "erro interno" });
  }
});

app.post("/api/vote", async (req, res) => {
  const { winnerId, loserId, mode } = req.body || {};
  try {
    res.json(
      await store.vote(
        String(winnerId || ""),
        String(loserId || ""),
        String(mode || "presidentes"),
      ),
    );
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "erro interno" });
  }
});

const migration = await store.init();
console.log("PostgreSQL inicializado", migration);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Presidência Duelo API em http://localhost:${PORT}`);
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
