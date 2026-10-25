'use strict';

const { openSession, Absent, cleanError } = require('./browser');
const { check } = require('./rules');

// Statuts d'une fonctionnalité (même logique que les 5 cas des cahiers d'exercices).
const STATUTS = {
  absente: { icon: '⬜', label: 'Absente' },
  erreur: { icon: '❌', label: 'Erreur JavaScript' },
  partielle: { icon: '🟠', label: 'Partielle' },
  ok: { icon: '✅', label: 'Fonctionne' },
};

const MAX_DETAILS = 3;

/**
 * Joue le scénario d'une fonctionnalité dans un contexte neuf (localStorage vide).
 * ux : retours utilisateur observés pendant les scénarios (notification, confirmation, erreur, état vide).
 */
const runFeature = async (browser, baseUrl, feature, ux) => {
  const session = await openSession(browser, baseUrl, { viewport: feature.viewport });
  const checks = [];
  const ctx = {
    ...session,
    check: (label, ok, hint) => {
      checks.push(check(label, ok, hint));
      return Boolean(ok);
    },
    ux: (kind, ok, hint) => ux[kind].push(check(`${feature.id} — ${kind}`, ok, hint)),
  };
  let absent = null;
  try {
    await feature.scenario(ctx);
  } catch (e) {
    // e.stop : le scénario s'arrête sur une vérification déjà enregistrée.
    if (e instanceof Absent) absent = e.message;
    else if (!e.stop) checks.push(check('Scénario', false, cleanError(e)));
  }
  if (session.loads > 0) {
    checks.push(check('Sans rechargement', false, 'La page s\'est rechargée pendant le scénario : formulaire sans `preventDefault()` ou lien `href` ?'));
  }
  const exceptions = [...new Set(session.exceptions)];
  const consoleErrors = [...new Set(session.consoleErrors)];
  await session.close();

  const passed = checks.filter((c) => c.ok).length;
  const failures = checks.filter((c) => !c.ok);
  let statut;
  if (exceptions.length > 0) statut = 'erreur';
  else if (absent && passed === 0) statut = 'absente';
  else if (absent || failures.length > 0) statut = 'partielle';
  else statut = 'ok';
  const details = [...exceptions.map((e) => `Exception : ${e}`), ...(absent ? [absent] : []), ...failures.map((c) => c.hint)];
  return {
    id: feature.id,
    titre: feature.titre,
    crud: feature.crud || null,
    statut,
    tests: { passed, total: checks.length + (absent ? 1 : 0) },
    feedback: feature.feedback[statut] || '',
    details: details.slice(0, MAX_DETAILS),
    exceptions,
    consoleErrors,
  };
};

module.exports = { runFeature, STATUTS };
