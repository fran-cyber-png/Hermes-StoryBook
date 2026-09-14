import type { DatosHoy } from './hoy';
import type { DatosSeries } from './series';

/**
 * «HOY» PARA LA GALERÍA — la respuesta REAL del server, no el caso ideal (regla dura #10).
 *
 * Cada objeto es, campo por campo, lo que devolvió `consultarHoy` corriendo contra
 * una copia de producción (`hermes_explain`, restaurada del dump del 10-sep-2026 a
 * las 03:40) con `server/scratchpad/medir-hoy.ts`. Nada se tipeó a mano: sólo
 * `inicioDeHoy` y `generadoEn` se ajustan al reloj de quien abre la galería, para
 * que el sello no diga «ayer». La serie de 14 días es la de `consultarSeriesDashboard`
 * sobre el mismo dump.
 *
 * ⚠️ **Una excepción, #954:** en `HOY_CAMPANA` las `ventas` de cada persona se cambiaron a
 * mano de 0 a `null`, que es lo que el server manda desde entonces en campaña. No hay otra
 * cifra que medir: en campaña no se consulta `conversiones_wa`.
 *
 * ⚠️ **El «hoy» medido son 27 h** —desde el 9-sep a las 00:00 de Lima hasta la
 * hora del dump— porque de madrugada el día real tiene tres horas y no dice nada.
 *
 * Lo que estos números muestran sin que nadie lea:
 *   · la deuda SIN DUEÑA (542 de 733 de más de 24 h) supera a la de todas las
 *     personas juntas: el problema es de reparto, no de velocidad;
 *   · `aperez` tiene 53 de más de 24 h y 119 asignadas sin estar en el mapa de
 *     ninguna línea: la fila aparece igual;
 *   · alex (0 de 2), jahelly (0 de 1) y darwin (0 de 9) sin ninguna primera respuesta:
 *     la pantalla tiene que decir «sin respuesta», nunca «0 min»;
 *   · Libros Mx, compartida entre darian y nicole: 58 contestadas desde el teléfono
 *     que no se pueden repartir por persona;
 *   · 150 DMs de Messenger sin respuesta de más de 24 h, que sólo se pueden abrir por
 *     su canal;
 *   · en campaña, 133 de las 214 de más de 24 h no tienen dueña y 109 son DMs de la
 *     Página, no de la línea.
 */

/** Hoy a las 00:00 del reloj de quien abre la galería. */
function medianocheLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** El supervisor de la Escuela (medido como `gsifuentes`): la mesa entera. */
export const HOY_SUPERVISOR: DatosHoy = {
  inicioDeHoy: medianocheLocal(),
  generadoEn: new Date().toISOString(),
  supervisor: true,
  modulo: "ventas",
  lineas: [
    {
      "numero": "51901938157",
      "etiqueta": "Alex",
      "clase": "propia",
      "personas": [
        "alex"
      ]
    },
    {
      "numero": "51921395391",
      "etiqueta": "Manuel",
      "clase": "propia",
      "personas": [
        "manuel"
      ]
    },
    {
      "numero": "51939744440",
      "etiqueta": "Por identificar — Perú",
      "clase": "sin_asignar",
      "personas": []
    },
    {
      "numero": "51941654039",
      "etiqueta": "Walter Ventas",
      "clase": "propia",
      "personas": [
        "walter"
      ]
    },
    {
      "numero": "51944531711",
      "etiqueta": "Sindy",
      "clase": "propia",
      "personas": [
        "sindy"
      ]
    },
    {
      "numero": "51961753189",
      "etiqueta": "Por identificar — Perú",
      "clase": "sin_asignar",
      "personas": []
    },
    {
      "numero": "51970356062",
      "etiqueta": "luz",
      "clase": "propia",
      "personas": [
        "luz"
      ]
    },
    {
      "numero": "51984429504",
      "etiqueta": "Ventas Meta",
      "clase": "equipo",
      "personas": [
        "alex",
        "darian",
        "darwin",
        "jahelly",
        "luz",
        "nicole",
        "sindy"
      ]
    },
    {
      "numero": "51986394450",
      "etiqueta": "Ventas Perú",
      "clase": "sin_asignar",
      "personas": []
    },
    {
      "numero": "51986790746",
      "etiqueta": "Usuario1",
      "clase": "sin_asignar",
      "personas": []
    },
    {
      "numero": "51986855496",
      "etiqueta": "Darwin",
      "clase": "propia",
      "personas": [
        "darwin"
      ]
    },
    {
      "numero": "5215610584485",
      "etiqueta": "Libros Mx",
      "clase": "compartida",
      "personas": [
        "darian",
        "nicole"
      ]
    },
    {
      "numero": "59178814740",
      "etiqueta": "Jahelly",
      "clase": "propia",
      "personas": [
        "jahelly"
      ]
    },
    {
      "numero": "593969185042",
      "etiqueta": "Darian",
      "clase": "propia",
      "personas": [
        "darian"
      ]
    },
    {
      "numero": "593992073457",
      "etiqueta": "Nicole",
      "clase": "propia",
      "personas": [
        "nicole"
      ]
    }
  ],
  escribieron: {
    "total": 450,
    "porLinea": [
      {
        "linea": "51970356062",
        "n": 250
      },
      {
        "linea": "51984429504",
        "n": 95
      },
      {
        "linea": "5215610584485",
        "n": 57
      },
      {
        "linea": "593969185042",
        "n": 21
      },
      {
        "linea": "593992073457",
        "n": 14
      },
      {
        "linea": "51986855496",
        "n": 8
      },
      {
        "linea": null,
        "canal": "facebook",
        "n": 5
      }
    ]
  },
  sinRespuesta: {
    "total": 733,
    "porDuena": [
      {
        "duena": null,
        "n": 542
      },
      {
        "duena": "luz",
        "n": 74
      },
      {
        "duena": "aperez",
        "n": 53
      },
      {
        "duena": "sindy",
        "n": 22
      },
      {
        "duena": "darian",
        "n": 12
      },
      {
        "duena": "alex",
        "n": 10
      },
      {
        "duena": "jahelly",
        "n": 9
      },
      {
        "duena": "darwin",
        "n": 7
      },
      {
        "duena": "nicole",
        "n": 3
      },
      {
        "duena": "usuario1",
        "n": 1
      }
    ],
    "porLinea": [
      {
        "linea": "51970356062",
        "n": 270
      },
      {
        "linea": "51984429504",
        "n": 176
      },
      {
        "linea": null,
        "canal": "facebook",
        "n": 150
      },
      {
        "linea": "51986855496",
        "n": 61
      },
      {
        "linea": "593969185042",
        "n": 47
      },
      {
        "linea": "5215610584485",
        "n": 15
      },
      {
        "linea": "59178814740",
        "n": 11
      },
      {
        "linea": "51901938157",
        "n": 2
      },
      {
        "linea": "51921395391",
        "n": 1
      }
    ]
  },
  calientesSinDuena: {
    "total": 190,
    "porLinea": [
      {
        "linea": "51970356062",
        "n": 88
      },
      {
        "linea": null,
        "canal": "facebook",
        "n": 41
      },
      {
        "linea": "593969185042",
        "n": 25
      },
      {
        "linea": "51986855496",
        "n": 20
      },
      {
        "linea": "5215610584485",
        "n": 5
      },
      {
        "linea": "59178814740",
        "n": 4
      },
      {
        "linea": null,
        "canal": "instagram",
        "n": 4
      },
      {
        "linea": "593992073457",
        "n": 3
      }
    ]
  },
  personas: [
    {
      "vendedora": "alex",
      "nombre": "Alex Roldán",
      "lineas": [
        "51901938157",
        "51984429504"
      ],
      "asignadas": 64,
      "contestadas": 1,
      "primeraRespuesta": {
        "medianaMin": null,
        "sobre": 0,
        "de": 2
      },
      "ventas": 2
    },
    {
      "vendedora": "aperez",
      "nombre": null,
      "lineas": [],
      "asignadas": 119,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": 0
    },
    {
      "vendedora": "darian",
      "nombre": null,
      "lineas": [
        "51984429504",
        "5215610584485",
        "593969185042"
      ],
      "asignadas": 124,
      "contestadas": 57,
      "primeraRespuesta": {
        "medianaMin": 4.1,
        "sobre": 19,
        "de": 24
      },
      "ventas": 4
    },
    {
      "vendedora": "darwin",
      "nombre": null,
      "lineas": [
        "51984429504",
        "51986855496"
      ],
      "asignadas": 16,
      "contestadas": 2,
      "primeraRespuesta": {
        "medianaMin": null,
        "sobre": 0,
        "de": 9
      },
      "ventas": 1
    },
    {
      "vendedora": "jahelly",
      "nombre": null,
      "lineas": [
        "51984429504",
        "59178814740"
      ],
      "asignadas": 44,
      "contestadas": 2,
      "primeraRespuesta": {
        "medianaMin": null,
        "sobre": 0,
        "de": 1
      },
      "ventas": 0
    },
    {
      "vendedora": "luz",
      "nombre": null,
      "lineas": [
        "51970356062",
        "51984429504"
      ],
      "asignadas": 3797,
      "contestadas": 346,
      "primeraRespuesta": {
        "medianaMin": 11.5,
        "sobre": 241,
        "de": 292
      },
      "ventas": 4
    },
    {
      "vendedora": "manuel",
      "nombre": null,
      "lineas": [
        "51921395391"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": 0
    },
    {
      "vendedora": "nicole",
      "nombre": null,
      "lineas": [
        "51984429504",
        "5215610584485",
        "593992073457"
      ],
      "asignadas": 216,
      "contestadas": 40,
      "primeraRespuesta": {
        "medianaMin": 2.5,
        "sobre": 24,
        "de": 31
      },
      "ventas": 1
    },
    {
      "vendedora": "sindy",
      "nombre": null,
      "lineas": [
        "51944531711",
        "51984429504"
      ],
      "asignadas": 2141,
      "contestadas": 32,
      "primeraRespuesta": {
        "medianaMin": 2.6,
        "sobre": 30,
        "de": 41
      },
      "ventas": 2
    },
    {
      "vendedora": "usuario1",
      "nombre": null,
      "lineas": [],
      "asignadas": 1,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": 0
    },
    {
      "vendedora": "walter",
      "nombre": null,
      "lineas": [
        "51941654039"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": 0
    }
  ],
  sinAtribuir: [
    {
      "linea": "5215610584485",
      "contestadas": 58
    }
  ],
};

/** Lo que ve Nicole, que no supervisa: su universo (la frontera de la cola) y su fila. */
export const HOY_NICOLE: DatosHoy = {
  inicioDeHoy: medianocheLocal(),
  generadoEn: new Date().toISOString(),
  supervisor: false,
  modulo: "ventas",
  lineas: [
    {
      "numero": "51984429504",
      "etiqueta": "Ventas Meta",
      "clase": "equipo",
      "personas": [
        "alex",
        "darian",
        "darwin",
        "jahelly",
        "luz",
        "nicole",
        "sindy"
      ]
    },
    {
      "numero": "5215610584485",
      "etiqueta": "Libros Mx",
      "clase": "compartida",
      "personas": [
        "darian",
        "nicole"
      ]
    },
    {
      "numero": "593992073457",
      "etiqueta": "Nicole",
      "clase": "propia",
      "personas": [
        "nicole"
      ]
    }
  ],
  escribieron: {
    "total": 81,
    "porLinea": [
      {
        "linea": "5215610584485",
        "n": 57
      },
      {
        "linea": "593992073457",
        "n": 14
      },
      {
        "linea": "51984429504",
        "n": 5
      },
      {
        "linea": null,
        "canal": "facebook",
        "n": 5
      }
    ]
  },
  sinRespuesta: {
    "total": 168,
    "porDuena": [
      {
        "duena": null,
        "n": 165
      },
      {
        "duena": "nicole",
        "n": 3
      }
    ],
    "porLinea": [
      {
        "linea": null,
        "canal": "facebook",
        "n": 150
      },
      {
        "linea": "5215610584485",
        "n": 15
      },
      {
        "linea": "51984429504",
        "n": 2
      },
      {
        "linea": "593969185042",
        "n": 1
      }
    ]
  },
  calientesSinDuena: {
    "total": 53,
    "porLinea": [
      {
        "linea": null,
        "canal": "facebook",
        "n": 41
      },
      {
        "linea": "5215610584485",
        "n": 5
      },
      {
        "linea": null,
        "canal": "instagram",
        "n": 4
      },
      {
        "linea": "593992073457",
        "n": 3
      }
    ]
  },
  personas: [
    {
      "vendedora": "nicole",
      "nombre": null,
      "lineas": [
        "51984429504",
        "5215610584485",
        "593992073457"
      ],
      "asignadas": 216,
      "contestadas": 40,
      "primeraRespuesta": {
        "medianaMin": 2.5,
        "sobre": 24,
        "de": 31
      },
      "ventas": 1
    }
  ],
  sinAtribuir: [
    {
      "linea": "5215610584485",
      "contestadas": 58
    }
  ],
};

/** El comando de campaña (medido como `centurion:usuario4`, supervisor): su línea, sin calientes ni ventas. */
export const HOY_CAMPANA: DatosHoy = {
  inicioDeHoy: medianocheLocal(),
  generadoEn: new Date().toISOString(),
  supervisor: true,
  modulo: "campana",
  lineas: [
    {
      "numero": "51963139984",
      "etiqueta": "Betto",
      "clase": "compartida",
      "personas": [
        "centurion:angie",
        "centurion:betto.romero",
        "centurion:job",
        "centurion:job.meneses",
        "centurion:usuario1",
        "centurion:usuario10",
        "centurion:usuario11",
        "centurion:usuario12",
        "centurion:usuario13",
        "centurion:usuario14",
        "centurion:usuario2",
        "centurion:usuario3",
        "centurion:usuario4",
        "centurion:usuario5",
        "centurion:usuario6",
        "centurion:usuario7",
        "centurion:usuario8",
        "centurion:usuario9",
        "usuario1"
      ]
    }
  ],
  escribieron: {
    "total": 30,
    "porLinea": [
      {
        "linea": "51963139984",
        "n": 27
      },
      {
        "linea": null,
        "canal": "facebook",
        "n": 3
      }
    ]
  },
  sinRespuesta: {
    "total": 214,
    "porDuena": [
      {
        "duena": null,
        "n": 133
      },
      {
        "duena": "centurion:usuario14",
        "n": 25
      },
      {
        "duena": "centurion:usuario4",
        "n": 16
      },
      {
        "duena": "centurion:usuario7",
        "n": 13
      },
      {
        "duena": "centurion:usuario8",
        "n": 11
      },
      {
        "duena": "centurion:usuario9",
        "n": 9
      },
      {
        "duena": "centurion:usuario3",
        "n": 5
      },
      {
        "duena": "centurion:job",
        "n": 2
      }
    ],
    "porLinea": [
      {
        "linea": null,
        "canal": "facebook",
        "n": 109
      },
      {
        "linea": "51963139984",
        "n": 105
      }
    ]
  },
  calientesSinDuena: null,
  personas: [
    {
      "vendedora": "centurion:angie",
      "nombre": "Angie",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:betto.romero",
      "nombre": "Betto Barrionuevo Romero",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:job",
      "nombre": "Job",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 2,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:job.meneses",
      "nombre": "Job Meneses",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario1",
      "nombre": "Andrea",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 1,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario10",
      "nombre": "Agente 10",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario11",
      "nombre": "Agente 11",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario12",
      "nombre": "Agente 12",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario13",
      "nombre": "Agente 13",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario14",
      "nombre": "David",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 85,
      "contestadas": 2,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario2",
      "nombre": "Agente 2",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario3",
      "nombre": "Cristofer",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 7,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario4",
      "nombre": "Cristian",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 52,
      "contestadas": 10,
      "primeraRespuesta": {
        "medianaMin": 40.9,
        "sobre": 9,
        "de": 9
      },
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario5",
      "nombre": "Agente 5",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario6",
      "nombre": "Agente 6",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario7",
      "nombre": "Diana Elizabeth",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 50,
      "contestadas": 3,
      "primeraRespuesta": {
        "medianaMin": 16.5,
        "sobre": 1,
        "de": 1
      },
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario8",
      "nombre": "Erick",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 40,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    },
    {
      "vendedora": "centurion:usuario9",
      "nombre": "Omar",
      "lineas": [
        "51963139984"
      ],
      "asignadas": 34,
      "contestadas": 14,
      "primeraRespuesta": {
        "medianaMin": 29.3,
        "sobre": 14,
        "de": 14
      },
      "ventas": null
    },
    {
      "vendedora": "usuario1",
      "nombre": null,
      "lineas": [
        "51963139984"
      ],
      "asignadas": 0,
      "contestadas": 0,
      "primeraRespuesta": null,
      "ventas": null
    }
  ],
  sinAtribuir: [
    {
      "linea": null,
      "contestadas": 9
    }
  ],
};

/**
 * Una vendedora recién llegada: sin líneas, sin asignadas, sin nada que medir. Es el
 * único caso sintético, y a propósito: el vacío también tiene que decir su motivo.
 */
export const HOY_VACIO: DatosHoy = {
  inicioDeHoy: medianocheLocal(),
  generadoEn: new Date().toISOString(),
  supervisor: false,
  modulo: 'ventas',
  lineas: [],
  escribieron: { total: 0, porLinea: [] },
  sinRespuesta: { total: 0, porDuena: [], porLinea: [] },
  calientesSinDuena: { total: 0, porLinea: [] },
  personas: [],
  sinAtribuir: [],
};

/** Los últimos 14 días, medidos sobre el mismo dump (`consultarSeriesDashboard`). */
export const SERIES_14: DatosSeries = {
  "leads_dia": [
    {
      "dia": "2026-08-28",
      "chats": 12,
      "comentarios": 41,
      "formularios": 2
    },
    {
      "dia": "2026-08-29",
      "chats": 75,
      "comentarios": 46,
      "formularios": 3
    },
    {
      "dia": "2026-08-30",
      "chats": 5,
      "comentarios": 40,
      "formularios": 4
    },
    {
      "dia": "2026-08-31",
      "chats": 13,
      "comentarios": 50,
      "formularios": 1
    },
    {
      "dia": "2026-09-01",
      "chats": 14,
      "comentarios": 40,
      "formularios": 3
    },
    {
      "dia": "2026-09-02",
      "chats": 230,
      "comentarios": 14,
      "formularios": 1
    },
    {
      "dia": "2026-09-03",
      "chats": 306,
      "comentarios": 19,
      "formularios": 0
    },
    {
      "dia": "2026-09-04",
      "chats": 231,
      "comentarios": 39,
      "formularios": 13
    },
    {
      "dia": "2026-09-05",
      "chats": 242,
      "comentarios": 36,
      "formularios": 18
    },
    {
      "dia": "2026-09-06",
      "chats": 351,
      "comentarios": 26,
      "formularios": 11
    },
    {
      "dia": "2026-09-07",
      "chats": 513,
      "comentarios": 38,
      "formularios": 12
    },
    {
      "dia": "2026-09-08",
      "chats": 488,
      "comentarios": 35,
      "formularios": 16
    },
    {
      "dia": "2026-09-09",
      "chats": 558,
      "comentarios": 39,
      "formularios": 26
    },
    {
      "dia": "2026-09-10",
      "chats": 30,
      "comentarios": 0,
      "formularios": 0
    }
  ],
  "envios_dia": [
    {
      "dia": "2026-08-28",
      "n": 1
    },
    {
      "dia": "2026-08-29",
      "n": 149
    },
    {
      "dia": "2026-08-30",
      "n": 0
    },
    {
      "dia": "2026-08-31",
      "n": 6
    },
    {
      "dia": "2026-09-01",
      "n": 3
    },
    {
      "dia": "2026-09-02",
      "n": 0
    },
    {
      "dia": "2026-09-03",
      "n": 17
    },
    {
      "dia": "2026-09-04",
      "n": 35
    },
    {
      "dia": "2026-09-05",
      "n": 0
    },
    {
      "dia": "2026-09-06",
      "n": 0
    },
    {
      "dia": "2026-09-07",
      "n": 835
    },
    {
      "dia": "2026-09-08",
      "n": 2232
    },
    {
      "dia": "2026-09-09",
      "n": 2609
    },
    {
      "dia": "2026-09-10",
      "n": 0
    }
  ],
  "ventas_dia": [
    {
      "dia": "2026-08-28",
      "n": 8
    },
    {
      "dia": "2026-08-29",
      "n": 3
    },
    {
      "dia": "2026-08-30",
      "n": 1
    },
    {
      "dia": "2026-08-31",
      "n": 9
    },
    {
      "dia": "2026-09-01",
      "n": 8
    },
    {
      "dia": "2026-09-02",
      "n": 7
    },
    {
      "dia": "2026-09-03",
      "n": 8
    },
    {
      "dia": "2026-09-04",
      "n": 8
    },
    {
      "dia": "2026-09-05",
      "n": 1
    },
    {
      "dia": "2026-09-06",
      "n": 0
    },
    {
      "dia": "2026-09-07",
      "n": 6
    },
    {
      "dia": "2026-09-08",
      "n": 25
    },
    {
      "dia": "2026-09-09",
      "n": 14
    },
    {
      "dia": "2026-09-10",
      "n": 0
    }
  ]
};
