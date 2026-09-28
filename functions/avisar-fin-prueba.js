// functions/avisar-fin-prueba.js
// Ciclo de la prueba de 7 días. Empezó el 2026-09-25 como un aviso DESPUÉS
// de vencer; el 2026-09-28 el usuario lo cambió: "a ese vencimiento, o se da
// de alta o se le cancela". Ver la migración 20260928120000 para el
// calendario y las excepciones. Contado desde el alta:
//
//   alta    email de bienvenida con las fechas
//   día 5   recordatorio: la prueba acaba el día 7
//   día 7   sin suscripción → cuenta cancelada (login bloqueado, datos intactos)
//   día 14  borrar cuenta, datos y fotos
//
// Mismo patrón que notificar-altas.js: protegido con el secreto compartido
// X-Cron-Secret, llamado por .github/workflows/notificar-altas.yml, y
// reutiliza RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY y ADMIN_EMAIL.
//
// ESTO ESCRIBE A USUARIOS REALES Y BORRA CUENTAS. Por eso:
//   - A quién le toca cada paso lo decide Postgres, no este código (funciones
//     usuarios_fin_prueba_pendiente_*). Aquí no se recalcula nada.
//   - Desactivar y borrar vuelven a comprobar las condiciones DENTRO de la
//     función de Postgres: si alguien se suscribe entre la lista y la acción,
//     no se le toca.
//   - El recordatorio se marca SOLO tras confirmar Resend el envío, y es ese
//     marcado el que fija la fecha de cancelación prometida en el email. Sin
//     recordatorio enviado no hay cancelación: un fallo de correo retrasa el
//     calendario de esa persona, nunca lo acorta.
//   - Guarda de volumen: si en una pasada salen más de LIMITE_POR_PASADA
//     cuentas para recordar, cancelar o borrar, ese paso NO se ejecuta y se
//     avisa al admin. Con el volumen real de altas, eso es un bug, no un día
//     normal — mismo criterio que las guardas de Pólizas.ai.
//   - Cada desactivación y cada borrado se le cuenta al admin por email.
//     Sin ADMIN_EMAIL configurado, esos dos pasos no se ejecutan.
//
// El tono del email importa: alguien que probó la app y no siguió no ha
// hecho nada malo. Se le dicen las fechas claras, se le da el enlace para
// suscribirse si quiere, y se acabó. Nada de urgencia fabricada.

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const BUCKET_FOTOS = "capturas-fotos";
const LIMITE_POR_PASADA = 10;
const DIA_MS = 24 * 60 * 60 * 1000;

function fecha(valor) {
  return new Date(valor).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

const PIE = [``, `— Costaviva`, `https://costaviva.org`];

function emailBienvenida(pruebaTerminaEn, borrarEn) {
  return {
    asunto: "Bienvenido a Costaviva: tu prueba gratis de 7 días",
    cuerpo: [
      `Hola,`,
      ``,
      `Gracias por darte de alta en Costaviva. Tienes 7 días de prueba gratis, sin tarjeta, hasta el ${fecha(pruebaTerminaEn)}.`,
      ``,
      `Para que no haya sorpresas, así funciona:`,
      ``,
      `  - Si te suscribes antes del ${fecha(pruebaTerminaEn)}, sigues usando la app sin cortes.`,
      `  - Si no, ese día se cancela tu cuenta y ya no podrás entrar.`,
      `  - Y el ${fecha(borrarEn)} la borramos, con todos tus datos.`,
      ``,
      `Te mandaremos un recordatorio dos días antes de que acabe la prueba.`,
      ``,
      `Planes:  https://costaviva.org/suscripcion  (3,99 €/mes o 39,99 €/año, se cancela cuando quieras)`,
      ``,
      `¡Buena pesca!`,
      ...PIE,
    ].join("\n"),
  };
}

function emailRecordatorio(desactivarEn, borrarEn) {
  return {
    asunto: `Tu prueba de Costaviva termina el ${fecha(desactivarEn)}`,
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Costaviva está a punto de terminar.`,
      ``,
      `  - El ${fecha(desactivarEn)}, si no te has suscrito, cancelaremos tu cuenta y ya no podrás entrar.`,
      `  - El ${fecha(borrarEn)} la borraremos, con tus salidas, capturas, fotos y ubicaciones.`,
      ``,
      `Si quieres conservarla, basta con suscribirte antes:  https://costaviva.org/suscripcion`,
      ``,
      `Si no, no hace falta que hagas nada.`,
      ...PIE,
    ].join("\n"),
  };
}

function emailDesactivada(borrarEn) {
  return {
    asunto: "Tu prueba ha terminado y tu cuenta de Costaviva se ha cancelado",
    cuerpo: [
      `Hola,`,
      ``,
      `Tu prueba gratis de Costaviva ha terminado sin suscripción, así que hemos cancelado tu cuenta.`,
      ``,
      `El ${fecha(borrarEn)} la borraremos definitivamente, con todos tus datos. Si quieres recuperarla antes de esa fecha, responde a este correo y la reactivamos.`,
      ``,
      `Gracias por haberla probado.`,
      ...PIE,
    ].join("\n"),
  };
}

function emailBorrada() {
  return {
    asunto: "Hemos borrado tu cuenta de Costaviva",
    cuerpo: [
      `Hola,`,
      ``,
      `Como te avisamos, hemos borrado tu cuenta de Costaviva y todos sus datos: salidas, capturas, fotos y ubicaciones.`,
      ``,
      `Si algún día quieres volver, puedes registrarte de nuevo en https://costaviva.org.`,
      ...PIE,
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
  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
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

  async function enviar(para, { asunto, cuerpo }, extra = {}) {
    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Costaviva <avisos@costaviva.org>",
        to: [para],
        subject: asunto,
        text: cuerpo,
        ...extra,
      }),
    });
    // El detalle de Resend nunca va a la respuesta: puede traer el email del
    // destinatario. Se lanza para que el llamante lo deje en el log.
    if (!envio.ok) throw new Error(`Resend ${envio.status}: ${await envio.text()}`);
  }

  async function avisarAdmin(asunto, lineas) {
    try {
      await enviar(adminEmail, { asunto: `Costaviva: ${asunto}`, cuerpo: lineas.join("\n") });
    } catch (e) {
      console.error(`avisar-fin-prueba: no se pudo avisar al admin: ${String(e)}`);
    }
  }

  // Las fotos viven en capturas-fotos/<user_id>/<uuid>.jpg y no se pueden
  // borrar desde SQL, así que van antes que la cuenta. Si esto falla, NO se
  // borra la cuenta: quedarían fotos huérfanas que ya nadie localizaría.
  async function borrarFotos(userId) {
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const lista = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET_FOTOS}`, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({ prefix: userId, limit: 100, offset: 0 }),
      });
      if (!lista.ok) throw new Error(`listar fotos HTTP ${lista.status}: ${await lista.text()}`);
      // Sin id = "carpeta" virtual; aquí todas las fotos cuelgan directas.
      const objetos = (await lista.json()).filter((o) => o && o.id);
      if (!objetos.length) return;
      const borrado = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_FOTOS}`, {
        method: "DELETE",
        headers: cabeceras,
        body: JSON.stringify({ prefixes: objetos.map((o) => `${userId}/${o.name}`) }),
      });
      if (!borrado.ok) throw new Error(`borrar fotos HTTP ${borrado.status}: ${await borrado.text()}`);
    }
    throw new Error("demasiadas vueltas borrando fotos");
  }

  const resultado = { bienvenidas: 0, recordados: 0, desactivados: 0, borrados: 0, fallos: 0 };
  const errores = [];

  // 1) Bienvenida, en cuanto confirma el email.
  try {
    const pendientes = (await rpc("usuarios_bienvenida_pendiente_email")) || [];
    for (const u of pendientes) {
      if (!u.email) continue;
      try {
        await enviar(u.email, emailBienvenida(u.prueba_termina_en, u.borrar_en));
        await rpc("marcar_bienvenida_email", { p_user_id: u.user_id });
        resultado.bienvenidas++;
      } catch (e) {
        console.error(`avisar-fin-prueba: bienvenida ${u.user_id}: ${String(e)}`);
        resultado.fallos++;
      }
    }
  } catch (e) {
    errores.push(`bienvenida: ${String(e)}`);
  }

  // 2) Recordatorio, día 5. Arranca la cuenta atrás de la cancelación, así
  //    que lleva la misma guarda de volumen que cancelar y borrar: el primer
  //    día incluye a los usuarios de antes de este cambio con la prueba ya
  //    vencida, y si son muchos lo decide el admin, no el cron.
  try {
    let pendientes = (await rpc("usuarios_fin_prueba_pendiente_recordatorio")) || [];
    if (pendientes.length > LIMITE_POR_PASADA) {
      errores.push(`recordatorio: ${pendientes.length} cuentas, por encima del límite; no se ha enviado ninguno`);
      if (adminEmail) {
        await avisarAdmin("recordatorios de fin de prueba FRENADOS", [
          `La pasada iba a mandar ${pendientes.length} recordatorios de fin de prueba de golpe (límite: ${LIMITE_POR_PASADA}), y cada uno arranca la cancelación de esa cuenta 2 días después.`,
          `No se ha enviado ninguno. Si son usuarios reales con la prueba vencida y quieres seguir, sube el límite en functions/avisar-fin-prueba.js.`,
        ]);
      }
      pendientes = [];
    }
    for (const u of pendientes) {
      if (!u.email) continue;
      try {
        await enviar(u.email, emailRecordatorio(u.desactivar_en, u.borrar_en));
        await rpc("marcar_fin_prueba_recordatorio", { p_user_id: u.user_id });
        resultado.recordados++;
      } catch (e) {
        console.error(`avisar-fin-prueba: recordatorio ${u.user_id}: ${String(e)}`);
        resultado.fallos++;
      }
    }
  } catch (e) {
    errores.push(`recordatorio: ${String(e)}`);
  }

  if (!adminEmail) {
    errores.push("ADMIN_EMAIL no configurado: desactivar y borrar no se ejecutan");
  } else {
    // 3) Cancelar, día 7 (o la fecha prometida en el recordatorio).
    try {
      const pendientes = (await rpc("usuarios_fin_prueba_pendiente_desactivar")) || [];
      if (pendientes.length > LIMITE_POR_PASADA) {
        errores.push(`desactivar: ${pendientes.length} cuentas, por encima del límite; no se ha tocado ninguna`);
        await avisarAdmin("desactivación de cuentas FRENADA", [
          `La pasada de fin de prueba iba a desactivar ${pendientes.length} cuentas de golpe (límite: ${LIMITE_POR_PASADA}).`,
          `No se ha desactivado ninguna. Con el volumen normal de altas eso huele a bug: revísalo antes de subir el límite en functions/avisar-fin-prueba.js.`,
        ]);
      } else {
        const hechas = [];
        for (const u of pendientes) {
          try {
            const ok = await rpc("desactivar_usuario_fin_prueba", { p_user_id: u.user_id });
            if (ok !== true) continue; // se suscribió entre la lista y ahora
            resultado.desactivados++;
            hechas.push(`${u.email} (se borrará el ${fecha(u.borrar_en)})`);
            if (u.email) {
              try {
                await enviar(u.email, emailDesactivada(u.borrar_en), { reply_to: "datos@costaviva.org" });
              } catch (e) {
                // Ya está desactivada: este email es informativo, no se reintenta.
                console.error(`avisar-fin-prueba: email de desactivación ${u.user_id}: ${String(e)}`);
              }
            }
          } catch (e) {
            console.error(`avisar-fin-prueba: desactivar ${u.user_id}: ${String(e)}`);
            resultado.fallos++;
          }
        }
        if (hechas.length) {
          await avisarAdmin(`${hechas.length} cuenta(s) desactivada(s) por fin de prueba`, [
            `Desactivadas (login bloqueado, datos intactos):`,
            ...hechas.map((h) => `  - ${h}`),
            ``,
            `Para reactivar a alguien: Supabase → Authentication → Users → Unban. Sin bloqueo, el borrado ya no le toca.`,
          ]);
        }
      }
    } catch (e) {
      errores.push(`desactivar: ${String(e)}`);
    }

    // 4) Borrar, 7 días después de desactivar.
    try {
      const pendientes = (await rpc("usuarios_fin_prueba_pendiente_borrar")) || [];
      if (pendientes.length > LIMITE_POR_PASADA) {
        errores.push(`borrar: ${pendientes.length} cuentas, por encima del límite; no se ha borrado ninguna`);
        await avisarAdmin("borrado de cuentas FRENADO", [
          `La pasada de fin de prueba iba a borrar ${pendientes.length} cuentas de golpe (límite: ${LIMITE_POR_PASADA}).`,
          `No se ha borrado ninguna. Revísalo antes de subir el límite en functions/avisar-fin-prueba.js.`,
        ]);
      } else {
        const hechas = [];
        for (const u of pendientes) {
          try {
            await borrarFotos(u.user_id);
            const ok = await rpc("borrar_usuario_fin_prueba", { p_user_id: u.user_id });
            if (ok !== true) continue;
            resultado.borrados++;
            hechas.push(u.email);
            if (u.email) {
              try {
                await enviar(u.email, emailBorrada());
              } catch (e) {
                console.error(`avisar-fin-prueba: email de borrado ${u.user_id}: ${String(e)}`);
              }
            }
          } catch (e) {
            console.error(`avisar-fin-prueba: borrar ${u.user_id}: ${String(e)}`);
            resultado.fallos++;
          }
        }
        if (hechas.length) {
          await avisarAdmin(`${hechas.length} cuenta(s) borrada(s) por fin de prueba`, [
            `Borradas con todos sus datos y fotos:`,
            ...hechas.map((h) => `  - ${h}`),
          ]);
        }
      }
    } catch (e) {
      errores.push(`borrar: ${String(e)}`);
    }
  }

  // Un error de fase (una rpc que no responde, la guarda de volumen) pone el
  // workflow en rojo para que se vea; un fallo con una persona suelta solo
  // cuenta en "fallos" y se reintenta en la pasada siguiente.
  if (errores.length) console.error(`avisar-fin-prueba: ${errores.join(" | ")}`);
  return json({ ...resultado, errores: errores.length }, errores.length ? 502 : 200);
}
