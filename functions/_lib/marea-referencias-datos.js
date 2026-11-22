// functions/_lib/marea-referencias-datos.js
// Nivel medio del mar de cada mareógrafo REDMAR de Puertos del Estado sobre
// el cero de las tablas de marea (2026-11-21). Fuente: Puertos del Estado,
// PORTUS (https://portus.puertos.es/), "Ceros - Referencias > Esquema Datum"
// de cada estación, leídos uno a uno por Mikel. Autorización escrita de
// Puertos del Estado del 2026-11-20 (Samuel Galán): uso de predicciones y
// valores de referencia de PORTUS con la mención «Fuente: Puertos del
// Estado» y enlace a PORTUS; sin redistribuirlos como propios.
// nmm = nivel medio (año anio_nmm) sobre el cero hidrográfico si el esquema
// lo da (cero: "hidrografico"); si no, sobre el Cero REDMAR = Cero del
// Puerto (cero: "puerto"). Sagunto fuera: su cero no es el del puerto.
// Coordenadas: lista de estaciones de PSMSL (psmsl.org), salvo San Cibrao y
// Carboneras (OpenStreetMap). Solo para elegir el mareógrafo más cercano.
export default [
 {
  "nombre": "Pasaia",
  "estacion": "Pasaia",
  "lat": 43.322,
  "lon": -1.932,
  "nmm": 2.896,
  "cero": "puerto",
  "anio": 2019
 },
 {
  "nombre": "Bilbao",
  "estacion": "Bilbao3",
  "lat": 43.352,
  "lon": -3.045,
  "nmm": 2.429,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Santander",
  "estacion": "Santander2",
  "lat": 43.461,
  "lon": -3.791,
  "nmm": 2.446,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Gijón",
  "estacion": "Gijon2",
  "lat": 43.558,
  "lon": -5.698,
  "nmm": 2.384,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "San Cibrao",
  "estacion": "San Cibrao",
  "lat": 43.72,
  "lon": -7.473,
  "nmm": 2.243,
  "cero": "hidrografico",
  "anio": 2019
 },
 {
  "nombre": "Ferrol",
  "estacion": "Ferrol2",
  "lat": 43.476,
  "lon": -8.249,
  "nmm": 2.222,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "A Coruña",
  "estacion": "Coruña2",
  "lat": 43.357,
  "lon": -8.389,
  "nmm": 2.201,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Langosteira",
  "estacion": "Langosteira2",
  "lat": 43.347,
  "lon": -8.53,
  "nmm": 2.269,
  "cero": "hidrografico",
  "anio": 2023
 },
 {
  "nombre": "Vilagarcía",
  "estacion": "Villagarcia2",
  "lat": 42.601,
  "lon": -8.77,
  "nmm": 2.092,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Marín",
  "estacion": "Marin",
  "lat": 42.406,
  "lon": -8.691,
  "nmm": 2.013,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Huelva (Mazagón)",
  "estacion": "Huelva5 (Mazagón)",
  "lat": 37.132,
  "lon": -6.834,
  "nmm": 1.946,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Bonanza",
  "estacion": "Bonanza2",
  "lat": 36.802,
  "lon": -6.338,
  "nmm": 1.516,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Tarifa",
  "estacion": "Tarifa",
  "lat": 36.006,
  "lon": -5.604,
  "nmm": 0.829,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Algeciras",
  "estacion": "Algeciras",
  "lat": 36.177,
  "lon": -5.398,
  "nmm": 0.689,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Málaga",
  "estacion": "Malaga3",
  "lat": 36.712,
  "lon": -4.417,
  "nmm": 0.643,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Almería",
  "estacion": "Almeria",
  "lat": 36.83,
  "lon": -2.478,
  "nmm": 0.442,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Carboneras",
  "estacion": "Carboneras",
  "lat": 36.997,
  "lon": -1.895,
  "nmm": 0.136,
  "cero": "puerto",
  "anio": 2014
 },
 {
  "nombre": "Gandía",
  "estacion": "Gandia",
  "lat": 38.995,
  "lon": -0.151,
  "nmm": 0.008,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Valencia",
  "estacion": "Valencia3",
  "lat": 39.442,
  "lon": -0.311,
  "nmm": 0.503,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Tarragona",
  "estacion": "Tarragona",
  "lat": 41.079,
  "lon": 1.213,
  "nmm": 0.155,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Barcelona",
  "estacion": "Barcelona2",
  "lat": 41.342,
  "lon": 2.166,
  "nmm": 0.375,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Maó",
  "estacion": "Mahon",
  "lat": 39.893,
  "lon": 4.271,
  "nmm": -0.038,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Alcúdia",
  "estacion": "Alcudia",
  "lat": 39.835,
  "lon": 3.139,
  "nmm": 0.43,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Palma",
  "estacion": "Mallorca (Palma)",
  "lat": 39.56,
  "lon": 2.637,
  "nmm": -0.107,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Eivissa",
  "estacion": "Ibiza2",
  "lat": 38.911,
  "lon": 1.45,
  "nmm": 0.42,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Formentera",
  "estacion": "Formentera",
  "lat": 38.735,
  "lon": 1.419,
  "nmm": 0.345,
  "cero": "puerto",
  "anio": 2011
 },
 {
  "nombre": "Vigo",
  "estacion": "Vigo2",
  "lat": 42.243,
  "lon": -8.726,
  "nmm": 2.038,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Arrecife",
  "estacion": "Arrecife",
  "lat": 28.972,
  "lon": -13.53,
  "nmm": 1.624,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Puerto del Rosario",
  "estacion": "Fuerteventura2 (Puerto del Rosario)",
  "lat": 28.497,
  "lon": -13.859,
  "nmm": 1.549,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Las Palmas",
  "estacion": "Las Palmas2",
  "lat": 28.141,
  "lon": -15.412,
  "nmm": 1.416,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "La Palma",
  "estacion": "La Palma",
  "lat": 28.678,
  "lon": -17.768,
  "nmm": 1.249,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "Santa Cruz de Tenerife",
  "estacion": "Tenerife2 (Santa Cruz)",
  "lat": 28.477,
  "lon": -16.241,
  "nmm": 1.365,
  "cero": "hidrografico",
  "anio": 2011
 },
 {
  "nombre": "La Gomera",
  "estacion": "La Gomera",
  "lat": 28.088,
  "lon": -17.108,
  "nmm": 1.17,
  "cero": "hidrografico",
  "anio": 2011
 }
];
