import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connectionRequiredHtml, renderConnectionRequired } from "./connection-required.js";

const gameSrc = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("connectionRequiredHtml exposes an alert and retry action", () => {
  const html = connectionRequiredHtml();
  assert.match(html, /role="alert"/);
  assert.match(html, /Conexão necessária/);
  assert.match(html, /id="retry-connection"/);
  assert.match(html, /somente online/);
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

  assert.match(root.innerHTML, /Conexão necessária/);
  assert.equal(typeof clickHandler, "function");
  clickHandler();
  assert.equal(reloads, 1);
});

test("the online initialization path imports the recoverable renderer", () => {
  assert.match(gameSrc, /import \{ renderConnectionRequired \} from "\.\/connection-required\.js"/);
  assert.match(gameSrc, /if \(requireApi\) \{\s*renderConnectionRequired\(root\);\s*return false;/);
  assert.doesNotMatch(gameSrc, /function renderConnectionRequired/);
});
