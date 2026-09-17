import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AGGREGATE_PUBLIC_COPY_POLICY } from "../../shared/aggregate-publication-copy.js";
import {
  APP_AGGREGATE_COPY,
  DAILY_DISTRIBUTION_COPY,
  PREDICTION_REVEAL_COPY,
  PUBLIC_RANKING_COPY,
  WITHHELD_COPY,
} from "./aggregate-copy.js";

const source = async (relative) => readFile(new URL(relative, import.meta.url), "utf8");

function leafKeys(value, prefix = []) {
  return Object.entries(value).flatMap(([key, child]) => (
    child && typeof child === "object"
      ? leafKeys(child, [...prefix, key])
      : [[...prefix, key]]
  ));
}

test("every fingerprinted copy leaf has a runtime consumer in its declared scope", async () => {
  assert.equal(WITHHELD_COPY, AGGREGATE_PUBLIC_COPY_POLICY.withheld.copy);
  assert.equal(PUBLIC_RANKING_COPY, AGGREGATE_PUBLIC_COPY_POLICY.scopes["global-ranking"].copy);
  assert.equal(DAILY_DISTRIBUTION_COPY, AGGREGATE_PUBLIC_COPY_POLICY.scopes["daily-distribution"].copy);
  assert.equal(PREDICTION_REVEAL_COPY, AGGREGATE_PUBLIC_COPY_POLICY.scopes["prediction-reveal"].copy);
  assert.deepEqual(Object.keys(APP_AGGREGATE_COPY).sort(), [
    "daily-distribution",
    "global-ranking",
    "prediction-reveal",
    "withheld",
  ]);

  const consumers = {
    withheld: await Promise.all([source("./main.js"), source("../../back/src/http-app.js")]),
    "global-ranking": await Promise.all([source("./main.js"), source("./domain.js"), source("../../back/src/topic-store.js")]),
    "daily-distribution": await Promise.all([
      source("./daily-session.js"),
      source("./daily-prediction.js"),
      source("../../back/src/daily-session.js"),
      source("../../back/src/topic-store.js"),
    ]),
    "prediction-reveal": [await source("./main.js")],
  };
  const copyByScope = {
    withheld: WITHHELD_COPY,
    "global-ranking": PUBLIC_RANKING_COPY,
    "daily-distribution": DAILY_DISTRIBUTION_COPY,
    "prediction-reveal": PREDICTION_REVEAL_COPY,
  };

  for (const [scope, copy] of Object.entries(copyByScope)) {
    const combinedSource = consumers[scope].join("\n");
    for (const path of leafKeys(copy)) {
      const key = path.at(-1);
      assert.match(combinedSource, new RegExp(`\\.${key}\\b`), `${scope}.${path.join(".")} não tem consumidor`);
    }
  }
});

test("aggregate UI modules consume the shared binding instead of cloning copy", async () => {
  for (const modulePath of ["./main.js", "./domain.js", "./daily-session.js", "./daily-prediction.js"]) {
    const contents = await source(modulePath);
    assert.match(contents, /from "\.\/aggregate-copy\.js"/);
    assert.doesNotMatch(contents, /from "\.\.\/\.\.\/shared\/aggregate-publication-copy\.js"/);
  }
});
