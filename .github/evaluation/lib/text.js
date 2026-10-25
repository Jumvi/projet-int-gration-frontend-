'use strict';

// Normalise un texte pour comparer des sorties sans être piégé par la mise en forme :
// accents, casse, espaces insécables (toLocaleString), tirets longs, apostrophes typographiques.
const normalize = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00a0\u202f\u2009\u2007]/g, ' ')
    .replace(/[’‘`´]/g, "'")
    .replace(/[—–]/g, '-')
    .toLowerCase()
    .replace(/(\d)[ ,](?=\d{3}(?!\d))/g, '$1') // "75 000" ou "75,000" (toLocaleString) -> "75000"
    .replace(/\s+/g, ' ')
    .trim();

// Découpe en jetons (mots / nombres, décimales comprises). La ponctuation est ignorée.
const tokens = (value) => normalize(value).match(/-?\d+(?:\.\d+)?|[a-z]+/g) || [];

// Les jetons attendus apparaissent-ils de façon CONTIGUË dans le texte ?
const hasRun = (text, expected) => {
  const hay = tokens(text);
  const needle = tokens(expected);
  if (needle.length === 0) return true;
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
};

// Les jetons attendus apparaissent-ils DANS L'ORDRE (pas forcément contigus) ?
const inOrder = (text, expectedList) => {
  const hay = tokens(text);
  let pos = 0;
  for (const item of expectedList) {
    const needle = tokens(item);
    let found = -1;
    for (let i = pos; i + needle.length <= hay.length; i += 1) {
      if (needle.every((t, j) => hay[i + j] === t)) {
        found = i;
        break;
      }
    }
    if (found === -1) return false;
    pos = found + needle.length;
  }
  return true;
};

// Même texte, à la mise en forme près (jetons identiques).
const sameText = (a, b) => typeof a === 'string' && tokens(a).join(' ') === tokens(b).join(' ');

const show = (value) => {
  if (typeof value === 'string') return `'${value}'`;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const mdCell = (value) => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

module.exports = { normalize, tokens, hasRun, inOrder, sameText, show, mdCell };
