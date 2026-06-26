// ============================================================
// Biblia en un Año · Asociación San Juan Apóstol — Cascarón de la app
// ============================================================
// IMPORTANTE: este archivo es un script CLÁSICO (no type="module"),
// a propósito. Si app-firebase.js (que sí es un módulo y depende de
// imports desde gstatic.com) falla al cargar por cualquier motivo —
// sobre todo sin conexión — un módulo ES roto no ejecuta NINGUNA línea,
// ni siquiera código que esté antes del import en el archivo. Por eso
// toda la interfaz (mostrar el día, las lecturas, navegar, etc.) vive
// acá, en un script normal que SIEMPRE se ejecuta, conectado a Firebase
// solo a través de la capa window.BibliaBackend definida más abajo.

(function(){
  "use strict";

  var PLAN = JSON.parse(document.getElementById('plan-data').textContent);
  var DAYS = PLAN.days;
  var PERIOD_ORDER = PLAN.period_order;

  var userKey = null, userEmail = "", progress = {}, completedDates = {};
  var currentDay = 1;

  // ---------------------------------------------------------------
  // Capa de backend: por defecto, un "stub" que no hace nada remoto.
  // Si app-firebase.js carga bien, sobreescribe window.BibliaBackend
  // con la versión real conectada a Firestore. Si no carga (sin red,
  // error de import, etc.), esta versión de respaldo permite que la
  // app siga totalmente usable, solo sin sincronización en la nube.
  // ---------------------------------------------------------------
  window.BibliaBackend = window.BibliaBackend || {
    ready: false,
    loadProgress: async function(){
      return { exists: false, data: null, error: 'backend-no-disponible' };
    },
    saveProgress: async function(){
      return { ok: false, error: 'backend-no-disponible' };
    }
  };

  function isValidEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function slugifyEmail(email){
    return email.trim().toLowerCase()
      .replace(/[^a-z0-9@._-]+/g,'')
      .replace(/[@.]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,100) || 'lector';
  }

  function clampDay(n){
    n = parseInt(n,10);
    if(isNaN(n)) return 1;
    return Math.max(1, Math.min(365, n));
  }

  function setSavedTag(text){
    var el = document.getElementById('savedTag');
    if(el) el.textContent = text;
  }

  var saveTimer = null, dayTimer = null;

  function saveProgress(){
    if(!userKey) return;
    setSavedTag('Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function(){
      window.BibliaBackend.saveProgress(userKey, {
        email: userEmail.trim(),
        diasCompletados: progress,
        fechasCompletadas: completedDates,
        ultimoDia: currentDay
      }).then(function(res){
        setSavedTag(res && res.ok ? 'Guardado ✓' : 'Sin conexión — se guardará al volver');
      });
    }, 350);
  }

  function saveCurrentDay(){
    if(!userKey) return;
    clearTimeout(dayTimer);
    dayTimer = setTimeout(function(){
      window.BibliaBackend.saveProgress(userKey, { ultimoDia: currentDay }, { onlyDay: true });
    }, 350);
  }

  async function loadProgressFor(email){
    var trimmed = email.trim();
    userEmail = trimmed;
    userKey = trimmed ? slugifyEmail(trimmed) : null;
    var avatarEl = document.getElementById('avatarInitial');
    if(avatarEl) avatarEl.textContent = trimmed ? trimmed[0].toUpperCase() : '?';
    setSavedTag('');

    if(!trimmed){
      progress = {}; completedDates = {}; currentDay = 1;
      rememberEmailOnThisDevice('');
      renderAll(); setSavedTag('');
      return;
    }

    if(!isValidEmail(trimmed)){
      setSavedTag('Mail inválido');
      progress = {}; completedDates = {}; currentDay = 1;
      renderAll();
      return;
    }

    rememberEmailOnThisDevice(trimmed);
    setSavedTag('Cargando…');

    var result = await window.BibliaBackend.loadProgress(userKey);
    if(result.exists){
      progress = result.data.diasCompletados || {};
      completedDates = result.data.fechasCompletadas || {};
      currentDay = clampDay(result.data.ultimoDia || 1);
      setSavedTag('Sincronizado');
    } else if(result.error){
      progress = {}; completedDates = {}; currentDay = 1;
      setSavedTag('Sin conexión — guardando local');
    } else {
      // no existe el documento todavía: lo creamos
      progress = {}; completedDates = {}; currentDay = 1;
      await window.BibliaBackend.saveProgress(userKey, {
        email: trimmed, diasCompletados: {}, fechasCompletadas: {}, ultimoDia: 1
      }, { isCreate: true });
      setSavedTag('Sincronizado');
    }
    renderAll();
  }

  // ---- Registro de fechas con actividad (para la racha por calendario) ----
  function todayKey(){
    var d = new Date();
    return formatDateKey(d);
  }

  function markTodayCompletedIfNeeded(dayNum){
    if(isDone(dayNum)){
      completedDates[todayKey()] = true;
    }
  }

  function computeCalendarStreak(){
    var dates = Object.keys(completedDates).filter(function(k){ return completedDates[k]; });
    if(!dates.length) return 0;
    dates.sort();
    var mostRecent = dates[dates.length-1];
    var mostRecentDate = parseDateKey(mostRecent);
    var today = parseDateKey(todayKey());
    var diffDaysFromToday = Math.round((today - mostRecentDate) / 86400000);
    if(diffDaysFromToday > 1) return 0;

    var streak = 0;
    var cursor = mostRecentDate;
    var dateSet = {};
    dates.forEach(function(k){ dateSet[k] = true; });
    while(dateSet[formatDateKey(cursor)]){
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }

  function parseDateKey(key){
    var parts = key.split('-');
    return new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10));
  }
  function formatDateKey(date){
    var y = date.getFullYear();
    var m = String(date.getMonth()+1).padStart(2,'0');
    var d = String(date.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }

  // ---- Modelo de progreso por lectura individual ----
  function getDayKeys(dayNum){
    var d = getDayData(dayNum);
    var keys = [];
    if(d.l1) keys.push('l1');
    if(d.l2) keys.push('l2');
    if(d.l3) keys.push('l3');
    return keys;
  }

  function isReadingDone(dayNum, key){
    var entry = progress[String(dayNum)];
    if(entry === true) return true;
    return !!(entry && entry[key]);
  }

  function isDone(dayNum){
    var entry = progress[String(dayNum)];
    if(entry === true) return true;
    if(!entry) return false;
    var keys = getDayKeys(dayNum);
    return keys.length>0 && keys.every(function(k){ return !!entry[k]; });
  }

  function toggleReading(dayNum, key){
    var k = String(dayNum);
    var entry = progress[k];
    if(entry === true){
      entry = {};
      getDayKeys(dayNum).forEach(function(kk){ entry[kk]=true; });
    }
    if(!entry) entry = {};
    entry[key] = !entry[key];
    var anyTrue = Object.keys(entry).some(function(kk){ return entry[kk]; });
    if(anyTrue) progress[k] = entry;
    else delete progress[k];
    markTodayCompletedIfNeeded(dayNum);
    saveProgress();
    renderAll();
  }

  function toggleDay(dayNum){
    var k = String(dayNum);
    if(isDone(dayNum)){
      delete progress[k];
    } else {
      var entry = {};
      getDayKeys(dayNum).forEach(function(kk){ entry[kk]=true; });
      progress[k] = entry;
    }
    markTodayCompletedIfNeeded(dayNum);
    saveProgress();
    renderAll();
  }

  // ---- Email input ----
  var LAST_EMAIL_KEY = 'biblia365_last_email';
  var nameInput = document.getElementById('userName');
  nameInput.addEventListener('change', function(){ loadProgressFor(nameInput.value); });
  nameInput.addEventListener('blur',   function(){ loadProgressFor(nameInput.value); });
  nameInput.addEventListener('keydown',function(e){ if(e.key==='Enter') nameInput.blur(); });

  function rememberEmailOnThisDevice(email){
    try {
      if(email && email.trim()) localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      else localStorage.removeItem(LAST_EMAIL_KEY);
    } catch(e){}
  }

  function getRememberedEmail(){
    try { return localStorage.getItem(LAST_EMAIL_KEY) || ''; }
    catch(e){ return ''; }
  }

  // ---- Connection status ----
  function renderConnStatus(){
    var el = document.getElementById('connStatus');
    if(!el) return;
    if(navigator.onLine){
      el.className = 'online';
      el.innerHTML = '<span class="dot"></span> En línea';
    } else {
      el.className = 'offline';
      el.innerHTML = '<span class="dot"></span> Sin conexión';
    }
  }
  window.addEventListener('online', renderConnStatus);
  window.addEventListener('offline', renderConnStatus);

  // ---- Day state ----
  function getDayData(n){ return DAYS[n-1]; }

  function countDoneDays(){
    var n=0;
    for(var i=1;i<=365;i++) if(isDone(i)) n++;
    return n;
  }

  function renderStats(){
    var done=countDoneDays(), pct=Math.round((done/365)*100);
    document.getElementById('statDone').textContent   = done;
    document.getElementById('statRemain').textContent = 365-done;
    document.getElementById('statStreak').textContent = computeCalendarStreak();
    document.getElementById('pctLabel').textContent   = pct;
    var C=238.76;
    document.getElementById('ringFg').style.strokeDashoffset = C - C*pct/100;
  }

  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function renderToday(){
    var d=getDayData(currentDay);
    document.getElementById('dayEyebrow').textContent = 'Día '+d.day+' de 365';
    document.getElementById('dayPeriod').textContent  = d.period;
    var rows=[];
    if(d.l1) rows.push({tag:'Primera lectura', ref:d.l1, key:'l1'});
    if(d.l2) rows.push({tag:'Segunda lectura', ref:d.l2, key:'l2'});
    if(d.l3) rows.push({tag:'Salmo / Proverbios / Cántico', ref:d.l3, key:'l3'});
    document.getElementById('dayReadings').innerHTML = rows.map(function(r){
      var checked = isReadingDone(d.day, r.key);
      return '<div class="read-row '+(checked?'done':'')+'">'
        +'<div class="read-check" data-action="toggle-reading" data-key="'+r.key+'">'
        +'<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        +'</div><div class="read-text"><div class="tag">'+r.tag+'</div><div class="ref">'+r.ref+'</div></div></div>';
    }).join('');
    document.querySelectorAll('#dayReadings [data-action="toggle-reading"]').forEach(function(el){
      el.addEventListener('click', function(){ toggleReading(currentDay, el.getAttribute('data-key')); });
    });
    document.getElementById('prevDay').disabled = currentDay<=1;
    document.getElementById('nextDay').disabled = currentDay>=365;
    document.getElementById('dayJumpInput').value = currentDay;
    renderEncouragement();
  }

  function renderEncouragement(){
    var box=document.getElementById('encourageBox');
    if(!userKey||!userEmail.trim()){
      box.innerHTML='📖 &nbsp;Ingresá tu mail arriba para guardar tu progreso.'; return;
    }
    var streak=computeCalendarStreak(), done=countDoneDays();
    var dayHasAnyProgress = !!progress[String(currentDay)];
    if(done===0 && !dayHasAnyProgress)
      box.innerHTML='🙏 &nbsp;¡Bienvenido/a! Marcá la lectura de hoy cuando la termines.';
    else if(isDone(currentDay))
      box.innerHTML='✅ &nbsp;¡Lectura de hoy completada! Racha: '+streak+(streak===1?' día':' días')+'.';
    else if(dayHasAnyProgress)
      box.innerHTML='📖 &nbsp;Vas a mitad de camino en el día de hoy — ¡terminá la lectura que falta!';
    else
      box.innerHTML='✨ &nbsp;Vas por '+done+' de 365 días. ¡Seguí así!';
  }

  function periodRange(p){
    var first=null,last=null,count=0,done=0;
    DAYS.forEach(function(d){
      if(d.period!==p) return;
      if(first===null) first=d.day; last=d.day; count++;
      if(isDone(d.day)) done++;
    });
    return {first:first,last:last,count:count,done:done};
  }

  function renderPeriods(){
    document.getElementById('periodList').innerHTML = PERIOD_ORDER.map(function(p){
      var r=periodRange(p), pct=Math.round((r.done/r.count)*100);
      return '<div class="period-card" data-goto="'+r.first+'">'
        +'<div class="period-card-top"><div class="title">'+p+'</div>'
        +'<div class="range">Días '+r.first+'–'+r.last+'</div></div>'
        +'<div class="period-bar"><div class="period-bar-fill" style="width:'+pct+'%"></div></div>'
        +'<div class="pcount">'+r.done+' de '+r.count+' días leídos</div></div>';
    }).join('');
    document.querySelectorAll('#periodList .period-card').forEach(function(el){
      el.addEventListener('click',function(){
        currentDay=parseInt(el.getAttribute('data-goto'),10);
        switchTab('today'); renderToday(); saveCurrentDay();
      });
    });
  }

  var listFilter='all';
  function renderList(){
    var filtered=DAYS.filter(function(d){
      if(listFilter==='pending') return !isDone(d.day);
      if(listFilter==='done')    return  isDone(d.day);
      return true;
    });
    if(!filtered.length){ document.getElementById('fullList').innerHTML='<div class="empty-note">No hay días en esta categoría.</div>'; return; }
    document.getElementById('fullList').innerHTML=filtered.map(function(d){
      var refs=[d.l1,d.l2].filter(Boolean).join(' · ');
      var done=isDone(d.day);
      var partial = !done && !!progress[String(d.day)];
      var stateClass = done ? 'done' : (partial ? 'partial' : '');
      return '<div class="day-row '+stateClass+'" data-day="'+d.day+'">'
        +'<div class="dnum">'+d.day+'</div>'
        +'<div class="dcheck" data-action="toggle-list"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
        +'<div class="dtext"><div class="refs">'+refs+'</div><div class="psalm">'+(d.l3||'')+'</div></div>'
        +'<button class="dgo" data-action="goto-list">Ver</button></div>';
    }).join('');
    document.querySelectorAll('#fullList [data-action="toggle-list"]').forEach(function(el){
      el.addEventListener('click',function(e){ e.stopPropagation(); toggleDay(parseInt(el.closest('.day-row').getAttribute('data-day'),10)); });
    });
    document.querySelectorAll('#fullList [data-action="goto-list"]').forEach(function(el){
      el.addEventListener('click',function(e){ e.stopPropagation(); currentDay=parseInt(el.closest('.day-row').getAttribute('data-day'),10); switchTab('today'); renderToday(); saveCurrentDay(); });
    });
  }

  document.getElementById('listFilter').addEventListener('click',function(e){
    var btn=e.target.closest('.chip'); if(!btn) return;
    listFilter=btn.getAttribute('data-filter');
    document.querySelectorAll('#listFilter .chip').forEach(function(c){ c.classList.remove('active'); });
    btn.classList.add('active'); renderList();
  });

  function switchTab(name){
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.toggle('active',b.getAttribute('data-tab')===name); });
    ['today','periods','list'].forEach(function(t){ document.getElementById('tab-'+t).classList.toggle('hidden',t!==name); });
  }
  document.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      switchTab(btn.getAttribute('data-tab'));
      if(btn.getAttribute('data-tab')==='periods') renderPeriods();
      if(btn.getAttribute('data-tab')==='list')    renderList();
    });
  });

  document.getElementById('prevDay').addEventListener('click',function(){ if(currentDay>1){ currentDay--; renderToday(); saveCurrentDay(); }});
  document.getElementById('nextDay').addEventListener('click',function(){ if(currentDay<365){ currentDay++; renderToday(); saveCurrentDay(); }});
  document.getElementById('dayJumpInput').addEventListener('change',function(e){
    var v=Math.max(1,Math.min(365,parseInt(e.target.value,10)||1));
    currentDay=v; renderToday(); saveCurrentDay();
  });

  document.getElementById('resetBtn').addEventListener('click',function(){
    if(!userKey||!userEmail.trim()){ alert('Ingresá tu mail primero.'); return; }
    if(confirm('¿Reiniciar tu progreso? No se puede deshacer.')){
      progress={}; saveProgress(); renderAll();
    }
  });

  /* PWA install prompt */
  var deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); deferredPrompt=e;
    var b = document.getElementById('installBanner');
    if(b) b.style.display='flex';
  });
  var installBtn = document.getElementById('installBtn');
  if(installBtn) installBtn.addEventListener('click',function(){
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(){ deferredPrompt=null; document.getElementById('installBanner').style.display='none'; });
  });
  var installDismiss = document.getElementById('installDismiss');
  if(installDismiss) installDismiss.addEventListener('click',function(){ document.getElementById('installBanner').style.display='none'; });
  window.addEventListener('appinstalled',function(){ var b=document.getElementById('installBanner'); if(b) b.style.display='none'; });

  /* Service Worker: habilita que la app abra sin conexión */
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(function(err){
      console.warn('No se pudo registrar el Service Worker', err);
    });

    var swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(swRefreshing) return;
      swRefreshing = true;
      window.location.reload();
    });
  }

  // Botón manual "Actualizar app"
  var updateBtn = document.getElementById('updateAppBtn');
  if(updateBtn){
    updateBtn.addEventListener('click', async function(){
      updateBtn.textContent = 'Actualizando…';
      try {
        if('serviceWorker' in navigator){
          var regs = await navigator.serviceWorker.getRegistrations();
          for(var i=0;i<regs.length;i++){ await regs[i].unregister(); }
        }
        if('caches' in window){
          var keys = await caches.keys();
          for(var j=0;j<keys.length;j++){ await caches.delete(keys[j]); }
        }
      } catch(e){ console.warn('Error al actualizar', e); }
      window.location.reload(true);
    });
  }

  function renderAll(){ renderStats(); renderToday(); }

  // ---- Init ----
  currentDay = 1;
  renderConnStatus();
  renderAll();

  var rememberedEmail = getRememberedEmail();
  if(rememberedEmail){
    nameInput.value = rememberedEmail;
    // Esperamos a que app-firebase.js (que es un módulo y carga de forma
    // diferida) tenga oportunidad de sobreescribir window.BibliaBackend
    // con la versión real conectada a Firestore. Si nunca llega (por
    // ejemplo, sin conexión real), seguimos igual con el backend de
    // respaldo tras ese margen — la persona ve su mail y puede usar la
    // app, simplemente sin progreso sincronizado para esta sesión.
    setSavedTag('Cargando…');
    waitForRealBackend(3000).then(function(){
      loadProgressFor(rememberedEmail);
    });
  }

  function waitForRealBackend(maxWaitMs){
    return new Promise(function(resolve){
      if(window.BibliaBackend && window.BibliaBackend.ready){ resolve(); return; }
      var resolved = false;
      function done(){
        if(resolved) return;
        resolved = true;
        window.removeEventListener('biblia-backend-ready', done);
        resolve();
      }
      window.addEventListener('biblia-backend-ready', done);
      setTimeout(done, maxWaitMs);
    });
  }

})();
