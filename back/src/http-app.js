import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import cors from "cors";
import express from "express";
import { CANDIDATES, TOPICS, candidatesForTopic, publicCandidate } from "./candidates.js";

const PRODUCTION_ORIGINS = ["https://polimatch.com.br"];
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/;

export function configuredAppOrigins(value) {
  return new Set(String(value || PRODUCTION_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
}

export function isAllowedBrowserOrigin(origin, origins, { production = false } = {}) {
  if (!origin) return true;
  return origins.has(origin) || (!production && LOCAL_ORIGIN_PATTERN.test(origin));
}

function embeddedIpv4Hextets(value) {
  const bytes = value.split(".").map(Number);
  if (bytes.length !== 4 || bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return [];
  return [((bytes[0] << 8) | bytes[1]).toString(16), ((bytes[2] << 8) | bytes[3]).toString(16)];
}

export function normalizedNetworkIdentity(address) {
  let value = String(address || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (value.startsWith("::ffff:") && isIP(value.slice(7)) === 4) value = value.slice(7);
  if (isIP(value) === 4) return `ipv4:${value}`;
  if (isIP(value) !== 6) return "unknown";

  const halves = value.split("::");
  const parseHalf = (half) => (half ? half.split(":").flatMap((part) => part.includes(".") ? embeddedIpv4Hextets(part) : [part]) : []);
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1]);
  const missing = Math.max(0, 8 - left.length - right.length);
  const expanded = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (expanded.length !== 8) return "unknown";
  const prefix = expanded.slice(0, 4).map((part) => part.padStart(4, "0")).join(":");
  return `ipv6:${prefix}::/64`;
}

export function networkPseudonym(address, secret) {
  if (!secret) throw new Error("VOTER_NETWORK_SECRET é obrigatório");
  return createHmac("sha256", secret).update(normalizedNetworkIdentity(address)).digest("hex");
}

function recoveryKeyFrom(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.get("authorization") || ""));
  return match?.[1] || "";
}

function requiredRecoveryKey(req) {
  const key = recoveryKeyFrom(req);
  if (key) return key;
  const error = new Error("sessão de jogador obrigatória");
  error.status = 401;
  error.code = "PLAYER_SESSION_REQUIRED";
  throw error;
}

function safeStatus(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
}

export function createHttpApp({
  store,
  googleIdentity,
  env = process.env,
  logger = console,
  clock = () => new Date(),
  candidateCatalog = candidatesForTopic,
} = {}) {
  if (!store) throw new Error("store é obrigatório");
  if (!googleIdentity) throw new Error("googleIdentity é obrigatório");

  const production = env.NODE_ENV === "production";
  const voterNetworkSecret = String(env.VOTER_NETWORK_SECRET || (production ? "" : "polimatch-local-development-secret"));
  if (production && voterNetworkSecret.length < 32) {
    throw new Error("VOTER_NETWORK_SECRET de produção deve ter ao menos 32 caracteres");
  }
  const allowedOrigins = configuredAppOrigins(env.APP_ORIGINS);
  const proxyHopsValue = env.TRUST_PROXY_HOPS ?? (production ? undefined : "0");
  const configuredProxyHops = Number(proxyHopsValue);
  if (proxyHopsValue === undefined || !/^\d+$/.test(String(proxyHopsValue)) || !Number.isSafeInteger(configuredProxyHops)) {
    throw new Error("TRUST_PROXY_HOPS deve ser configurado explicitamente como inteiro não negativo");
  }

  const app = express();
  app.set("trust proxy", configuredProxyHops);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
  });
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (isAllowedBrowserOrigin(origin, allowedOrigins, { production })) return next();
    return res.status(403).json({
      error: "origem não autorizada",
      code: "CORS_ORIGIN_DENIED",
      requestId: req.requestId,
    });
  });
  app.use(cors({
    origin(origin, callback) {
      callback(null, isAllowedBrowserOrigin(origin, allowedOrigins, { production }));
    },
  }));
  app.use(express.json({ limit: "32kb" }));

  function sendError(req, res, error) {
    const status = safeStatus(error);
    if (status >= 500) {
      logger.error?.({
        event: "request_failed",
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        error: error?.stack || error?.message || String(error),
      });
      return res.status(status).json({ error: "erro interno", code: "INTERNAL_ERROR", requestId: req.requestId });
    }

    const body = { error: error?.message || "requisição inválida", requestId: req.requestId };
    if (error?.code) body.code = error.code;
    if (Object.hasOwn(error || {}, "current")) body.current = error.current;
    if (Number.isFinite(error?.retryAfterSeconds)) {
      body.retryAfterSeconds = error.retryAfterSeconds;
      res.set("Retry-After", String(error.retryAfterSeconds));
    }
    return res.status(status).json(body);
  }

  app.get("/api/health", async (req, res) => {
    try {
      await store.health();
      res.json({
        ok: true,
        service: "polimatch-api",
        database: "postgresql",
        candidates: CANDIDATES.length,
        playableCandidates: TOPICS.filter(({ active }) => active).reduce((total, topic) => total + candidateCatalog(topic.id).length, 0),
        activeTopics: TOPICS.filter(({ active }) => active).length,
        googleLogin: googleIdentity.configured,
      });
    } catch (error) {
      error.status = 503;
      sendError(req, res, error);
    }
  });

  app.get("/api/topics", (_req, res) => res.json({ topics: TOPICS }));

  app.get("/api/candidates", (req, res) => {
    const topicId = String(req.query.topic || "eleicoes-2026");
    const candidates = candidateCatalog(topicId);
    res.json({
      topicId,
      candidates: candidates.map(publicCandidate),
    });
  });

  app.get("/api/ranking", async (req, res) => {
    try {
      res.json(await store.ranking(String(req.query.topic || "eleicoes-2026")));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.post("/api/player", async (req, res) => {
    try {
      const networkHash = networkPseudonym(req.ip || req.socket?.remoteAddress, voterNetworkSecret);
      res.status(201).json(await store.createPlayer({ networkHash }));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.get("/api/player/state", async (req, res) => {
    try {
      res.json(await store.playerRanking(requiredRecoveryKey(req), String(req.query.topic || "eleicoes-2026")));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.get("/api/daily-session", async (req, res) => {
    try {
      res.json(await store.dailySession(
        requiredRecoveryKey(req),
        String(req.query.topic || "eleicoes-2026"),
        { now: clock() },
      ));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.get("/api/daily-cut", async (req, res) => {
    try {
      res.json(await store.dailyCut(
        String(req.query.topic || "eleicoes-2026"),
        String(req.query.date || ""),
        { now: clock() },
      ));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const identity = await googleIdentity.verify(req.body?.credential);
      res.json(await store.signInWithGoogle({
        identity,
        currentToken: recoveryKeyFrom(req),
        topicId: String(req.body?.topicId || "eleicoes-2026"),
      }));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await store.signOut(requiredRecoveryKey(req));
      res.status(204).end();
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.post("/api/vote", (_req, res) => {
    res.status(410).json({
      error: "duelos binários foram substituídos por rodadas de quatro; atualize o aplicativo",
      code: "ROUND_V4_REQUIRED",
    });
  });

  app.post("/api/round-vote", async (req, res) => {
    const { roundId, winnerId, candidateIds, topicId, playerVersion } = req.body || {};
    try {
      res.json(await store.roundVote({
        roundId,
        winnerId: String(winnerId || ""),
        candidateIds,
        topicId: String(topicId || "eleicoes-2026"),
        recoveryKey: requiredRecoveryKey(req),
        playerVersion,
      }));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.post("/api/daily-vote", async (req, res) => {
    // A ordem e as quatro cartas nunca vêm do cliente. `editionId + slot`
    // apontam para o baralho materializado; o store relê esse registro sob
    // trava antes de aplicar Elo e progresso na mesma transação.
    const { answerId, editionId, slot, winnerId, topicId, playerVersion } = req.body || {};
    try {
      res.json(await store.dailyVote({
        answerId,
        editionId: String(editionId || ""),
        slot,
        winnerId: String(winnerId || ""),
        topicId: String(topicId || "eleicoes-2026"),
        recoveryKey: requiredRecoveryKey(req),
        playerVersion,
        now: clock(),
      }));
    } catch (error) {
      sendError(req, res, error);
    }
  });

  app.use((error, req, res, _next) => sendError(req, res, error));
  return app;
}
