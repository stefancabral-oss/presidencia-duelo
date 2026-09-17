import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function fullyDecode(value, label) {
  let decoded = value;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new Error(`${label}: caminho possui escape percentual inválido`);
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  if (decoded.includes("%")) throw new Error(`${label}: caminho possui codificação percentual ambígua`);
  return decoded;
}

function assertRelativePathSyntax(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}: caminho ausente`);
  const decoded = fullyDecode(value, label).normalize("NFC");
  if (decoded.includes("\0")
    || decoded.includes("\\")
    || decoded.includes(":")
    || decoded.includes("?")
    || decoded.includes("#")
    || /[\p{Cc}\p{Default_Ignorable_Code_Point}]/u.test(decoded)
    || decoded.startsWith("/")
    || decoded.startsWith("//")) {
    throw new Error(`${label}: caminho absoluto, esquema ou metadado de URL não permitido`);
  }
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label}: caminho relativo não canônico`);
  }
  return segments.join("/");
}

function isContained(rootPath, candidatePath) {
  const relation = relative(rootPath, candidatePath);
  return relation !== "" && !relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation);
}

export async function resolveCardArtPilotRepoFile(repoRoot, value, label = "path") {
  const relativePath = assertRelativePathSyntax(value, label);
  const rootPath = await realpath(fileURLToPath(repoRoot));
  const requestedPath = resolve(rootPath, ...relativePath.split("/"));
  if (!isContained(rootPath, requestedPath)) throw new Error(`${label}: caminho escapa do repositório`);

  let physicalPath;
  try {
    physicalPath = await realpath(requestedPath);
  } catch (error) {
    throw new Error(`${label}: arquivo inexistente ou ilegível (${error.message})`);
  }
  if (!isContained(rootPath, physicalPath)) throw new Error(`${label}: destino físico escapa do repositório`);
  if (physicalPath !== requestedPath) throw new Error(`${label}: links simbólicos não são permitidos`);

  return Object.freeze({
    path: physicalPath,
    url: pathToFileURL(physicalPath),
    repoPath: relative(rootPath, physicalPath).split(sep).join("/")
  });
}
