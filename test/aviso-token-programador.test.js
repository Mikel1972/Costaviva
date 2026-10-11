// Aviso de caducidad de PROGRAMADOR_GITHUB_TOKEN (2026-10-11): sustituye al
// recordatorio que vivía en la cuenta vieja de Claude. Sin IA, cada lunes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wf = readFileSync(".github/workflows/aviso-token-programador.yml", "utf8");

test("aviso del token: semanal, lee la caducidad real y abre una sola incidencia", () => {
  assert.match(wf, /- cron: "17 7 \* \* 1"/);
  assert.match(wf, /issues: write/);
  assert.match(wf, /github-authentication-token-expiration/);
  assert.match(wf, /-gt 21/);
  assert.match(wf, /gh issue list[^\n]*--state open/);
  assert.match(wf, /gh issue create/);
  assert.doesNotMatch(wf, /echo "\$TOKEN"|echo \$TOKEN/, "nunca imprime el token");
});
