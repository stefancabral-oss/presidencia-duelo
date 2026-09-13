import cors from "cors";
import express from "express";
import { CANDIDATES } from "./candidates.js";
import { createPostgresStore } from "./postgres-store.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const store = createPostgresStore();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

function recoveryKeyFrom(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.get("authorization") || ""));
  return match?.[1] || "";
}

function sendError(res, err) {
  const body = { error: err.message || "erro interno" };
  if (err.code) body.code = err.code;
  if (err.current) body.current = err.current;
  res.status(err.status || 500).json(body);
}

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
    candidates: CANDIDATES.map(({ personId, id, name, party, vice, photo, initials, corrida2026, topics, politicalSide }) => ({
      personId,
      id,
      name,
      party,
      vice,
      photo,
      initials,
      corrida2026: corrida2026 === true,
      topics,
      politicalSide,
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

app.post("/api/player", async (_req, res) => {
  try {
    res.status(201).json(await store.createPlayer());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/player/state", async (req, res) => {
  try {
    res.json(await store.playerState(
      recoveryKeyFrom(req),
      String(req.query.mode || "presidentes"),
    ));
  } catch (err) {
    sendError(res, err);
  }
});

app.put("/api/player/state", async (req, res) => {
  const { mode, version, state } = req.body || {};
  try {
    res.json(await store.replacePlayerState(
      recoveryKeyFrom(req),
      String(mode || "presidentes"),
      version,
      state,
    ));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/vote", async (req, res) => {
  const { voteId, winnerId, loserId, mode, playerVersion } = req.body || {};
  try {
    res.json(
      await store.vote(
        String(winnerId || ""),
        String(loserId || ""),
        String(mode || "presidentes"),
        voteId,
        { recoveryKey: recoveryKeyFrom(req), version: playerVersion },
      ),
    );
  } catch (err) {
    sendError(res, err);
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
