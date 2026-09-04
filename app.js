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
  var weights = [];        // [{date:"YYYY-MM-DD", kg:Number}] sempre ordinato per data crescente
  var live = null;
  var wakeLock = null;
  var deferredInstall = null;
  var wRange = 90;         // giorni mostrati nel grafico e nell'elenco

  var LS = {
    state: "fit.ul.state",
    prog: "fit.ul.progress",
    sess: "fit.ul.sessions",
    live: "fit.ul.live",
    weight: "fit.ul.weight"
  };

  /* =========================  UTIL  ========================= */
  function $(id) { return document.getElementById(id); }

  // la tastiera italiana produce la virgola: va accettata ovunque si legga un numero
  function parseNum(v) {
    if (v === null || v === undefined || v === "") return NaN;
    return parseFloat(String(v).replace(",", ".").trim());
  }

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
  function saveWeights() { lsSet(LS.weight, weights); }
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
    var w = lsGet(LS.weight, null); if (w && w.length) weights = normalizeWeights(w);
    var lv = lsGet(LS.live, null); if (lv && lv.dayKey) live = lv;
  }

  // tiene solo voci valide, una per data, ordinate dalla più vecchia
  function normalizeWeights(list) {
    var byDate = {};
    (list || []).forEach(function (e) {
      if (!e || !e.date) return;
      var kg = Number(e.kg);
      if (!isFinite(kg) || kg <= 0) return;
      byDate[e.date] = { date: e.date, kg: kg };
    });
    return Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
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
      sessions: sessions,
      weights: weights
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
          " (" + data.sessions.length + " allenamenti, " +
          ((data.weights && data.weights.length) || 0) + " pesate)? I dati presenti ora andranno persi.",
        "Importa", function () {
          sessions = data.sessions || [];
          progress = data.progress || {};
          weights = normalizeWeights(data.weights || []);
          if (data.state) {
            state.nextDayIndex = data.state.nextDayIndex || 0;
            state.sinceDeload = data.state.sinceDeload || 0;
            state.total = data.state.total || sessions.length;
            state.lastBackup = data.state.lastBackup || null;
            state.sinceBackup = data.state.sinceBackup || 0;
          }
          saveState(); saveProgress(); saveSessions(); saveWeights();
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
    ["home", "workout", "history", "detail", "weight"].forEach(function (s) {
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

    renderWeightSummary();

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
    iw.type = "text"; iw.inputMode = "decimal"; iw.autocomplete = "off";
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
      var reps = parseInt(r.r, 10), w = parseNum(r.w);
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
                     .map(function (r) {
                       var w = parseNum(r.w);
                       return { w: isFinite(w) ? w : 0, r: Number(r.r) };
                     });
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

  /* =========================================================
     PESO CORPOREO
     Il peso giornaliero oscilla di 1-2 kg per acqua e glicogeno:
     il segnale utile è la media mobile, non la singola pesata.
     ========================================================= */
  var DAY = 86400000;
  function dateMs(iso) {
    var p = String(iso).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getTime();
  }

  // media delle pesate nei 7 giorni che finiscono con quella all'indice i
  function trend7(list, i) {
    var end = dateMs(list[i].date), start = end - 6 * DAY, sum = 0, n = 0;
    for (var j = i; j >= 0; j--) {
      if (dateMs(list[j].date) < start) break;
      sum += list[j].kg; n++;
    }
    return sum / n;
  }

  // ritmo in kg/settimana: regressione ai minimi quadrati sulle ultime `days` giornate.
  // Più robusto della differenza fra due pesate, che amplifica il rumore.
  function rateKgWeek(list, days) {
    if (list.length < 4) return null;
    var last = dateMs(list[list.length - 1].date);
    var from = last - days * DAY;
    var pts = list.filter(function (e) { return dateMs(e.date) >= from; });
    if (pts.length < 4) return null;
    var span = (dateMs(pts[pts.length - 1].date) - dateMs(pts[0].date)) / DAY;
    if (span < 7) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) {
      var x = (dateMs(p.date) - from) / DAY, y = p.kg;
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    });
    var den = n * sxx - sx * sx;
    if (!den) return null;
    return ((n * sxy - sx * sy) / den) * 7;
  }

  function inRange(list, days) {
    if (!days) return list.slice();
    if (!list.length) return [];
    var from = dateMs(list[list.length - 1].date) - (days - 1) * DAY;
    return list.filter(function (e) { return dateMs(e.date) >= from; });
  }

  // limite inferiore ragionevole: intercetta anni digitati male (0202, 1900)
  function minDateISO() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function validDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
    return iso <= todayISO() && iso >= minDateISO();
  }
  function entryFor(iso) {
    var found = null;
    weights.forEach(function (e) { if (e.date === iso) found = e; });
    return found;
  }

  function addWeight(value, iso) {
    var kg = parseNum(value);
    if (!isFinite(kg) || kg <= 0 || kg > 500) { toast("Inserisci un peso valido"); return false; }
    var date = iso || todayISO();
    if (!validDate(date)) {
      toast(date > todayISO() ? "Non puoi registrare un peso futuro" : "Data non valida");
      return false;
    }
    var existing = entryFor(date);
    if (existing) existing.kg = kg;
    else weights.push({ date: date, kg: kg });
    weights = normalizeWeights(weights);
    saveWeights();
    var when = date === todayISO() ? "di oggi" : "del " + prettyDate(date);
    toast(existing ? "Peso " + when + " aggiornato" : "Peso " + when + " registrato");
    return true;
  }

  function wireWeightInput(inputId, buttonId, dateId, resetId, existsId) {
    var input = $(inputId), btn = $(buttonId), date = $(dateId),
        reset = $(resetId), exists = $(existsId);

    date.max = todayISO();
    date.min = minDateISO();

    // riporta il controllo su oggi: è lo stato in cui deve trovarsi al prossimo utilizzo
    function toToday() {
      date.value = todayISO();
      refresh();
    }
    // mostra se quel giorno è già stato registrato, senza toccare ciò che ha digitato
    function refresh() {
      var iso = date.value;
      var isToday = iso === todayISO();
      date.classList.toggle("is-past", !isToday && !!iso);
      reset.hidden = isToday || !iso;
      btn.textContent = isToday ? "Registra" : "Registra il " + shortDate(iso);
      var e = iso && validDate(iso) ? entryFor(iso) : null;
      if (e) {
        exists.hidden = false;
        exists.textContent = "Quel giorno è già registrato a " + e.kg.toFixed(1) +
          " kg: salvando lo sostituisci.";
      } else {
        exists.hidden = true;
      }
    }

    function submit() {
      if (addWeight(input.value, date.value)) {
        input.value = "";
        input.blur();
        toToday();                       // torna subito al percorso rapido
        renderWeightSummary();
        if (!$("screen-weight").hidden) renderWeightScreen();
      }
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    date.addEventListener("change", refresh);
    date.addEventListener("input", refresh);
    reset.addEventListener("click", toToday);

    toToday();
    return { refresh: refresh, toToday: toToday };
  }

  /* ---------- riepilogo in home ---------- */
  function renderWeightSummary() {
    var texts = [];
    if (!weights.length) {
      texts.push("Nessuna pesata registrata. Pesati la mattina a digiuno, sempre nelle stesse condizioni.");
    } else {
      var last = weights[weights.length - 1];
      var t = trend7(weights, weights.length - 1);
      texts.push("Tendenza <strong>" + t.toFixed(1) + " kg</strong> · ultima pesata " +
        last.kg.toFixed(1) + " kg il " + prettyDate(last.date));
      var r = rateKgWeek(weights, 21);
      if (r !== null) {
        texts.push((r < 0 ? "−" : "+") + Math.abs(r).toFixed(2) + " kg/settimana");
      }
    }
    var host = $("wSummary"), host2 = $("wSummary2");
    var html = texts.join("<br>");
    if (host) host.innerHTML = html;
    if (host2) host2.innerHTML = html;

    // i moduli vengono collegati prima del caricamento dei dati: qui sono aggiornati
    if (typeof weightForms !== "undefined" && weightForms) refreshWeightForms();
  }

  /* ---------- statistiche ---------- */
  function renderWeightStats() {
    var host = $("wStats");
    host.innerHTML = "";
    if (!weights.length) { host.hidden = true; return; }
    host.hidden = false;

    var trend = trend7(weights, weights.length - 1);
    var rate = rateKgWeek(weights, 21);

    host.appendChild(statTile(
      "Peso di tendenza",
      trend.toFixed(1), "kg",
      "media 7 giorni · " + weights.length + " pesate in archivio",
      null
    ));

    if (rate === null) {
      host.appendChild(statTile("Ritmo settimanale", "—", "",
        "servono almeno 4 pesate distribuite su 2 settimane", null));
    } else {
      var pct = (rate / trend) * 100;
      var chip;
      if (pct <= -0.9) chip = { cls: "chip-warn", txt: "più veloce del target" };
      else if (pct <= -0.35) chip = { cls: "chip-ok", txt: "in linea con il taglio" };
      else if (pct < 0.15) chip = { cls: "chip", txt: "sostanzialmente stabile" };
      else chip = { cls: "chip-warn", txt: "in aumento" };
      host.appendChild(statTile(
        "Ritmo settimanale",
        (rate < 0 ? "−" : "+") + Math.abs(rate).toFixed(2), "kg",
        (pct < 0 ? "−" : "+") + Math.abs(pct).toFixed(2) + "%/sett · regressione 21 giorni",
        chip
      ));
    }
  }

  function statTile(label, value, unit, sub, chip) {
    var d = document.createElement("div"); d.className = "w-stat";
    var l = document.createElement("div"); l.className = "lab"; l.textContent = label;
    var v = document.createElement("div"); v.className = "val"; v.textContent = value;
    if (unit) { var u = document.createElement("span"); u.className = "u"; u.textContent = unit; v.appendChild(u); }
    var s = document.createElement("div"); s.className = "sub"; s.textContent = sub;
    d.appendChild(l); d.appendChild(v); d.appendChild(s);
    if (chip) {
      var c = document.createElement("span");
      c.className = "chip " + chip.cls;
      c.textContent = chip.txt;
      d.appendChild(c);
    }
    return d;
  }

  /* ---------- grafico ---------- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function niceStep(span, target) {
    var raw = span / target;
    var steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return 10;
  }
  var shortMon = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  function shortDate(iso) {
    var p = String(iso).split("-");
    return Number(p[2]) + " " + shortMon[Number(p[1]) - 1];
  }

  function renderWeightChart() {
    var wrap = $("wChartWrap");
    var tip = $("wTip");
    // rimuovo solo il grafico precedente, non il tooltip
    var old = wrap.querySelector("svg");
    if (old) wrap.removeChild(old);
    tip.hidden = true;

    var data = inRange(weights, wRange);
    var sub = $("wChartSub");

    if (data.length < 2) {
      sub.textContent = data.length === 1
        ? "Una sola misurazione: servono almeno due pesate per tracciare l'andamento."
        : "Nessuna misurazione in questo intervallo.";
      return;
    }
    sub.textContent = "Linea: media mobile 7 giorni. Punti: singole misurazioni.";

    // la media mobile va calcolata su tutto lo storico, non solo sulla finestra
    var trendAll = weights.map(function (_, i) { return trend7(weights, i); });
    var offset = weights.length - data.length;
    var trendVals = data.map(function (_, i) { return trendAll[offset + i]; });

    var W = Math.max(260, wrap.clientWidth || 320);
    var PLOT_H = 190, PAD_T = 12, PAD_B = 24, PAD_L = 36, PAD_R = 14;
    var H = PLOT_H + PAD_B;
    var innerW = W - PAD_L - PAD_R;
    var innerH = PLOT_H - PAD_T;

    var xs = data.map(function (e) { return dateMs(e.date); });
    var x0 = xs[0], x1 = xs[xs.length - 1];
    if (x1 === x0) x1 = x0 + DAY;

    var allY = data.map(function (e) { return e.kg; }).concat(trendVals);
    var yMin = Math.min.apply(null, allY), yMax = Math.max.apply(null, allY);
    if (yMax - yMin < 1) { var mid = (yMax + yMin) / 2; yMin = mid - 0.6; yMax = mid + 0.6; }
    var step = niceStep(yMax - yMin, 4);
    yMin = Math.floor(yMin / step) * step;
    yMax = Math.ceil(yMax / step) * step;

    function X(ms) { return PAD_L + ((ms - x0) / (x1 - x0)) * innerW; }
    function Y(kg) { return PAD_T + (1 - (kg - yMin) / (yMax - yMin)) * innerH; }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: W, height: H,
      role: "img",
      tabindex: "0",
      "aria-label": "Andamento del peso: da " + prettyDate(data[0].date) + " a " +
        prettyDate(data[data.length - 1].date) +
        ", da " + Math.min.apply(null, allY).toFixed(1) + " a " + Math.max.apply(null, allY).toFixed(1) + " kg"
    });

    // griglia orizzontale: linee sottili continue, un passo sopra la superficie
    for (var g = yMin; g <= yMax + 1e-9; g += step) {
      var gy = Y(g);
      svg.appendChild(svgEl("line", {
        x1: PAD_L, y1: gy, x2: W - PAD_R, y2: gy,
        stroke: "var(--chart-grid)", "stroke-width": 1
      }));
      var lab = svgEl("text", {
        x: PAD_L - 6, y: gy + 3.5,
        "text-anchor": "end",
        fill: "var(--ink-faint)",
        "font-size": "9.5",
        "font-family": "var(--mono)",
        "style": "font-variant-numeric:tabular-nums"
      });
      lab.textContent = (Math.round(g * 10) / 10).toFixed(step < 1 ? 1 : 0);
      svg.appendChild(lab);
    }

    // etichette asse x: solo prima e ultima, per non affollare
    [[data[0].date, PAD_L, "start"], [data[data.length - 1].date, W - PAD_R, "end"]].forEach(function (t) {
      var e = svgEl("text", {
        x: t[1], y: H - 7, "text-anchor": t[2],
        fill: "var(--ink-faint)", "font-size": "9.5", "font-family": "var(--mono)"
      });
      e.textContent = shortDate(t[0]);
      svg.appendChild(e);
    });

    // punti grezzi: contesto recessivo, non una seconda serie
    data.forEach(function (e) {
      svg.appendChild(svgEl("circle", {
        cx: X(dateMs(e.date)), cy: Y(e.kg), r: 3.2,
        fill: "var(--chart-dot)",
        stroke: "var(--surface)", "stroke-width": 1.5
      }));
    });

    // la serie: media mobile 7 giorni
    var d = trendVals.map(function (v, i) {
      return (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(v).toFixed(1);
    }).join(" ");
    svg.appendChild(svgEl("path", {
      d: d, fill: "none",
      stroke: "var(--accent)", "stroke-width": 2,
      "stroke-linejoin": "round", "stroke-linecap": "round"
    }));

    // marcatore finale + etichetta diretta solo sull'ultimo valore
    var lx = X(xs[xs.length - 1]), ly = Y(trendVals[trendVals.length - 1]);
    svg.appendChild(svgEl("circle", {
      cx: lx, cy: ly, r: 4.5,
      fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2
    }));
    var endLab = svgEl("text", {
      x: Math.min(lx + 8, W - PAD_R), y: Math.max(ly - 8, 12),
      "text-anchor": lx > W - 60 ? "end" : "start",
      fill: "var(--ink)", "font-size": "11", "font-weight": "600"
    });
    endLab.textContent = trendVals[trendVals.length - 1].toFixed(1) + " kg";
    svg.appendChild(endLab);

    // livello interattivo: crosshair + tooltip al tocco, punto più vicino
    var cross = svgEl("line", {
      x1: 0, y1: PAD_T, x2: 0, y2: PLOT_H,
      stroke: "var(--line-strong)", "stroke-width": 1, opacity: "0"
    });
    var focusDot = svgEl("circle", {
      cx: 0, cy: 0, r: 5,
      fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2, opacity: "0"
    });
    svg.appendChild(cross); svg.appendChild(focusDot);

    var hit = svgEl("rect", {
      x: PAD_L, y: 0, width: innerW, height: PLOT_H,
      fill: "transparent", style: "cursor:crosshair"
    });
    svg.appendChild(hit);

    var focusIdx = -1;
    function focusAt(i) {
      if (i < 0 || i >= data.length) return;
      focusIdx = i;
      var px = X(xs[i]), py = Y(data[i].kg);
      cross.setAttribute("x1", px); cross.setAttribute("x2", px);
      cross.setAttribute("opacity", "1");
      focusDot.setAttribute("cx", px); focusDot.setAttribute("cy", py);
      focusDot.setAttribute("opacity", "1");
      tip.innerHTML = "<b>" + data[i].kg.toFixed(1) + " kg</b> · " + shortDate(data[i].date) +
        "<br>tendenza " + trendVals[i].toFixed(1) + " kg";
      tip.hidden = false;
      var scale = wrap.clientWidth / W;
      var left = px * scale;
      tip.style.left = Math.min(Math.max(left, 44), wrap.clientWidth - 44) + "px";
      tip.style.top = (py * scale) + "px";
    }
    function clearFocus() {
      cross.setAttribute("opacity", "0");
      focusDot.setAttribute("opacity", "0");
      tip.hidden = true;
      focusIdx = -1;
    }
    function nearest(clientX) {
      var r = svg.getBoundingClientRect();
      var vx = ((clientX - r.left) / r.width) * W;
      var best = 0, bd = Infinity;
      for (var i = 0; i < xs.length; i++) {
        var dd = Math.abs(X(xs[i]) - vx);
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    }
    hit.addEventListener("pointerdown", function (e) { focusAt(nearest(e.clientX)); });
    hit.addEventListener("pointermove", function (e) { if (e.pressure > 0 || e.buttons || e.pointerType === "mouse") focusAt(nearest(e.clientX)); });
    hit.addEventListener("pointerleave", clearFocus);
    svg.addEventListener("blur", clearFocus);
    // stessa informazione da tastiera
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { focusAt(focusIdx < 0 ? 0 : Math.min(focusIdx + 1, data.length - 1)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { focusAt(focusIdx < 0 ? data.length - 1 : Math.max(focusIdx - 1, 0)); e.preventDefault(); }
      else if (e.key === "Escape") clearFocus();
    });

    wrap.appendChild(svg);
  }

  /* ---------- elenco misurazioni (la vista tabellare del grafico) ---------- */
  function renderWeightList() {
    var host = $("wList");
    host.innerHTML = "";
    var data = inRange(weights, wRange).slice().reverse();
    if (!data.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "Nessuna misurazione in questo intervallo.";
      host.appendChild(e);
      return;
    }
    data.forEach(function (entry, i) {
      var row = document.createElement("div"); row.className = "w-row";
      var d = document.createElement("div"); d.className = "wd"; d.textContent = prettyDate(entry.date);
      var k = document.createElement("div"); k.className = "wk"; k.textContent = entry.kg.toFixed(1) + " kg";
      var delta = document.createElement("div"); delta.className = "wdelta";
      var prev = data[i + 1];
      delta.textContent = prev ? ((entry.kg - prev.kg >= 0 ? "+" : "−") + Math.abs(entry.kg - prev.kg).toFixed(1)) : "";
      var del = document.createElement("button");
      del.type = "button"; del.className = "w-del"; del.textContent = "✕";
      del.setAttribute("aria-label", "Elimina la pesata del " + prettyDate(entry.date));
      del.addEventListener("click", function () {
        ask("Eliminare la pesata del " + prettyDate(entry.date) + " (" + entry.kg.toFixed(1) + " kg)?", "Elimina", function () {
          weights = weights.filter(function (x) { return x.date !== entry.date; });
          saveWeights(); renderWeightScreen(); renderWeightSummary();
        });
      });
      row.appendChild(d); row.appendChild(delta); row.appendChild(k); row.appendChild(del);
      host.appendChild(row);
    });
  }

  function renderRanges() {
    var host = $("wRanges");
    host.innerHTML = "";
    [[30, "30 giorni"], [90, "90 giorni"], [0, "Tutto"]].forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = r[1];
      b.setAttribute("aria-pressed", String(wRange === r[0]));
      b.addEventListener("click", function () { wRange = r[0]; renderWeightScreen(); });
      host.appendChild(b);
    });
  }

  function renderWeightScreen() {
    renderRanges();
    renderWeightStats();
    renderWeightChart();
    renderWeightList();
    renderWeightSummary();
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if ($("screen-weight").hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderWeightChart, 150);
  });

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
  var weightForms = [
    wireWeightInput("wInput", "wSave", "wDate", "wReset", "wExists"),
    wireWeightInput("wInput2", "wSave2", "wDate2", "wReset2", "wExists2")
  ];
  function refreshWeightForms() {
    weightForms.forEach(function (f) { f.refresh(); });
  }
  $("wOpen").addEventListener("click", function () {
    setTitle("Peso corporeo", weights.length + (weights.length === 1 ? " misurazione" : " misurazioni"));
    renderWeightScreen();
    show("weight");
    // il grafico si misura sul contenitore: va ridisegnato ora che è visibile
    requestAnimationFrame(renderWeightChart);
  });
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
