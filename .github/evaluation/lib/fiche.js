'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadDonnees } = require('./sandbox');
const { check } = require('./rules');

/**
 * Appelle les fonctions de js/donnees.js imposées par la fiche, hors navigateur.
 * sujet.fonctions : [{ nom, tests: (api) => checks }] ; api.json('expr') renvoie { ok, value | error }.
 */
const testFiche = (root, sujet) => {
  const file = path.join(root, 'js', 'donnees.js');
  if (!fs.existsSync(file)) return { exists: false, checks: [check('js/donnees.js', false, '`js/donnees.js` est introuvable.')], fonctions: [] };
  const api = loadDonnees(fs.readFileSync(file, 'utf8'));
  if (api.error) {
    const hint = /is not defined/.test(api.errorMessage)
      ? `\`js/donnees.js\` ne se charge pas seul (${api.errorMessage}) : il ne doit dépendre ni du DOM ni des autres fichiers.`
      : `\`js/donnees.js\` s'arrête sur une erreur : ${api.errorMessage}.`;
    return { exists: true, checks: [check('Chargement de donnees.js', false, hint)], fonctions: [] };
  }
  const fonctions = sujet.fonctions.map((fn) => {
    if (!api.has(fn.nom)) return { nom: fn.nom, checks: [check(fn.nom, false, `Fonction \`${fn.nom}()\` absente de \`js/donnees.js\`.`)] };
    try {
      return { nom: fn.nom, checks: fn.tests(api) };
    } catch (e) {
      return { nom: fn.nom, checks: [check(fn.nom, false, `\`${fn.nom}()\` : test impossible (${e.message}).`)] };
    }
  });
  return { exists: true, checks: fonctions.flatMap((f) => f.checks), fonctions };
};

// Raccourci pour les tests : compare la valeur renvoyée par une expression à une attente.
const expect = (api, expression, predicate, attendu) => {
  const res = api.json(expression);
  const ok = res.ok && predicate(res.value);
  const got = res.ok ? JSON.stringify(res.value) : res.error;
  return check(expression, ok, `\`${expression}\` renvoie ${got === undefined ? 'undefined' : String(got).slice(0, 140)} : ${attendu}.`);
};

module.exports = { testFiche, expect };
