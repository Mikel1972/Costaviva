// functions/avisar-fin-prueba.js
// Emails de la prueba gratis de Premium. Desde el 2026-10-11 (cobro con los
// precios confirmados por Mikel) la prueba dura 14 días sin tarjeta y, al
// acabar, la cuenta pasa al PLAN GRATUITO (mapa, mareas y condiciones
// básicas): no se bloquea nada. Ver la migración 20261011230000. Contado
// desde el alta:
//
//   alta    bienvenida, con la fecha en que acaba la prueba
//   día 11  recordatorio: la prueba de Premium acaba el día 14
//   día 14  sin suscripción → pasa al plan gratuito, con su email
//            (perfiles.desactivado_en guarda cuándo)
//
// Son emails de servicio sobre la propia cuenta (el alta los anuncia), no
// publicidad. En inglés a quien tiene la app en inglés (user_metadata.idioma).
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
//     es además el que fija la fecha de fin que se le promete: sin
//     recordatorio enviado no hay paso a gratis. Un fallo de correo retrasa
//     el calendario de esa persona, nunca lo acorta.
//   - Guarda de volumen: si en una pasada salen más de LIMITE_POR_PASADA
//     recordatorios o pasos a gratis, ese paso NO se ejecuta y se avisa al
//     admin.
//
// El tono del email importa: fechas claras, el enlace a los planes, y se
// acabó. Nada de urgencia fabricada.

import { secretoValido } from "./_lib/secreto.js";
import { enviarEmail } from "./_lib/email.js";
import { emailFinInvitacion } from "./_lib/invitaciones.js";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const LIMITE_POR_PASADA = 10;

// Hora de Madrid a propósito (ZONA_NEGOCIO): fechas de la suscripción en los emails.
function fecha(valor, idioma = "es") {
  return new Date(valor).toLocaleDateString(idioma === "en" ? "en-NZ" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid", // a propósito (ZONA_NEGOCIO)
  });
}

const PIE = [``, `— Costaviva`, `https://costaviva.org`];
const PLANES = {
  es: `Planes Premium:  https://costaviva.org/suscripcion  (desde 3,99 €/mes o 29,99 €/año, IVA incluido; se cancela cuando quieras)`,
  en: `Premium plans:  https://costaviva.org/suscripcion  (prices in your currency, tax included; cancel any time)`,
};

function emailBienvenida(pruebaTerminaEn, idioma = "es") {
  if (idioma === "en") {
    return {
      asunto: "Welcome to Costaviva: 14 days of Premium, free",
      cuerpo: [
        `Hi,`,
        ``,
        `Thanks for signing up to Costaviva. You have 14 days of Premium for free, no card needed, until ${fecha(pruebaTerminaEn, "en")}.`,
        ``,
        `Premium adds the fishing index and activity window, sea layers, webcams, your fishing log, groups and the SOS alarm. The map, tides and basic conditions are always free.`,
        ``,
        `When the trial ends you simply move to the free plan: nothing is charged and nothing is deleted. We'll remind you 3 days before.`,
        ``,
        PLANES.en,
        ``,
        `Tight lines!`,
        ...PIE,
      ].join("\n"),
    };
  }
  return {
    asunto: "Bienvenido a Costaviva: 14 días de Premium gratis",
    cuerpo: [
      `Hola,`,
      ``,
      `Gracias por darte de alta en Costaviva. Tienes 14 días de Premium gratis, sin tarjeta, hasta el ${fecha(pruebaTerminaEn)}.`,
      ``,
      `Premium añade el índice de pesca y la ventana de actividad, las capas del mar, las webcams, tu cuaderno de pesca, los grupos y la alarma SOS. El mapa, las mareas y las condiciones básicas son siempre gratis.`,
      ``,
      `Cuando acabe la prueba pasas al plan gratuito sin más: no se cobra nada y no se borra nada. Te avisaremos 3 días antes.`,
      ``,
      PLANES.es,
      ``,
      `¡Buena pesca!`,
      ...PIE,
    ].join("\n"),
  };
}

function emailRecordatorio(finEn, idioma = "es") {
  if (idioma === "en") {
    return {
      asunto: `Your Costaviva Premium trial ends on ${fecha(finEn, "en")}`,
      cuerpo: [
        `Hi,`,
        ``,
        `Your free Premium trial ends on ${fecha(finEn, "en")}. After that you'll be on the free plan (map, tides and basic conditions). Your data stays saved.`,
        ``,
        `If you'd like to keep Premium, you can subscribe before then:`,
        ``,
        PLANES.en,
        ``,
        `If not, you don't need to do anything.`,
        ...PIE,
      ].join("\n"),
    };
  }
  return {
    asunto: `Tu prueba de Premium en Costaviva termina el ${fecha(finEn)}`,
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Premium termina el ${fecha(finEn)}. Después seguirás con el plan gratuito (mapa, mareas y condiciones básicas). Tus datos se guardan.`,
      ``,
      `Si quieres seguir con Premium, puedes suscribirte antes:`,
      ``,
      PLANES.es,
      ``,
      `Si no, no hace falta que hagas nada.`,
      ...PIE,
    ].join("\n"),
  };
}

function emailPasoAGratis(idioma = "es") {
  if (idioma === "en") {
    return {
      asunto: "Your Costaviva Premium trial has ended",
      cuerpo: [
        `Hi,`,
        ``,
        `Your free Premium trial has ended, so your account is now on the free plan: the map, tides and basic conditions are still there.`,
        ``,
        `Your trips, catches, photos and spots are saved. If you subscribe to Premium at any time, everything is back as you left it.`,
        ``,
        PLANES.en,
        ``,
        `Thanks for trying it.`,
        ...PIE,
      ].join("\n"),
    };
  }
  return {
    asunto: "Tu prueba de Premium en Costaviva ha terminado",
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Premium ha terminado y tu cuenta pasa al plan gratuito: el mapa, las mareas y las condiciones básicas siguen ahí.`,
      ``,
      `Tus salidas, capturas, fotos y ubicaciones siguen guardadas. Si te suscribes a Premium en cualquier momento, lo tienes todo como lo dejaste.`,
      ``,
      PLANES.es,
      ``,
      `Gracias por haberla probado.`,
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
    email: (u) => emailBienvenida(u.prueba_termina_en, u.idioma),
    marcar: "marcar_bienvenida_email",
    contador: "bienvenidas",
  });

  // El recordatorio fija la fecha de fin de la prueba. El primer día incluye a
  // los usuarios de antes de este cambio con la prueba ya vencida: por eso
  // lleva guarda de volumen.
  await paso({
    nombre: "recordatorio",
    lista: "usuarios_fin_prueba_pendiente_recordatorio",
    limitar: true,
    email: (u) => emailRecordatorio(u.desactivar_en, u.idioma),
    marcar: "marcar_fin_prueba_recordatorio",
    contador: "recordados",
  });

  const desactivados = await paso({
    nombre: "paso a gratis",
    lista: "usuarios_fin_prueba_pendiente_desactivar",
    limitar: true,
    email: (u) => emailPasoAGratis(u.idioma),
    marcar: "desactivar_usuario_fin_prueba",
    contador: "desactivados",
  });
  if (desactivados.length) {
    await avisarAdmin(`${desactivados.length} prueba(s) terminada(s) sin suscripción`, [
      `Cuentas que han pasado al plan gratuito (siguen entrando; datos conservados):`,
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
