import { createHash } from "node:crypto";

const INVISIBLE_OR_CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u;
const SAFE_REPOSITORY_PATH_PATTERN = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function editorialInvalid(message) {
  throw new TypeError(`registro editorial inválido: ${message}`);
}

export function visibleText(value, { allowEmpty = false, max = 10_000 } = {}) {
  return typeof value === "string"
    && value.length <= max
    && (allowEmpty || value.trim().length > 0)
    && !INVISIBLE_OR_CONTROL_PATTERN.test(value);
}

export function assertPlainRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) editorialInvalid(`${label} deve ser um objeto`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) editorialInvalid(`${label} deve ser um objeto JSON`);
}

export function assertExactKeys(value, expectedKeys, label) {
  assertPlainRecord(value, label);
  const expected = [...expectedKeys].sort();
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const unexpected = actual.filter((key) => !expected.includes(key));
    const missing = expected.filter((key) => !actual.includes(key));
    const details = [
      unexpected.length ? `inesperados: ${unexpected.join(", ")}` : "",
      missing.length ? `ausentes: ${missing.join(", ")}` : "",
    ].filter(Boolean).join("; ");
    editorialInvalid(`${label} tem campos inválidos${details ? ` (${details})` : ""}`);
  }
}

export function immutableJsonSnapshot(value, seen = new WeakSet()) {
  const valueType = typeof value;
  if (value === null || valueType === "string" || valueType === "boolean") return value;
  if (valueType === "number") {
    if (!Number.isFinite(value)) editorialInvalid("dados editoriais devem conter somente números finitos");
    return value;
  }
  if (valueType !== "object") editorialInvalid("dados editoriais devem conter somente valores JSON definidos");
  if (seen.has(value)) editorialInvalid("dados editoriais não podem conter referências cíclicas");
  seen.add(value);
  let snapshot;
  if (Array.isArray(value)) {
    snapshot = value.map((item) => immutableJsonSnapshot(item, seen));
  } else {
    assertPlainRecord(value, "dados editoriais");
    snapshot = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableJsonSnapshot(item, seen)]),
    );
  }
  seen.delete(value);
  return Object.freeze(snapshot);
}

export function sha256Fingerprint(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function normalizedTextBlob(value, label = "arquivo editorial") {
  const text = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? Buffer.from(value).toString("utf8")
    : String(value);
  if (text.includes("\u0000") || text.includes("\ufffd")) editorialInvalid(`${label} deve ser UTF-8 textual`);
  return text.replace(/\r\n?/g, "\n");
}

export function textBlobFingerprint(value, label) {
  return sha256Fingerprint(normalizedTextBlob(value, label));
}

export function safeRepositoryPath(value, { prefix = "", extensions = [] } = {}) {
  if (!visibleText(value, { max: 1_000 }) || !SAFE_REPOSITORY_PATH_PATTERN.test(value)) return false;
  if (prefix && !value.startsWith(prefix)) return false;
  return extensions.length === 0 || extensions.some((extension) => value.endsWith(extension));
}
