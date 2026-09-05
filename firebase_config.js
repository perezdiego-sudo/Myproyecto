// Configuración de conexión a Firebase (Firestore)
// Este archivo NO contiene datos sensibles del negocio, solo la conexión al proyecto.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5iP0E5BVu0XX0bclE-0j1ym24GRbYDNQ",
  authDomain: "quimiaseo-caribe.firebaseapp.com",
  projectId: "quimiaseo-caribe",
  storageBucket: "quimiaseo-caribe.firebasestorage.app",
  messagingSenderId: "673921871746",
  appId: "1:673921871746:web:7b2203db138de8edf0a99b"
};

// Inicializa Firebase y la base de datos Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);