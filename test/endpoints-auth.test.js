// test/endpoints-auth.test.js
//
// Comprueba, contra la Supabase real y la producción real (nunca contra un
// mock), que los datos de usuario de Costa Viva no son accesibles sin la
// sesión de su propio dueño. Sin dependencias/framework — Node 18+ trae
// fetch nativo, coherente con el resto del repo (sin build step).
//
// Uso: node test/endpoints-auth.test.js
// (opcional: PRODUCCION_URL=https://otra-url node test/endpoints-auth.test.js)
//
// Lo que SÍ comprueba:
//   - Las 6 tablas de usuario en Supabase no devuelven datos con solo la
//     anon key (sin token de sesión) — RLS bloqueando de verdad, no solo
//     declarado en el .sql.
//   - /sos-alerta en producción rechaza peticiones sin token.
//
// La prueba cruzada (token de usuario A leyendo una fila de usuario B) SÍ
// está incluida, pero es opcional: solo corre si están las variables de
// entorno TEST_USER_A_EMAIL/PASSWORD y TEST_USER_B_EMAIL/PASSWORD (dos
// cuentas reales y confirmadas — el alta tiene "Confirm email" activado en
// este proyecto). Sin ellas, esa comprobación se salta con un aviso en vez
// de fallar — así el workflow diario no se rompe hasta que existan esos
// secrets en GitHub Actions.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";
const PRODUCCION_URL = process.env.PRODUCCION_URL || "https://fishnow-59u.pages.dev";
const { TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD } = process.env;

const TABLAS_USUARIO = [
  "contactos_emergencia",
  "alertas_sos",
  "perfiles",
  "salidas_pesca",
  "capturas",
  "captura_fotos",
];

let fallos = 0;
function ok(descripcion) {
  console.log(`  OK  ${descripcion}`);
}
function fail(descripcion, detalle) {
  fallos++;
  console.error(`FALLO  ${descripcion}${detalle ? " — " + detalle : ""}`);
}

async function comprobarTablaSinToken(tabla) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*&limit=5`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  const cuerpo = await resp.json().catch(() => null);
  const vacio = Array.isArray(cuerpo) && cuerpo.length === 0;
  if (resp.status === 200 && vacio) {
    ok(`${tabla}: sin token devuelve [] (RLS bloqueando)`);
  } else {
    fail(`${tabla}: sin token NO devuelve vacío`, `HTTP ${resp.status}, body=${JSON.stringify(cuerpo).slice(0, 200)}`);
  }
}

async function comprobarSosAlertaSinToken() {
  const resp = await fetch(`${PRODUCCION_URL}/sos-alerta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat: 43.3, lon: -2.6, tipo: "manual" }),
  });
  if (resp.status === 401) {
    ok("/sos-alerta: rechaza sin token de sesión (401)");
  } else {
    const cuerpo = await resp.text().catch(() => "");
    fail("/sos-alerta: NO rechaza sin token", `HTTP ${resp.status}, body=${cuerpo.slice(0, 200)}`);
  }
}

async function comprobarSosAlertaTokenBasura() {
  const resp = await fetch(`${PRODUCCION_URL}/sos-alerta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer esto-no-es-un-token-valido" },
    body: JSON.stringify({ lat: 43.3, lon: -2.6, tipo: "manual" }),
  });
  const cuerpo = await resp.json().catch(() => null);
  const filtroPorDatosDeUsuario = cuerpo && Array.isArray(cuerpo.contactos) && cuerpo.contactos.length > 0;
  if (resp.status >= 400 && !filtroPorDatosDeUsuario) {
    ok("/sos-alerta: token inválido no cuela (no manda datos de ningún contacto)");
  } else {
    fail("/sos-alerta: token inválido no fue rechazado con claridad", `HTTP ${resp.status}, body=${JSON.stringify(cuerpo).slice(0, 200)}`);
  }
}

async function iniciarSesion(email, password) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cuerpo = await resp.json().catch(() => null);
  if (!resp.ok || !cuerpo?.access_token) throw new Error(`login falló para ${email}: HTTP ${resp.status}`);
  return { token: cuerpo.access_token, userId: cuerpo.user.id };
}

async function comprobarAislamientoCruzado() {
  if (!TEST_USER_A_EMAIL || !TEST_USER_A_PASSWORD || !TEST_USER_B_EMAIL || !TEST_USER_B_PASSWORD) {
    console.log("  --  prueba cruzada A-lee-B saltada (faltan TEST_USER_A/B_EMAIL/PASSWORD)");
    return;
  }
  const a = await iniciarSesion(TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD);
  const b = await iniciarSesion(TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD);

  const creada = await fetch(`${SUPABASE_URL}/rest/v1/contactos_emergencia`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${a.token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ user_id: a.userId, nombre: "smoke-test cruzado", email: "smoke-test@example.com" }),
  }).then((r) => r.json());
  const fila = Array.isArray(creada) ? creada[0] : null;
  if (!fila?.id) {
    fail("prueba cruzada A-lee-B: no se pudo crear la fila de prueba de A", JSON.stringify(creada).slice(0, 200));
    return;
  }

  try {
    const vistoPorB = await fetch(`${SUPABASE_URL}/rest/v1/contactos_emergencia?id=eq.${fila.id}&select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${b.token}` },
    }).then((r) => r.json());
    if (Array.isArray(vistoPorB) && vistoPorB.length === 0) {
      ok("prueba cruzada A-lee-B: el token de B no ve la fila de A (RLS aislando de verdad)");
    } else {
      fail("prueba cruzada A-lee-B: ¡el token de B SÍ vio la fila de A!", JSON.stringify(vistoPorB).slice(0, 200));
    }
  } finally {
    await fetch(`${SUPABASE_URL}/rest/v1/contactos_emergencia?id=eq.${fila.id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${a.token}` },
    });
  }
}

async function main() {
  console.log(`Objetivo: ${PRODUCCION_URL}\n`);
  console.log("Tablas de usuario en Supabase (sin token, solo anon apikey):");
  for (const tabla of TABLAS_USUARIO) {
    await comprobarTablaSinToken(tabla);
  }
  console.log("\nEndpoint /sos-alerta:");
  await comprobarSosAlertaSinToken();
  await comprobarSosAlertaTokenBasura();

  console.log("\nAislamiento entre usuarios (RLS, caso más estricto):");
  await comprobarAislamientoCruzado();

  if (fallos > 0) {
    console.error(`\n${fallos} comprobación(es) fallida(s).`);
    process.exit(1);
  }
  console.log("\nTodas las comprobaciones pasaron.");
}

main().catch((e) => {
  console.error("Error inesperado ejecutando el test:", e);
  process.exit(1);
});
