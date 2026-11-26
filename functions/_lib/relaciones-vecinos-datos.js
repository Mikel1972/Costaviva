// functions/_lib/relaciones-vecinos-datos.js — lo escribe el robot de las
// cámaras (scripts/oleaje-camaras/medir-espuma.mjs, escribirRelaciones):
// cociente histórico orilla A / orilla B entre cámaras cercanas, por tamaño
// de mar. Lo usa la regla de vecinos (coherencia-vecinos.js). No editar a mano.
export default {
 "generado": "2026-11-26T21:07:23.255Z",
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
   },
   "medio": {
    "log": -0.458,
    "mad": 0.458,
    "n": 8
   }
  },
  "bakio|sopelana": {
   "medio": {
    "log": 0,
    "mad": 0.347,
    "n": 12
   }
  },
  "berria|castrourdiales": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 64
   },
   "grande": {
    "log": 0.805,
    "mad": 0.805,
    "n": 16
   },
   "medio": {
    "log": 0.916,
    "mad": 0,
    "n": 16
   }
  },
  "berria|sopelana": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 17
   },
   "grande": {
    "log": 0,
    "mad": 0.347,
    "n": 14
   },
   "medio": {
    "log": 0,
    "mad": 0.916,
    "n": 42
   }
  },
  "castrourdiales|sopelana": {
   "pequeno": {
    "log": -0.693,
    "mad": 0.223,
    "n": 22
   },
   "grande": {
    "log": -0.916,
    "mad": 0.458,
    "n": 14
   },
   "medio": {
    "log": -0.916,
    "mad": 0,
    "n": 8
   }
  },
  "deba|donostia": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 9
   },
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
    "n": 46
   },
   "medio": {
    "log": 0,
    "mad": 0,
    "n": 47
   },
   "grande": {
    "log": 0,
    "mad": 0.693,
    "n": 28
   }
  },
  "deba|zumaia": {
   "medio": {
    "log": 0,
    "mad": 0.916,
    "n": 17
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
    "n": 16
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
    "n": 15
   }
  },
  "getaria|hondarribia": {
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 20
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
    "n": 10
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 20
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
    "n": 161
   },
   "grande": {
    "log": -0.916,
    "mad": 0,
    "n": 89
   },
   "pequeno": {
    "log": 0,
    "mad": 0,
    "n": 159
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
    "n": 36
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
    "n": 29
   },
   "grande": {
    "log": 0,
    "mad": 0,
    "n": 24
   }
  }
 }
};
