'use strict';

const { openSession, Absent, cleanError } = require('./browser');
const { check, skip } = require('./rules');

const PAYLOAD = '<img src=x onerror="window.__xss=1"><b data-xss>gras</b>';

// Session hors scénario : les vérifications intermédiaires des outils ne sont pas comptées.
const openTool = async (browser, baseUrl) => {
  const s = await openSession(browser, baseUrl);
  s.check = (label, ok) => Boolean(ok);
  s.ux = () => {};
  return s;
};

/**
 * Premier lancement (localStorage vide) puis test de rechargement.
 * sujet.demo : { item, min } ; sujet.modele(etat) → checks ; sujet.persistance : { agir(ctx), verifier(ctx, memo) }.
 */
const checkPersistance = async (browser, baseUrl, sujet) => {
  const s = await openTool(browser, baseUrl);
  const key = `kadea-${sujet.id}`;
  const result = { premier: [], reload: [], modele: [], etat: null, exceptions: [] };
  try {
    const items = await s.count(s.t(sujet.demo.item));
    result.premier.push(
      check('Données de démonstration', items >= sujet.demo.min, `Au premier lancement, ${items} \`[data-test="${sujet.demo.item}"]\` affiché(s) : au moins ${sujet.demo.min} attendu(s) (\`creerDonneesDemo()\`).`),
    );
    const saved = await s.storage(key);
    result.premier.push(check(`Clé \`${key}\``, saved.exists, `Rien n'est sauvegardé sous la clé \`${key}\` au premier lancement : appelle \`sauvegarder()\` après avoir créé la démo.`));
    if (saved.exists) result.premier.push(check('JSON valide', saved.json, `La valeur de \`${key}\` n'est pas du JSON : utilise \`JSON.stringify()\`.`));
    if (saved.json) {
      result.etat = saved.value;
      result.modele = sujet.modele(saved.value);
    }
    const memo = await sujet.persistance.agir(s);
    await s.reload();
    const after = await sujet.persistance.verifier(s, memo);
    result.reload.push(check('L\'état survit au rechargement', after.ok, after.hint));
    const savedAfter = await s.storage(key);
    if (savedAfter.json && !result.etat) {
      result.etat = savedAfter.value;
      result.modele = sujet.modele(savedAfter.value);
    }
  } catch (e) {
    result.reload.push(check('L\'état survit au rechargement', false, e instanceof Absent ? `Test de rechargement impossible : ${e.message}` : cleanError(e)));
  }
  result.exceptions = [...new Set(s.exceptions)];
  result.consoleErrors = [...new Set(s.consoleErrors)];
  if (result.exceptions.length > 0) result.premier.push(check('Premier lancement sans erreur', false, `Erreur au premier lancement : ${result.exceptions[0]}`));
  await s.close();
  return result;
};

// Une saisie piégée ne doit jamais devenir une balise : textContent, pas innerHTML.
const checkInjection = async (browser, baseUrl, sujet) => {
  const s = await openTool(browser, baseUrl);
  let res;
  try {
    await sujet.injection(s, PAYLOAD);
    await s.settle(300);
    const facts = await s.page.evaluate(() => ({
      executed: window.__xss === 1,
      nodes: document.querySelectorAll('[data-xss], img[src="x"]').length,
      shown: document.body.innerText.includes('data-xss'),
    }));
    res = {
      ok: !facts.executed && facts.nodes === 0,
      tested: facts.shown,
      check: check(
        'Injection HTML',
        !facts.executed && facts.nodes === 0,
        facts.executed ? 'Faille XSS : le code saisi a été exécuté. Affiche les saisies avec `textContent`, jamais `innerHTML`.' : 'Une saisie est devenue une balise HTML : utilise `textContent`, jamais `innerHTML` avec une donnée saisie.',
      ),
    };
  } catch (e) {
    res = { ok: null, tested: false, check: skip('Injection HTML', `Test d'injection impossible : ${e instanceof Absent ? e.message : cleanError(e)}`) };
  }
  await s.close();
  return res;
};

module.exports = { checkPersistance, checkInjection, PAYLOAD };
