import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import EDITORIAL_GOVERNANCE from "../../shared/editorial-governance-policy.json" with { type: "json" };
import EDITORIAL_LEDGER from "../../shared/editorial-publication-ledger.json" with { type: "json" };
import { TOPICS } from "../src/candidates.js";
import { approvalAuthorityFromEnvironment } from "../src/editorial-authority.js";
import { createCandidateRegistry } from "../src/editorial-gate.js";
import { PUBLIC_CANDIDATE_SCHEMA_V2 } from "../src/candidate-public.js";
import { createGitReviewedStateVerifier } from "../src/editorial-history.js";
import { loadRepositoryFile, REPOSITORY_ROOT, statRepositoryFile } from "../src/repository-files.js";

const verifyApprovalAuthority = approvalAuthorityFromEnvironment(process.env);
const versionedDecisionCount = EDITORIAL_LEDGER.decisions.reduce((count, entry) => (
  count + ["content", "cardArt", "documentaryPhoto"].filter((dimension) => Object.hasOwn(entry, dimension)).length
), 0);

const registry = createCandidateRegistry({
  catalog: CATALOG,
  topics: TOPICS,
  ledger: EDITORIAL_LEDGER,
  assetRegistry: EDITORIAL_ASSETS,
  governancePolicy: EDITORIAL_GOVERNANCE,
  loadRepositoryFile,
  statRepositoryFile,
  verifyReviewedState: createGitReviewedStateVerifier({ repositoryRoot: REPOSITORY_ROOT }),
  verifyApprovalAuthority,
  contentRuleset: PUBLIC_CANDIDATE_SCHEMA_V2,
});

if (registry.authority.deniedDecisions > 0) {
  throw new Error(`${registry.authority.deniedDecisions} decisões não possuem recibo válido da autoridade externa injetada`);
}

console.log([
  "Governança editorial verificada:",
  `${versionedDecisionCount} decisões atestadas;`,
  `${registry.authority.verifiedDecisions} decisões autorizadas externamente;`,
  `${registry.candidatesForTopic("eleicoes-2026").length} candidatos publicáveis.`,
].join(" "));
