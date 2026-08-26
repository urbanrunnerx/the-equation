/**
 * The Equation — core simulation.
 * Growth:  f(t+dt) = f(t) * exp(b * Π(vars) * dt)
 * Stored as log10:  d(log10 f)/dt = b * Π(vars) * dtSpeed * log10(e)
 * Buying divides f by the cost (fLog -= costLog), so spending always bites.
 */
(function (root) {
  "use strict";

  var LOG10E = Math.LOG10E;

  var VAR_ORDER = ["x", "y", "z", "u", "v"];

  var VAR_DEFS = {
    x: {
      id: "x",
      name: "x",
      title: "Linear term",
      blurb: "Adds itself to the exponent. First and always owned.",
      unlockLog: -Infinity,
      costLog0: 1,          // 10
      growth: 3,
      quad: 0.014,
      flavor: "the independent variable"
    },
    y: {
      id: "y",
      name: "y",
      title: "Second factor",
      blurb: "Multiplies the exponent. Unlocks as f(t) grows.",
      unlockLog: 22.0,
      costLog0: 22.0,
      growth: 8,
      quad: 0.055,
      flavor: "a second axis of growth"
    },
    z: {
      id: "z",
      name: "z",
      title: "Third factor",
      blurb: "Another multiplier on the exponent.",
      unlockLog: 40,
      costLog0: 40,
      growth: 12,
      quad: 0.08,
      flavor: "depth"
    },
    u: {
      id: "u",
      name: "u",
      title: "Fourth factor",
      blurb: "Late-run multiplier. Expensive, decisive.",
      unlockLog: 70,
      costLog0: 70,
      growth: 18,
      quad: 0.11,
      flavor: "a change of variables"
    },
    v: {
      id: "v",
      name: "v",
      title: "Fifth factor",
      blurb: "The last variable of this edition.",
      unlockLog: 130,
      costLog0: 130,
      growth: 25,
      quad: 0.14,
      flavor: "the outer term"
    }
  };

  function defaultState() {
    return {
      v: 1,
      t: 0,
      fLog: 0,             // log10(f), f starts at 1
      fLayer: 0,
      b: 1,
      mu: 0,
      muTotal: 0,
      vars: { x: 0, y: 0, z: 0, u: 0, v: 0 },
      up: { dt: 0, cheapX: 0 },
      muUp: { y: 0, dt: 0 },
      autobuy: false,
      autobuyAcc: 0,
      prestiges: 0,
      maxFLog: 0,
      maxFLayer: 0,
      runMaxFLog: 0,
      playTime: 0,
      runTime: 0,
      lastSave: Date.now(),
      lifetimeMu: 0,
      totalBuys: 0,
      lastRate: 0,           // d(log10 f)/d(real s) at last tick — for offline
      graph: [],
      graphTAcc: 0
    };
  }

  function Game() {
    this.s = defaultState();
    this.hovered = "x";
    this.events = [];        // {type, text, at}
    this._saveTimer = 0;
  }

  Game.VAR_ORDER = VAR_ORDER;
  Game.VAR_DEFS = VAR_DEFS;

  Game.prototype.emit = function (type, text) {
    this.events.push({ type: type, text: text, at: Date.now() });
  };

  /* ---------- derived ---------- */

  Game.prototype.dtSpeed = function () {
    var s = this.s;
    // Base dt: equation-seconds per real second. Upgrades raise it.
    // f-upgrades multiply; μ-upgrades add.
    var dt = 0.075 * Math.pow(1.18, Math.min(s.up.dt, 12)) + 0.05 * s.muUp.dt;
    return dt;
  };

  Game.prototype.xGrowth = function () {
    var g = 3 * Math.pow(0.93, this.s.up.cheapX);
    return Math.max(2.12, g);
  };

  Game.prototype.varValue = function (id) {
    var lv = this.s.vars[id] || 0;
    // +1 per level, stepwise bump every 10: extra +9 (so the 10th level ~doubles)
    var v = 1 + lv + 9 * Math.floor(lv / 10);
    if (id === "y") {
      // μ upgrade: +1 to y per level, then a small multiplier
      v = (v + this.s.muUp.y) * (1 + 0.08 * this.s.muUp.y);
    }
    return v;
  };

  Game.prototype.isUnlocked = function (id) {
    var def = VAR_DEFS[id];
    if (!def) return false;
    if (def.unlockLog === -Infinity) return true;
    var L = this.s.runMaxFLog;
    if (this.s.maxFLayer > 0 || this.s.fLayer > 0) return true;
    return L + 1e-9 >= def.unlockLog;
  };

  Game.prototype.nextLocked = function () {
    for (var i = 0; i < VAR_ORDER.length; i++) {
      var id = VAR_ORDER[i];
      if (!this.isUnlocked(id)) return id;
    }
    return null;
  };

  Game.prototype.product = function () {
    var p = 1;
    for (var i = 0; i < VAR_ORDER.length; i++) {
      var id = VAR_ORDER[i];
      if (this.isUnlocked(id)) p *= this.varValue(id);
    }
    return p;
  };

  /** Coefficient inside the exp: b * x * y * … */
  Game.prototype.exponentCoeff = function () {
    return this.s.b * this.product();
  };

  /** d(log10 f) / d(real second) */
  Game.prototype.growthRate = function () {
    return this.exponentCoeff() * this.dtSpeed() * LOG10E;
  };

  Game.prototype.costLog = function (id) {
    var def = VAR_DEFS[id];
    var lv = this.s.vars[id] || 0;
    var growth = id === "x" ? this.xGrowth() : def.growth;
    var rlog = Math.log10(growth);
    return def.costLog0 + lv * rlog + def.quad * lv * Math.max(0, lv - 1);
  };

  Game.prototype.canBuy = function (id) {
    if (!this.isUnlocked(id)) return false;
    if (this.s.fLayer > 0) return true;
    return this.s.fLog + 1e-12 >= this.costLog(id);
  };

  Game.prototype.fNum = function () {
    return new root.Num(this.s.fLog, this.s.fLayer);
  };

  /* ---------- mutation ---------- */

  Game.prototype._noteMax = function () {
    var s = this.s;
    if (s.fLayer > s.maxFLayer || (s.fLayer === s.maxFLayer && s.fLog > s.maxFLog)) {
      s.maxFLog = s.fLog;
      s.maxFLayer = s.fLayer;
    }
    if (s.fLayer === 0) {
      if (s.fLog > s.runMaxFLog) s.runMaxFLog = s.fLog;
    } else {
      var equiv = s.fLayer === 1 ? Math.pow(10, s.fLog) : Infinity;
      if (isFinite(equiv) && equiv > s.runMaxFLog) s.runMaxFLog = equiv;
    }
  };

  Game.prototype._spendLog = function (costLog) {
    var s = this.s;
    if (s.fLayer > 0) return true; // cost is dust
    if (s.fLog < costLog - 1e-12) return false;
    s.fLog -= costLog;
    if (s.fLog < -12) s.fLog = -12; // floor near 0
    return true;
  };

  Game.prototype._sumCost = function (id, fromLv, n) {
    if (n <= 0) return 0;
    var def = VAR_DEFS[id];
    var growth = id === "x" ? this.xGrowth() : def.growth;
    var r = Math.log10(growth);
    var q = def.quad;
    var c0 = def.costLog0;
    var a = fromLv;
    var b = fromLv + n - 1;
    var N = n;
    var sumk = N * (a + b) / 2;
    var sumk2 = (b * (b + 1) * (2 * b + 1) - (a - 1) * a * (2 * a - 1)) / 6;
    if (a === 0) sumk2 = (b * (b + 1) * (2 * b + 1)) / 6;
    var sumkk1 = sumk2 - sumk;
    return N * c0 + r * sumk + q * sumkk1;
  };

  Game.prototype.buyableCount = function (id) {
    if (!this.isUnlocked(id) || this.s.fLayer === 0 && this.s.fLog < this.costLog(id)) return 0;
    if (this.s.fLayer > 0) return 8;
    var budget = this.s.fLog;
    var lv = this.s.vars[id];
    var lo = 0, hi = 1;
    while (hi < 120 && this._sumCost(id, lv, hi) <= budget) {
      lo = hi;
      hi *= 2;
    }
    hi = Math.min(hi, 120);
    while (lo < hi) {
      var mid = Math.floor((lo + hi + 1) / 2);
      if (this._sumCost(id, lv, mid) <= budget + 1e-12) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  Game.prototype.buy = function (id, max) {
    if (!this.isUnlocked(id)) return 0;
    var n = max ? this.buyableCount(id) : (this.canBuy(id) ? 1 : 0);
    if (n <= 0) return 0;
    if (!max) n = 1;
    var lv = this.s.vars[id];
    var total = this._sumCost(id, lv, n);
    if (!this._spendLog(total)) {
      // fallback one-by-one
      n = 0;
      while (this.canBuy(id) && n < 200) {
        if (!this._spendLog(this.costLog(id))) break;
        this.s.vars[id] += 1;
        n++;
      }
      this.s.totalBuys += n;
      return n;
    }
    var before = lv;
    this.s.vars[id] += n;
    this.s.totalBuys += n;
    var after = this.s.vars[id];
    var m10 = Math.floor(after / 10) - Math.floor(before / 10);
    if (m10 > 0) {
      this.emit("milestone", id + " milestone ×" + this.varValue(id).toFixed(0) + " at level " + after);
    }
    return n;
  };

  Game.prototype.buyUpgrade = function (which) {
    var s = this.s;
    if (which === "dt" && s.up.dt >= 12) return false;
    if (which === "cheapX" && s.up.cheapX >= 8) return false;
    var cost = this.upgradeCostLog(which);
    if (!isFinite(cost)) return false;
    if (s.fLayer === 0 && s.fLog < cost) return false;
    if (!this._spendLog(cost)) return false;
    s.up[which] += 1;
    if (which === "dt") this.emit("up", "dt increased to " + this.dtSpeed().toFixed(3));
    else this.emit("up", "x costs grow ×" + this.xGrowth().toFixed(2) + " per level");
    return true;
  };

  Game.prototype.upgradeCostLog = function (which) {
    var s = this.s;
    if (which === "dt") {
      if (s.up.dt >= 12) return Infinity;
      return 3.8 + s.up.dt * 2.4 + 0.35 * s.up.dt * s.up.dt;
    }
    if (which === "cheapX") {
      if (s.up.cheapX >= 8) return Infinity;
      return 4.5 + s.up.cheapX * 3.0 + 0.5 * s.up.cheapX * s.up.cheapX;
    }
    return Infinity;
  };

  Game.prototype.canUpgrade = function (which) {
    if (this.s.fLayer > 0) return true;
    return this.s.fLog >= this.upgradeCostLog(which);
  };

  Game.prototype.muUpgradeCost = function (which) {
    var lv = this.s.muUp[which] || 0;
    if (which === "y") return 5 * Math.pow(3.2, lv);
    if (which === "dt") return 8 * Math.pow(2.8, lv);
    return Infinity;
  };

  Game.prototype.buyMuUpgrade = function (which) {
    var cost = this.muUpgradeCost(which);
    if (this.s.mu < cost) return false;
    this.s.mu -= cost;
    this.s.muUp[which] += 1;
    this.emit("up", which === "y" ? "y-production lemma strengthened" : "dt lemma strengthened");
    return true;
  };

  /** Spend a slice of f to push t forward. Optional, not a clicker. */
  Game.prototype.advance = function () {
    var s = this.s;
    if (s.fLayer === 0 && s.fLog < 0.3) return false;
    var slice = 0.045757; // ~10% of f
    if (s.fLayer === 0) s.fLog -= slice;
    var push = 1.75; // seconds of real production
    this._applyGrowth(push);
    s.t += this.dtSpeed() * push;
    return true;
  };

  /* ---------- prestige ---------- */

  Game.prototype._prestigeLog = function () {
    if (this.s.fLayer > 0 || this.s.maxFLayer > 0) return Math.max(this.s.runMaxFLog, 1e10);
    return Math.max(this.s.runMaxFLog, this.s.fLog);
  };

  Game.prototype.db = function () {
    var L = this._prestigeLog();
    if (L < 12) return 0;
    // Gentle: first prestige ~ +1.0 to +2.0 b; later logs still grow db.
    if (L > 1e8) L = 1e8 + Math.log10(L);
    return Math.pow(L / 24, 0.85);
  };

  Game.prototype.muGain = function () {
    var L = this._prestigeLog();
    if (L > 1e8) L = 1e8 + Math.log10(L);
    return Math.max(0, L);
  };

  Game.prototype.canPrestige = function () {
    return this.db() >= 0.18;
  };

  Game.prototype.prestige = function () {
    if (!this.canPrestige()) return false;
    var db = this.db();
    var dmu = this.muGain();
    this.s.b += db;
    this.s.mu += dmu;
    this.s.muTotal += dmu;
    this.s.lifetimeMu += dmu;
    this.s.prestiges += 1;
    this.s.t = 0;
    this.s.fLog = 0;
    this.s.fLayer = 0;
    this.s.vars = { x: 0, y: 0, z: 0, u: 0, v: 0 };
    this.s.up = { dt: 0, cheapX: 0 };
    this.s.runTime = 0;
    this.s.runMaxFLog = 0;
    this.s.graph = [];
    this.s.graphTAcc = 0;
    this.s.lastRate = 0;
    this.emit("prestige", "b → " + root.formatJS(this.s.b, 3) + "   μ +" + root.formatJS(dmu, 2));
    return true;
  };

  /* ---------- tick ---------- */

  Game.prototype._applyGrowth = function (realDt) {
    var s = this.s;
    var dL = this.growthRate() * realDt;
    // One tick cannot skip decades of notation; keeps prestige μ/b sane.
    if (s.fLayer === 0 && dL > 6) dL = 6;
    s.lastRate = this.growthRate();
    if (s.fLayer === 0) {
      s.fLog += dL;
      if (s.fLog > s.runMaxFLog) s.runMaxFLog = s.fLog;
      if (s.fLog > 1e10) {
        s.runMaxFLog = Math.max(s.runMaxFLog, s.fLog);
        s.fLayer = 1;
        s.fLog = Math.log10(Math.min(s.fLog, 1e308));
      }
    } else if (s.fLayer === 1) {
      var slog = Math.pow(10, s.fLog);
      if (isFinite(slog)) {
        s.fLog = Math.log10(slog + dL);
      }
    }
    this._noteMax();
  };

  Game.prototype.tick = function (realDt) {
    if (realDt < 0) realDt = 0;
    if (realDt > 0.25) realDt = 0.25; // in-loop clamp; offline is separate
    var s = this.s;
    var prevLocked = this.nextLocked();

    if (s.autobuy && s.prestiges >= 1) {
      s.autobuyAcc = (s.autobuyAcc || 0) + realDt;
      if (s.autobuyAcc >= 0.4) {
        s.autobuyAcc = 0;
        for (var i = 0; i < VAR_ORDER.length; i++) {
          var id = VAR_ORDER[i];
          if (this.isUnlocked(id)) this.buy(id, true);
        }
      }
    }

    this._applyGrowth(realDt);
    s.t += this.dtSpeed() * realDt;
    s.playTime += realDt;
    s.runTime += realDt;

    if (prevLocked && this.isUnlocked(prevLocked)) {
      this.emit("unlock", "Variable " + prevLocked + " entered the equation.");
    }

    s.graphTAcc += realDt;
    if (s.graphTAcc >= 0.08) {
      s.graphTAcc = 0;
      var L = s.fLayer === 0 ? s.fLog : 1e10 + s.fLog;
      s.graph.push({ t: s.t, l: Math.max(0, L) });
      if (s.graph.length > 720) s.graph.splice(0, s.graph.length - 600);
    }
  };

  Game.prototype.applyOffline = function (elapsedSec) {
    var cap = 8 * 3600;
    var grant = Math.min(Math.max(0, elapsedSec), cap);
    if (grant < 1) return null;
    var rate = this.s.lastRate || this.growthRate();
    var before = { log: this.s.fLog, layer: this.s.fLayer, t: this.s.t };
    // Apply at last known rate (no extra buys while away)
    if (this.s.fLayer === 0) {
      this.s.fLog += rate * grant;
      if (this.s.fLog > 1e10) {
        this.s.fLayer = 1;
        this.s.fLog = Math.log10(this.s.fLog);
      }
    }
    this.s.t += this.dtSpeed() * grant;
    this.s.playTime += grant;
    this.s.runTime += grant;
    this._noteMax();
    return {
      grant: grant,
      before: before,
      afterLog: this.s.fLog,
      afterLayer: this.s.fLayer
    };
  };

  /* ---------- save ---------- */

  Game.prototype.serialize = function () {
    var s = this.s;
    return JSON.stringify({
      v: 1,
      t: s.t,
      fLog: s.fLog,
      fLayer: s.fLayer,
      b: s.b,
      mu: s.mu,
      muTotal: s.muTotal,
      vars: s.vars,
      up: s.up,
      muUp: s.muUp,
      autobuy: s.autobuy,
      prestiges: s.prestiges,
      maxFLog: s.maxFLog,
      maxFLayer: s.maxFLayer,
      runMaxFLog: s.runMaxFLog,
      playTime: s.playTime,
      runTime: s.runTime,
      lastSave: Date.now(),
      lifetimeMu: s.lifetimeMu,
      totalBuys: s.totalBuys,
      lastRate: s.lastRate,
      graph: s.graph.slice(-400)
    });
  };

  Game.prototype.loadJSON = function (str) {
    var d;
    try { d = JSON.parse(str); } catch (e) { return false; }
    if (!d || typeof d !== "object") return false;
    var s = defaultState();
    if (typeof d.t === "number") s.t = d.t;
    if (typeof d.fLog === "number") s.fLog = d.fLog;
    if (typeof d.fLayer === "number") s.fLayer = d.fLayer;
    if (typeof d.b === "number") s.b = d.b;
    if (typeof d.mu === "number") s.mu = d.mu;
    if (typeof d.muTotal === "number") s.muTotal = d.muTotal;
    if (d.vars) {
      VAR_ORDER.forEach(function (id) {
        if (typeof d.vars[id] === "number") s.vars[id] = d.vars[id];
      });
    }
    if (d.up) {
      if (typeof d.up.dt === "number") s.up.dt = d.up.dt;
      if (typeof d.up.cheapX === "number") s.up.cheapX = d.up.cheapX;
    }
    if (d.muUp) {
      if (typeof d.muUp.y === "number") s.muUp.y = d.muUp.y;
      if (typeof d.muUp.dt === "number") s.muUp.dt = d.muUp.dt;
    }
    s.autobuy = !!d.autobuy;
    if (typeof d.prestiges === "number") s.prestiges = d.prestiges;
    if (typeof d.maxFLog === "number") s.maxFLog = d.maxFLog;
    if (typeof d.maxFLayer === "number") s.maxFLayer = d.maxFLayer;
    if (typeof d.runMaxFLog === "number") s.runMaxFLog = d.runMaxFLog;
    if (typeof d.playTime === "number") s.playTime = d.playTime;
    if (typeof d.runTime === "number") s.runTime = d.runTime;
    if (typeof d.lifetimeMu === "number") s.lifetimeMu = d.lifetimeMu;
    if (typeof d.totalBuys === "number") s.totalBuys = d.totalBuys;
    if (typeof d.lastRate === "number") s.lastRate = d.lastRate;
    if (Array.isArray(d.graph)) s.graph = d.graph.filter(function (p) {
      return p && typeof p.t === "number" && typeof p.l === "number";
    }).slice(-720);
    this.s = s;
    return d.lastSave || Date.now();
  };

  Game.prototype.hardReset = function () {
    this.s = defaultState();
    this.emit("reset", "The chalkboard is clean.");
  };

  root.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);
