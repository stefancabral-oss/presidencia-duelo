import test from "node:test";
import assert from "node:assert/strict";
import { orientationMotion, pointerMotion } from "./chroma-motion.js";

test("pointer motion maps the card center to a neutral hologram", () => {
  const motion = pointerMotion({ left: 10, top: 20, width: 200, height: 400 }, 110, 220);
  assert.deepEqual(motion, { x: 0.5, y: 0.5, rotateX: 0, rotateY: 0 });
});

test("pointer motion clamps light and tilt to the card bounds", () => {
  const motion = pointerMotion({ left: 0, top: 0, width: 100, height: 100 }, 180, -40);
  assert.equal(motion.x, 1);
  assert.equal(motion.y, 0);
  assert.equal(motion.rotateX, 4.5);
  assert.equal(motion.rotateY, 5.5);
});

test("device orientation produces controlled movement", () => {
  const motion = orientationMotion(45, 0);
  assert.equal(motion.x, 0.5);
  assert.equal(motion.y, 0.5);
  assert.equal(motion.rotateX, 0);
  assert.equal(motion.rotateY, 0);
});
