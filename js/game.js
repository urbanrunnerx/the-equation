/**
 * The Equation — core simulation.
 * Growth:  f(t+dt) = f(t) * exp(b * φ * τ * Π(vars) * dt)
 * Stored as log10:  d(log10 f)/dt = b * φ * τ * Π(vars) * dtSpeed * log10(e)
 * φ (phi) from Rewrite; τ from theories; both default to 1 so v1 saves still work.
 * Buying divides f by the cost (fLog -= costLog), so spending always bites.
 */
(function (root) {
  "use strict";

  var LOG10E = Math.LOG10E;
  var MAX_DLOG_PER_SEC = 2.0; // named clamp: decades of f per real second

  var VAR_ORDER = ["x", "y", "z", "u", "v", "w", "a"];

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
      blurb: "A late term of this edition.",
      unlockLog: 130,
      costLog0: 130,
      growth: 25,
      quad: 0.14,
      flavor: "the outer term"
    },
    w: {
      id: "w",
      name: "w",
      title: "Sixth factor",
      blurb: "Admitted from the star ledger. Multiplies the exponent.",
      unlockLog: 180,
      costLog0: 180,
      growth: 32,
      quad: 0.16,
      starGate: "unlockW",
      flavor: "a wider product"
    },
    a: {
      id: "a",
      name: "α",
      title: "Outer coefficient",
      blurb: "The last variable of this edition. Requires a star lemma.",
      unlockLog: 280,
      costLog0: 280,
      growth: 40,
      quad: 0.18,
      starGate: "unlockA",
      flavor: "the outer coefficient"
    }
  };

  var ACHIEVEMENTS = [
    { id: "firstX", name: "Independent variable", desc: "Buy x for the first time.", stars: 1 },
    { id: "f6", name: "Six decades", desc: "f(t) reaches 1e6.", stars: 1 },
    { id: "f12", name: "Twelve decades", desc: "f(t) reaches 1e12.", stars: 2 },
    { id: "f20", name: "Twenty decades", desc: "f(t) reaches 1e20.", stars: 2 },
    { id: "f40", name: "Forty decades", desc: "f(t) reaches 1e40.", stars: 2 },
    { id: "firstP", name: "Change of base", desc: "Prestige once.", stars: 2 },
    { id: "p5", name: "Five bases", desc: "Prestige five times.", stars: 3 },
    { id: "p15", name: "Fifteen bases", desc: "Prestige fifteen times.", stars: 3 },
    { id: "firstR", name: "Rewrite", desc: "Rewrite the equation once.", stars: 3 },
    { id: "firstT", name: "Workshop", desc: "Open the theory workshop.", stars: 2 },
    { id: "buyY", name: "Second axis", desc: "Buy y.", stars: 1 },
    { id: "buyZ", name: "Depth", desc: "Buy z.", stars: 1 },
    { id: "play5", name: "Five minutes", desc: "Play for five minutes.", stars: 1 },
    { id: "play15", name: "Quarter hour", desc: "Play for fifteen minutes.", stars: 1 },
    { id: "pub1", name: "First publication", desc: "Publish a theory.", stars: 2 },
    { id: "buyW", name: "Wider product", desc: "Buy w.", stars: 2 }
  ];

  var STAR_SHOP = [
    {
      id: "earlyAutobuy",
      name: "Early autobuy",
      desc: "Autobuy on the Variables tab before your first prestige.",
      max: 1,
      cost: function () { return 3; }
    },
    {
      id: "prodMult",
      name: "Lemma of stars",
      desc: "Permanent +8% to the exponent coefficient per level.",
      max: 6,
      cost: function (lv) { return 2 + lv; }
    },
    {
      id: "unlockW",
      name: "Admit w",
      desc: "Unlock variable w. Still needs high f(t) this run.",
      max: 1,
      cost: function () { return 4; }
    },
    {
      id: "unlockA",
      name: "Admit α",
      desc: "Unlock variable α, the outer coefficient.",
      max: 1,
      cost: function () { return 7; }
    },
    {
      id: "autoPrestige",
      name: "Auto-prestige",
      desc: "Unlock a toggle: prestige automatically when Δb ≥ threshold.",
      max: 1,
      cost: function () { return 5; }
    }
  ];

  function defaultTheories() {
    return {
      active: "recurrence",
      recurrence: {
        rho: 0, c1: 1, c2: 1, c3: 0, c4: 0,
        maxRho: 0, tau: 0, published: 0
      },
      dual: {
        sigma: 0, lambda: 0, a1: 1, a2: 0, a3: 1, a4: 0,
        maxSigma: 0, tau: 0, published: 0
      }
    };
  }

  function defaultStarShop() {
    return { earlyAutobuy: 0, prodMult: 0, unlockW: 0, unlockA: 0, autoPrestige: 0 };
  }

  function defaultVars() {
    return { x: 0, y: 0, z: 0, u: 0, v: 0, w: 0, a: 0 };
  }

  function defaultState() {
    return {
      v: 2,
      t: 0,
      fLog: 1,             // log10(f), f starts at 10 so x is buyable at t=0
      fLayer: 0,
      b: 1,
      mu: 0,
      muTotal: 0,
      phi: 1,
      vars: defaultVars(),
      up: { dt: 0, cheapX: 0 },
      muUp: { y: 0, dt: 0 },
      autobuy: false,
      autobuyAcc: 0,
      autoPrestige: false,
      autoPrestigeThreshold: 1,
      prestiges: 0,
      rewrites: 0,
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
      graphTAcc: 0,
      stars: 0,
      starsTotal: 0,
      achievements: {},
      starShop: defaultStarShop(),
      theories: defaultTheories()
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
  Game.ACHIEVEMENTS = ACHIEVEMENTS;
  Game.STAR_SHOP = STAR_SHOP;

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
    if (def.starGate && !(this.s.starShop && this.s.starShop[def.starGate] > 0)) return false;
    if (def.unlockLog === -Infinity) return true;
    var L = this.s.runMaxFLog;
    if (this.s.fLayer > 0) {
      var mapped = Math.pow(10, this.s.fLog);
      if (isFinite(mapped)) L = Math.max(L, mapped);
      else L = Math.max(L, 1e10);
    }
    return L + 1e-9 >= def.unlockLog;
  };

  Game.prototype.nextLocked = function () {
    for (var i = 0; i < VAR_ORDER.length; i++) {
      var id = VAR_ORDER[i];
      if (this.isUnlocked(id)) continue;
      var def = VAR_DEFS[id];
      if (def.starGate && !(this.s.starShop && this.s.starShop[def.starGate] > 0)) continue;
      return id;
    }
    return null;
  };

  Game.prototype.starGatedPending = function () {
    var out = [];
    for (var i = 0; i < VAR_ORDER.length; i++) {
      var id = VAR_ORDER[i];
      var def = VAR_DEFS[id];
      if (def.starGate && !(this.s.starShop && this.s.starShop[def.starGate] > 0)) out.push(id);
    }
    return out;
  };

  Game.prototype.product = function () {
    var p = 1;
    for (var i = 0; i < VAR_ORDER.length; i++) {
      var id = VAR_ORDER[i];
      if (this.isUnlocked(id)) p *= this.varValue(id);
    }
    return p;
  };

  Game.prototype.phi = function () {
    var p = this.s.phi;
    if (!(p > 0) || !isFinite(p)) return 1;
    return p;
  };

  Game.prototype.tau = function () {
    var th = this.s.theories;
    if (!th) return 1;
    var t1 = (th.recurrence && th.recurrence.tau) || 0;
    var t2 = (th.dual && th.dual.tau) || 0;
    return (1 + t1) * (1 + t2);
  };

  Game.prototype.starMult = function () {
    var lv = (this.s.starShop && this.s.starShop.prodMult) || 0;
    return 1 + 0.08 * lv;
  };

  /** Coefficient inside the exp: b * φ * τ * starMult * Π(vars) */
  Game.prototype.exponentCoeff = function () {
    return this.s.b * this.phi() * this.tau() * this.starMult() * this.product();
  };

  /** Uncapped d(log10 f) / d(real second). Use displayRate() for UI and ticks. */
  Game.MAX_DLOG_PER_SEC = MAX_DLOG_PER_SEC;

  Game.prototype.growthRate = function () {
    return this.exponentCoeff() * this.dtSpeed() * LOG10E;
  };

  /** Rate the sim actually applies (clamped decades / real second). */
  Game.prototype.displayRate = function () {
    return Math.min(this.growthRate(), MAX_DLOG_PER_SEC);
  };

  Game.prototype._affordLog = function () {
    var s = this.s;
    if (s.fLayer === 0) return s.fLog;
    var log10f = Math.pow(10, s.fLog);
    if (!isFinite(log10f)) return 1e300;
    return log10f;
  };

  Game.prototype.showPhi = function () {
    return this.s.rewrites >= 1 || this.phi() > 1.0000001;
  };

  Game.prototype.theoriesUnlocked = function () {
    return this.s.rewrites >= 1;
  };

  Game.prototype.showTau = function () {
    return this.theoriesUnlocked() || this.tau() > 1.0000001;
  };

  Game.prototype.showStars = function () {
    return (this.s.starsTotal || 0) > 0 || (this.s.stars || 0) > 0;
  };

  Game.prototype.autobuyAvailable = function () {
    return this.s.prestiges >= 1 || this.s.rewrites >= 1 ||
      !!(this.s.starShop && this.s.starShop.earlyAutobuy > 0);
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
    return this._affordLog() + 1e-12 >= this.costLog(id);
  };

  Game.prototype.fNum = function () {
    return new root.Num(this.s.fLog, this.s.fLayer);
  };

  Game.prototype.lifetimeFLog = function () {
    if (this.s.maxFLayer > 0) return 1e12;
    return Math.max(this.s.maxFLog, this.s.runMaxFLog, this.s.fLog);
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
    if (s.fLayer === 0) {
      if (s.fLog < costLog - 1e-12) return false;
      s.fLog -= costLog;
      if (s.fLog < -12) s.fLog = -12;
      return true;
    }
    var log10f = Math.pow(10, s.fLog);
    if (!isFinite(log10f) || log10f > 1e15) {
      s.fLog -= 1e-8;
      if (s.fLog < 0) s.fLog = 0;
      return true;
    }
    if (log10f < costLog - 1e-12) return false;
    log10f -= costLog;
    if (log10f <= 1e10) {
      s.fLayer = 0;
      s.fLog = log10f;
    } else {
      s.fLog = Math.log10(log10f);
    }
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
    if (!this.isUnlocked(id) || this._affordLog() < this.costLog(id)) return 0;
    var budget = this._affordLog();
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
      this.checkAchievements();
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
    this.checkAchievements();
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
    var cost = this.upgradeCostLog(which);
    if (!isFinite(cost)) return false;
    return this._affordLog() >= cost;
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

  /** Buried optional on Upgrades. Spend ~10% of f for 0.2s of clamped production.
   *  A tap is strictly worse than waiting 0.2s. Not a clicker. */
  Game.prototype.advance = function () {
    var slice = 0.045757; // log10(1/0.9) ≈ 10% of f; _spendLog bites at every fLayer
    if (!this._spendLog(slice)) return false;
    var push = 0.2;
    this._applyGrowth(push);
    this.s.t += this.dtSpeed() * push;
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

  Game.prototype._resetRun = function () {
    var s = this.s;
    s.t = 0;
    s.fLog = 1;
    s.fLayer = 0;
    s.vars = defaultVars();
    s.up = { dt: 0, cheapX: 0 };
    s.runTime = 0;
    s.runMaxFLog = 0;
    s.graph = [];
    s.graphTAcc = 0;
    s.lastRate = 0;
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
    this._resetRun();
    this.emit("prestige", "b → " + root.formatJS(this.s.b, 3) + "   μ +" + root.formatJS(dmu, 2));
    this.checkAchievements();
    return true;
  };

  /* ---------- rewrite (second prestige) ---------- */

  Game.prototype.dphi = function () {
    var b = this.s.b;
    if (!(b > 1.2)) return 0;
    // First rewrite is a session goal after several prestiges, not hours.
    return Math.pow((b - 1) / 2.2, 0.72);
  };

  Game.prototype.rewriteUnlocked = function () {
    return this.s.prestiges >= 3 && this.s.b >= 2.6;
  };

  Game.prototype.canRewrite = function () {
    return this.rewriteUnlocked() && this.dphi() >= 0.45;
  };

  Game.prototype.rewrite = function () {
    if (!this.canRewrite()) return false;
    var dphi = this.dphi();
    this.s.phi = this.phi() + dphi;
    this.s.rewrites += 1;
    this.s.b = 1;
    // Prestige-layer reset: b returns to 1. μ and μ lemmas are kept
    // (learned permanently). Stars, theories, and φ persist.
    this._resetRun();
    this.emit("rewrite", "φ → " + root.formatJS(this.s.phi, 3) + "   b returns to 1");
    this.checkAchievements();
    return true;
  };

  /* ---------- stars ---------- */

  Game.prototype._achieved = function (id) {
    var s = this.s;
    var L = this.lifetimeFLog();
    switch (id) {
      case "firstX": return (s.vars.x || 0) >= 1 || s.totalBuys >= 1;
      case "f6": return L >= 6;
      case "f12": return L >= 12;
      case "f20": return L >= 20;
      case "f40": return L >= 40;
      case "firstP": return s.prestiges >= 1;
      case "p5": return s.prestiges >= 5;
      case "p15": return s.prestiges >= 15;
      case "firstR": return s.rewrites >= 1;
      case "firstT": return s.rewrites >= 1;
      case "buyY": return (s.vars.y || 0) >= 1;
      case "buyZ": return (s.vars.z || 0) >= 1;
      case "play5": return s.playTime >= 300;
      case "play15": return s.playTime >= 900;
      case "pub1": {
        var th = s.theories;
        if (!th) return false;
        return ((th.recurrence && th.recurrence.published) || 0) +
          ((th.dual && th.dual.published) || 0) >= 1;
      }
      case "buyW": return (s.vars.w || 0) >= 1;
      default: return false;
    }
  };

  Game.prototype.checkAchievements = function () {
    if (!this.s.achievements) this.s.achievements = {};
    var gained = 0;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      if (this.s.achievements[a.id]) continue;
      if (!this._achieved(a.id)) continue;
      this.s.achievements[a.id] = true;
      this.s.stars += a.stars;
      this.s.starsTotal += a.stars;
      gained += a.stars;
      this.emit("star", a.name + "  ·  +" + a.stars + " ★");
    }
    return gained;
  };

  Game.prototype.starShopCost = function (id) {
    var def = null;
    for (var i = 0; i < STAR_SHOP.length; i++) {
      if (STAR_SHOP[i].id === id) { def = STAR_SHOP[i]; break; }
    }
    if (!def) return Infinity;
    var lv = (this.s.starShop && this.s.starShop[id]) || 0;
    if (lv >= def.max) return Infinity;
    return def.cost(lv);
  };

  Game.prototype.buyStarShop = function (id) {
    if (!this.s.starShop) this.s.starShop = defaultStarShop();
    var def = null;
    for (var i = 0; i < STAR_SHOP.length; i++) {
      if (STAR_SHOP[i].id === id) { def = STAR_SHOP[i]; break; }
    }
    if (!def) return false;
    var lv = this.s.starShop[id] || 0;
    if (lv >= def.max) return false;
    var cost = def.cost(lv);
    if (this.s.stars < cost) return false;
    this.s.stars -= cost;
    this.s.starShop[id] = lv + 1;
    this.emit("star", def.name + " purchased");
    return true;
  };

  /* ---------- theories ---------- */

  Game.prototype.theoryRate = function (id) {
    var th = this.s.theories;
    if (!th) return 0;
    if (id === "recurrence") {
      var r = th.recurrence;
      // ρ_{n+1} = ρ + c1·c2·1.28^{c3} · (1 + 0.35 c4), sped a little by own τ
      return 0.42 * r.c1 * r.c2 * Math.pow(1.28, r.c3) * (1 + 0.35 * r.c4) * (1 + 0.12 * r.tau);
    }
    if (id === "dual") {
      var d = th.dual;
      var dLam = 0.5 * d.a1 * Math.pow(1.25, d.a2) * (1 + 0.1 * d.tau);
      var dSig = d.lambda * (0.09 * d.a3) * Math.pow(1.2, d.a4) * (1 + 0.1 * d.tau);
      return { lambda: dLam, sigma: dSig };
    }
    return 0;
  };

  Game.prototype._tickTheory = function (id, dt) {
    var th = this.s.theories;
    if (!th) return;
    if (id === "recurrence") {
      var r = th.recurrence;
      var rate = this.theoryRate("recurrence");
      r.rho += rate * dt;
      if (r.rho > 1e300) r.rho = 1e300;
      if (r.rho > r.maxRho) r.maxRho = r.rho;
    } else if (id === "dual") {
      var d = th.dual;
      var rates = this.theoryRate("dual");
      d.lambda += rates.lambda * dt;
      d.sigma += rates.sigma * dt;
      if (d.lambda > 1e300) d.lambda = 1e300;
      if (d.sigma > 1e300) d.sigma = 1e300;
      if (d.sigma > d.maxSigma) d.maxSigma = d.sigma;
    }
  };

  Game.prototype.theoryCost = function (tid, which) {
    var th = this.s.theories[tid];
    if (tid === "recurrence") {
      if (which === "c1") return 8 * Math.pow(1.72, th.c1 - 1);
      if (which === "c2") return 22 * Math.pow(1.95, th.c2 - 1);
      if (which === "c3") return 55 * Math.pow(2.35, th.c3);
      if (which === "c4") return 110 * Math.pow(2.7, th.c4);
    }
    if (tid === "dual") {
      if (which === "a1") return 8 * Math.pow(1.78, th.a1 - 1);
      if (which === "a2") return 28 * Math.pow(2.15, th.a2);
      if (which === "a3") return 14 * Math.pow(1.95, th.a3 - 1);
      if (which === "a4") return 36 * Math.pow(2.25, th.a4);
    }
    return Infinity;
  };

  Game.prototype.theoryCurrency = function (tid, which) {
    var th = this.s.theories[tid];
    if (tid === "recurrence") return th.rho;
    if (tid === "dual") {
      if (which === "a1" || which === "a2") return th.lambda;
      return th.sigma;
    }
    return 0;
  };

  Game.prototype.canBuyTheory = function (tid, which) {
    if (!this.theoriesUnlocked()) return false;
    var cost = this.theoryCost(tid, which);
    return this.theoryCurrency(tid, which) + 1e-9 >= cost;
  };

  Game.prototype.buyTheory = function (tid, which) {
    if (!this.canBuyTheory(tid, which)) return false;
    var cost = this.theoryCost(tid, which);
    var th = this.s.theories[tid];
    if (tid === "recurrence") {
      th.rho -= cost;
      th[which] += 1;
    } else {
      if (which === "a1" || which === "a2") th.lambda -= cost;
      else th.sigma -= cost;
      th[which] += 1;
    }
    return true;
  };

  Game.prototype.theoryPubValue = function (tid) {
    var th = this.s.theories[tid];
    if (tid === "recurrence") {
      var m = th.maxRho;
      if (m < 80) return 0;
      return Math.pow(Math.log10(m + 1), 1.35) * 0.48;
    }
    if (tid === "dual") {
      var s = th.maxSigma;
      if (s < 45) return 0;
      return Math.pow(Math.log10(s + 1), 1.3) * 0.52;
    }
    return 0;
  };

  Game.prototype.canPublish = function (tid) {
    return this.theoriesUnlocked() && this.theoryPubValue(tid) > 0;
  };

  Game.prototype.publishTheory = function (tid) {
    if (!this.canPublish(tid)) return false;
    var gain = this.theoryPubValue(tid);
    var th = this.s.theories[tid];
    if (!(th.tau > 0)) th.tau = gain;
    else th.tau *= (1 + 0.28 * gain);
    th.published += 1;
    if (tid === "recurrence") {
      th.rho = 0; th.c1 = 1; th.c2 = 1; th.c3 = 0; th.c4 = 0; th.maxRho = 0;
    } else {
      th.sigma = 0; th.lambda = 0; th.a1 = 1; th.a2 = 0; th.a3 = 1; th.a4 = 0; th.maxSigma = 0;
    }
    this.emit("publish", (tid === "recurrence" ? "Recurrence" : "Coupled rates") +
      " published  ·  τₙ = " + root.formatJS(th.tau, 3));
    this.checkAchievements();
    return true;
  };

  Game.prototype.setActiveTheory = function (tid) {
    if (tid !== "recurrence" && tid !== "dual") return false;
    if (!this.theoriesUnlocked()) return false;
    this.s.theories.active = tid;
    return true;
  };

  /* ---------- tick ---------- */

  Game.prototype._applyGrowth = function (realDt) {
    var s = this.s;
    var rate = this.displayRate();
    var dL = rate * realDt;
    s.lastRate = rate;
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
      } else {
        s.fLog += 1e-9 * realDt;
      }
    }
    this._noteMax();
  };

  Game.prototype.tick = function (realDt) {
    if (realDt < 0) realDt = 0;
    if (realDt > 0.25) realDt = 0.25; // in-loop clamp; offline is separate
    var s = this.s;
    var prevLocked = this.nextLocked();

    if (s.autobuy && this.autobuyAvailable()) {
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

    if (this.theoriesUnlocked()) {
      var active = (s.theories && s.theories.active) || "recurrence";
      this._tickTheory(active, realDt);
    }

    if (s.autoPrestige && s.starShop && s.starShop.autoPrestige > 0 && this.canPrestige()) {
      var thr = s.autoPrestigeThreshold;
      if (!(thr > 0)) thr = 1;
      if (this.db() >= thr) this.prestige();
    }

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

    this.checkAchievements();
  };

  Game.prototype.applyOffline = function (elapsedSec) {
    var cap = 8 * 3600;
    var grant = Math.min(Math.max(0, elapsedSec), cap);
    if (grant < 1) return null;
    var rate = this.s.lastRate || this.displayRate();
    if (rate > MAX_DLOG_PER_SEC) rate = MAX_DLOG_PER_SEC;
    var before = { log: this.s.fLog, layer: this.s.fLayer, t: this.s.t };
    this._applyGrowth(grant);
    this.s.t += this.dtSpeed() * grant;
    this.s.playTime += grant;
    this.s.runTime += grant;
    this._noteMax();
    if (this.theoriesUnlocked()) {
      var active = (this.s.theories && this.s.theories.active) || "recurrence";
      this._tickTheory(active, grant);
    }
    this.checkAchievements();
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
      v: 2,
      t: s.t,
      fLog: s.fLog,
      fLayer: s.fLayer,
      b: s.b,
      mu: s.mu,
      muTotal: s.muTotal,
      phi: s.phi,
      vars: s.vars,
      up: s.up,
      muUp: s.muUp,
      autobuy: s.autobuy,
      autoPrestige: s.autoPrestige,
      autoPrestigeThreshold: s.autoPrestigeThreshold,
      prestiges: s.prestiges,
      rewrites: s.rewrites,
      maxFLog: s.maxFLog,
      maxFLayer: s.maxFLayer,
      runMaxFLog: s.runMaxFLog,
      playTime: s.playTime,
      runTime: s.runTime,
      lastSave: Date.now(),
      lifetimeMu: s.lifetimeMu,
      totalBuys: s.totalBuys,
      lastRate: s.lastRate,
      graph: s.graph.slice(-400),
      stars: s.stars,
      starsTotal: s.starsTotal,
      achievements: s.achievements,
      starShop: s.starShop,
      theories: s.theories
    });
  };

  function mergeTheories(d) {
    var t = defaultTheories();
    if (!d || typeof d !== "object") return t;
    if (d.active === "dual" || d.active === "recurrence") t.active = d.active;
    if (d.recurrence) {
      ["rho", "c1", "c2", "c3", "c4", "maxRho", "tau", "published"].forEach(function (k) {
        if (typeof d.recurrence[k] === "number") t.recurrence[k] = d.recurrence[k];
      });
      if (!(t.recurrence.c1 > 0)) t.recurrence.c1 = 1;
      if (!(t.recurrence.c2 > 0)) t.recurrence.c2 = 1;
    }
    if (d.dual) {
      ["sigma", "lambda", "a1", "a2", "a3", "a4", "maxSigma", "tau", "published"].forEach(function (k) {
        if (typeof d.dual[k] === "number") t.dual[k] = d.dual[k];
      });
      if (!(t.dual.a1 > 0)) t.dual.a1 = 1;
      if (!(t.dual.a3 > 0)) t.dual.a3 = 1;
    }
    return t;
  }

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
    if (typeof d.phi === "number" && d.phi > 0) s.phi = d.phi;
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
    s.autoPrestige = !!d.autoPrestige;
    if (typeof d.autoPrestigeThreshold === "number" && d.autoPrestigeThreshold > 0) {
      s.autoPrestigeThreshold = d.autoPrestigeThreshold;
    }
    if (typeof d.prestiges === "number") s.prestiges = d.prestiges;
    if (typeof d.rewrites === "number") s.rewrites = d.rewrites;
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
    if (typeof d.stars === "number") s.stars = d.stars;
    if (typeof d.starsTotal === "number") s.starsTotal = d.starsTotal;
    if (d.achievements && typeof d.achievements === "object") {
      Object.keys(d.achievements).forEach(function (k) {
        if (d.achievements[k]) s.achievements[k] = true;
      });
    }
    if (d.starShop && typeof d.starShop === "object") {
      ["earlyAutobuy", "prodMult", "unlockW", "unlockA", "autoPrestige"].forEach(function (k) {
        if (typeof d.starShop[k] === "number") s.starShop[k] = d.starShop[k];
      });
    }
    s.theories = mergeTheories(d.theories);
    // Stuck brand-new saves from before f started at 10.
    if ((s.prestiges || 0) === 0 && (s.rewrites || 0) === 0 &&
        (s.vars.x || 0) === 0 && s.t < 1 && s.fLayer === 0 && s.fLog < 1) {
      s.fLog = 1;
    }
    this.s = s;
    this.checkAchievements();
    return d.lastSave || Date.now();
  };

  Game.prototype.hardReset = function () {
    this.s = defaultState();
    this.emit("reset", "The chalkboard is clean.");
  };

  root.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);
