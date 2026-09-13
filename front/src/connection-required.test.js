import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connectionRequiredHtml, renderConnectionRequired } from "./connection-required.js";

const gameSrc = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("connectionRequiredHtml exposes an alert and retry action", () => {
  const html = connectionRequiredHtml();
  assert.match(html, /role="alert"/);
  assert.match(html, /Não foi possível sincronizar/);
  assert.match(html, /id="retry-connection"/);
  assert.match(html, /Wi-Fi e dados móveis são compatíveis/);
  assert.match(html, />PM</);
  assert.match(html, />PoliMatch</);
});

test("renderConnectionRequired replaces the shell and wires retry", () => {
  const root = { innerHTML: "shell incompleto" };
  let clickHandler;
  let reloads = 0;
  const documentObject = {
    getElementById(id) {
      assert.equal(id, "retry-connection");
      return {
        addEventListener(event, handler) {
          assert.equal(event, "click");
          clickHandler = handler;
        },
      };
    },
  };

  renderConnectionRequired(root, {
    documentObject,
    reload: () => { reloads += 1; },
  });

  assert.match(root.innerHTML, /Não foi possível sincronizar/);
  assert.equal(typeof clickHandler, "function");
  clickHandler();
  assert.equal(reloads, 1);
});

test("the online initialization path imports the recoverable renderer", () => {
  assert.match(gameSrc, /import \{ renderConnectionRequired \} from "\.\/connection-required\.js"/);
  assert.match(gameSrc, /if \(requireApi\) \{\s*renderConnectionRequired\(root\);\s*return false;/);
  assert.doesNotMatch(gameSrc, /function renderConnectionRequired/);
  assert.match(gameSrc, /if \(requireApi && !playerReady\) \{[\s\S]*renderConnectionRequired\(root\);[\s\S]*return false;/);
  assert.doesNotMatch(gameSrc, /renderPlayerRecovery\([^)]*\);\s*setTab\("rank"\)/);
});
