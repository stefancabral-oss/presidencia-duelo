import cors from "cors";
import express from "express";
import { CANDIDATES, TOPICS, candidatesForTopic } from "./candidates.js";
import { createTopicStore } from "./topic-store.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const store = createTopicStore();

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
      service: "polimatch-api",
      database: "postgresql",
      candidates: CANDIDATES.length,
      playableCandidates: TOPICS
        .filter(({ active }) => active)
        .reduce((total, topic) => total + candidatesForTopic(topic.id).length, 0),
      activeTopics: TOPICS.filter(({ active }) => active).length,
    });
  } catch {
    res.status(503).json({ ok: false, error: "banco indisponível" });
  }
});

app.get("/api/topics", (_req, res) => {
  res.json({ topics: TOPICS });
});

app.get("/api/candidates", (req, res) => {
  const topicId = String(req.query.topic || "eleicoes-2026");
  const candidates = candidatesForTopic(topicId);
  res.json({
    topicId,
    candidates: candidates.map(({ personId, id, name, displayName, affiliation, photo, role, summary, office, party, location, bio, relevance2026, facts, highlight, controversy, sources, reviewedAt, reviewStatus, topicIds }) => ({
      personId,
      id,
      name,
      displayName,
      affiliation,
      photo,
      role,
      summary,
      office,
      party,
      location,
      bio,
      relevance2026,
      facts,
      highlight,
      controversy,
      sources,
      reviewedAt,
      reviewStatus,
      topicIds,
    })),
  });
});

app.get("/api/ranking", async (req, res) => {
  try {
    res.json(await store.ranking(String(req.query.topic || "eleicoes-2026")));
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
    res.json(await store.playerRanking(
      recoveryKeyFrom(req),
      String(req.query.topic || "eleicoes-2026"),
    ));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/vote", async (req, res) => {
  const { voteId, winnerId, loserId, topicId, playerVersion } = req.body || {};
  try {
    res.json(await store.vote({
      voteId,
      winnerId: String(winnerId || ""),
      loserId: String(loserId || ""),
      topicId: String(topicId || "eleicoes-2026"),
      recoveryKey: recoveryKeyFrom(req),
      playerVersion,
    }));
  } catch (err) {
    sendError(res, err);
  }
});

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
