// ============================================================
// Biblia en un Año · ASJA — Panel de coordinador
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs
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

// ------------------------------------------------------------------
// IMPORTANTE sobre esta "contraseña":
// Es una traba simple para que un visitante casual no entre por
// accidente al panel. NO es seguridad real: cualquiera que vea el
// código fuente del archivo puede leerla. La protección de fondo
// (que nadie pueda ALTERAR datos de otros) la dan las reglas de
// Firestore, no esta contraseña. Cambiala editando la línea siguiente.
// ------------------------------------------------------------------
const COORD_PASSWORD = "asja2026";

(function(){
  "use strict";

  var allUsers = [];
  var sortKey = 'pct';
  var sortDir = 'desc';
  var searchTerm = '';
  var statusFilter = 'all';

  // ---- Login ----
  var loginScreen = document.getElementById('loginScreen');
  var dashScreen  = document.getElementById('dashScreen');
  var pwInput     = document.getElementById('pwInput');
  var loginBtn    = document.getElementById('loginBtn');
  var loginError  = document.getElementById('loginError');

  function tryLogin(){
    if(pwInput.value === COORD_PASSWORD){
      sessionStorage.setItem('coordAuth','1');
      showDashboard();
    } else {
      loginError.style.display='block';
    }
  }
  loginBtn.addEventListener('click', tryLogin);
  pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });

  document.getElementById('logoutBtn').addEventListener('click', function(){
    sessionStorage.removeItem('coordAuth');
    dashScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    pwInput.value='';
  });

  function showDashboard(){
    loginScreen.classList.add('hidden');
    dashScreen.classList.remove('hidden');
    loadUsers();
  }

  if(sessionStorage.getItem('coordAuth')==='1'){
    showDashboard();
  }

  // ---- Cargar usuarios desde Firestore ----
  async function loadUsers(){
    document.getElementById('tableBody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:40px;color:#6C757D;">Cargando datos…</td></tr>';
    try {
      var snap = await getDocs(collection(db, 'usuarios'));
      allUsers = [];
      snap.forEach(function(docSnap){
        var d = docSnap.data();
        var dias = d.diasCompletados || {};
        var doneCount = Object.keys(dias).length;
        var maxDay = 0;
        Object.keys(dias).forEach(function(k){ var n=parseInt(k,10); if(n>maxDay) maxDay=n; });
        var streak = 0;
        for(var x=maxDay; x>=1; x--){ if(dias[String(x)]) streak++; else break; }
        var lastTs = d.ultimaActividad ? d.ultimaActividad.toDate() : null;
        allUsers.push({
          id: docSnap.id,
          nombre: d.nombre || docSnap.id,
          done: doneCount,
          pct: Math.round((doneCount/365)*100),
          streak: streak,
          lastActive: lastTs
        });
      });
      renderStats();
      renderTable();
    } catch(e){
      console.error(e);
      document.getElementById('tableBody').innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:40px;color:#B42318;">Error al cargar los datos. Revisá la consola.</td></tr>';
    }
  }

  document.getElementById('refreshBtn').addEventListener('click', loadUsers);

  // ---- Stats header ----
  function daysSince(date){
    if(!date) return Infinity;
    return (Date.now() - date.getTime()) / (1000*60*60*24);
  }

  function renderStats(){
    var total = allUsers.length;
    var activeToday = allUsers.filter(function(u){ return daysSince(u.lastActive) <= 1; }).length;
    var avgPct = total ? Math.round(allUsers.reduce(function(s,u){ return s+u.pct; },0)/total) : 0;
    var completed = allUsers.filter(function(u){ return u.done >= 365; }).length;

    document.getElementById('dashTotalUsers').textContent = total;
    document.getElementById('dashActiveToday').textContent = activeToday;
    document.getElementById('dashAvgPct').textContent = avgPct + '%';
    document.getElementById('dashCompleted').textContent = completed;
  }

  // ---- Table ----
  function statusOf(u){
    var d = daysSince(u.lastActive);
    if(d <= 2) return 'active';
    if(d <= 7) return 'stale';
    return 'inactive';
  }

  function formatDate(date){
    if(!date) return '—';
    return date.toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'numeric'}) +
           ' ' + date.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  }

  function renderTable(){
    var rows = allUsers.slice();

    if(searchTerm.trim()){
      var t = searchTerm.trim().toLowerCase();
      rows = rows.filter(function(u){ return u.nombre.toLowerCase().indexOf(t) !== -1; });
    }
    if(statusFilter !== 'all'){
      rows = rows.filter(function(u){ return statusOf(u) === statusFilter; });
    }

    rows.sort(function(a,b){
      var av = a[sortKey], bv = b[sortKey];
      if(sortKey === 'nombre'){ av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if(sortKey === 'lastActive'){ av = av ? av.getTime() : 0; bv = bv ? bv.getTime() : 0; }
      if(av < bv) return sortDir === 'asc' ? -1 : 1;
      if(av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    document.getElementById('resultCount').textContent =
      rows.length + (rows.length===1 ? ' persona' : ' personas');

    if(!rows.length){
      document.getElementById('tableBody').innerHTML =
        '<tr><td colspan="6"><div class="empty-dash">No se encontraron usuarios con estos filtros.</div></td></tr>';
      return;
    }

    document.getElementById('tableBody').innerHTML = rows.map(function(u){
      var st = statusOf(u);
      var stLabel = st==='active' ? 'Activo' : st==='stale' ? 'Inactivo (semana)' : 'Inactivo';
      return '<tr>'
        +'<td class="u-name">'+escapeHtml(u.nombre)+'</td>'
        +'<td><div class="u-bar-wrap"><div class="u-bar"><div class="u-bar-fill" style="width:'+u.pct+'%"></div></div><span class="u-pct">'+u.pct+'%</span></div></td>'
        +'<td>'+u.done+' / 365</td>'
        +'<td>'+u.streak+(u.streak===1?' día':' días')+'</td>'
        +'<td><span class="u-badge '+st+'">'+stLabel+'</span></td>'
        +'<td>'+formatDate(u.lastActive)+'</td>'
        +'</tr>';
    }).join('');
  }

  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  // ---- Sorting ----
  document.querySelectorAll('th[data-sort]').forEach(function(th){
    th.addEventListener('click', function(){
      var key = th.getAttribute('data-sort');
      if(sortKey === key){ sortDir = sortDir==='asc' ? 'desc' : 'asc'; }
      else { sortKey = key; sortDir = key==='nombre' ? 'asc' : 'desc'; }
      document.querySelectorAll('th[data-sort] .arrow').forEach(function(a){ a.textContent=''; });
      th.querySelector('.arrow').textContent = sortDir==='asc' ? '▲' : '▼';
      renderTable();
    });
  });

  // ---- Search & filter ----
  document.getElementById('searchInput').addEventListener('input', function(e){
    searchTerm = e.target.value; renderTable();
  });
  document.getElementById('statusFilter').addEventListener('change', function(e){
    statusFilter = e.target.value; renderTable();
  });

  // ---- Export CSV ----
  document.getElementById('exportBtn').addEventListener('click', function(){
    var rows = [['Nombre','Días leídos','Porcentaje','Racha','Última actividad']];
    allUsers.forEach(function(u){
      rows.push([u.nombre, u.done, u.pct+'%', u.streak, formatDate(u.lastActive)]);
    });
    var csv = rows.map(function(r){
      return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(',');
    }).join('\n');
    var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'biblia365_progreso_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

})();
