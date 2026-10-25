'use strict';

const vm = require('node:vm');
const nodeCrypto = require('node:crypto');

const TIMEOUT = 2000;

const describeError = (error) => {
  if (error === null || error === undefined) return 'erreur inconnue';
  if (typeof error !== 'object') return `Exception levée : ${String(error)}`;
  if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return `Temps d'exécution dépassé (${TIMEOUT} ms) : boucle infinie probable`;
  return `${error.name || 'Error'}: ${error.message}`;
};

/**
 * Charge js/donnees.js seul, sans DOM ni localStorage : c'est ce que demande le contrat.
 * Les fonctions déclarées au premier niveau (const / function) sont ensuite appelables par leur nom.
 */
const loadDonnees = (code, filename = 'js/donnees.js') => {
  const sandbox = {
    console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, table: () => {} },
    crypto: { randomUUID: () => nodeCrypto.randomUUID(), getRandomValues: (a) => nodeCrypto.getRandomValues(a) },
    structuredClone,
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  const context = vm.createContext(sandbox);
  let error = null;
  try {
    new vm.Script(code, { filename }).runInContext(context, { timeout: TIMEOUT });
  } catch (e) {
    error = e === undefined || e === null ? new Error(`exception levée : ${e}`) : e;
  }

  const evaluate = (expression) => {
    try {
      return { ok: true, value: new vm.Script(expression).runInContext(context, { timeout: TIMEOUT }) };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  };

  // Évalue une expression et renvoie sa valeur sérialisée (indépendante du contexte vm).
  const json = (expression) => {
    const res = evaluate(`(() => { const v = (${expression}); return v === undefined ? '__undefined__' : JSON.stringify(v); })()`);
    if (!res.ok) return res;
    if (res.value === '__undefined__') return { ok: true, value: undefined };
    try {
      return { ok: true, value: res.value === undefined ? undefined : JSON.parse(res.value) };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  };

  const has = (name) => {
    const res = evaluate(`typeof ${name} === 'function'`);
    return res.ok && res.value === true;
  };

  return { error, errorMessage: error ? describeError(error) : null, evaluate, json, has };
};

module.exports = { loadDonnees, describeError };
