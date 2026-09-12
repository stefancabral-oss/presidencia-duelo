const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export async function fetchCandidates() {
  const res = await fetch(apiUrl("/api/candidates"));
  if (!res.ok) throw new Error(`candidates ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.candidates) ? data.candidates : data;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("lista vazia");
  }
  return list;
}

export async function fetchHealth() {
  const res = await fetch(apiUrl("/api/health"));
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

export async function fetchServerRanking() {
  const res = await fetch(apiUrl("/api/ranking"));
  if (!res.ok) throw new Error(`ranking ${res.status}`);
  return res.json();
}

export async function postVote(winnerId, loserId) {
  const res = await fetch(apiUrl("/api/vote"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winnerId, loserId }),
  });
  if (!res.ok) throw new Error(`vote ${res.status}`);
  return res.json();
}
