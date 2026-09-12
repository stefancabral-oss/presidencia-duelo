import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const frontPublic = join(appRoot, "../front/public");

mkdirSync(join(appRoot, "public"), { recursive: true });
cpSync(join(frontPublic, "candidates"), join(appRoot, "public/candidates"), { recursive: true });
cpSync(join(frontPublic, "CREDITS.md"), join(appRoot, "public/CREDITS.md"));
cpSync(join(frontPublic, "icons"), join(appRoot, "public/icons"), { recursive: true });

console.log("app/public sincronizado a partir de front/public");
