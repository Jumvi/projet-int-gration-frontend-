'use strict';

const { check, skip } = require('./rules');

// Seul accès réseau de l'évaluation : l'application est-elle en ligne à l'adresse de projet.json ?
const checkPages = async (projet) => {
  const url = String((projet && projet.pages) || '');
  if (process.env.KADEA_OFFLINE) return skip('Application en ligne', 'Vérification de GitHub Pages désactivée (KADEA_OFFLINE).');
  if (!/^https:\/\//.test(url)) return check('Application en ligne', false, 'Adresse GitHub Pages absente de projet.json.');
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return check('Application en ligne', false, `${url} répond ${res.status} : active GitHub Pages (Settings → Pages) sur la bonne branche.`);
    const body = await res.text();
    return check('Application en ligne', /js\/app\.js/.test(body), `${url} est en ligne mais ne charge pas js/app.js : ce n'est pas ton application.`);
  } catch (e) {
    return skip('Application en ligne', `GitHub Pages non joignable depuis l'évaluation (${e.name}) : vérifié par le coach.`);
  }
};

module.exports = { checkPages };
