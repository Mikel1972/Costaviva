// Comparación del secreto de las rutinas (functions/_lib/secreto.js,
// comun supabase.md D13, 2026-10-07).
import { test } from "node:test";
import assert from "node:assert/strict";
import { secretoValido } from "../functions/_lib/secreto.js";

test("acepta solo el secreto exacto", () => {
  assert.equal(secretoValido("abc123", "abc123"), true);
  assert.equal(secretoValido("abc124", "abc123"), false);
  assert.equal(secretoValido("abc12", "abc123"), false);
  assert.equal(secretoValido("abc1234", "abc123"), false);
});

test("sin secreto configurado o sin cabecera, rechaza (fail-closed)", () => {
  assert.equal(secretoValido("", ""), false);
  assert.equal(secretoValido(null, undefined), false);
  assert.equal(secretoValido(null, "abc"), false);
  assert.equal(secretoValido("abc", undefined), false);
});
