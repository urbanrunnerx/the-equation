/**
 * The Equation — log10 number system.
 * A value is stored as { mag, layer }:
 *   layer 0:  value = 10^mag          (mag = log10(value))
 *   layer 1:  value = 10^(10^mag)     (ee-scale)
 *   layer 2:  10^10^10^mag
 * Never use raw JS Number for f(t).
 */
(function (root) {
  "use strict";

  var LOG10E = Math.LOG10E;
  var LN10 = Math.LN10;
  var LOG10_2 = Math.LOG10E * Math.LN2;

  function Num(mag, layer) {
    this.m = mag;
    this.l = layer || 0;
    this._norm();
  }

  Num.LOG10E = LOG10E;
  Num.LN10 = LN10;

  Num.zero = function () { return new Num(-Infinity, 0); };
  Num.one = function () { return new Num(0, 0); };
  Num.fromNumber = function (n) {
    if (!(n > 0) || n === 0) return Num.zero();
    return new Num(Math.log10(n), 0);
  };
  Num.fromLog10 = function (log10) {
    if (log10 === -Infinity) return Num.zero();
    return new Num(log10, 0);
  };

  Num.prototype._norm = function () {
    if (this.m === -Infinity) {
      this.l = 0;
      return this;
    }
    if (!isFinite(this.m)) return this;
    while (this.l === 0 && this.m >= 1e10) {
      this.m = Math.log10(this.m);
      this.l++;
    }
    while (this.l > 0 && this.m >= 1e10) {
      this.m = Math.log10(this.m);
      this.l++;
    }
    while (this.l > 0 && this.m < 10) {
      this.m = Math.pow(10, this.m);
      this.l--;
    }
    return this;
  };

  Num.prototype.clone = function () {
    var n = new Num(this.m, this.l);
    return n;
  };

  /** log10(this) as a JS number. Infinity if too large. */
  Num.prototype.log10 = function () {
    if (this.m === -Infinity) return -Infinity;
    if (this.l === 0) return this.m;
    if (this.l === 1) {
      if (this.m > 308) return Infinity;
      return Math.pow(10, this.m);
    }
    return Infinity;
  };

  Num.prototype.toNumber = function () {
    var L = this.log10();
    if (L === -Infinity) return 0;
    if (L > 308) return Infinity;
    return Math.pow(10, L);
  };

  Num.prototype.cmp = function (o) {
    if (this.m === -Infinity && o.m === -Infinity) return 0;
    if (this.m === -Infinity) return -1;
    if (o.m === -Infinity) return 1;
    if (this.l !== o.l) return this.l > o.l ? 1 : -1;
    if (this.m === o.m) return 0;
    return this.m > o.m ? 1 : -1;
  };
  Num.prototype.gte = function (o) { return this.cmp(o) >= 0; };
  Num.prototype.gt = function (o) { return this.cmp(o) > 0; };
  Num.prototype.eq = function (o) { return this.cmp(o) === 0; };

  Num.prototype.mul = function (o) {
    if (this.m === -Infinity || o.m === -Infinity) return Num.zero();
    if (this.l === 0 && o.l === 0) return new Num(this.m + o.m, 0);
    // Higher layer dominates; if equal layers, mag-add only works for layer 0.
    if (this.l > o.l) return this.clone();
    if (o.l > this.l) return o.clone();
    // same layer >= 1: 10^(10^a) * 10^(10^b) ≈ 10^(10^max) when far apart
    var a = Math.max(this.m, o.m);
    var b = Math.min(this.m, o.m);
    var diff = a - b;
    if (diff > 10) return new Num(a, this.l);
    // log10(10^(10^a) * 10^(10^b)) = 10^a + 10^b = 10^a (1 + 10^(b-a))
    var slog = a + Math.log10(1 + Math.pow(10, -diff));
    return new Num(slog, this.l);
  };

  Num.prototype.div = function (o) {
    if (o.m === -Infinity) return new Num(Infinity, 0);
    if (this.m === -Infinity) return Num.zero();
    if (this.l === 0 && o.l === 0) return new Num(this.m - o.m, 0);
    if (this.l > o.l) return this.clone();
    if (o.l > this.l) return Num.zero();
    return new Num(this.m - 1e-15, this.l); // essentially unchanged
  };

  Num.prototype.pow = function (p) {
    if (p === 0) return Num.one();
    if (this.m === -Infinity) return Num.zero();
    if (this.l === 0) return new Num(this.m * p, 0);
    return this.clone();
  };

  /** this += 10^dLog   (add a linear increment in log10-space to layer-0 mag) */
  Num.prototype.addLog10 = function (dLog) {
    if (!(dLog > 0) || !isFinite(dLog)) return this;
    if (this.l === 0) {
      if (this.m === -Infinity) this.m = Math.log10(dLog > 0 ? Math.pow(10, dLog) : 0);
      // 10^m + tiny is not what we want — callers add to the LOG, not the value.
      this.m += dLog;
      this._norm();
      return this;
    }
    // layer >= 1: log10(value) = 10^m. Adding dLog to log10(value):
    var slog = this.l === 1 ? Math.pow(10, this.m) : Infinity;
    if (!isFinite(slog)) return this;
    var news = slog + dLog;
    if (news <= 0) {
      this.m = -Infinity;
      this.l = 0;
      return this;
    }
    this.m = Math.log10(news);
    this.l = 1;
    this._norm();
    return this;
  };

  Num.prototype.toJSON = function () {
    return { m: this.m, l: this.l };
  };
  Num.fromJSON = function (j) {
    if (!j) return Num.one();
    return new Num(j.m, j.l || 0);
  };

  /**
   * Format a layer-0 log10, or a Num.
   *  < 1e6        locale with commas
   *  then         scientific 1.23e9
   *  huge exp     ee notation: ee3 = 10^(10^3)
   */
  function formatLog(log10, places) {
    if (places == null) places = 2;
    if (log10 == null || log10 === -Infinity || (log10 === 0 && arguments[2] === "zero")) return "0";
    if (!isFinite(log10)) {
      if (log10 < 0) return "0";
      return "∞";
    }
    if (log10 < -3) return "0";
    if (log10 < 0) {
      var small = Math.pow(10, log10);
      return small.toFixed(Math.min(3, places + 1));
    }
    if (log10 < 6) {
      var n = Math.pow(10, log10);
      if (log10 < 3) {
        var d = log10 < 1 ? 2 : (log10 < 2 ? 1 : 0);
        return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
      }
      return Math.round(n).toLocaleString();
    }
    // scientific until exponent itself is huge
    if (log10 < 1e4) {
      var exp = Math.floor(log10 + 1e-12);
      var mant = Math.pow(10, log10 - exp);
      if (mant >= 9.995) {
        mant = 1;
        exp += 1;
      }
      return mant.toFixed(places) + "e" + exp.toString();
    }
    // eeX where X = log10(log10(value)) = log10(log10)
    var ee = Math.log10(log10);
    if (ee < 9) return "ee" + ee.toFixed(places);
    if (ee < 1e4) {
      var e2 = Math.floor(ee);
      var m2 = Math.pow(10, ee - e2);
      return "ee" + m2.toFixed(places) + "e" + e2;
    }
    return "eee" + Math.log10(ee).toFixed(places);
  }

  function formatNum(num, places) {
    if (places == null) places = 2;
    if (!num) return "0";
    if (num.m === -Infinity) return "0";
    if (num.l === 0) return formatLog(num.m, places);
    if (num.l === 1) {
      // value = 10^(10^m) = ee(m)
      if (num.m < 6) return "ee" + num.m.toFixed(places);
      return "eee" + Math.log10(num.m).toFixed(places);
    }
    return "eee" + formatLog(num.m, places);
  }

  /** Pretty-print a JS number that may be large (b, mu, t, dt, variable values). */
  function formatJS(n, places) {
    if (places == null) places = 2;
    if (!isFinite(n) || n === 0) return n === 0 ? "0" : "∞";
    if (n < 0) return "−" + formatJS(-n, places);
    return formatLog(Math.log10(n), places);
  }

  function formatTime(seconds) {
    if (seconds < 60) return seconds.toFixed(seconds < 10 ? 2 : 1) + " s";
    if (seconds < 3600) {
      var m = Math.floor(seconds / 60);
      var s = seconds - m * 60;
      return m + "m " + s.toFixed(0) + "s";
    }
    if (seconds < 86400) {
      var h = Math.floor(seconds / 3600);
      var m2 = Math.floor((seconds - h * 3600) / 60);
      return h + "h " + m2 + "m";
    }
    var d = Math.floor(seconds / 86400);
    var h2 = Math.floor((seconds - d * 86400) / 3600);
    return d + "d " + h2 + "h";
  }

  root.Num = Num;
  root.formatLog = formatLog;
  root.formatNum = formatNum;
  root.formatJS = formatJS;
  root.formatTime = formatTime;
})(typeof window !== "undefined" ? window : globalThis);
