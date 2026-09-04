/* Diario Upper/Lower — app offline
   Nessuna dipendenza esterna, nessuna richiesta di rete.
   I dati restano su questo dispositivo (localStorage). */
(function () {
  "use strict";

  /* =========================================================
     PROGRAMMA — Upper/Lower 4 giorni
     rest = secondi di recupero
     ========================================================= */
  var PROGRAM = [
    { key: "upperA", name: "Upper A", exercises: [
      { slug: "panca-piana",     name: "Panca piana (bilanciere)",            sets: 4, min: 6,  max: 8,  rest: 120 },
      { slug: "rematore",        name: "Rematore bilanciere/manubrio",        sets: 4, min: 8,  max: 10, rest: 120 },
      { slug: "military-press",  name: "Military press",                      sets: 3, min: 8,  max: 10, rest: 90 },
      { slug: "trazioni",        name: "Trazioni / Lat machine presa larga",  sets: 3, min: 8,  max: 10, rest: 90 },
      { slug: "alzate-laterali", name: "Alzate laterali",                     sets: 3, min: 12, max: 15, rest: 60 },
      { slug: "curl-pushdown",   name: "Curl bicipiti + Push down (superset)", sets: 3, min: 12, max: 12, rest: 60 }
    ]},
    { key: "lowerA", name: "Lower A", exercises: [
      { slug: "back-squat",      name: "Back squat",                          sets: 4, min: 6,  max: 8,  rest: 180 },
      { slug: "rdl",             name: "Stacco rumeno (RDL)",                 sets: 3, min: 8,  max: 10, rest: 120 },
      { slug: "leg-press",       name: "Leg press / Affondi manubri",         sets: 3, min: 10, max: 12, rest: 90 },
      { slug: "leg-curl",        name: "Leg curl",                            sets: 3, min: 10, max: 12, rest: 90 },
      { slug: "polpacci-piedi",  name: "Polpacci in piedi",                   sets: 4, min: 12, max: 15, rest: 60 },
      { slug: "cable-crunch",    name: "Cable crunch",                        sets: 3, min: 12, max: 15, rest: 60 }
    ]},
    { key: "upperB", name: "Upper B", exercises: [
      { slug: "panca-inclinata", name: "Panca inclinata",                     sets: 4, min: 8,  max: 10, rest: 120 },
      { slug: "lat-stretta",     name: "Lat machine presa stretta/neutra",    sets: 4, min: 8,  max: 10, rest: 120 },
      { slug: "dip",             name: "Dip / Chest press machine",           sets: 3, min: 8,  max: 10, rest: 90 },
      { slug: "rematore-cavi",   name: "Rematore basso ai cavi",              sets: 3, min: 10, max: 12, rest: 90 },
      { slug: "face-pull",       name: "Face pull",                           sets: 3, min: 12, max: 15, rest: 60 },
      { slug: "martello-french", name: "Curl a martello + French press (superset)", sets: 3, min: 12, max: 12, rest: 60 }
    ]},
    { key: "lowerB", name: "Lower B", exercises: [
      { slug: "stacco",          name: "Stacco da terra (conv./sumo)",        sets: 4, min: 5,  max: 6,  rest: 180 },
      { slug: "bulgari",         name: "Affondi bulgari / Front squat",       sets: 3, min: 8,  max: 10, rest: 120 },
      { slug: "hip-thrust",      name: "Hip thrust",                          sets: 3, min: 10, max: 12, rest: 90 },
      { slug: "leg-extension",   name: "Leg extension",                       sets: 3, min: 12, max: 15, rest: 90 },
      { slug: "polpacci-seduto", name: "Polpacci da seduto",                  sets: 4, min: 15, max: 20, rest: 45 },
      { slug: "crunch-knee",     name: "Cable crunch / Hanging knee raise",   sets: 3, min: 12, max: 15, rest: 45 }
    ]}
  ];

  var DELOAD_AFTER = 20;   // 5 settimane x 4 sedute
  var BACKUP_NUDGE = 12;   // sedute senza backup prima del promemoria

  /* =========================  STATO  ========================= */
  var state = { nextDayIndex: 0, sinceDeload: 0, total: 0, lastBackup: null, sinceBackup: 0 };
  var progress = {};
  var sessions = [];
  var live = null;
  var wakeLock = null;
  var deferredInstall = null;

  var LS = { state: "fit.ul.state", prog: "fit.ul.progress", sess: "fit.ul.sessions", live: "fit.ul.live" };

  /* =========================  UTIL  ========================= */
  function $(id) { return document.getElementById(id); }

  function fmt(n) {
    if (n === null || n === undefined || n === "") return "";
    var v = Number(n);
    if (!isFinite(v)) return "";
    return (Math.round(v * 100) / 100).toString();
  }
  function clock(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  var MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  function prettyDate(iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return Number(p[2]) + " " + MESI[Number(p[1]) - 1] + " " + p[0];
  }
  function lsGet(k, fb) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast("Memoria del browser piena: esporta un backup."); return false; }
  }
  function dayByKey(k) {
    for (var i = 0; i < PROGRAM.length; i++) if (PROGRAM[i].key === k) return PROGRAM[i];
    return PROGRAM[0];
  }
  function roundLoad(x) { return Math.round((Math.round(x / 1.25) * 1.25) * 100) / 100; }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* dialog di conferma interno (niente confirm() nativo) */
  function ask(message, okLabel, onOk) {
    var ov = document.createElement("div"); ov.className = "overlay";
    var dg = document.createElement("div"); dg.className = "dialog";
    dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true");
    var p = document.createElement("p"); p.textContent = message;
    var acts = document.createElement("div"); acts.className = "dialog-actions";
    var no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annulla";
    var yes = document.createElement("button"); yes.type = "button"; yes.className = "btn btn-primary"; yes.textContent = okLabel || "Conferma";
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    no.addEventListener("click", close);
    yes.addEventListener("click", function () { close(); onOk(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", esc);
    acts.appendChild(no); acts.appendChild(yes);
    dg.appendChild(p); dg.appendChild(acts);
    ov.appendChild(dg); document.body.appendChild(ov);
    yes.focus();
  }

  /* =========================  PERSISTENZA  ========================= */
  function saveState() { lsSet(LS.state, state); }
  function saveProgress() { lsSet(LS.prog, progress); }
  function saveSessions() { lsSet(LS.sess, sessions); }
  function persistLive() { lsSet(LS.live, live); }

  function loadAll() {
    var s = lsGet(LS.state, null);
    if (s) {
      state.nextDayIndex = s.nextDayIndex || 0;
      state.sinceDeload = s.sinceDeload || 0;
      state.total = s.total || 0;
      state.lastBackup = s.lastBackup || null;
      state.sinceBackup = s.sinceBackup || 0;
    }
    var p = lsGet(LS.prog, null); if (p) progress = p;
    var se = lsGet(LS.sess, null); if (se && se.length) sessions = se;
    var lv = lsGet(LS.live, null); if (lv && lv.dayKey) live = lv;
  }

  // chiede al browser di non buttare via i dati sotto pressione di memoria
  function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (already) {
          if (!already) navigator.storage.persist();
        }).catch(function () {});
      }
    } catch (e) {}
  }

  /* =========================  BACKUP  ========================= */
  function exportData() {
    var payload = {
      app: "diario-upper-lower",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: state,
      progress: progress,
      sessions: sessions
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    a.href = url;
    a.download = "diario-upper-lower-" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    state.lastBackup = todayISO();
    state.sinceBackup = 0;
    saveState();
    renderHome();
    toast("Backup esportato");
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { toast("File non valido"); return; }
      if (!data || data.app !== "diario-upper-lower" || !data.sessions) {
        toast("Non è un backup di questa app");
        return;
      }
      ask("Sostituire i dati attuali con il backup del " +
          (data.exportedAt ? data.exportedAt.slice(0, 10) : "?") +
          " (" + data.sessions.length + " allenamenti)? I dati presenti ora andranno persi.",
        "Importa", function () {
          sessions = data.sessions || [];
          progress = data.progress || {};
          if (data.state) {
            state.nextDayIndex = data.state.nextDayIndex || 0;
            state.sinceDeload = data.state.sinceDeload || 0;
            state.total = data.state.total || sessions.length;
            state.lastBackup = data.state.lastBackup || null;
            state.sinceBackup = data.state.sinceBackup || 0;
          }
          saveState(); saveProgress(); saveSessions();
          renderHome();
          toast("Backup importato");
        });
    };
    reader.onerror = function () { toast("Lettura del file fallita"); };
    reader.readAsText(file);
  }

  /* =========================  TIMER RECUPERO  ========================= */
  var rest = { left: 0, id: null, endsAt: 0 };

  function startRest(sec, label) {
    stopRest();
    rest.endsAt = Date.now() + sec * 1000;
    rest.left = sec;
    $("restLabel").textContent = label || "Recupero";
    $("restbar").hidden = false;
    $("workoutFoot").style.paddingBottom = "5.2rem";
    document.body.classList.add("rest-on");
    paintRest();
    rest.id = setInterval(tickRest, 250);
  }
  function tickRest() {
    // ricalcolo dall'orologio: resta corretto se lo schermo si spegne
    var left = Math.ceil((rest.endsAt - Date.now()) / 1000);
    if (left <= 0) { ding(); stopRest(); return; }
    if (left !== rest.left) { rest.left = left; paintRest(); }
  }
  function paintRest() { $("restTime").textContent = clock(Math.max(0, rest.left)); }
  function stopRest() {
    if (rest.id) { clearInterval(rest.id); rest.id = null; }
    rest.left = 0; rest.endsAt = 0;
    $("restbar").hidden = true;
    $("workoutFoot").style.paddingBottom = "";
    document.body.classList.remove("rest-on");
  }
  function ding() {
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC(), o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.55);
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }

  /* =========================  SCHERMATE  ========================= */
  function show(which) {
    ["home", "workout", "history", "detail"].forEach(function (s) {
      $("screen-" + s).hidden = (s !== which);
    });
    $("backBtn").hidden = (which === "home");
    $("histBtn").hidden = (which !== "home");
    window.scrollTo(0, 0);
  }

  function setTitle(main, sub) {
    $("title").firstChild.nodeValue = main;
    $("subtitle").textContent = sub;
  }

  /* ---------- HOME ---------- */
  function renderHome() {
    var day = PROGRAM[state.nextDayIndex % PROGRAM.length];
    $("nextName").textContent = day.name;
    $("nextMeta").textContent = day.exercises.length + " esercizi · " +
      day.exercises.reduce(function (a, e) { return a + e.sets; }, 0) + " serie totali";
    $("startBtn").textContent = (live && live.dayKey) ? "Riprendi " + dayByKey(live.dayKey).name : "Inizia allenamento";

    var ds = $("daySwitch"); ds.innerHTML = "";
    PROGRAM.forEach(function (d, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = d.name;
      b.setAttribute("aria-pressed", String(i === state.nextDayIndex % PROGRAM.length));
      b.addEventListener("click", function () {
        if (live) { toast("Allenamento in corso: terminalo o annullalo prima"); return; }
        state.nextDayIndex = i; saveState(); renderHome();
      });
      ds.appendChild(b);
    });

    var bn = $("deloadBanner");
    if (state.sinceDeload >= DELOAD_AFTER) {
      bn.hidden = false;
      bn.className = "banner";
      bn.innerHTML = "";
      var txt = document.createElement("div");
      txt.textContent = "Sono " + state.sinceDeload + " sedute dall'ultimo deload: settimana di scarico consigliata (serie dimezzate, ~70% del carico).";
      var ok = document.createElement("button");
      ok.type = "button"; ok.textContent = "Fatto";
      ok.addEventListener("click", function () { state.sinceDeload = 0; saveState(); renderHome(); });
      bn.appendChild(txt); bn.appendChild(ok);
    } else {
      bn.hidden = true;
    }

    var bi = $("backupInfo");
    if (state.lastBackup) {
      bi.textContent = "Ultimo backup: " + prettyDate(state.lastBackup) +
        (state.sinceBackup ? " · " + state.sinceBackup + " allenamenti da allora" : " · aggiornato");
    } else {
      bi.textContent = "Nessun backup esportato. I dati vivono solo su questo telefono: esporta ogni tanto un file di backup.";
    }

    renderList($("recentList"), sessions.slice(0, 6),
      "Nessun allenamento registrato.<br>Inizia il primo per costruire lo storico.");

    $("statusLine").textContent = "Dati salvati su questo dispositivo · " + sessions.length + " allenamenti in archivio";
  }

  function renderList(host, items, emptyMsg) {
    host.innerHTML = "";
    if (!items.length) {
      var e = document.createElement("div");
      e.className = "empty"; e.innerHTML = emptyMsg;
      host.appendChild(e);
      return;
    }
    items.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "hist-row";
      var left = document.createElement("div");
      var d = document.createElement("div"); d.className = "d"; d.textContent = s.dayName || s.dayKey;
      var t = document.createElement("div"); t.className = "s"; t.textContent = prettyDate(s.date);
      left.appendChild(d); left.appendChild(t);
      var v = document.createElement("div"); v.className = "vol";
      v.textContent = (s.setsDone || 0) + " serie";
      b.appendChild(left); b.appendChild(v);
      b.addEventListener("click", function () { renderDetail(s); });
      host.appendChild(b);
    });
  }

  /* ---------- ALLENAMENTO ---------- */
  function newLive(dayKey) {
    var day = dayByKey(dayKey);
    var entries = {};
    day.exercises.forEach(function (ex) {
      var last = progress[ex.slug];
      var rows = [];
      for (var i = 0; i < ex.sets; i++) {
        var pw = "", pr = "";
        if (last && last.sets && last.sets[i]) { pw = last.sets[i].w; pr = last.sets[i].r; }
        else if (last && last.sets && last.sets.length) {
          pw = last.sets[last.sets.length - 1].w; pr = last.sets[last.sets.length - 1].r;
        }
        if (last && last.suggest) { pw = last.suggest; pr = ex.min; }
        rows.push({ w: pw === "" ? "" : String(pw), r: pr === "" ? "" : String(pr), done: false });
      }
      entries[ex.slug] = rows;
    });
    live = { dayKey: dayKey, date: todayISO(), started: Date.now(), entries: entries };
    persistLive();
  }

  function renderWorkout() {
    var day = dayByKey(live.dayKey);
    setTitle(day.name, prettyDate(live.date));
    var host = $("exList"); host.innerHTML = "";

    day.exercises.forEach(function (ex) {
      var rows = live.entries[ex.slug];
      if (!rows) { rows = []; live.entries[ex.slug] = rows; }
      var wrap = document.createElement("div"); wrap.className = "ex";

      var nm = document.createElement("div"); nm.className = "name"; nm.textContent = ex.name;
      wrap.appendChild(nm);

      var tags = document.createElement("div"); tags.className = "ex-tags";
      var c1 = document.createElement("span"); c1.className = "chip chip-accent";
      c1.textContent = ex.sets + "×" + (ex.min === ex.max ? ex.min : ex.min + "-" + ex.max);
      var c2 = document.createElement("span"); c2.className = "chip";
      c2.textContent = "rec " + (ex.rest >= 60 ? clock(ex.rest) : ex.rest + "s");
      tags.appendChild(c1); tags.appendChild(c2);
      var last = progress[ex.slug];
      if (last && last.suggest) {
        var c3 = document.createElement("span"); c3.className = "chip chip-ok";
        c3.textContent = "sali a " + fmt(last.suggest) + " kg";
        tags.appendChild(c3);
      }
      wrap.appendChild(tags);

      if (last && last.sets && last.sets.length) {
        var lastLine = document.createElement("div"); lastLine.className = "ex-last";
        lastLine.textContent = "Ultima (" + prettyDate(last.date) + "): " +
          last.sets.map(function (s) { return fmt(s.w) + "kg × " + s.r; }).join("  ·  ");
        wrap.appendChild(lastLine);
      }

      rows.forEach(function (row, i) { wrap.appendChild(setRow(ex, row, i)); });

      var hint = document.createElement("div");
      hint.className = "ex-hint"; hint.hidden = true;
      hint.setAttribute("data-hint", ex.slug);
      wrap.appendChild(hint);

      host.appendChild(wrap);
      refreshHint(ex);
    });
  }

  function setRow(ex, row, i) {
    var el = document.createElement("div");
    el.className = "setrow" + (row.done ? " done" : "");

    var n = document.createElement("div"); n.className = "n"; n.textContent = (i + 1);
    el.appendChild(n);

    var fw = document.createElement("div"); fw.className = "field";
    var iw = document.createElement("input");
    iw.type = "number"; iw.inputMode = "decimal"; iw.step = "1.25"; iw.min = "0";
    iw.value = row.w; iw.placeholder = "kg";
    iw.setAttribute("aria-label", "Peso serie " + (i + 1) + " " + ex.name);
    iw.addEventListener("input", function () { row.w = iw.value; persistLive(); });
    var uw = document.createElement("span"); uw.className = "unit"; uw.textContent = "kg";
    fw.appendChild(iw); fw.appendChild(uw);
    el.appendChild(fw);

    var fr = document.createElement("div"); fr.className = "field";
    var minus = document.createElement("button");
    minus.type = "button"; minus.className = "step"; minus.textContent = "−";
    minus.setAttribute("aria-label", "Una ripetizione in meno");
    var ir = document.createElement("input");
    ir.type = "number"; ir.inputMode = "numeric"; ir.step = "1"; ir.min = "0";
    ir.value = row.r; ir.placeholder = ex.min === ex.max ? String(ex.min) : ex.min + "-" + ex.max;
    ir.setAttribute("aria-label", "Ripetizioni serie " + (i + 1) + " " + ex.name);
    var plus = document.createElement("button");
    plus.type = "button"; plus.className = "step"; plus.textContent = "+";
    plus.setAttribute("aria-label", "Una ripetizione in più");
    function bump(d) {
      var base = parseInt(ir.value, 10);
      base = isNaN(base) ? ex.min : base + d;
      if (base < 0) base = 0;
      ir.value = String(base); row.r = ir.value; persistLive(); refreshHint(ex);
    }
    minus.addEventListener("click", function () { bump(-1); });
    plus.addEventListener("click", function () { bump(1); });
    ir.addEventListener("input", function () { row.r = ir.value; persistLive(); refreshHint(ex); });
    fr.appendChild(minus); fr.appendChild(ir); fr.appendChild(plus);
    el.appendChild(fr);

    var tick = document.createElement("button");
    tick.type = "button"; tick.className = "tick"; tick.textContent = "✓";
    tick.setAttribute("aria-label", "Serie " + (i + 1) + " completata");
    tick.setAttribute("aria-pressed", String(!!row.done));
    tick.addEventListener("click", function () {
      row.done = !row.done;
      if (row.done) {
        if (row.r === "" || row.r === null) { row.r = String(ex.min); ir.value = row.r; }
        el.classList.add("done");
        startRest(ex.rest, "Recupero · " + ex.name);
      } else {
        el.classList.remove("done");
      }
      tick.setAttribute("aria-pressed", String(!!row.done));
      persistLive(); refreshHint(ex);
    });
    el.appendChild(tick);

    return el;
  }

  // suggerimento doppia progressione in tempo reale
  function refreshHint(ex) {
    var host = document.querySelector('[data-hint="' + ex.slug + '"]');
    if (!host) return;
    var rows = live.entries[ex.slug] || [];
    var allTop = rows.length > 0, anyDone = false, maxW = 0;
    rows.forEach(function (r) {
      var reps = parseInt(r.r, 10), w = parseFloat(r.w);
      if (r.done) anyDone = true;
      if (isNaN(reps) || reps < ex.max) allTop = false;
      if (!isNaN(w)) maxW = Math.max(maxW, w);
    });
    if (allTop && anyDone && maxW > 0) {
      var next = roundLoad(Math.max(maxW + 1.25, maxW * 1.025));
      host.hidden = false;
      host.textContent = "Range chiuso su tutte le serie → la prossima volta sali a " + fmt(next) +
        " kg e riparti da " + ex.min + " rip.";
    } else {
      host.hidden = true;
    }
  }

  function finishWorkout() {
    var day = dayByKey(live.dayKey);
    var exOut = [], setsDone = 0;

    day.exercises.forEach(function (ex) {
      var rows = live.entries[ex.slug] || [];
      var kept = rows.filter(function (r) { return r.done && r.r !== ""; })
                     .map(function (r) { return { w: (r.w === "" ? 0 : Number(r.w)), r: Number(r.r) }; });
      if (!kept.length) return;
      setsDone += kept.length;
      exOut.push({ slug: ex.slug, name: ex.name, sets: kept });

      var allTop = kept.length >= ex.sets && kept.every(function (s) { return s.r >= ex.max; });
      var maxW = kept.reduce(function (a, s) { return Math.max(a, s.w); }, 0);
      var rec = { date: live.date, sets: kept };
      if (allTop && maxW > 0) rec.suggest = roundLoad(Math.max(maxW + 1.25, maxW * 1.025));
      progress[ex.slug] = rec;
    });

    if (!setsDone) {
      ask("Nessuna serie risulta completata (spunta le serie con ✓). Chiudere senza salvare?", "Chiudi", function () {
        live = null; persistLive(); stopRest(); releaseWake(); goHome();
      });
      return;
    }

    var stamp = new Date();
    var sess = {
      id: live.date.replace(/-/g, "") + "-" + pad2(stamp.getHours()) + pad2(stamp.getMinutes()) + "-" + live.dayKey,
      date: live.date,
      dayKey: live.dayKey,
      dayName: day.name,
      setsDone: setsDone,
      minutes: Math.max(1, Math.round((Date.now() - live.started) / 60000)),
      exercises: exOut
    };

    sessions.unshift(sess);
    if (sessions.length > 500) sessions.length = 500;
    saveSessions();
    saveProgress();

    state.total++;
    state.sinceDeload++;
    state.sinceBackup++;
    state.nextDayIndex = (PROGRAM.indexOf(day) + 1) % PROGRAM.length;
    saveState();

    live = null; persistLive();
    stopRest(); releaseWake();
    goHome();

    if (state.sinceBackup >= BACKUP_NUDGE) {
      toast("Sono " + state.sinceBackup + " allenamenti senza backup: esportane uno.");
    }
  }

  /* ---------- DETTAGLIO ---------- */
  function renderDetail(s) {
    setTitle(s.dayName || s.dayKey, prettyDate(s.date) + (s.minutes ? " · " + s.minutes + " min" : ""));
    var host = $("detailCard"); host.innerHTML = "";
    (s.exercises || []).forEach(function (ex) {
      var d = document.createElement("div"); d.className = "det-ex";
      var n = document.createElement("div"); n.className = "name"; n.textContent = ex.name;
      var st = document.createElement("div"); st.className = "det-sets";
      st.textContent = (ex.sets || []).map(function (x) { return fmt(x.w) + "kg × " + x.r; }).join("   ·   ");
      d.appendChild(n); d.appendChild(st);
      host.appendChild(d);
    });
    show("detail");
  }

  /* ---------- SCHERMO ACCESO ---------- */
  function requestWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
      }
    } catch (e) {}
  }
  function releaseWake() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (!$("screen-workout").hidden) requestWake();
      if (rest.id) tickRest();
    }
  });

  /* ---------- NAVIGAZIONE ---------- */
  function goHome() {
    setTitle("Diario Upper/Lower", "4 giorni · doppia progressione");
    renderHome();
    show("home");
  }

  $("startBtn").addEventListener("click", function () {
    if (!live) newLive(PROGRAM[state.nextDayIndex % PROGRAM.length].key);
    renderWorkout(); show("workout"); requestWake();
  });
  $("cancelBtn").addEventListener("click", function () {
    ask("Annullare l'allenamento in corso? I dati inseriti andranno persi.", "Annulla allenamento", function () {
      live = null; persistLive(); stopRest(); releaseWake(); goHome();
    });
  });
  $("finishBtn").addEventListener("click", finishWorkout);
  $("histBtn").addEventListener("click", function () {
    setTitle("Storico", state.total + " allenamenti registrati");
    renderList($("fullList"), sessions, "Nessun allenamento registrato.");
    show("history");
  });
  $("backBtn").addEventListener("click", function () {
    if (!$("screen-workout").hidden) {
      ask("Uscire dall'allenamento? Resta salvato come 'in corso' e potrai riprenderlo.", "Esci", function () {
        releaseWake(); goHome();
      });
      return;
    }
    goHome();
  });
  $("rest15").addEventListener("click", function () {
    if (rest.id) { rest.endsAt += 15000; tickRest(); }
  });
  $("restSkip").addEventListener("click", stopRest);
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", function () { $("importFile").click(); });
  $("importFile").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) importData(f);
    e.target.value = "";
  });

  /* ---------- INSTALLAZIONE ---------- */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    $("installCard").hidden = false;
  });
  $("installBtn").addEventListener("click", function () {
    if (!deferredInstall) { $("installCard").hidden = true; return; }
    deferredInstall.prompt();
    deferredInstall.userChoice.then(function () {
      deferredInstall = null;
      $("installCard").hidden = true;
    });
  });
  window.addEventListener("appinstalled", function () {
    deferredInstall = null;
    $("installCard").hidden = true;
    toast("App installata");
  });

  /* ---------- SERVICE WORKER ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  /* ---------- AVVIO ---------- */
  loadAll();
  requestPersistence();
  goHome();
})();
