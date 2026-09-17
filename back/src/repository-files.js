import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function createRepositoryFileAccess(repositoryRoot) {
  const lexicalRoot = path.resolve(repositoryRoot);
  const physicalRoot = realpathSync.native(lexicalRoot);

  function repositoryAbsolutePath(repositoryPath) {
    const absolutePath = path.resolve(lexicalRoot, ...String(repositoryPath).split("/"));
    if (!isContained(lexicalRoot, absolutePath)) throw new Error("caminho fora do repositório");
    return absolutePath;
  }

  function assertPhysicalContainmentWithoutSymlinks(absolutePath) {
    const relative = path.relative(lexicalRoot, absolutePath);
    let cursor = lexicalRoot;
    for (const segment of relative.split(path.sep)) {
      cursor = path.join(cursor, segment);
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error(`caminho usa symlink no repositório: ${relative}`);
      }
    }
    const physicalPath = realpathSync.native(absolutePath);
    if (!isContained(physicalRoot, physicalPath)) throw new Error("caminho físico fora do repositório");
  }

  return Object.freeze({
    loadRepositoryFile(repositoryPath) {
      const absolutePath = repositoryAbsolutePath(repositoryPath);
      assertPhysicalContainmentWithoutSymlinks(absolutePath);
      return readFileSync(absolutePath);
    },
    statRepositoryFile(repositoryPath) {
      const absolutePath = repositoryAbsolutePath(repositoryPath);
      assertPhysicalContainmentWithoutSymlinks(absolutePath);
      const metadata = lstatSync(absolutePath);
      return Object.freeze({
        isFile: metadata.isFile(),
        isSymbolicLink: metadata.isSymbolicLink(),
        mode: metadata.mode & 0o777,
      });
    },
  });
}

const repositoryFiles = createRepositoryFileAccess(REPOSITORY_ROOT);
export const { loadRepositoryFile, statRepositoryFile } = repositoryFiles;
