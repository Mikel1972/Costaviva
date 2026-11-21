// functions/_lib/relaciones-vecinos-datos.js — lo escribe el robot de las
// cámaras (scripts/oleaje-camaras/medir-espuma.mjs, escribirRelaciones):
// cociente histórico orilla A / orilla B entre cámaras cercanas, por tamaño
// de mar. Lo usa la regla de vecinos (coherencia-vecinos.js). No editar a mano.
export default {
 "generado": "2026-11-21T10:39:30.004Z",
 "radioKm": 40,
 "nMin": 8,
 "pares": {
  "bakio|castrourdiales": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 16
   }
  },
  "bakio|deba": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 8
   }
  },
  "berria|castrourdiales": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 59
   },
   "grande": {
    "log": 0.693,
    "mad": 0.693,
    "n": 13
   },
   "medio": {
    "log": 0.916,
    "mad": 0,
    "n": 9
   }
  },
  "berria|sopelana": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 11
   },
   "grande": {
    "log": 0,
    "mad": 0.693,
    "n": 13
   },
   "medio": {
    "log": 0,
    "mad": 0.916,
    "n": 27
   }
  },
  "castrourdiales|sopelana": {
   "pequeno": {
    "log": -0.693,
    "mad": 0.223,
    "n": 19
   },
   "grande": {
    "log": -0.916,
    "mad": 0.458,
    "n": 14
   }
  },
  "deba|donostia": {
   "grande": {
    "log": 0,
    "mad": 0,
    "n": 12
   }
  },
  "deba|getaria": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 8
   }
  },
  "deba|orio": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 18
   }
  },
  "deba|zarautz": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 43
   },
   "medio": {
    "log": 0,
    "mad": 0,
    "n": 22
   },
   "grande": {
    "log": 0,
    "mad": 0.693,
    "n": 24
   }
  },
  "deba|zumaia": {
   "medio": {
    "log": 0,
    "mad": 0.916,
    "n": 15
   },
   "grande": {
    "log": 0,
    "mad": 0.693,
    "n": 15
   }
  },
  "donostia|hondarribia": {
   "medio": {
    "log": 0,
    "mad": 0,
    "n": 15
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 12
   }
  },
  "donostia|zarautz": {
   "medio": {
    "log": 0,
    "mad": 0.916,
    "n": 13
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 14
   }
  },
  "getaria|hondarribia": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 17
   }
  },
  "getaria|orio": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 9
   }
  },
  "getaria|zarautz": {
   "medio": {
    "log": -0.916,
    "mad": 0,
    "n": 9
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 17
   }
  },
  "hondarribia|orio": {
   "medio": {
    "log": 0,
    "mad": 0,
    "n": 29
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 45
   },
   "grande": {
    "log": -0.916,
    "mad": 0,
    "n": 10
   }
  },
  "hondarribia|zarautz": {
   "medio": {
    "log": -0.916,
    "mad": 0,
    "n": 114
   },
   "grande": {
    "log": -0.916,
    "mad": 0,
    "n": 59
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 136
   }
  },
  "hondarribia|zumaia": {
   "medio": {
    "log": -0.916,
    "mad": 0,
    "n": 20
   },
   "grande": {
    "log": -0.916,
    "mad": 0,
    "n": 27
   }
  },
  "orio|zarautz": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 20
   }
  },
  "zarautz|zumaia": {
   "medio": {
    "log": 0,
    "mad": 0,
    "n": 24
   },
   "grande": {
    "log": 0,
    "mad": 0,
    "n": 22
   }
  }
 }
};
