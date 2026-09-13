export function createVoteId(cryptoObject = globalThis.crypto) {
  if (typeof cryptoObject?.randomUUID !== "function") {
    throw new Error("navegador sem suporte a identificador seguro de voto");
  }
  return cryptoObject.randomUUID();
}
