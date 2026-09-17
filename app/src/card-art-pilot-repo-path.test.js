import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolveCardArtPilotRepoFile } from "./card-art-pilot-repo-path.js";

test("repository paths decode before validation and reject schemes, metadata and traversal", async () => {
  const repoRoot = new URL("../../", import.meta.url);
  const valid = await resolveCardArtPilotRepoFile(
    repoRoot,
    "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
    "fixture.path"
  );
  assert.match(valid.repoPath, /card-art-pilot-176\/manifest\.json$/);
  assert.equal(valid.url.protocol, "file:");

  for (const candidate of [
    "../package.json",
    "%2e%2e/package.json",
    "%252e%252e/package.json",
    "https://example.test/file.json",
    "https%3A%2F%2Fexample.test%2Ffile.json",
    "C:/Windows/win.ini",
    "C%3A%2FWindows%2Fwin.ini",
    "safe.json?outside=1",
    "safe.json%3Foutside=1",
    "safe.json#fragment",
    "safe.json%23fragment",
    "safe\u200B.json",
    "safe\n.json",
    "folder\\file.json",
    "folder//file.json"
  ]) {
    await assert.rejects(
      resolveCardArtPilotRepoFile(repoRoot, candidate, "fixture.path"),
      /fixture\.path/
    );
  }
});

test("repository paths resolve physically and reject symlink escapes", async (context) => {
  const temporaryParent = await mkdtemp(join(tmpdir(), "pilot-repo-path-"));
  const repository = join(temporaryParent, "repository");
  const outside = join(temporaryParent, "outside");
  await Promise.all([mkdir(repository), mkdir(outside)]);
  await writeFile(join(repository, "inside.json"), "{}", "utf8");
  await writeFile(join(outside, "secret.json"), "{}", "utf8");
  try {
    const rootUrl = pathToFileURL(`${repository}/`);
    assert.equal((await resolveCardArtPilotRepoFile(rootUrl, "inside.json")).repoPath, "inside.json");
    try {
      await symlink(outside, join(repository, "escape"), "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
        context.skip(`symlink/junction indisponível: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(
      resolveCardArtPilotRepoFile(rootUrl, "escape/secret.json", "fixture.path"),
      /destino físico escapa do repositório|links simbólicos não são permitidos/
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});
