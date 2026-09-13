import assert from "node:assert/strict";
import { test } from "node:test";
import { TOPICS } from "../../shared/topics.js";
import { topicSelectorHtml } from "./topic-selector.js";

test("shared selector renders every topic as a native synchronized button", () => {
  const html = topicSelectorHtml("Assunto do ranking");
  assert.match(html, /data-topic-selector/);
  assert.match(html, /aria-label="Assunto do ranking"/);
  assert.equal((html.match(/data-topic=/g) || []).length, TOPICS.length);
  assert.equal((html.match(/<button/g) || []).length, TOPICS.length);
  assert.match(html, /data-topic-count/);
  assert.match(html, /data-topic-description/);
});
