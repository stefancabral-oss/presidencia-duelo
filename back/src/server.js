import cors from "cors";
import express from "express";
import { CANDIDATES } from "./candidates.js";
import { snapshot, vote } from "./elo-store.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "presidencia-duelo-api",
    candidates: CANDIDATES.length,
  });
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

app.get("/api/ranking", (_req, res) => {
  res.json(snapshot());
});

app.post("/api/vote", (req, res) => {
  const { winnerId, loserId } = req.body || {};
  try {
    res.json(vote(String(winnerId || ""), String(loserId || "")));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "erro interno" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Presidência Duelo API em http://localhost:${PORT}`);
});
