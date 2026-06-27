// ============================================================
// Biblia en un Año · Asociación San Juan Apóstol — Conexión a Firebase
// ============================================================
// Este archivo es un MÓDULO (type="module"), porque el SDK de Firebase
// se distribuye como módulos ES. Si el import de más abajo falla por
// cualquier motivo (sin red, CORS, bloqueo, etc.), este archivo entero
// no ejecuta ninguna línea — por diseño de los módulos ES. Por eso toda
// la interfaz vive en app-shell.js (script clásico), que sigue
// funcionando aunque este archivo no llegue a cargar. Acá solo se
// implementa window.BibliaBackend con la conexión real a Firestore.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIrtATxUSVv6W65sbSJUNQZ3ZBOnjZD4s",
  authDomain: "biblia-asja-4aea4.firebaseapp.com",
  projectId: "biblia-asja-4aea4",
  storageBucket: "biblia-asja-4aea4.firebasestorage.app",
  messagingSenderId: "761938941434",
  appId: "1:761938941434:web:535acdd7499e82c5044043"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// Pedirle al navegador que NO borre automáticamente nuestros datos
// guardados localmente (importante sobre todo en iPhone/Safari, donde
// el sistema puede limpiar este tipo de almacenamiento si no se pide
// explícitamente que sea persistente). No hay garantía de que se
// conceda, pero reduce mucho la probabilidad de que se pierda el
// progreso guardado para uso offline.
if(navigator.storage && navigator.storage.persist){
  navigator.storage.persist().then(function(granted){
    window.__STORAGE_PERSIST_GRANTED__ = granted;
  }).catch(function(){
    window.__STORAGE_PERSIST_GRANTED__ = 'error';
  });
}

window.__FIRESTORE_PERSISTENCE_STATUS__ = 'pendiente';
enableIndexedDbPersistence(db).then(function(){
  window.__FIRESTORE_PERSISTENCE_STATUS__ = 'habilitada';
}).catch(function(err){
  window.__FIRESTORE_PERSISTENCE_STATUS__ = 'FALLÓ: ' + (err && err.code ? err.code : err);
  console.warn('No se pudo habilitar persistencia offline de Firestore', err);
});

function userDocRef(key){ return doc(db, 'usuarios', key); }

// Envuelve una promesa con un límite de tiempo: si no resuelve ni
// rechaza en ese plazo, se da por "perdida" — evita que la app quede
// esperando para siempre si Firestore se cuelga sin red.
function withTimeout(promise, ms){
  return new Promise(function(resolve, reject){
    var timer = setTimeout(function(){ reject(new Error('Tiempo de espera agotado')); }, ms);
    promise.then(function(v){ clearTimeout(timer); resolve(v); },
                 function(e){ clearTimeout(timer); reject(e); });
  });
}

window.BibliaBackend = {
  ready: true,

  loadProgress: async function(userKey){
    try {
      var snap = await withTimeout(getDoc(userDocRef(userKey)), 6000);
      if(snap.exists()){
        return { exists: true, data: snap.data(), error: null };
      }
      return { exists: false, data: null, error: null };
    } catch(e){
      console.error('Error cargando progreso de Firestore', e);
      return { exists: false, data: null, error: e.message || 'error' };
    }
  },

  saveProgress: async function(userKey, fields, opts){
    opts = opts || {};
    try {
      var payload = {};
      if(fields.email !== undefined) payload.email = fields.email;
      if(fields.diasCompletados !== undefined) payload.diasCompletados = fields.diasCompletados;
      if(fields.fechasCompletadas !== undefined) payload.fechasCompletadas = fields.fechasCompletadas;
      if(fields.ultimoDia !== undefined) payload.ultimoDia = fields.ultimoDia;
      if(opts.isCreate){
        payload.creadoEn = serverTimestamp();
      }
      if(!opts.onlyDay){
        payload.ultimaActividad = serverTimestamp();
      }
      await setDoc(userDocRef(userKey), payload, { merge: true });
      return { ok: true, error: null };
    } catch(e){
      console.error('Error guardando en Firestore', e);
      return { ok: false, error: e.message || 'error' };
    }
  }
};

// Avisarle al cascarón (app-shell.js) que el backend real ya está listo,
// por si necesita reintentar algo que se hizo en modo "sin backend".
window.dispatchEvent(new CustomEvent('biblia-backend-ready'));
