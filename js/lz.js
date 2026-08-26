/**
 * LZ-String (MIT, pieroxy) — URI-safe compress/decompress only.
 * Wrapped as SaveCode with EQ1. prefix for The Equation save codes.
 */
(function (root) {
  "use strict";

  var fromCharCode = String.fromCharCode;
  var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  var baseReverseDic = {};

  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (var i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }

  function writeBit(ctx, bitsPerChar, getCharFromInt, bit) {
    ctx.val = (ctx.val << 1) | (bit ? 1 : 0);
    if (ctx.pos === bitsPerChar - 1) {
      ctx.pos = 0;
      ctx.data.push(getCharFromInt(ctx.val));
      ctx.val = 0;
    } else {
      ctx.pos++;
    }
  }

  function writeBits(ctx, bitsPerChar, getCharFromInt, value, n) {
    for (var i = 0; i < n; i++) {
      writeBit(ctx, bitsPerChar, getCharFromInt, value & 1);
      value >>= 1;
    }
  }

  function _compress(uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary = {},
        context_dictionaryToCreate = {},
        context_c = "",
        context_wc = "",
        context_w = "",
        context_enlargeIn = 2,
        context_dictSize = 3,
        context_numBits = 2,
        ctx = { data: [], val: 0, pos: 0 },
        ii;

    function emitW() {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
        if (context_w.charCodeAt(0) < 256) {
          writeBits(ctx, bitsPerChar, getCharFromInt, 0, context_numBits);
          writeBits(ctx, bitsPerChar, getCharFromInt, context_w.charCodeAt(0), 8);
        } else {
          writeBits(ctx, bitsPerChar, getCharFromInt, 1, context_numBits);
          writeBits(ctx, bitsPerChar, getCharFromInt, context_w.charCodeAt(0), 16);
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        writeBits(ctx, bitsPerChar, getCharFromInt, context_dictionary[context_w], context_numBits);
      }
      context_enlargeIn--;
      if (context_enlargeIn === 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
        context_w = context_wc;
      } else {
        emitW();
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    if (context_w !== "") emitW();
    writeBits(ctx, bitsPerChar, getCharFromInt, 2, context_numBits);
    while (true) {
      ctx.val = ctx.val << 1;
      if (ctx.pos === bitsPerChar - 1) {
        ctx.data.push(getCharFromInt(ctx.val));
        break;
      }
      ctx.pos++;
    }
    return ctx.data.join("");
  }

  function _decompress(length, resetValue, getNextValue) {
    var dictionary = [];
    var enlargeIn = 4;
    var dictSize = 4;
    var numBits = 3;
    var entry = "";
    var result = [];
    var i, w, bits, resb, maxpower, power, c;
    var data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i += 1) dictionary[i] = i;

    function readBits(n) {
      var b = 0;
      var maxp = Math.pow(2, n);
      var p = 1;
      while (p !== maxp) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        b |= (resb > 0 ? 1 : 0) * p;
        p <<= 1;
      }
      return b;
    }

    switch (bits = readBits(2)) {
      case 0:
        c = fromCharCode(readBits(8));
        break;
      case 1:
        c = fromCharCode(readBits(16));
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) return "";
      switch (c = readBits(numBits)) {
        case 0:
          dictionary[dictSize++] = fromCharCode(readBits(8));
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          dictionary[dictSize++] = fromCharCode(readBits(16));
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) entry = w + w.charAt(0);
        else return null;
      }
      result.push(entry);
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      w = entry;
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  }

  function compressToEncodedURIComponent(input) {
    if (input == null) return "";
    return _compress(input, 6, function (a) { return keyStrUriSafe.charAt(a); });
  }

  function decompressFromEncodedURIComponent(input) {
    if (input == null) return "";
    if (input === "") return null;
    input = input.replace(/ /g, "+");
    return _decompress(input.length, 32, function (index) {
      return getBaseValue(keyStrUriSafe, input.charAt(index));
    });
  }

  var PREFIX = "EQ1.";

  var SaveCode = {
    PREFIX: PREFIX,
    encode: function (json) {
      if (json == null) json = "";
      return PREFIX + compressToEncodedURIComponent(String(json));
    },
    decode: function (text) {
      if (text == null) return null;
      text = String(text).replace(/^\s+|\s+$/g, "");
      if (!text) return null;
      if (text.indexOf(PREFIX) === 0) {
        try {
          var out = decompressFromEncodedURIComponent(text.slice(PREFIX.length));
          if (out == null || out === "") return null;
          return out;
        } catch (e) {
          return null;
        }
      }
      if (text.charAt(0) === "{") return text;
      return null;
    },
    compressToEncodedURIComponent: compressToEncodedURIComponent,
    decompressFromEncodedURIComponent: decompressFromEncodedURIComponent
  };

  root.SaveCode = SaveCode;
})(typeof window !== "undefined" ? window : globalThis);
