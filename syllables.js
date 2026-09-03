/**
 * syllables.js — metrical syllable counting for verse, in French, English and
 * Spanish.
 *
 * Edit mode shows, beside each line, how many syllables the French has and how
 * many the translation being typed has. That only helps if the numbers are
 * right, so this counts the way a poet counts rather than the way a dictionary
 * hyphenates: a French mute e elides before a vowel and never sounds at the end
 * of a line, and Spanish runs a word-final vowel into the next word's initial
 * one and then measures to the last stress. Orthographic hyphenation gets both
 * of those wrong, which is why there is no library here.
 *
 * It is a segmenter rather than a counter: `scan()` returns the pieces, so the
 * count is their length and the editor can show the split in a tooltip. Where
 * classical French genuinely allows two readings — the diérèse in "ouvrier",
 * "hier", "lion" — it says so through `unsure` / `min` / `max` instead of
 * asserting a number it cannot justify.
 *
 * No dependencies and no build: the same file runs in the browser (loaded only
 * on localhost, by the edit-mode guard in index.html) and in Node, where
 * tools/check-meter.mjs scores it against all 3,576 French lines in the corpus.
 */
(function (root) {
  'use strict';

  /* ===== Shared ========================================================== */

  var LETTER = 'a-zà-öø-ÿœæū';
  var APOS = "'";
  var NOT_LETTER = new RegExp('[^' + LETTER + APOS + ']+', 'g');

  /* The corpus writes apostrophes as U+2019 exclusively, and 161 French lines
     begin with a stray U+FEFF that is deliberately preserved on disk. */
  function tidy(line) {
    return String(line == null ? '' : line)
      .replace(/﻿/g, '')
      .replace(/[‘’ʼ]/g, APOS)
      .toLowerCase();
  }

  /* Dashes, guillemets, ellipses and punctuation are all word breaks; so is a
     hyphen, since "peut-être" is two words to a metrician. */
  function tokens(line) {
    var raw = tidy(line).replace(NOT_LETTER, ' ').split(' ');
    var out = [];
    for (var i = 0; i < raw.length; i++) if (raw[i]) out.push(raw[i]);
    return out;
  }

  function deacc(w) {
    return w.normalize ? w.normalize('NFD').replace(/[̀-ͯ]/g, '') : w;
  }

  function startsWith(word, list) {
    for (var i = 0; i < list.length; i++) if (word.indexOf(list[i]) === 0) return true;
    return false;
  }

  function has(list, w) {
    for (var i = 0; i < list.length; i++) if (list[i] === w) return true;
    return false;
  }

  /* ===== French ========================================================== */

  var FR_V = 'aàâäeéèêëiîïoôöuùûüūyÿœæ';
  var FR_TREMA = 'ëïüÿ';

  function frV(c) { return !!c && FR_V.indexOf(c) !== -1; }

  /* Vowel clusters that are a single nucleus. Longest first — matching is greedy. */
  var FR_DIGRAPH = [
    'eau', 'œu', 'oeu', 'eui', 'œi', 'oei', 'ien',
    'ai', 'aî', 'au',
    'ei', 'eî', 'eu', 'eû',
    'oi', 'oî', 'ou', 'oû', 'où',
    'ui', 'œ', 'æ'
  ];

  /* h aspiré blocks elision. Stems, matched de-accented against the start of the
     word, so inflections come along: hardi/hardie/hardis, hurler/hurlent. */
  var FR_ASPIRE = ('hagard haillon hain hair hais hait haiss halet halle hallier hameau ' +
    'hanch hant harass harc hard hareng harg haricot harn harp hasard hat haut hav ' +
    'hennir heris hern heron heros hetre heurt hibou hide hierarch hiss hoch holl homard ' +
    'hongr hont hoqu hord hors hott houb houe houk houl houp hourra houss huch hue ' +
    'huguenot huit hulotte hupp hurl hutt hun').split(' ');
  /* héroïsme, héroïne and héroïque take a mute h where "héros" does not. */
  var FR_ASPIRE_NOT = ['heroi'];

  /* -ent that is a real nasal nucleus rather than a verb ending. Drawn from
     every -ent word in the corpus, hand-checked. */
  var FR_ENT_NUCLEUS = ('absent accent adjacent ardent argent auvent cent client ' +
    'confident content couvent dent diligent excellent gent imprudent indifferent ' +
    'innocent intelligent lent occident orient parent patient permanent present prudent ' +
    'recent regent relent serpent souvent talent torrent urgent vent violent').split(' ');
  /* -ment words that are third-person-plural verbs, where the default for -ment
     is the sounded suffix of an adverb or a noun. */
  var FR_MENT_VERB = ('aiment allument arment calment charment compriment desarment ' +
    'dorment embaument enferment enflamment estiment ferment forment germent ment ' +
    'pament referment renferment').split(' ');

  /* The only words whose single syllable elides away entirely. */
  var FR_ELIDE = ['je', 'me', 'te', 'se', 'ce', 'de', 'le', 'ne', 'que'];

  function frAspirate(word) {
    var w = deacc(word);
    if (w.charAt(0) !== 'h') return false;
    if (startsWith(w, FR_ASPIRE_NOT)) return false;
    return startsWith(w, FR_ASPIRE);
  }

  /* Spelling fixes that have to happen before anything counts vowels. */
  function frPrepare(w) {
    w = w.replace(/'/g, '');
    /* the tréma in -guë / -quë marks a pronounced u, not a hiatus: aiguë = ai-guë.
       U+016B stands in for that u so the silent-u rule below leaves it alone. */
    w = w.replace(/([gq])u[ëü]/g, '$1ūe');
    /* u is silent in qu- always, and in gu- before a front vowel */
    w = w.replace(/qu(?=[aàâeéèêiîoôuùy])/g, 'q');
    w = w.replace(/gu(?=[eéèêiîy])/g, 'g');
    /* y before a vowel is a consonant: ennuyé = en-nu-yé, voyage = vo-ya-ge,
       yeux = yeux. Standing alone it stays the vowel of "il y a". */
    if (w.length > 1) w = w.replace(new RegExp('y(?=[' + FR_V + '])', 'g'), 'Y');
    /* and the i of -ill- after a vowel is the same glide: mou-illés = mouil-lés */
    w = w.replace(new RegExp('([' + FR_V + '])i(?=ll)', 'g'), '$1Y');
    /* the e of -ement is silent after a vowel: gaiement = gai-ment */
    w = w.replace(new RegExp('([' + FR_V + '])ement$'), '$1ment');
    /* the e of a future or conditional stem is silent: m'ennuierai = m'en-nui-rai */
    w = w.replace(new RegExp('([' + FR_V + '])ie(?=r)', 'g'), '$1i');
    return w;
  }

  /* How does this word's -ent behave?
       'nucleus'  a sounded nasal vowel   (argent, client)
       'silent'   nothing at all          (étaient, vient, puent)
       'mute'     a mute e, so it sounds before a consonant (parlent, chargent)
       null       the word does not end in -ent */
  function frEnt(w) {
    if (!/ent$/.test(w)) return null;
    var plain = deacc(w);
    if (has(FR_ENT_NUCLEUS, plain)) return 'nucleus';
    if (/ment$/.test(w)) return has(FR_MENT_VERB, plain) ? 'mute' : 'nucleus';
    /* a vowel before -ent means the whole ending is silent: étai|ent, vi|ent */
    return frV(w.charAt(w.length - 4)) ? 'silent' : 'mute';
  }

  /* Nucleus ranges in a word, as [start, end) pairs. */
  function frNuclei(w) {
    var out = [];
    var i = 0;
    while (i < w.length) {
      if (!frV(w.charAt(i))) { i++; continue; }
      /* a tréma always opens a nucleus of its own: Ca|ïn, po|ë|te, Antino|üs */
      if (FR_TREMA.indexOf(w.charAt(i)) !== -1) { out.push([i, i + 1]); i++; continue; }
      var taken = 0;
      for (var d = 0; d < FR_DIGRAPH.length; d++) {
        var g = FR_DIGRAPH[d];
        if (w.substr(i, g.length) !== g) continue;
        /* a tréma just past the cluster belongs to the next nucleus instead */
        var after = w.charAt(i + g.length);
        if (after && FR_TREMA.indexOf(after) !== -1) continue;
        taken = g.length;
        break;
      }
      if (!taken) taken = 1;
      out.push([i, i + taken]);
      i += taken;
    }
    return out;
  }

  /* The Latinate -tion / -sion keeps its full diérèse in classical verse —
     ex-pi-a-ti-on — where an everyday word contracts. */
  var FR_LATINATE = /[st]ions?$/;

  var FR_CLUSTER = /(?:[bcdfgptv][lr]|ch|ph|th|gn)$/;

  /* Returns how many hiatuses were contracted, which is also how many readings
     of this word the diérèse would add a syllable to. */
  function frContract(w, nuclei) {
    if (FR_LATINATE.test(w)) return 0;
    var merged = 0;
    for (var k = 0; k + 1 < nuclei.length;) {
      var lone = nuclei[k][1] - nuclei[k][0] === 1 && /^[iu]$/.test(w.charAt(nuclei[k][0]));
      /* after an obstruent + liquid the diérèse is compulsory: ou-vri-er */
      if (lone && nuclei[k][1] === nuclei[k + 1][0] && !FR_CLUSTER.test(w.slice(0, nuclei[k][0]))) {
        nuclei.splice(k, 2, [nuclei[k][0], nuclei[k + 1][1]]);
        merged++;
      } else k++;
    }
    return merged;
  }

  function frWord(raw) {
    var w = frPrepare(raw);
    var ent = frEnt(w);
    var tail = '';
    if (ent === 'silent' || ent === 'mute') { tail = w.slice(-3); w = w.slice(0, -3); }

    var nuclei = frNuclei(w);
    var loose = frContract(w, nuclei);
    var count = nuclei.length;
    var mute = false, firm = false, drop = 0;

    if (ent === 'mute') {
      /* the -ent of a verb is a mute e; it was sliced off the word above, so
         there is nothing left in `nuclei` to take away for it */
      mute = true;
      firm = true;      /* nor does the -ent of a verb */
    } else if (ent === null && count === 1 && has(FR_ELIDE, w)) {
      mute = true; drop = 1;
    } else if (ent === null && count > 1) {
      /* a final e or es is mute — but never a word's only syllable, so "les"
         keeps its own while "belles" ends in one that may elide */
      var last = w.slice(nuclei[count - 1][0]);
      /* only a bare final e elides before a vowel. A plural -es keeps its
         syllable — 3,543 corpus lines agree, and it is the classical rule. */
      if (last === 'e' || last === 'es') { mute = true; drop = 1; firm = last === 'es'; }
    }

    var base = count - drop;
    if (base < 1 && !mute) base = 1;     /* a word always has a syllable */
    if (base < 0) base = 0;

    return {
      word: w,
      tail: tail,
      base: base,
      mute: mute,
      firm: firm,
      nuclei: nuclei,
      loose: loose,
      vowelStart: frV(w.charAt(0)) || (w.charAt(0) === 'h' && !frAspirate(raw))
    };
  }

  /* Readable pieces for the tooltip: a single consonant between two nuclei goes
     with the following syllable, a pair splits unless it is obstruent + liquid. */
  function frSyllables(it, sounded) {
    var w = it.word + it.tail;
    var nuclei = it.nuclei;
    if (!nuclei.length) return [w];
    var cuts = [0], k;
    for (k = 1; k < nuclei.length; k++) {
      var gs = nuclei[k - 1][1], ge = nuclei[k][0];
      var gap = w.slice(gs, ge);
      /* one consonant joins the syllable after it; of a longer run only a
         final cluster does, and the rest closes the syllable before */
      var at = gap.length <= 1 ? gs : ge - (FR_CLUSTER.test(gap.slice(-2)) ? 2 : 1);
      cuts.push(at < gs ? gs : at);
    }
    cuts.push(w.length);
    var out = [];
    for (k = 0; k < cuts.length - 1; k++) {
      var piece = w.slice(cuts[k], cuts[k + 1]);
      if (piece) out.push(piece.replace(/Y/g, 'y').replace(/ū/g, 'u').replace(/q(?![uū])/g, 'qu'));
    }
    /* a mute e that does not sound is shown attached, not as a piece of its own */
    while (out.length > sounded && out.length > 1) {
      out[out.length - 2] += out[out.length - 1];
      out.pop();
    }
    return out;
  }

  function frScan(line) {
    var ws = tokens(line);
    var info = [], i;
    for (i = 0; i < ws.length; i++) info.push(frWord(ws[i]));

    var count = 0, max = 0, unsure = false, parts = [];
    for (i = 0; i < info.length; i++) {
      var it = info[i];
      var n = it.base;
      /* the mute e sounds before a consonant, elides before a vowel, and is
         never counted at the end of the line */
      if (it.mute && (!info[i + 1] ? n === 0 : it.firm || !info[i + 1].vowelStart)) n += 1;
      count += n;
      max += n;
      if (it.loose) { max += it.loose; unsure = true; }
      parts = parts.concat(frSyllables(it, n));
    }
    return { count: count, min: count, max: max, unsure: unsure, parts: parts };
  }

  /* ===== Spanish ========================================================= */

  var ES_STRONG = 'aeoáéó';
  var ES_ACCENT_WEAK = 'íú';
  var ES_V = ES_STRONG + 'iuü' + ES_ACCENT_WEAK;
  var ES_ACCENTED = /[áéíóú]/;
  var ES_VOWEL_END = /[aeiouáéíóúy]$/;
  var ES_VOWEL_START = /^h?[aeiouáéíóú]/;

  function esV(c) { return !!c && ES_V.indexOf(c) !== -1; }

  /* Nucleus ranges: a run of vowels is one syllable unless it holds a hiatus —
     two strong vowels, or an accented weak one. An h between vowels is passed
     over, since it is silent but does not join them. */
  function esNuclei(w) {
    var out = [];
    var i = 0;
    while (i < w.length) {
      if (!esV(w.charAt(i))) { i++; continue; }
      var s = i, prev = '';
      while (i < w.length) {
        var c = w.charAt(i);
        if (c === 'h' && prev && esV(w.charAt(i + 1))) { i++; continue; }
        if (!esV(c)) break;
        if (prev && ((ES_STRONG.indexOf(prev) !== -1 && ES_STRONG.indexOf(c) !== -1) ||
          ES_ACCENT_WEAK.indexOf(prev) !== -1 || ES_ACCENT_WEAK.indexOf(c) !== -1)) {
          out.push([s, i]);
          s = i;
        }
        prev = c;
        i++;
      }
      out.push([s, i]);
    }
    return out;
  }

  /* 1 = aguda, 2 = llana, 3 = esdrújula — counted back from the end. */
  function esStress(word) {
    var nuc = esNuclei(word);
    if (!nuc.length) return 2;
    if (ES_ACCENTED.test(word)) {
      for (var k = nuc.length - 1; k >= 0; k--) {
        if (ES_ACCENTED.test(word.slice(nuc[k][0], nuc[k][1]))) return nuc.length - k;
      }
    }
    return /[aeiouns]$/.test(word) ? 2 : 1;
  }

  var ES_CLUSTER = /(?:[bcdfgptk][lr]|ch|ll|rr)$/;

  function esSyllables(w) {
    var nuc = esNuclei(w);
    if (!nuc.length) return [w];
    var cuts = [0], k;
    for (k = 1; k < nuc.length; k++) {
      var gap = w.slice(nuc[k - 1][1], nuc[k][0]);
      var at = nuc[k][0] - gap.length;
      if (gap.length >= 2 && !ES_CLUSTER.test(gap)) at += gap.length - 1;
      cuts.push(at);
    }
    cuts.push(w.length);
    var out = [];
    for (k = 0; k < cuts.length - 1; k++) if (cuts[k + 1] > cuts[k]) out.push(w.slice(cuts[k], cuts[k + 1]));
    return out.length ? out : [w];
  }

  function esScan(line) {
    var ws = tokens(line);
    if (!ws.length) return { count: 0, min: 0, max: 0, unsure: false, parts: [] };
    var parts = [];
    for (var i = 0; i < ws.length; i++) {
      /* the conjunction "y" is the vowel /i/, and runs into its neighbours:
         "espantada y llena" is es-pan-ta-da_y-lle-na */
      var word = ws[i].replace(/'/g, '');
      if (word === 'y') word = 'i';
      var syl = esSyllables(word);
      /* synalepha: a word ending in a vowel runs into one beginning with a
         vowel, and the two are measured as a single syllable */
      if (parts.length && ES_VOWEL_END.test(parts[parts.length - 1]) && ES_VOWEL_START.test(syl[0])) {
        parts[parts.length - 1] += '‿' + syl.shift();
      }
      parts = parts.concat(syl);
    }
    /* the line is measured to its last stress: aguda +1, esdrújula -1 */
    var count = parts.length + 2 - esStress(ws[ws.length - 1].replace(/'/g, ''));
    if (count < 1) count = parts.length;
    return { count: count, min: count, max: count, unsure: false, parts: parts };
  }

  /* ===== English ========================================================= */

  /* en-syllables.js carries the words these rules get wrong; it is loaded beside
     this file by the edit-mode guard. Without it the rules are right about nine
     times in ten, which is why the tooltip shows its working. */
  function enWord(w) {
    w = w.replace(/'/g, '');
    if (!w) return 0;
    var dict = root.EN_SYLLABLES;
    if (dict && dict.get) {
      var known = dict.get(w);
      if (known) return known;
    }
    var s = deacc(w).replace(/[^a-z]/g, '');
    if (!s) return 0;
    if (s.length <= 3) return 1;
    var bonus = 0;
    /* a syllabic m or l carries its own beat: pris-m, ryth-m */
    if (/[^aeiouy][ms]ms?$/.test(s) || /[^aeiouy]sms?$/.test(s)) bonus += 1;
    /* -ying is always two: fly-ing, dy-ing */
    if (/ying$/.test(s)) bonus += 1;
    /* -es is a syllable after a sibilant (hous-es, cag-es, fac-es) and silent
       otherwise (makes, lives); -ed likewise, but only on a long enough stem,
       or "abed" loses the syllable it needs */
    s = s.replace(/[^aeiouysxzhwgc]es$/, function (m) { return m.charAt(0); });
    if (s.length > 4) s = s.replace(/[^aeiouytd]ed$/, function (m) { return m.charAt(0); });
    /* a magic e stays silent under a consonant suffix: change-less, hope-ful,
       state-ment, love-ly. Not after another vowel, where it sounds: a-gree-ment. */
    s = s.replace(/([^aeiouy])e(?=(?:less|ness|ment|ful|some|ly)$)/, '$1');
    /* silent final e, but -le and -re after a consonant keep their syllable */
    if (/[^aeiouy][lr]e$/.test(s)) s = s.slice(0, -1) + 'a';
    else s = s.replace(/([^aeiouy])e$/, '$1');
    var m = s.match(/[aeiouy]+/g);
    if (!m) return 1;
    var n = bonus;
    for (var i = 0; i < m.length; i++) {
      n += 1;
      if (m[i].length < 2) continue;
      /* a run that spans a hiatus is two: cre-ate, qui-et, li-on. But -tion,
         -cious and their kin are one, which is where English parts company
         with French. */
      var at = s.indexOf(m[i]);
      if (/^io/.test(m[i]) && /[tscx]$/.test(s.slice(0, at))) continue;
      if (/^(?:i[aeou]|eo|ua|uo|oe|ae|yi)/.test(m[i])) n += 1;
    }
    return n || 1;
  }

  function enScan(line) {
    var ws = tokens(line);
    var parts = [], count = 0;
    for (var i = 0; i < ws.length; i++) {
      var n = enWord(ws[i]);
      count += n;
      parts.push(n > 1 ? ws[i] + '·' + n : ws[i]);
    }
    return { count: count, min: count, max: count, unsure: false, parts: parts };
  }

  /* ===== Public surface ================================================== */

  function scan(line, lang) {
    var base = String(lang || 'fr').slice(0, 2);
    if (base === 'es') return esScan(line);
    if (base === 'en') return enScan(line);
    return frScan(line);
  }

  function count(line, lang) { return scan(line, lang).count; }

  /* The metre a poem is written in: the count most of its lines agree on. */
  function meter(lines, lang) {
    var tally = {}, best = 0, bestN = 0;
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      var n = count(lines[i], lang);
      tally[n] = (tally[n] || 0) + 1;
      if (tally[n] > best) { best = tally[n]; bestN = n; }
    }
    return bestN;
  }

  var API = { scan: scan, count: count, meter: meter };
  root.SYLLABLES = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
