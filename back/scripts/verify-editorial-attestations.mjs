import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import EDITORIAL_GOVERNANCE from "../../shared/editorial-governance-policy.json" with { type: "json" };
import EDITORIAL_LEDGER from "../../shared/editorial-publication-ledger.json" with { type: "json" };
import { TOPICS } from "../src/candidates.js";
import { createCandidateRegistry } from "../src/editorial-gate.js";
import { createGitReviewedStateVerifier } from "../src/editorial-history.js";
import { loadRepositoryFile, REPOSITORY_ROOT } from "../src/repository-files.js";

const registry = createCandidateRegistry({
  catalog: CATALOG,
  topics: TOPICS,
  ledger: EDITORIAL_LEDGER,
  assetRegistry: EDITORIAL_ASSETS,
  governancePolicy: EDITORIAL_GOVERNANCE,
  loadRepositoryFile,
  verifyReviewedState: createGitReviewedStateVerifier({ repositoryRoot: REPOSITORY_ROOT }),
});

console.log([
  "Governança editorial verificada:",
  `${EDITORIAL_LEDGER.decisions.length} decisões atestadas;`,
  `${registry.candidatesForTopic("eleicoes-2026").length} candidatos publicáveis.`,
].join(" "));
