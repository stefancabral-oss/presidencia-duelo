// Flags separadas para as duas áreas cívicas (A01 · #223; operação em A03 · #225).
//
// Fontes, em ordem: capacidades do servidor (`/api/game-capabilities`, versão 1,
// chaves `civicDirectory` e `civicNews`) e, para desenvolvimento local, as variáveis
// de build `VITE_CIVIC_DIRECTORY` / `VITE_CIVIC_NEWS`. Nenhuma flag lê storage nem
// dados do jogador: desligar uma área só muda navegação e montagem, nunca a sessão.
export const CIVIC_AREAS = Object.freeze(["directory", "news"]);

const SERVER_KEYS = Object.freeze({ directory: "civicDirectory", news: "civicNews" });
const ENV_KEYS = Object.freeze({ directory: "VITE_CIVIC_DIRECTORY", news: "VITE_CIVIC_NEWS" });

function enabledByEnv(env, key) {
  const value = env?.[key];
  return value === "1" || value === "true" || value === true;
}

export function civicFlags(gameFeatures = {}, env = {}) {
  const features = gameFeatures && typeof gameFeatures === "object" ? gameFeatures : {};
  return Object.freeze(Object.fromEntries(CIVIC_AREAS.map((area) => [
    area,
    features[SERVER_KEYS[area]] === true || enabledByEnv(env, ENV_KEYS[area]),
  ])));
}

export function anyCivicArea(flags) {
  return CIVIC_AREAS.some((area) => flags?.[area] === true);
}

export function areaEnabled(flags, area) {
  return flags?.[area] === true;
}
