export function skipUnknownDuel({ locked, pair, nextPair, announce = () => {} }) {
  if (locked || !Array.isArray(pair) || pair.length !== 2 || typeof nextPair !== "function") {
    return false;
  }
  const skipped = [...pair];
  nextPair();
  announce(skipped);
  return true;
}
