(function () {
  "use strict";

  var SAVE_KEY = "the-equation-v2";
  var SAVE_KEY_LEGACY = "the-equation-v1";
  var game = new Game();
  var tab = "equation";
  var lastPaint = 0;
  var canvas, ctx;
  var prestigeArmed = false;
  var rewriteArmed = false;
  var publishArmed = null;

  function $(id) { return document.getElementById(id); }

  function toast(html, ms) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = html;
    $("toasts").appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.4s";
      setTimeout(function () { el.remove(); }, 400);
    }, ms || 4200);
  }

  function drainEvents() {
    var ev = game.events.splice(0, game.events.length);
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === "unlock") toast("Unlocked <b>" + e.text.replace("Variable ", "").replace(" entered the equation.", "") + "</b> — " + e.text);
      else if (e.type === "milestone") toast("<b>Milestone.</b> " + e.text);
      else if (e.type === "prestige") toast("<b>Prestige.</b> " + e.text, 5000);
      else if (e.type === "rewrite") toast("<b>Rewrite.</b> " + e.text, 5500);
      else if (e.type === "star") toast("<b>★</b> " + e.text, 4500);
      else if (e.type === "publish") toast("<b>Published.</b> " + e.text, 5000);
      else if (e.type === "up") toast(e.text);
      else if (e.type === "reset") toast(e.text);
    }
  }

  /* ----- tabs ----- */
  function setTab(name) {
    tab = name;
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    if (name === "theories" && game.theoriesUnlocked() && !game.s.theoriesSeen) {
      game.s.theoriesSeen = true;
      game.checkAchievements();
      save(false);
    }
    paint(true);
  }
  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTab(btn.getAttribute("data-tab"));
    });
  });

  /* ----- formula ----- */
  function activeIds() {
    return Game.VAR_ORDER.filter(function (id) { return game.isUnlocked(id); });
  }

  function formulaTerms() {
    var terms = ["b"];
    if (game.showPhi()) terms.push("phi");
    if (game.showTau()) terms.push("tau");
    activeIds().forEach(function (id) { terms.push(id); });
    terms.push("dt");
    return terms;
  }

  function termSpan(id, inner, added) {
    var cls = "";
    if (added && added.indexOf(id) >= 0 && motionOk()) cls = ' class="write-in"';
    return '<span data-term="' + id + '"' + cls + ">" + inner + "</span>";
  }

  function varProductHTML(added, numeric) {
    var ids = activeIds();
    var inner = ids.map(function (id) {
      var body = numeric
        ? formatJS(game.varValue(id), 2)
        : ("<i>" + Game.VAR_DEFS[id].name + "</i>");
      return termSpan(id, body, added);
    }).join("·");
    if (!ids.length) inner = "1";
    if (game.showPhi()) {
      return "(" + inner + ")<span data-term=\"phi\"" +
        ((added && added.indexOf("phi") >= 0 && motionOk()) ? ' class="write-in"' : "") +
        "><sup>" + (numeric ? formatJS(game.phi(), 3) : "<i>φ</i>") + "</sup></span>";
    }
    return inner;
  }

  function formulaMainHTML(added) {
    var parts = [termSpan("b", "<i>b</i>", added)];
    parts.push(varProductHTML(added, false));
    if (game.showTau()) parts.push(termSpan("tau", "<i>τ</i>", added));
    parts.push(termSpan("dt", "d<i>t</i>", added));
    return "<i>f</i>(<i>t</i>+d<i>t</i>) = <i>f</i>(<i>t</i>)·<i>e</i><sup>" + parts.join("·") + "</sup>";
  }

  function fText() {
    var s = game.s;
    return s.fLayer ? formatNum(new Num(s.fLog, s.fLayer)) : formatLog(s.fLog);
  }

  function formulaSubHTML(added) {
    var parts = [termSpan("b", formatJS(game.s.b, 3), added)];
    parts.push(varProductHTML(added, true));
    if (game.showTau()) parts.push(termSpan("tau", formatJS(game.tau(), 3), added));
    parts.push(termSpan("dt", formatJS(game.dtSpeed(), 3), added));
    return '<span data-term="f">' + fText() + "</span> · e<sup>" + parts.join(" · ") + "</sup>";
  }

  function updateFormulaSubNumbers() {
    var sub = $("formula-sub");
    if (!sub) return;
    function set(term, text) {
      var el = sub.querySelector('[data-term="' + term + '"]');
      if (el) el.textContent = text;
    }
    set("f", fText());
    set("b", formatJS(game.s.b, 3));
    if (game.showPhi()) {
      var phiEl = sub.querySelector('[data-term="phi"]');
      if (phiEl) {
        var sup = phiEl.querySelector("sup");
        if (sup) sup.textContent = formatJS(game.phi(), 3);
        else phiEl.textContent = formatJS(game.phi(), 3);
      }
    }
    if (game.showTau()) set("tau", formatJS(game.tau(), 3));
    activeIds().forEach(function (id) { set(id, formatJS(game.varValue(id), 2)); });
    set("dt", formatJS(game.dtSpeed(), 3));
  }

  var paintedTerms = null;

  function paintFormula() {
    var terms = formulaTerms();
    var sig = terms.join(",");
    var prev = paintedTerms;
    if (prev === sig || (writeInUntil && performance.now() < writeInUntil && prev)) {
      updateFormulaSubNumbers();
      return;
    }
    var added = [];
    if (prev !== null) {
      var old = prev.split(",");
      for (var i = 0; i < terms.length; i++) {
        if (old.indexOf(terms[i]) < 0) added.push(terms[i]);
      }
    }
    paintedTerms = sig;
    $("formula-main").innerHTML = formulaMainHTML(added);
    $("formula-sub").innerHTML = formulaSubHTML(added);
    if (added.length && motionOk()) {
      writeInUntil = performance.now() + 2200;
    }
  }

  /* ----- juice ----- */
  function motionOk() {
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var juiceReady = false;
  var lastDecade = { layer: 0, d: 0 };
  var varFlashUntil = {};
  var writeInUntil = 0;

  function hushJuice(rebuildFormula) {
    juiceReady = false;
    if (rebuildFormula) paintedTerms = null;
  }

  function decadeState() {
    return { layer: game.s.fLayer || 0, d: Math.floor(game.s.fLog) };
  }

  function retriggerClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function punchBuy(id) {
    if (motionOk()) {
      retriggerClass($("f-value"), "flinch");
      var sel = '#formula-main [data-term="' + id + '"], #formula-sub [data-term="' + id + '"]';
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) retriggerClass(nodes[i], "lit");
      setTimeout(function () {
        var n2 = document.querySelectorAll(sel);
        for (var k = 0; k < n2.length; k++) n2[k].classList.remove("lit");
      }, 600);
    }
    varFlashUntil[id] = performance.now() + 600;
    applyVarFlashes();
  }

  function applyVarFlashes() {
    var now = performance.now();
    Object.keys(varFlashUntil).forEach(function (id) {
      if (varFlashUntil[id] <= now) {
        delete varFlashUntil[id];
        var stale = document.querySelectorAll('.var-row[data-id="' + id + '"].flash');
        for (var s = 0; s < stale.length; s++) stale[s].classList.remove("flash");
        return;
      }
      var rows = document.querySelectorAll('.var-row[data-id="' + id + '"]');
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].classList.contains("flash")) {
          if (motionOk()) retriggerClass(rows[i], "flash");
          else rows[i].classList.add("flash");
        }
      }
    });
  }

  function anyVarFlash() {
    var now = performance.now();
    var any = false;
    Object.keys(varFlashUntil).forEach(function (id) {
      if (varFlashUntil[id] > now) any = true;
      else delete varFlashUntil[id];
    });
    return any;
  }

  function spawnDecadeFloat(up) {
    if (!motionOk()) return;
    var block = $("f-value") && $("f-value").parentNode;
    if (!block) return;
    var el = document.createElement("div");
    el.className = "decade-float" + (up ? "" : " drop");
    el.textContent = up ? "+1 decade" : "−1 decade";
    block.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  function pendingResetEvent() {
    var ev = game.events;
    for (var i = 0; i < ev.length; i++) {
      var t = ev[i].type;
      if (t === "prestige" || t === "rewrite" || t === "reset") return true;
    }
    return false;
  }

  function checkDecade() {
    var cur = decadeState();
    if (!juiceReady || pendingResetEvent()) {
      lastDecade = cur;
      juiceReady = true;
      return;
    }
    if (cur.layer !== lastDecade.layer) {
      lastDecade = cur;
      return;
    }
    var delta = cur.d - lastDecade.d;
    lastDecade = cur;
    if (!delta) return;
    var fv = $("f-value");
    if (delta > 0) {
      fv.classList.remove("drop");
      if (motionOk()) retriggerClass(fv, "decade-pulse");
      spawnDecadeFloat(true);
    } else {
      fv.classList.add("drop");
      if (motionOk()) retriggerClass(fv, "decade-pulse");
      spawnDecadeFloat(false);
    }
  }

  /* ----- variables ----- */
  function varRow(id, compact) {
    var def = Game.VAR_DEFS[id];
    var unlocked = game.isUnlocked(id);
    var lv = game.s.vars[id] || 0;
    var val = game.varValue(id);
    var cost = game.costLog(id);
    var can = game.canBuy(id);
    var nextMs = 10 - (lv % 10);
    var locked = !unlocked;
    var why = "";
    if (locked) {
      if (def.starGate && !(game.s.starShop && game.s.starShop[def.starGate] > 0)) {
        why = "Purchase in the Stars shop";
      } else {
        why = "Unlocks at f(t) ≥ " + formatLog(def.unlockLog);
      }
    }
    var hover = game.hovered === id ? " hovered" : "";
    var has10 = !locked && game.s.starShop && game.s.starShop.buy10 > 0;
    var html = '<div class="var-row' + (locked ? " locked" : "") + (has10 ? " has-10" : "") + hover + '" data-id="' + id + '">';
    html += '<div class="var-name">' + def.name + "</div>";
    html += '<div class="var-info">';
    if (locked) {
      html += '<div class="val">' + why + "</div>";
      html += '<div class="eff">' + def.blurb + "</div>";
    } else {
      html += '<div class="val">' + def.name + " = " + formatJS(val, 2) + " <span style='color:var(--ink-mute)'>lv " + lv + "</span></div>";
      html += '<div class="eff">×' + formatJS(val, 2) + " on the exponent";
      if (!compact) html += " · next ×2-style bump in " + nextMs + " buys";
      html += "</div>";
    }
    html += "</div>";
    if (!locked) {
      html += '<div class="var-cost"><span class="n">' + formatLog(cost) + "</span>cost</div>";
      html += '<button class="btn" data-buy="1" data-id="' + id + '"' + (can ? "" : " disabled") + ">Buy 1</button>";
      if (game.s.starShop && game.s.starShop.buy10 > 0) {
        html += '<button class="btn" data-buy="10" data-id="' + id + '"' + (can ? "" : " disabled") + ">Buy 10</button>";
      }
      html += '<button class="btn primary" data-buy="max" data-id="' + id + '"' + (can ? "" : " disabled") + ">Buy max</button>";
    }
    html += "</div>";
    return html;
  }

  function renderVars(into, compact) {
    var ids = [];
    Game.VAR_ORDER.forEach(function (id) {
      if (game.isUnlocked(id)) ids.push(id);
    });
    var nxt = game.nextLocked();
    if (nxt) ids.push(nxt);
    var pending = game.starGatedPending();
    if (pending.length && ids.indexOf(pending[0]) < 0) ids.push(pending[0]);
    into.innerHTML = ids.map(function (id) { return varRow(id, compact); }).join("");
  }

  function bindVarClicks(root) {
    root.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-buy]");
      if (!t) return;
      var id = t.getAttribute("data-id");
      game.hovered = id;
      var mode = t.getAttribute("data-buy");
      var n = game.buy(id, mode === "max" ? "max" : (mode === "10" ? 10 : false));
      if (n) save(false);
      paint(true);
      if (n) punchBuy(id);
    });
    root.addEventListener("mouseover", function (ev) {
      var row = ev.target.closest(".var-row");
      if (row && row.getAttribute("data-id")) game.hovered = row.getAttribute("data-id");
    });
  }

  /* ----- upgrades ----- */
  function renderUpgrades() {
    var rows = [
      {
        id: "dt",
        name: "dt — time speed",
        desc: "Equation time runs faster. t and production both scale with dt.  " + game.s.up.dt + " / 12",
        cost: game.upgradeCostLog("dt"),
        can: game.canUpgrade("dt"),
        effect: "dt = " + formatJS(game.dtSpeed(), 3)
      },
      {
        id: "cheapX",
        name: "Leaner x",
        desc: "x costs grow more slowly.  " + game.s.up.cheapX + " / 8",
        cost: game.upgradeCostLog("cheapX"),
        can: game.canUpgrade("cheapX"),
        effect: "×" + game.xGrowth().toFixed(2) + " per level"
      }
    ];
    var html = "";
    rows.forEach(function (u) {
      var maxed = !isFinite(u.cost);
      html += '<div class="up-row">';
      html += '<div class="var-name" style="font-size:16px;letter-spacing:0.04em;font-style:normal;font-family:var(--sans)">' + (u.id === "dt" ? "dt" : "x′") + "</div>";
      html += '<div class="var-info"><div class="val">' + u.name + '</div><div class="eff">' + u.desc + " · " + u.effect + "</div></div>";
      html += '<div class="var-cost"><span class="n">' + (maxed ? "✓" : formatLog(u.cost)) + "</span>" + (maxed ? "owned" : "cost") + "</div>";
      html += '<span></span>';
      html += '<button class="btn primary" data-up="' + u.id + '"' + (u.can && !maxed ? "" : " disabled") + ">Buy</button>";
      html += "</div>";
    });
    $("upgrade-table").innerHTML = html;
  }

  function renderMuUp() {
    if (game.s.prestiges < 1 && game.s.rewrites < 1) {
      $("mu-upgrades").innerHTML = '<p style="color:var(--ink-mute);font-size:13px">Complete a prestige to unlock lemmas bought with μ.</p>';
      return;
    }
    var html = "";
    Game.MU_UPS.forEach(function (u) {
      var lv = game.s.muUp[u.id] || 0;
      var cost = game.muUpgradeCost(u.id);
      var maxed = !isFinite(cost) || lv >= u.max;
      var can = !maxed && game.s.mu >= cost;
      html += '<div class="up-row">';
      html += '<div class="var-name" style="font-size:16px;font-style:normal;font-family:var(--sans)">' + u.short + "</div>";
      html += '<div class="var-info"><div class="val">' + u.name + " <span style='color:var(--ink-mute)'>lv " + lv + " / " + u.max + "</span></div>";
      html += '<div class="eff">' + u.desc + "</div></div>";
      html += '<div class="var-cost"><span class="n">' + (maxed ? "✓" : formatJS(cost, 2)) + "</span>" + (maxed ? "owned" : "μ") + "</div>";
      html += "<span></span>";
      html += '<button class="btn primary" data-mu="' + u.id + '"' + (can ? "" : " disabled") + ">Buy</button>";
      html += "</div>";
    });
    $("mu-upgrades").innerHTML = html;
  }

  /* ----- stats ----- */
  function renderStats() {
    var s = game.s;
    var cells = [
      ["f(t)", s.fLayer ? formatNum(new Num(s.fLog, s.fLayer)) : formatLog(s.fLog)],
      ["t this run", formatTime(s.t)],
      ["b", formatJS(s.b, 3)],
      ["μ (spendable)", formatJS(s.mu, 2)],
      ["φ", formatJS(game.phi(), 3)],
      ["τ", formatJS(game.tau(), 3)],
      ["Stars", String(s.stars) + " / " + String(s.starsTotal || 0) + " earned"],
      ["Max f (lifetime)", s.maxFLayer > 0 ? formatNum(new Num(s.maxFLog, s.maxFLayer)) : formatLog(s.maxFLog)],
      ["Max f this run", formatLog(s.runMaxFLog)],
      ["Prestiges", String(s.prestiges)],
      ["Rewrites", String(s.rewrites || 0)],
      ["Lifetime μ", formatJS(s.lifetimeMu, 2)],
      ["Play time", formatTime(s.playTime)],
      ["Run time", formatTime(s.runTime)],
      ["Buys", String(s.totalBuys)],
      ["dt", formatJS(game.dtSpeed(), 3)]
    ];
    $("stats-grid").innerHTML = cells.map(function (c) {
      var gk = /[μφατλσρΠ]/.test(c[0]) ? " greek" : "";
      return '<div class="stat-cell"><div class="k' + gk + '">' + c[0] + '</div><div class="v">' + c[1] + "</div></div>";
    }).join("");
  }

  /* ----- prestige / rewrite panel ----- */
  function prestigeProgress() {
    var L = game._prestigeLog();
    return Math.max(0, Math.min(1, L / 12));
  }

  function rewriteProgress() {
    if (game.canRewrite()) return 1;
    if (!game.rewriteUnlocked()) {
      return Math.max(0, Math.min(0.85, game.s.prestiges / 8 * 0.7 + Math.max(0, (game.s.b - 1) / 8) * 0.3));
    }
    var d = game.dphi();
    return Math.max(0, Math.min(1, d / 0.45));
  }

  function renderPrestige() {
    var db = game.db();
    var dmu = game.muGain();
    var can = game.canPrestige();
    $("db-val").textContent = can || db > 0 ? "+" + formatJS(db, 3) : "—";
    $("b-after").textContent = formatJS(game.s.b + db, 3);
    $("dmu-val").textContent = dmu > 0 ? "+" + formatJS(dmu, 2) : "—";
    $("mu-after").textContent = formatJS(game.s.mu + dmu, 2);
    $("p-bar").style.width = (prestigeProgress() * 100).toFixed(1) + "%";
    $("btn-prestige").disabled = !can;
    $("btn-prestige-mini").disabled = !can;
    if (game.s.prestiges === 0 && (game.s.vars.y || 0) === 0) {
      $("p-hint").textContent = "Waiting for y (~1e22) makes a stronger first prestige. The button still works if you want to go now.";
    } else if (!can) {
      var L = game._prestigeLog();
      $("p-hint").textContent = "Prestige opens as log10(f) approaches 12. Currently " + (isFinite(L) ? L.toFixed(2) : "huge") + ".";
    } else {
      $("p-hint").textContent = "Δb is meaningful. Later runs: wait until (b+Δb)/b feels slow to grow.";
    }
    renderMuUp();
    renderRewrite();
  }

  function renderRewrite() {
    var dphi = game.dphi();
    var can = game.canRewrite();
    $("dphi-val").textContent = dphi > 0 ? "+" + formatJS(dphi, 3) : "—";
    $("phi-after").textContent = formatJS(game.phi() + dphi, 3);
    $("rewrite-count").textContent = String(game.s.rewrites || 0);
    $("r-bar").style.width = (rewriteProgress() * 100).toFixed(1) + "%";
    $("btn-rewrite").disabled = !can;
    if (!game.rewriteUnlocked()) {
      $("r-hint").textContent = "Unlocks after 8 prestiges and b ≥ 8. Currently " +
        game.s.prestiges + " prestige" + (game.s.prestiges === 1 ? "" : "s") + ", b = " + formatJS(game.s.b, 3) + ".";
    } else if (!can) {
      $("r-hint").textContent = "Raise b further. Δφ opens at 0.45 (now " + formatJS(dphi, 3) + "). The floor is not free at b = 8.";
    } else {
      $("r-hint").textContent = "Rewriting returns b to 1 and raises φ, the power on Π. Autobuy and μ lemmas stay. Theories open after the first rewrite.";
    }
  }

  /* ----- stars ----- */
  function renderStars() {
    var s = game.s;
    $("star-have").textContent = String(s.stars || 0);
    $("star-total").textContent = String(s.starsTotal || 0);
    var achHtml = "";
    Game.ACHIEVEMENTS.forEach(function (a) {
      var done = !!(s.achievements && s.achievements[a.id]);
      achHtml += '<div class="ach-row' + (done ? " done" : "") + '">';
      achHtml += '<div><div class="val">' + a.name + '</div><div class="eff">' + a.desc + "</div></div>";
      achHtml += '<div class="stars">' + (done ? "got " : "") + a.stars + " ★</div>";
      achHtml += "</div>";
    });
    $("ach-list").innerHTML = achHtml;

    var shopHtml = "";
    Game.STAR_SHOP.forEach(function (item) {
      var lv = (s.starShop && s.starShop[item.id]) || 0;
      var cost = game.starShopCost(item.id);
      var maxed = lv >= item.max;
      var can = !maxed && s.stars >= cost;
      var label = item.max > 1 ? (item.name + "  " + lv + " / " + item.max) : item.name;
      shopHtml += '<div class="up-row">';
      shopHtml += '<div class="var-name" style="font-size:16px;font-style:normal;font-family:var(--sans)">★</div>';
      shopHtml += '<div class="var-info"><div class="val">' + label + '</div><div class="eff">' + item.desc;
      if (item.id === "prodMult") shopHtml += "  ·  ×" + formatJS(game.starMult(), 2);
      shopHtml += "</div></div>";
      shopHtml += '<div class="var-cost"><span class="n">' + (maxed ? "✓" : String(cost)) + "</span>" + (maxed ? "owned" : "stars") + "</div>";
      shopHtml += "<span></span>";
      shopHtml += '<button class="btn primary" data-star="' + item.id + '"' + (can ? "" : " disabled") + ">Buy</button>";
      shopHtml += "</div>";
    });
    $("star-shop").innerHTML = shopHtml;

    var apOn = !!(s.starShop && s.starShop.autoPrestige > 0);
    $("auto-p-wrap").hidden = !apOn;
    if (apOn) {
      $("auto-prestige").checked = !!s.autoPrestige;
      $("auto-p-thr").value = String(s.autoPrestigeThreshold || 1);
    }
    var notOn = !!(s.starShop && s.starShop.notation > 0);
    $("notation-wrap").hidden = !notOn;
    if (notOn) {
      $("notation-sel").value = s.notation || "mix";
      if (typeof setNotation === "function") setNotation(s.notation || "mix");
    }
  }

  /* ----- theories ----- */
  function thUpRow(tid, which, name, desc, costLabel) {
    var cost = game.theoryCost(tid, which);
    var can = game.canBuyTheory(tid, which);
    var lv = game.s.theories[tid][which];
    var html = '<div class="up-row">';
    html += '<div class="var-name" style="font-size:18px">' + name + "</div>";
    html += '<div class="var-info"><div class="val">' + desc + " <span style='color:var(--ink-mute)'>lv " + lv + "</span></div>";
    html += '<div class="eff">cost ' + formatJS(cost, 2) + " " + costLabel + "</div></div>";
    html += '<div class="var-cost"><span class="n">' + formatJS(cost, 2) + "</span>" + costLabel + "</div>";
    html += "<span></span>";
    html += '<button class="btn primary" data-thbuy="' + tid + '" data-which="' + which + '"' + (can ? "" : " disabled") + ">Buy</button>";
    html += "</div>";
    return html;
  }

  function renderTheories(force) {
    var open = game.theoriesUnlocked();
    $("theories-locked").hidden = open;
    $("theories-open").hidden = !open;
    var tabBtn = $("tab-theories");
    if (tabBtn) tabBtn.classList.toggle("dim", !open);
    if (!open) return;

    var th = game.s.theories;
    var rec = th.recurrence;
    var du = th.dual;
    var active = th.active || "recurrence";
    $("tau-big").textContent = formatJS(game.tau(), 3);

    $("th-card-recurrence").classList.toggle("is-active", active === "recurrence");
    $("th-card-dual").classList.toggle("is-active", active === "dual");
    $("btn-act-recurrence").textContent = active === "recurrence" ? "Active" : "Set active";
    $("btn-act-dual").textContent = active === "dual" ? "Active" : "Set active";
    $("btn-act-recurrence").disabled = active === "recurrence";
    $("btn-act-dual").disabled = active === "dual";

    $("th-rho").textContent = formatJS(rec.rho, 2);
    $("th-maxrho").textContent = formatJS(rec.maxRho, 2);
    $("th-tau1").textContent = formatJS(rec.tau, 3);
    $("th-rate1").textContent = formatJS(game.theoryRate("recurrence"), 2);

    $("th-lam").textContent = formatJS(du.lambda, 2);
    $("th-sig").textContent = formatJS(du.sigma, 2);
    $("th-tau2").textContent = formatJS(du.tau, 3);
    $("th-rate2").textContent = formatJS(game.theoryRate("dual").sigma, 2);

    var can1 = game.canPublish("recurrence");
    var can2 = game.canPublish("dual");
    $("btn-pub-recurrence").disabled = !can1;
    $("btn-pub-dual").disabled = !can2;
    var g1 = game.theoryPubValue("recurrence");
    var g2 = game.theoryPubValue("dual");
    $("th-pub-recurrence").textContent = can1
      ? ("Publish resets ρ and cᵢ. Next τ₁ ≈ " + formatJS(rec.tau > 0 ? rec.tau * (1 + 0.28 * g1) : g1, 3) + ".")
      : "Publish after max ρ ≥ 80 (currently " + formatJS(rec.maxRho, 2) + ").";
    $("th-pub-dual").textContent = can2
      ? ("Publish resets λ, σ and aᵢ. Next τ₂ ≈ " + formatJS(du.tau > 0 ? du.tau * (1 + 0.28 * g2) : g2, 3) + ".")
      : "Publish after max σ ≥ 45 (currently " + formatJS(du.maxSigma, 2) + ").";

    if (force) {
      $("th-up-recurrence").innerHTML =
        thUpRow("recurrence", "c1", "c₁", "Adds to the recurrence step", "ρ") +
        thUpRow("recurrence", "c2", "c₂", "Second factor in the step", "ρ") +
        thUpRow("recurrence", "c3", "c₃", "1.28^{c₃} on the step", "ρ") +
        thUpRow("recurrence", "c4", "c₄", "Linear boost to the step", "ρ");
      $("th-up-dual").innerHTML =
        thUpRow("dual", "a1", "a₁", "λ production (costs λ)", "λ") +
        thUpRow("dual", "a2", "a₂", "1.25^{a₂} on λ (costs λ)", "λ") +
        thUpRow("dual", "a3", "a₃", "σ conversion from λ (costs σ)", "σ") +
        thUpRow("dual", "a4", "a₄", "1.2^{a₄} on σ (costs σ)", "σ");
    }
  }

  /* ----- graph ----- */
  function drawGraph() {
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 640;
    var h = canvas.clientHeight || 240;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, w, h);

    var pts = game.s.graph;
    var padL = 56, padR = 10, padT = 12, padB = 22;
    var gw = w - padL - padR, gh = h - padT - padB;

    ctx.strokeStyle = "#2a2822";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + gh);
    ctx.lineTo(padL + gw, padT + gh);
    ctx.stroke();

    ctx.fillStyle = "#6c665c";
    ctx.font = "10px Eq Sans, sans-serif";
    ctx.fillText("t", padL + gw - 8, padT + gh + 16);
    ctx.save();
    ctx.translate(14, padT + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("log10 f", 0, 0);
    ctx.restore();

    if (!pts.length) return;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var l0 = 0, l1 = 1;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].l > l1) l1 = pts[i].l;
    }
    if (t1 <= t0) t1 = t0 + 1;
    if (l1 <= l0) l1 = 1;

    ctx.fillStyle = "#6c665c";
    ctx.fillText(formatJS(l1, 1), 4, padT + 10);
    ctx.fillText("0", 4, padT + gh);
    ctx.fillText(formatTime(t1), padL + gw - 48, padT + gh + 16);

    ctx.beginPath();
    for (var j = 0; j < pts.length; j++) {
      var x = padL + ((pts[j].t - t0) / (t1 - t0)) * gw;
      var y = padT + gh - (pts[j].l / l1) * gh;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#d4af4a";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = "rgba(108, 102, 92, 0.85)";
    ctx.font = "9px Eq Sans, sans-serif";
    var marked = 0;
    for (var k = 1; k < pts.length && marked < 6; k++) {
      if (pts[k].l < pts[k - 1].l - 0.15) {
        var dx = padL + ((pts[k].t - t0) / (t1 - t0)) * gw;
        var dy = padT + gh - (pts[k].l / l1) * gh;
        ctx.fillText("spend", dx + 2, dy + 10);
        marked++;
        k += 8;
      }
    }

    var grd = ctx.createLinearGradient(0, padT, 0, padT + gh);
    grd.addColorStop(0, "rgba(212,175,74,0.18)");
    grd.addColorStop(1, "rgba(212,175,74,0)");
    ctx.lineTo(padL + gw, padT + gh);
    ctx.lineTo(padL, padT + gh);
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();
  }

  /* ----- paint ----- */
  function paint(force) {
    var s = game.s;
    $("top-t").textContent = formatTime(s.t);
    $("top-b").textContent = formatJS(s.b, 3);
    $("top-mu").textContent = formatJS(s.mu, 2);
    $("top-dt").textContent = formatJS(game.dtSpeed(), 3);
    $("top-phi").textContent = formatJS(game.phi(), 3);
    $("top-tau").textContent = formatJS(game.tau(), 3);
    $("top-stars").textContent = String(s.stars || 0);
    $("cur-phi").hidden = !game.showPhi();
    $("cur-tau").hidden = !game.showTau();
    $("cur-stars").hidden = !game.showStars();

    $("f-value").textContent = fText();
    $("growth").textContent = "+" + formatJS(game.displayRate(), 2) + " decades / s";
    $("t-value").textContent = formatTime(s.t);
    $("b-value").textContent = formatJS(s.b, 3);
    $("mu-value").textContent = formatJS(s.mu, 2);
    $("phi-value").textContent = formatJS(game.phi(), 3);
    $("tau-value").textContent = formatJS(game.tau(), 3);
    $("meta-phi").hidden = !game.showPhi();
    $("meta-tau").hidden = !game.showTau();
    paintFormula();
    checkDecade();
    var eqHint = $("eq-hint");
    if (eqHint) {
      eqHint.hidden = !((s.prestiges || 0) === 0 && (s.rewrites || 0) === 0 && (s.vars.x || 0) === 0);
    }
    if (typeof setNotation === "function") setNotation(s.notation || "mix");
    $("foot-rate").textContent = "d(log₁₀ f)/dt = " + formatJS(game.displayRate(), 3);

    $("btn-prestige-mini").disabled = !game.canPrestige();
    $("autobuy-wrap").hidden = !game.autobuyAvailable();
    $("autobuy").checked = !!s.autobuy;

    var pending = game.starGatedPending();
    var hint = $("var-star-hint");
    if (pending.length) {
      var names = pending.map(function (id) { return Game.VAR_DEFS[id].name; }).join(", ");
      hint.hidden = false;
      hint.textContent = "Later variables (" + names + ") are admitted from the Stars shop, then still need high f this run.";
    } else {
      hint.hidden = true;
    }

    if (force) {
      if (anyVarFlash()) applyVarFlashes();
      else {
        renderVars($("eq-vars"), true);
        renderVars($("var-table"), false);
        applyVarFlashes();
      }
      renderUpgrades();
      renderPrestige();
      renderStars();
      renderTheories(true);
      renderStats();
    } else {
      // Refresh affordance on a slower cadence so buttons do not jitter.
      if (!paint._acc) paint._acc = 0;
      paint._acc += 0.05;
      if (paint._acc >= 0.28) {
        paint._acc = 0;
        var flashing = anyVarFlash();
        if (tab === "equation") {
          if (flashing) applyVarFlashes();
          else renderVars($("eq-vars"), true);
        }
        if (tab === "variables") {
          if (flashing) applyVarFlashes();
          else renderVars($("var-table"), false);
        }
        if (tab === "upgrades") renderUpgrades();
        if (tab === "prestige") renderPrestige();
        if (tab === "stars") renderStars();
        if (tab === "theories") renderTheories(true);
        if (tab === "stats") renderStats();
      } else if (tab === "prestige") {
        $("db-val").textContent = game.canPrestige() || game.db() > 0 ? "+" + formatJS(game.db(), 3) : "—";
        $("p-bar").style.width = (prestigeProgress() * 100).toFixed(1) + "%";
        $("btn-prestige").disabled = !game.canPrestige();
        $("dphi-val").textContent = game.dphi() > 0 ? "+" + formatJS(game.dphi(), 3) : "—";
        $("r-bar").style.width = (rewriteProgress() * 100).toFixed(1) + "%";
        $("btn-rewrite").disabled = !game.canRewrite();
      } else if (tab === "theories" && game.theoriesUnlocked()) {
        renderTheories(false);
      }
    }

    drawGraph();
    drainEvents();
  }

  /* ----- clicks ----- */
  bindVarClicks($("eq-vars"));
  bindVarClicks($("var-table"));

  $("upgrade-table").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-up]");
    if (t) {
      game.buyUpgrade(t.getAttribute("data-up"));
      paint(true); save(false);
    }
  });
  $("mu-upgrades").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-mu]");
    if (t) {
      game.buyMuUpgrade(t.getAttribute("data-mu"));
      paint(true); save(true);
    }
  });
  $("autobuy").addEventListener("change", function () {
    game.s.autobuy = $("autobuy").checked;
    save(false);
  });

  $("star-shop").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-star]");
    if (!t) return;
    if (game.buyStarShop(t.getAttribute("data-star"))) {
      paint(true); save(true);
    }
  });
  $("auto-prestige").addEventListener("change", function () {
    game.s.autoPrestige = $("auto-prestige").checked;
    save(false);
  });
  $("auto-p-thr").addEventListener("change", function () {
    var n = parseFloat($("auto-p-thr").value);
    if (isFinite(n) && n > 0) game.s.autoPrestigeThreshold = n;
    save(false);
  });
  $("notation-sel").addEventListener("change", function () {
    var v = $("notation-sel").value;
    if (v === "sci" || v === "eng" || v === "mix") {
      game.s.notation = v;
      if (typeof setNotation === "function") setNotation(v);
      paint(true); save(false);
    }
  });

  $("panel-theories").addEventListener("click", function (ev) {
    var act = ev.target.closest("[data-activate]");
    if (act) {
      game.setActiveTheory(act.getAttribute("data-activate"));
      paint(true); save(false);
      return;
    }
    var buy = ev.target.closest("[data-thbuy]");
    if (buy) {
      if (game.buyTheory(buy.getAttribute("data-thbuy"), buy.getAttribute("data-which"))) {
        paint(true); save(false);
      }
      return;
    }
  });
  function openPublishModal(tid) {
    if (!game.canPublish(tid)) return;
    publishArmed = tid;
    var gain = game.theoryPubValue(tid);
    var th = game.s.theories[tid];
    var next = th.tau > 0 ? th.tau * (1 + 0.28 * gain) : gain;
    $("m-pub-gain").textContent = "τₙ → " + formatJS(next, 3);
    $("m-pub-body").textContent = tid === "recurrence"
      ? "ρ and c₁–c₄ return to their start. Published τ₁ stays."
      : "λ, σ and aᵢ return to their start. Published τ₂ stays.";
    $("modal-publish").classList.add("open");
  }
  function doPublish() {
    $("modal-publish").classList.remove("open");
    var tid = publishArmed;
    publishArmed = null;
    if (tid && game.publishTheory(tid)) { paint(true); save(true); }
  }
  $("btn-pub-recurrence").addEventListener("click", function () { openPublishModal("recurrence"); });
  $("btn-pub-dual").addEventListener("click", function () { openPublishModal("dual"); });
  $("pub-cancel").addEventListener("click", function () {
    $("modal-publish").classList.remove("open");
    publishArmed = null;
  });
  $("pub-go").addEventListener("click", doPublish);

  function openPrestigeModal() {
    if (!game.canPrestige()) return;
    $("m-db").textContent = "+" + formatJS(game.db(), 3);
    $("m-mu").textContent = "+" + formatJS(game.muGain(), 2);
    $("modal-prestige").classList.add("open");
    prestigeArmed = true;
  }
  function doPrestige() {
    $("modal-prestige").classList.remove("open");
    prestigeArmed = false;
    if (game.prestige()) {
      save(true);
      hushJuice();
      paint(true);
    }
  }
  function openRewriteModal() {
    if (!game.canRewrite()) return;
    $("m-dphi").textContent = "+" + formatJS(game.dphi(), 3);
    $("modal-rewrite").classList.add("open");
    rewriteArmed = true;
  }
  function doRewrite() {
    $("modal-rewrite").classList.remove("open");
    rewriteArmed = false;
    if (game.rewrite()) {
      save(true);
      hushJuice();
      paint(true);
    }
  }
  $("btn-prestige").addEventListener("click", openPrestigeModal);
  $("btn-prestige-mini").addEventListener("click", openPrestigeModal);
  $("m-cancel").addEventListener("click", function () {
    $("modal-prestige").classList.remove("open");
    prestigeArmed = false;
  });
  $("m-go").addEventListener("click", doPrestige);
  $("btn-rewrite").addEventListener("click", openRewriteModal);
  $("rw-cancel").addEventListener("click", function () {
    $("modal-rewrite").classList.remove("open");
    rewriteArmed = false;
  });
  $("rw-go").addEventListener("click", doRewrite);

  $("btn-export").addEventListener("click", function () {
    var json = game.serialize();
    $("save-box").value = json;
    try {
      navigator.clipboard.writeText(json);
      toast("Save copied to clipboard.");
    } catch (e) {
      toast("Save placed in the box below.");
    }
  });
  $("btn-import").addEventListener("click", function () {
    var raw = $("save-box").value.trim();
    if (!raw) { toast("Paste a save JSON first."); return; }
    if (game.loadJSON(raw)) {
      save(true);
      hushJuice(true);
      paint(true);
      toast("Save imported.");
    } else toast("Could not read that save.");
  });
  $("btn-reset").addEventListener("click", function () {
    $("modal-reset").classList.add("open");
  });
  $("r-cancel").addEventListener("click", function () { $("modal-reset").classList.remove("open"); });
  document.querySelectorAll(".modal").forEach(function (m) {
    m.addEventListener("click", function (ev) {
      if (ev.target === m) closeModals();
    });
  });
  $("r-go").addEventListener("click", function () {
    $("modal-reset").classList.remove("open");
    game.hardReset();
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_LEGACY);
    } catch (e) {}
    hushJuice(true);
    paint(true);
  });

  window.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { closeModals(); return; }
    if (ev.target && (ev.target.tagName === "TEXTAREA" || ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT")) return;
    var k = ev.key;
    if (k === "m" || k === "M") {
      var id = game.hovered || "x";
      if (game.buy(id, true)) { paint(true); save(false); punchBuy(id); }
    } else if (k === "p" || k === "P") {
      if (prestigeArmed) doPrestige();
      else openPrestigeModal();
    } else if (k === "r" || k === "R") {
      if (rewriteArmed) doRewrite();
      else openRewriteModal();
    } else if (k === "1") setTab("equation");
    else if (k === "2") setTab("variables");
    else if (k === "3") setTab("upgrades");
    else if (k === "4") setTab("prestige");
    else if (k === "5") setTab("stars");
    else if (k === "6") setTab("theories");
    else if (k === "7") setTab("stats");
  });

  /* ----- save ----- */
  function closeModals() {
    document.querySelectorAll(".modal.open").forEach(function (m) {
      m.classList.remove("open");
    });
    prestigeArmed = false;
    rewriteArmed = false;
    publishArmed = null;
  }

  function save(force) {
    try { localStorage.setItem(SAVE_KEY, game.serialize()); } catch (e) {}
  }

  function load() {
    var raw = null;
    var fromLegacy = false;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      try { raw = localStorage.getItem(SAVE_KEY_LEGACY); } catch (e2) { raw = null; }
      fromLegacy = !!raw;
    }
    if (!raw) return;
    var last = game.loadJSON(raw);
    if (!last) return;
    if (fromLegacy) {
      save(true);
    }
    var elapsed = (Date.now() - last) / 1000;
    var recap = game.applyOffline(elapsed);
    if (recap && recap.grant >= 2) {
      toast(
        "<b>While you were away</b> (" + formatTime(recap.grant) + "), f(t) grew from " +
        formatLog(recap.before.log) + " to " + formatLog(recap.afterLog) + ".",
        7000
      );
    }
  }

  /* ----- loop ----- */
  canvas = $("graph");
  ctx = canvas.getContext("2d");

  load();
  paint(true);
  save(true);

  var acc = 0;
  var last = performance.now();
  var saveAcc = 0;
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    var step = 1 / 25;
    while (acc >= step) {
      game.tick(step);
      acc -= step;
    }
    saveAcc += dt;
    if (saveAcc >= 4) { saveAcc = 0; save(false); }
    if (now - lastPaint > 50) {
      lastPaint = now;
      paint(false);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("beforeunload", function () { save(true); });
})();
