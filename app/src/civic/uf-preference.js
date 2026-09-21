// Preferência local de recorte (Brasil ou uma UF) para leitura pública (A02 · #224).
//
// Regras: seleção manual, validada contra os 27 códigos do contrato B01 mais "BR";
// persistência mínima em chave própria, separada do namespace do jogo
// (`polimatch:v4:*`); fallback em memória quando o storage falha; reset explícito.
// Nunca solicita geolocalização e nunca é sincronizada com votos, chave de
// recuperação ou identidade Google.
import { UFS } from "../../../shared/civic-contract.js";

export const UF_PREFERENCE_KEY = "polimatch:civic:uf";
export const DEFAULT_JURISDICTION = "BR";
export const JURISDICTIONS = Object.freeze([DEFAULT_JURISDICTION, ...UFS]);

export function isJurisdiction(value) {
  return typeof value === "string" && JURISDICTIONS.includes(value);
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createUfPreference({ storage = defaultStorage(), onChange } = {}) {
  let memory = null;

  function read() {
    try {
      const stored = storage?.getItem(UF_PREFERENCE_KEY);
      if (isJurisdiction(stored)) return stored;
    } catch {
      // Storage bloqueado (modo privado, cota, política): a memória desta sessão vale.
    }
    return memory;
  }

  return {
    /** Escolha registrada ou `null` quando a pessoa nunca escolheu. */
    get() {
      return read();
    },
    /** Recorte efetivo para consultas: a escolha ou Brasil. */
    effective() {
      return read() ?? DEFAULT_JURISDICTION;
    },
    set(jurisdiction) {
      if (!isJurisdiction(jurisdiction)) throw new TypeError(`Recorte inválido: ${String(jurisdiction)}`);
      memory = jurisdiction;
      let persisted = false;
      try {
        storage?.setItem(UF_PREFERENCE_KEY, jurisdiction);
        persisted = storage?.getItem(UF_PREFERENCE_KEY) === jurisdiction;
      } catch {
        persisted = false;
      }
      onChange?.(jurisdiction, { persisted });
      return { jurisdiction, persisted };
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(UF_PREFERENCE_KEY);
      } catch {
        // Sem storage não há nada a apagar além da memória.
      }
      onChange?.(null, { persisted: false });
    },
  };
}
