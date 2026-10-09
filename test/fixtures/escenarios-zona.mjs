// Escenarios fijos de España y Portugal para la no regresión de la zona
// horaria (2026-10-09, fase 0 de Nueva Zelanda). `foto(raiz)` calcula, con el
// código del repo que está en `raiz`, índices hora a hora (todas las
// modalidades, octubre, enero, cambio de hora de marzo y junio), amanecer y
// anochecer, luna, /prevision (bloques, mareas y presión con un "ahora"
// fijo), el eje horario, la hora de las cámaras, el proxy y el índice SEO.
//
// test/fixtures/zona-horaria-espana.json se generó con este mismo fichero
// sobre origin/main ANTES del cambio (Europe/Madrid fijo) y guarda solo lo que
// depende de la hora (sol, luna, eje, horas de /prevision...), no lo que
// depende de los datos de especies o del oleaje, que cambian a menudo. Los
// índices se comparan en el propio test: zona deducida frente a Madrid
// explícito (`zona`), que debe dar lo mismo en la Península y Portugal.
// (El 2026-10-09 se comprobó además que los índices completos coincidían
// con los de main, antes de que existiera `contexto.zona`.)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const RealDate = Date;
const sha = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

export const PUNTOS = {
  mundaka: [43.407, -2.698], cangas: [42.26, -8.78], cadiz: [36.53, -6.3], valencia: [39.47, -0.33], palma: [39.55, 2.63],
  peniche: [39.36, -9.38], azores: [37.74, -25.67], madeira: [32.64, -16.92],
};

function serie(inicioUTC, n, fase = 0) {
  const horas = [];
  for (let i = 0; i < n; i++) {
    const d = new RealDate(inicioUTC + i * 3600000);
    horas.push({
      hora: `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, "0")}:00`,
      nivelMar: 1.8 * Math.sin((2 * Math.PI * (i + fase)) / 12.42), ola: 0.4 + 0.3 * Math.sin(i / 7), viento: 8 + 10 * Math.sin(i / 9), vientoDir: (i * 17) % 360,
      tempAgua: 17, presion: 1016 - i * 0.2, lluvia: i % 11 === 0 ? 1.2 : 0,
    });
  }
  return horas;
}

export async function foto(raiz, { zona = undefined, soloHora = false } = {}) {
  let FIJO = RealDate.UTC(2026, 9, 9, 10, 17);
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(FIJO); }
    static now() { return FIJO; }
  }
  const VA = await import(`${raiz}/assets/js/ventana-actividad.js`);
  const CS = await import(`${raiz}/assets/js/condiciones-salida.js`);
  const P = await import(`${raiz}/functions/prevision.js`);
  const EJE = await import(`${raiz}/functions/_lib/eje-horario.js`);
  const OC = await import(`${raiz}/functions/_lib/oleaje-camaras.js`);
  const IH = await import(`${raiz}/functions/_lib/seo/indice-hoy.js`);
  const OM = await import(`${raiz}/functions/_lib/open-meteo.js`);
  const json = (p) => JSON.parse(readFileSync(new URL(p, `file://${raiz}/`), "utf8"));
  const DATOS = json("assets/datos/especies.json");
  const out = {};

  const inicios = { oct: RealDate.UTC(2026, 9, 7), ene: RealDate.UTC(2026, 0, 14), dst: RealDate.UTC(2026, 2, 27), jun: RealDate.UTC(2026, 5, 20) };
  out.indices = {};
  for (const [nom, [lat, lon]] of Object.entries(PUNTOS)) {
    for (const [ep, ini] of Object.entries(inicios)) {
      const horas = serie(ini, 96, lat);
      for (const modalidad of VA.MODALIDADES) {
        const ctx = { lat, lon, zona, modalidad, reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas, b0: DATOS.indice?.b0_logodds ?? 0, horaActual: horas[40].hora };
        const r = [];
        for (let i = 30; i < 96; i++) {
          const ind = VA.indiceSpot(DATOS, horas, i, ctx);
          r.push([ind.puntuacion, ind.especie?.id ?? null, ind.freza ? 1 : 0, JSON.stringify(ind.resultado?.razones?.map((x) => [x.factor, x.texto, x.aporte]) ?? null)]);
        }
        out.indices[`${nom}|${ep}|${modalidad}`] = `${sha(r)}:${r.map((x) => x[0]).join(",")}`;
      }
    }
  }
  const lub = DATOS.especies.find((e) => e.id === "lubina");
  out.ventanaLubina = createHash("sha256").update(JSON.stringify(VA.calcularVentana(lub, DATOS.reglas_por_defecto, serie(inicios.jun, 72), {
    lat: 43.407, lon: -2.698, zona, modalidad: "submarina", reglasModalidad: DATOS.reglas_por_modalidad, reglasExpertas: DATOS.reglas_expertas,
  }))).digest("hex");
  out.sol = Object.entries(PUNTOS).map(([n, [lat, lon]]) => {
    const s = VA.solDelDia("2026-10-09", lat, lon);
    return [n, VA.minutosMadrid(s.amanecer), VA.minutosMadrid(s.anochecer)];
  });
  out.luna = ["2026-10-09", "2026-03-29", "2026-07-01"].map((f) => CS.lunaDeFecha(f, "07:30"));
  out.idxSalida = CS.indiceHoraSalida(serie(inicios.oct, 72).map((h) => h.hora), "2026-10-08", "23:40");

  // /prevision con un "ahora" fijo (mañana y noche).
  function respuesta() {
    const eje = EJE.ejeHorario({ timezone: "Europe/Madrid", start_date: "2026-10-09", end_date: "2026-10-10" }, FIJO);
    const time = eje.horas.map((h) => h.etiqueta);
    const f = (g) => time.map((_, i) => g(i));
    return {
      marino: { hourly: { time, wave_height: f((i) => 0.5 + 0.2 * Math.sin(i / 5)), wave_period: f(() => 9), wave_direction: f(() => 300), sea_surface_temperature: f(() => 18.2), ocean_current_velocity: f(() => 0.3), ocean_current_direction: f(() => 90), sea_level_height_msl: f((i) => 1.5 * Math.sin((2 * Math.PI * i) / 12.42)) } },
      viento: { hourly: { time, windspeed_10m: f((i) => 10 + i), winddirection_10m: f((i) => (i * 13) % 360), precipitation: f(() => 0), cloudcover: f((i) => i % 100), pressure_msl: f((i) => 1015 - i * 0.3) } },
    };
  }
  out.prevision = {};
  globalThis.Date = FakeDate;
  try {
    for (const slug of ["mundaka", "peniche", "valencia", "cadiz", "palma"]) {
      const s = P.SPOTS.find((x) => x.slug === slug);
      for (const t of [RealDate.UTC(2026, 9, 9, 10, 17), RealDate.UTC(2026, 9, 9, 22, 40)]) {
        FIJO = t;
        const r = respuesta();
        const p = P.procesarSpot(s, r.marino, r.viento, {}, {}, "openmeteo");
        out.prevision[`${slug}@${t}`] = {
          bloques: p.bloques.map((b) => [b.hora, b.horaISO]), marea: p.marea, presion: p.presion,
        };
      }
    }
  } finally {
    globalThis.Date = RealDate;
  }
  FIJO = RealDate.UTC(2026, 9, 9, 10, 17);
  out.eje = [EJE.ejeHorario({ timezone: "Europe/Madrid", past_days: 1, forecast_days: 2 }, FIJO).horas.slice(0, 3), EJE.etiquetaHora(FIJO, "Europe/Madrid")];
  out.isoCam = [OC.isoLocalMadrid(RealDate.UTC(2026, 9, 8, 10, 30)), OC.isoLocalMadrid(RealDate.UTC(2026, 11, 8, 10, 30))];
  out.proxy = OM.validarConsultaProxy("marine", new URLSearchParams("latitude=43.41&longitude=-2.70&timezone=Europe%2FMadrid&forecast_days=1&hourly=wave_height"), { hoy: "2026-10-09" });
  const prev = json("test/fixtures/seo-prevision.json");
  const sp = prev.spots.find((s) => s.slug === "bakio");
  const horas = IH.serieHorariaSpot(sp, json("test/fixtures/seo-marine-bakio.json"), json("test/fixtures/seo-forecast-bakio.json"));
  out.seo = horas.slice(20, 26).map((h) => h.hora).concat([JSON.stringify(IH.indiceDeHoy(DATOS, sp, horas, { ahoraISO: horas[30].hora }))]);
  if (soloHora) {
    delete out.indices;
    delete out.ventanaLubina;
    delete out.seo;
  }
  return out;
}

// node test/fixtures/escenarios-zona.mjs <raiz> > zona-horaria-espana.json
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await foto(process.argv[2], { soloHora: true }), null, 1));
}
