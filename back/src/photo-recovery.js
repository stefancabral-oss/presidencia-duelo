import { createHash } from "node:crypto";
import { immutableJsonSnapshot } from "./editorial-integrity.js";

export const RECOVERY_NOTICE = "Perfil editorial em revisão. Nesta recuperação, mostramos apenas o nome e a fotografia do acervo existente.";

// Autorização de restauração #202: não é aprovação do perfil editorial.
// A lista fixa nome, ID, arquivo e bytes; não libera todo arquivo encontrado.
export function withPhotoRecovery(registry, manifest, loadRepositoryFile) {
  if (manifest?.schemaVersion !== 1 || manifest.authorizationIssue !== 202
    || !Array.isArray(manifest.photos)) throw new Error("manifesto de recuperação inválido");
  const restored = new Map();
  const seen = new Set();
  for (const photo of manifest.photos) {
    const candidate = registry.candidatesById.get(photo.id);
    const expectedPath = `/portraits/${String(photo.personId).padStart(3, "0")}.jpg`;
    if (!candidate || candidate.personId !== photo.personId || candidate.name !== photo.name
      || photo.image !== expectedPath || !/^[a-f0-9]{64}$/.test(photo.sha256)
      || seen.has(photo.id)) throw new Error("identidade fotográfica de recuperação inválida");
    seen.add(photo.id);
    const bytes = loadRepositoryFile(`app/public${photo.image}`);
    if (createHash("sha256").update(bytes).digest("hex") !== photo.sha256) {
      throw new Error(`fotografia de recuperação alterada: ${photo.id}`);
    }
    if (candidate.publication?.content?.status === "rejected"
      || candidate.publication?.documentaryPhoto?.status === "rejected") continue;
    if (candidate.eligible) continue;
    const publication = {
      content: { status: "pending", reviewedAt: "" },
      cardArt: { status: "missing", image: "", version: "" },
      documentaryPhoto: {
        status: "restored", image: photo.image,
        source: "Acervo fotográfico existente · restauração autorizada na issue #202",
        license: "Condições e pendências individuais nos créditos",
      },
    };
    const unknown = { status: "ambiguous", source: "Retido até revisão editorial individual" };
    restored.set(photo.id, immutableJsonSnapshot({
      ...candidate,
      // Nenhuma alegação, classificação inferida ou selo de revisão é herdado.
      role: "Pessoa pública", party: null, primaryArea: null, contextAffiliation: null,
      taxonomyProvenance: {
        role: { status: "extracted", source: "Catálogo de pessoas públicas do PoliMatch" },
        party: unknown, primaryArea: unknown, contextAffiliation: unknown,
      },
      location: "Brasil", summary: "Nome e fotografia do acervo existente.",
      bio: RECOVERY_NOTICE, relevance2026: RECOVERY_NOTICE,
      facts: [], highlight: RECOVERY_NOTICE, controversy: RECOVERY_NOTICE, sources: [],
      photo: photo.image, cardArt: "", reviewedAt: "", reviewStatus: "pending",
      publication, eligible: true,
    }));
  }
  const candidates = Object.freeze(registry.candidates.map((candidate) => restored.get(candidate.id) || candidate));
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const candidatesById = Object.freeze({ get: (id) => byId.get(id), has: (id) => byId.has(id) });
  return Object.freeze({
    ...registry, candidates, candidatesById,
    recovery: Object.freeze({ issue: 202, restoredPhotos: restored.size, fullEditorialApproval: false }),
    candidatesForTopic(topicId) {
      if (!registry.topicsById.get(topicId)?.active) return Object.freeze([]);
      return Object.freeze(candidates.filter((candidate) => candidate.eligible && candidate.topicIds.includes(topicId)));
    },
    candidateBelongsToTopic(candidateId, topicId) {
      const candidate = byId.get(candidateId);
      return Boolean(registry.topicsById.get(topicId)?.active && candidate?.eligible && candidate.topicIds.includes(topicId));
    },
  });
}
