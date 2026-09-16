import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

export function loadRepositoryFile(repositoryPath) {
  const absolutePath = path.resolve(REPOSITORY_ROOT, ...String(repositoryPath).split("/"));
  const relativePath = path.relative(REPOSITORY_ROOT, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("caminho fora do repositório");
  }
  return readFileSync(absolutePath);
}
