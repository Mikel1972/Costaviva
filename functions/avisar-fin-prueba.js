// functions/avisar-fin-prueba.js
// Emails de la prueba gratis de 7 días. Empezó el 2026-09-25 como un aviso
// DESPUÉS de vencer; el 2026-09-28 el usuario lo cambió: "a ese vencimiento,
// o se da de alta o se le cancela". Ver la migración 20260928120000 para el
// calendario y las excepciones. Contado desde el alta:
//
//   alta    bienvenida, con la fecha en que acaba la prueba
//   día 5   recordatorio: la prueba acaba el día 7
//   día 7   sin suscripción → cuenta desactivada, con su email
//
// "Desactivada" NO bloquea el login ni borra nada (decisión del usuario): el
// acceso a la app ya lo corta el paywall, y así puede volver, suscribirse y
// recuperarlo todo. Sus datos se conservan y sus capturas siguen en las
// estadísticas anónimas si dio el consentimiento en el alta.
//
// Mismo patrón que notificar-altas.js: protegido con el secreto compartido
// X-Cron-Secret, llamado por .github/workflows/notificar-altas.yml, y
// reutiliza RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY y ADMIN_EMAIL.
//
// ESTO ESCRIBE A USUARIOS REALES. Por eso:
//   - A quién le toca cada email lo decide Postgres, no este código
//     (usuarios_bienvenida_pendiente_email, usuarios_fin_prueba_pendiente_*).
//     Aquí no se recalcula nada.
//   - Cada paso se marca SOLO tras confirmar Resend el envío. El recordatorio
//     es además el que fija la fecha de desactivación que se le promete: sin
//     recordatorio enviado no hay desactivación. Un fallo de correo retrasa
//     el calendario de esa persona, nunca lo acorta.
//   - Guarda de volumen: si en una pasada salen más de LIMITE_POR_PASADA
//     recordatorios o desactivaciones, ese paso NO se ejecuta y se avisa al
//     admin. Con el volumen real de altas, eso es un bug o una decisión que
//     debe tomar una persona, no el cron.
//
// El tono del email importa: alguien que probó la app y no siguió no ha
// hecho nada malo. Fechas claras, el enlace para suscribirse, y se acabó.
// Nada de urgencia fabricada.

import { secretoValido } from "./_lib/secreto.js";
import { enviarEmail } from "./_lib/email.js";
import { emailFinInvitacion } from "./_lib/invitaciones.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const LIMITE_POR_PASADA = 10;

// Hora de Madrid a propósito (ZONA_NEGOCIO): fechas de la suscripción en los emails.
function fecha(valor) {
  return new Date(valor).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid", // a propósito (ZONA_NEGOCIO)
  });
}

const PIE = [``, `— Costaviva`, `https://costaviva.org`];
const PLANES = `Planes:  https://costaviva.org/suscripcion  (3,99 €/mes o 39,99 €/año, se cancela cuando quieras)`;

function emailBienvenida(pruebaTerminaEn) {
  return {
    asunto: "Bienvenido a Costaviva: tu prueba gratis de 7 días",
    cuerpo: [
      `Hola,`,
      ``,
      `Gracias por darte de alta en Costaviva. Tienes 7 días de prueba gratis, sin tarjeta, hasta el ${fecha(pruebaTerminaEn)}.`,
      ``,
      `En estos días puedes consultar las condiciones del mar en tus zonas, ver las webcams y llevar tu cuaderno de pesca con tus salidas y capturas.`,
      ``,
      `Para que no haya sorpresas:`,
      ``,
      `  - Si te suscribes antes del ${fecha(pruebaTerminaEn)}, sigues usando la app sin cortes.`,
      `  - Si no, ese día tu cuenta quedará desactivada. Tus datos se guardan: si te suscribes más adelante, lo recuperas todo.`,
      ``,
      `Te mandaremos un recordatorio dos días antes de que acabe la prueba.`,
      ``,
      PLANES,
      ``,
      `¡Buena pesca!`,
      ...PIE,
    ].join("\n"),
  };
}

function emailRecordatorio(desactivarEn) {
  return {
    asunto: `Tu prueba de Costaviva termina el ${fecha(desactivarEn)}`,
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Costaviva está a punto de terminar.`,
      ``,
      `El ${fecha(desactivarEn)}, si no te has suscrito, tu cuenta quedará desactivada y ya no podrás consultar las condiciones del mar ni tu cuaderno de pesca. Tus datos se guardan.`,
      ``,
      `Si quieres seguir sin cortes, basta con suscribirte antes:`,
      ``,
      PLANES,
      ``,
      `Si no, no hace falta que hagas nada.`,
      ...PIE,
    ].join("\n"),
  };
}

function emailDesactivada() {
  return {
    asunto: "Tu prueba de Costaviva ha terminado",
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Costaviva ha terminado sin suscripción, así que tu cuenta ha quedado desactivada.`,
      ``,
      `Tus salidas, capturas, fotos y ubicaciones siguen guardadas. Si en algún momento te suscribes, entras con tu email de siempre y lo tienes todo como lo dejaste.`,
      ``,
      PLANES,
      ``,
      `Y si no es para ti, no pasa nada — gracias por haberla probado.`,
      ...PIE,
    ].join("\n"),
  };
}

// Cuentas de public.accesos_permanentes (2026-10-01): una vez por email, al
// añadirlas a la lista. Texto pedido por el usuario ("como tienes enchufe...").
function emailAccesoPermanente() {
  return {
    asunto: "¡Tienes enchufe! Costaviva es gratis para ti",
    cuerpo: [
      `¡Hola!`,
      ``,
      `Como tienes enchufe, Costaviva es gratis para ti. Para siempre, sin suscripción y sin tarjeta 🎣`,
      ``,
      `Tienes acceso completo: condiciones del mar en tiempo real, webcams en directo y tu cuaderno de pesca con tus salidas y capturas.`,
      ``,
      `Si aún no tienes cuenta, créala con este mismo email:`,
      `https://costaviva.org/login?alta=1`,
      `Si ya la tienes, entra como siempre: https://costaviva.org`,
      ``,
      `¡Buena pesca!`,
      `— Costaviva`,
    ].join("\n"),
  };
}

function json(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { env } = context;
  const secretoEsperado = env.CRON_SECRET;
  const secretoRecibido = context.request.headers.get("X-Cron-Secret");
  if (!secretoValido(secretoRecibido, secretoEsperado)) {
    return json({ error: "no autorizado" }, 401);
  }

  const resendKey = env.RESEND_API_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = env.ADMIN_EMAIL;
  if (!resendKey || !serviceRoleKey) {
    return json({ error: "aviso de fin de prueba no configurado todavía" }, 501);
  }

  const cabeceras = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };

  async function rpc(nombre, cuerpo = {}) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(cuerpo),
    });
    if (!resp.ok) throw new Error(`rpc ${nombre} HTTP ${resp.status}: ${await resp.text()}`);
    const texto = await resp.text();
    return texto ? JSON.parse(texto) : null;
  }

  async function enviar(para, { asunto, cuerpo }) {
    const envio = await enviarEmail(env, { to: para, subject: asunto, text: cuerpo });
    // El detalle de Resend nunca va a la respuesta: puede traer el email del
    // destinatario. El helper ya lo deja en el log; aquí solo el código.
    if (!envio.ok) throw new Error(envio.error);
  }

  async function avisarAdmin(asunto, lineas) {
    if (!adminEmail) return;
    try {
      await enviar(adminEmail, { asunto: `Costaviva: ${asunto}`, cuerpo: lineas.join("\n") });
    } catch (e) {
      console.error(`avisar-fin-prueba: no se pudo avisar al admin: ${String(e)}`);
    }
  }

  const resultado = { bienvenidas: 0, recordados: 0, desactivados: 0, permanentes: 0, invitaciones: 0, fallos: 0 };
  const errores = [];

  // Un paso: pide la lista a Postgres, aplica la guarda de volumen si toca,
  // y para cada persona manda el email y SOLO entonces marca.
  // argsMarcar: los pasos de prueba marcan por user_id; el de acceso
  // permanente, por email (la persona puede no tener cuenta aún).
  // opcional: si la función de la lista aún no existe (migración sin aplicar,
  // HTTP 404 de PostgREST), se avisa en el log y no se pone en rojo.
  async function paso({ nombre, lista, limitar, email, marcar, contador, argsMarcar = (u) => ({ p_user_id: u.user_id }), opcional = false }) {
    try {
      const pendientes = (await rpc(lista)) || [];
      if (limitar && pendientes.length > LIMITE_POR_PASADA) {
        errores.push(`${nombre}: ${pendientes.length} cuentas, por encima del límite; no se ha hecho ninguna`);
        await avisarAdmin(`${nombre} de fin de prueba FRENADO`, [
          `La pasada iba a hacer el paso "${nombre}" con ${pendientes.length} cuentas de golpe (límite: ${LIMITE_POR_PASADA}).`,
          `No se ha hecho ninguna. Si son usuarios reales con la prueba vencida y quieres seguir, sube el límite en functions/avisar-fin-prueba.js.`,
        ]);
        return [];
      }
      const hechos = [];
      for (const u of pendientes) {
        if (!u.email) continue;
        try {
          await enviar(u.email, email(u));
          const marcado = await rpc(marcar, argsMarcar(u));
          // desactivar devuelve false si se suscribió entre la lista y ahora.
          if (marcado === false) continue;
          resultado[contador]++;
          hechos.push(u.email);
        } catch (e) {
          console.error(`avisar-fin-prueba: ${nombre} ${u.user_id ?? "(sin cuenta)"}: ${String(e)}`);
          resultado.fallos++;
        }
      }
      return hechos;
    } catch (e) {
      if (opcional && /HTTP 404/.test(String(e))) {
        console.warn(`avisar-fin-prueba: ${nombre}: ${lista}() no existe todavía; paso omitido`);
        return [];
      }
      errores.push(`${nombre}: ${String(e)}`);
      return [];
    }
  }

  await paso({
    nombre: "bienvenida",
    lista: "usuarios_bienvenida_pendiente_email",
    limitar: false,
    email: (u) => emailBienvenida(u.prueba_termina_en),
    marcar: "marcar_bienvenida_email",
    contador: "bienvenidas",
  });

  // El recordatorio fija la fecha de desactivación. El primer día incluye a
  // los usuarios de antes de este cambio con la prueba ya vencida: por eso
  // lleva guarda de volumen.
  await paso({
    nombre: "recordatorio",
    lista: "usuarios_fin_prueba_pendiente_recordatorio",
    limitar: true,
    email: (u) => emailRecordatorio(u.desactivar_en),
    marcar: "marcar_fin_prueba_recordatorio",
    contador: "recordados",
  });

  const desactivados = await paso({
    nombre: "desactivación",
    lista: "usuarios_fin_prueba_pendiente_desactivar",
    limitar: true,
    email: () => emailDesactivada(),
    marcar: "desactivar_usuario_fin_prueba",
    contador: "desactivados",
  });
  if (desactivados.length) {
    await avisarAdmin(`${desactivados.length} prueba(s) terminada(s) sin suscripción`, [
      `Cuentas desactivadas (sin acceso a la app hasta que se suscriban; datos conservados):`,
      ...desactivados.map((e) => `  - ${e}`),
    ]);
  }

  // Sin guarda de volumen: la lista solo la rellena una migración a mano.
  await paso({
    nombre: "acceso permanente",
    lista: "accesos_permanentes_pendiente_aviso",
    limitar: false,
    email: () => emailAccesoPermanente(),
    marcar: "marcar_acceso_permanente_avisado",
    contador: "permanentes",
    argsMarcar: (u) => ({ p_email: u.email }),
  });

  // Fin del acceso gratis por invitación (100 %, 2026-10-08, migración
  // 20261008170000): 7 días antes, una vez, invitando a suscribirse. Lo decide
  // invitaciones_pendiente_aviso_fin(). Con guarda de volumen, como el resto
  // de pasos que escriben a usuarios por una fecha.
  await paso({
    nombre: "fin de invitación",
    lista: "invitaciones_pendiente_aviso_fin",
    limitar: true,
    email: (u) => {
      const e = emailFinInvitacion(u);
      return { asunto: e.asunto, cuerpo: e.texto };
    },
    marcar: "marcar_invitacion_aviso_fin",
    contador: "invitaciones",
    argsMarcar: (u) => ({ p_id: u.id }),
    opcional: true,
  });

  // Un error de paso (una rpc que no responde, la guarda de volumen) pone el
  // workflow en rojo para que se vea; un fallo con una persona suelta solo
  // cuenta en "fallos" y se reintenta en la pasada siguiente.
  if (errores.length) console.error(`avisar-fin-prueba: ${errores.join(" | ")}`);
  return json({ ...resultado, errores: errores.length }, errores.length ? 502 : 200);
}
