#!/usr/bin/env node
'use strict';

/**
 * Évaluation automatique — Projet de fin de module 6 (application web vanilla + localStorage).
 * Usage : node .github/evaluation/evaluate.js [dossierDuDepot] [fichierDeSortie]
 * Les captures sont écrites dans evaluation/captures/ à côté du fichier de sortie.
 */

const fs = require('node:fs');
const path = require('node:path');

const { loadProjet, checkFiles, SUJETS } = require('./lib/projet');
const { analyzeProject } = require('./lib/static');
const { analyzeCss } = require('./lib/css');
const { validateHtml, semantics } = require('./lib/html');
const { testFiche } = require('./lib/fiche');
const { gitFacts, currentSha } = require('./lib/git');
const { checkReadme } = require('./lib/readme');
const { checkPages } = require('./lib/pages');
const { startServer } = require('./lib/server');
const { launch, openSession } = require('./lib/browser');
const { runFeature, STATUTS } = require('./lib/fonctionnalites');
const { checkResponsive } = require('./lib/responsive');
const { checkClavier } = require('./lib/clavier');
const { runLighthouse } = require('./lib/lighthouse');
const { checkPersistance, checkInjection } = require('./lib/persistance');
const { scoreRubric, summarize } = require('./lib/rubric');
const { check, skip } = require('./lib/rules');
const { mdCell } = require('./lib/text');

const ROOT = path.resolve(process.argv[2] || process.cwd());
const OUTPUT = path.resolve(process.argv[3] || path.join(ROOT, 'evaluation.md'));
const CAPTURES = path.join(path.dirname(OUTPUT), 'evaluation', 'captures');

const loadSujet = (id) => (id ? require(`./sujets/${id}`) : null);

const emptyBrowserResults = (reason) => ({
  sem: { facts: { main: false, nav: false, logo: false }, checks: [check('Structure', false, reason)], labels: check('Un label par champ', false, reason) },
  responsive: [375, 768, 1280].map((width) => ({ width, capture: null, check: check(`${width} px`, false, reason) })),
  clavier: { checks: [check('Clavier', false, reason)] },
  lighthouse: { ok: false, score: null, failing: [] },
  persistance: { premier: [check('Données de démonstration', false, reason), check('Clé', false, reason)], reload: [check('Rechargement', false, reason)], modele: [], exceptions: [], consoleErrors: [] },
  injection: { ok: null, check: skip('Injection HTML', reason) },
  features: [],
});

const runBrowser = async (sujet, ux) => {
  const server = await startServer(ROOT);
  const browser = await launch();
  try {
    const first = await openSession(browser, server.url);
    const sem = await semantics(first.page);
    await first.close();
    const responsive = await checkResponsive(browser, server.url, CAPTURES);
    const clavier = await checkClavier(browser, server.url);
    const persistance = await checkPersistance(browser, server.url, sujet);
    const injection = await checkInjection(browser, server.url, sujet);
    const features = [];
    for (const feature of sujet.fonctionnalites) {
      features.push(await runFeature(browser, server.url, feature, ux));
      console.log(`  ${feature.id} ${STATUTS[features[features.length - 1].statut].label}`);
    }
    await browser.close();
    const lighthouse = await runLighthouse(server.url);
    return { sem, responsive, clavier, persistance, injection, features, lighthouse };
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
};

const yesNo = (c) => (c.ok === null ? '➖' : c.ok ? '✅' : '❌');

const buildReport = (r, rubric, summary, meta) => {
  const out = [];
  const sujet = r.sujet ? SUJETS[r.sujet.id].titre : 'sujet non reconnu';
  out.push('# 📊 Évaluation automatique — Projet de fin de module 6');
  out.push('');
  out.push(`> Générée le ${meta.date} · commit \`${meta.sha}\` · **${mdCell(r.projet.nom || 'application sans nom')}** · ${sujet} · évaluation déterministe basée uniquement sur le brief, la fiche du sujet et le barème.`);
  out.push('');
  out.push(`## Note : **${summary.total} / 18** · **${String(summary.sur20).replace('.', ',')} / 20** · ${summary.niveau}`);
  out.push('');
  const ok = r.features.filter((f) => f.statut === 'ok').length;
  out.push(`Fonctionnalités : **${ok} / 10** · Compétence ${summary.validee ? '✅ **validée**' : `❌ **non validée** (${summary.total < 12 ? 'moins de 12 / 18' : `critère à 0 : ${summary.zero.join(', ')}`})`}`);
  out.push('');
  if (r.git.evaluatorTouched.length > 0) {
    out.push(`> ⚠️ Le dossier \`.github/\` a été modifié par l'apprenant (${r.git.evaluatorTouched.slice(0, 3).map((c) => `\`${mdCell(c)}\``).join(', ')}) : le coach vérifiera ce résultat.`);
    out.push('');
  }
  const blocking = r.projet.checks.filter((c) => !c.ok).concat(r.files.checks.filter((c) => !c.ok));
  if (blocking.length > 0) {
    out.push(`> ⚠️ Contrat technique : ${blocking.map((c) => mdCell(c.hint)).join(' · ')}`);
    out.push('');
  }

  out.push('## 1. Fonctionnalités de la fiche');
  out.push('');
  if (r.features.length === 0) {
    out.push(`_Aucune fonctionnalité testée : ${mdCell(r.blocked)}_`);
  } else {
    out.push('| Fonctionnalité | Statut | Tests | Feedback |');
    out.push('|---|---|:-:|---|');
    r.features.forEach((f) => {
      const details = f.details.length > 0 ? `\n${f.details.map((d) => `• ${d}`).join('\n')}` : '';
      out.push(`| **${f.id}** — ${mdCell(f.titre)} | ${STATUTS[f.statut].icon} ${STATUTS[f.statut].label} | ${f.tests.passed}/${f.tests.total} | ${mdCell(`${f.feedback}${details}`)} |`);
    });
  }
  out.push('');

  out.push('## 2. Vérifications techniques');
  out.push('');
  out.push('| Vérification | Résultat | Détail |');
  out.push('|---|:-:|---|');
  const row = (label, c, okText) => out.push(`| ${label} | ${yesNo(c)} | ${mdCell(c.ok ? okText || '' : c.hint)} |`);
  const lh = r.lighthouse;
  row('Validation HTML', check('HTML', r.html.exists && r.html.errors.length === 0, r.html.exists ? `${r.html.errors.length} erreur(s) : ${r.html.errors.slice(0, 3).join(' ; ')}` : 'index.html absent'), 'Aucune erreur');
  r.sem.checks.filter((c) => !c.ok).forEach((c) => row('Sémantique', c));
  if (r.sem.checks.every((c) => c.ok)) row('Sémantique', check('s', true), 'header, nav, main, footer, un seul h1');
  row('Labels', r.sem.labels, 'Chaque champ a son label');
  row(
    'Accessibilité Lighthouse',
    lh.score === null ? skip('Lighthouse', `Lighthouse n'a pas pu s'exécuter${lh.error ? ` : ${lh.error}` : ''}.`) : check('Lighthouse', lh.score >= 90, `${lh.score} / 100 — à corriger : ${lh.failing.slice(0, 4).join(' ; ')}`),
    `${lh.score} / 100`,
  );
  r.responsive.forEach((x) => row(`Responsive ${x.width} px`, x.check, 'Aucun défilement horizontal'));
  r.clavier.checks.forEach((c) => row(c.label, c, r.clavier.reached ? `${r.clavier.reached} contrôle(s) atteint(s) avec Tab` : ''));
  r.persistance.premier.forEach((c) => row(`Premier lancement : ${c.label}`, c, 'OK'));
  r.persistance.reload.forEach((c) => row('Rechargement (F5)', c, 'Action → rechargement → état conservé'));
  row('Injection HTML', r.injection.check, 'La saisie piégée reste du texte');
  row('Console', check('Console', r.consoleErrors.length === 0, `${r.consoleErrors.length} erreur(s) : ${r.consoleErrors.slice(0, 2).join(' ; ')}`), 'Aucune erreur');
  const methods = ['find', 'filter', 'map', 'some', 'sort', 'reduce'];
  row('Méthodes de tableau', check('m', methods.every((m) => r.js.arrayMethods.has(m)), `Absente(s) : ${methods.filter((m) => !r.js.arrayMethods.has(m)).join(', ')}`), methods.join(', '));
  const fiche = r.donnees.checks;
  row('Fonctions de donnees.js', check('f', fiche.length > 0 && fiche.every((c) => c.ok), `${fiche.filter((c) => c.ok).length}/${fiche.length} : ${(fiche.find((c) => !c.ok) || {}).hint || ''}`), `${fiche.length}/${fiche.length} tests réussis`);
  row('Commits', check('g', r.git.count >= 15 && r.git.days >= 6, `${r.git.count} commit(s) sur ${r.git.days} jour(s) (15 sur 6 jours attendus)`), `${r.git.count} commits sur ${r.git.days} jours`);
  row('README', check('r', r.readme.ok, (r.readme.checks.find((c) => !c.ok) || {}).hint), 'Complet');
  row('GitHub Pages', r.pages, `En ligne : ${r.projet.data.pages || ''}`);
  out.push('');

  out.push('## 3. Barème officiel (/18)');
  out.push('');
  out.push('| Critère | Niveau | Points /3 | Feedback |');
  out.push('|---|---|:-:|---|');
  rubric.forEach((c) => {
    const todo = c.points < 3 && c.failed.length > 0 ? `\nÀ corriger : ${c.failed.slice(0, 3).join(' ')}` : '';
    out.push(`| ${mdCell(c.name)} | ${c.level} (${c.percent} %) | **${c.points}** | ${mdCell(`${c.feedback}\n_${c.detail}_${todo}`)} |`);
  });
  out.push(`| **Total** | ${summary.niveau} | **${summary.total} / 18** | Note sur 20 : **${String(summary.sur20).replace('.', ',')}** |`);
  out.push('');

  const captures = r.responsive.filter((x) => x.capture);
  if (captures.length > 0) {
    out.push('## 4. Captures (premier lancement)');
    out.push('');
    out.push(`| ${captures.map((x) => `${x.width} px`).join(' | ')} |`);
    out.push(`|${captures.map(() => ':-:').join('|')}|`);
    out.push(`| ${captures.map((x) => `<img src="${path.relative(path.dirname(OUTPUT), x.capture).split(path.sep).join('/')}" width="${Math.round(x.width / 4)}" alt="Capture ${x.width} px">`).join(' | ')} |`);
    out.push('');
  }

  out.push('## Comment lire cette évaluation');
  out.push('');
  out.push('| Statut | Signification |');
  out.push('|---|---|');
  out.push('| ⬜ Absente | Les éléments `data-test` de la fiche sont introuvables |');
  out.push('| ❌ Erreur JavaScript | Une exception s\'est produite pendant le scénario |');
  out.push('| 🟠 Partielle | Au moins une vérification du scénario échoue (cas limites compris) |');
  out.push('| ✅ Fonctionne | Toutes les vérifications du scénario réussissent, sans rechargement de page |');
  out.push('');
  out.push('Chaque scénario part d\'un localStorage vide (données de démonstration). Barème : chaque critère est noté de 0 à 3 à partir des vérifications ci-dessus, puis plafonné selon les règles du barème (ex. `var` ou `==` → 1 au plus ; faille d\'injection → 0). Note sur 20 = total sur 18 × 10 ÷ 9 ; compétence validée à partir de 12 / 18, sans aucun critère à 0.');
  out.push('');
  out.push('> ℹ️ Le coach complète cette évaluation : ressemblance avec le produit d\'origine, démo de 5 minutes et explication de ton code. Corrige, commit, merge sur `develop` et push : l\'évaluation est relancée automatiquement.');
  out.push('');
  return out.join('\n');
};

const main = async () => {
  const projet = loadProjet(ROOT);
  const files = checkFiles(ROOT);
  const sujet = loadSujet(projet.sujet);
  const ux = { notification: [], confirmation: [], erreur: [], etatVide: [] };

  const r = {
    projet,
    files,
    sujet,
    html: await validateHtml(ROOT),
    css: analyzeCss(ROOT),
    js: analyzeProject(ROOT),
    donnees: sujet ? testFiche(ROOT, sujet) : { exists: fs.existsSync(path.join(ROOT, 'js', 'donnees.js')), checks: [check('Fiche', false, 'Sujet inconnu : renseigne `sujet` dans projet.json.')] },
    git: gitFacts(ROOT),
    readme: checkReadme(ROOT, projet.data),
    pages: await checkPages(projet.data),
    ux,
  };

  r.blocked = !sujet ? 'le sujet de `projet.json` est absent ou inconnu.' : !fs.existsSync(path.join(ROOT, 'index.html')) ? '`index.html` est introuvable.' : null;
  Object.assign(r, r.blocked ? emptyBrowserResults(r.blocked) : await runBrowser(sujet, ux));

  r.consoleErrors = [...new Set([...r.features.flatMap((f) => [...f.exceptions, ...f.consoleErrors]), ...(r.persistance.exceptions || []), ...(r.persistance.consoleErrors || [])])];
  if (r.js.syntaxErrors.length > 0) r.consoleErrors.unshift(...r.js.syntaxErrors);

  const rubric = scoreRubric(r);
  const summary = summarize(rubric);
  const report = buildReport(r, rubric, summary, {
    date: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    sha: currentSha(ROOT),
  });
  fs.writeFileSync(OUTPUT, report);

  rubric.forEach((c) => console.log(`${String(c.points)}/3  ${c.name.padEnd(42)} ${c.detail}`));
  console.log(`\nNote : ${summary.total}/18 (${summary.sur20}/20) → ${path.relative(process.cwd(), OUTPUT) || OUTPUT}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
