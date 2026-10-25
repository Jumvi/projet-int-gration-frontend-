'use strict';

const { check } = require('./rules');
const { ARRAY_METHODS } = require('./static');

// Barème officiel : 6 critères × 3 points. Les textes de niveau sont repris du barème.
const LEVELS = ['Débutant : Insuffisant', 'En développement : À améliorer', 'Compétent : Satisfaisant', 'Avancé'];

const toLevel = (ratio) => {
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.65) return 2;
  if (ratio >= 0.35) return 1;
  return 0;
};

// Une preuve pondérée ; ok === null = non mesurable, exclue du calcul.
const proof = (w, c) => ({ ...c, w });
const weighted = (proofs) => {
  const counted = proofs.filter((p) => p.ok !== null);
  const total = counted.reduce((sum, p) => sum + p.w, 0);
  return total === 0 ? 0 : counted.reduce((sum, p) => sum + (p.ok ? p.w : 0), 0) / total;
};
const share = (checks) => {
  const counted = checks.filter((c) => c.ok !== null);
  return counted.length === 0 ? null : counted.filter((c) => c.ok).length / counted.length;
};
// Proportion → preuve : réussie si au moins `min` des vérifications passent.
const fromShare = (w, label, checks, min, hint) => {
  const value = share(checks);
  return proof(w, { label, ok: value === null ? null : value >= min, hint: hint || (checks.find((c) => c.ok === false) || {}).hint || label });
};

const CRITERIA = [
  {
    name: 'Intégration HTML/CSS et responsive',
    texts: [
      'Page faite de div, aucune adaptation au mobile, débordement horizontal à toutes les largeurs.',
      'Sémantique partielle (div à la place de nav ou main, champs sans label). Application difficile à utiliser sur mobile. Valeurs CSS répétées en dur.',
      'Structure sémantique et responsive corrects. Lighthouse entre 80 et 89, ou quelques erreurs de validation mineures, ou un défaut de mise en page à une seule largeur.',
      'HTML sémantique et valide (header, nav, main, footer, un seul h1), un label par champ, accessibilité Lighthouse d\'au moins 90, tout au clavier avec un focus visible. Aucun défilement horizontal aux trois largeurs ; Flexbox et Grid choisis à bon escient ; couleurs et espacements en variables CSS.',
    ],
    score: (r) => {
      const lh = r.lighthouse.score;
      const overflow = r.responsive.filter((x) => !x.check.ok).length;
      const css = r.css.exists ? r.css : {};
      const proofs = [
        proof(3, check('Lighthouse ≥ 90', lh === null ? null : lh >= 90, `Accessibilité Lighthouse : ${lh} / 100 (90 attendu).`)),
        proof(2, check('HTML valide', r.html.exists && r.html.errors.length === 0, `${r.html.errors.length} erreur(s) de validation HTML.`)),
        fromShare(2, 'Sémantique', r.sem.checks, 1),
        proof(2, r.sem.labels),
        fromShare(3, 'Responsive', r.responsive.map((x) => x.check), 1),
        fromShare(2, 'Clavier', r.clavier.checks, 1),
        proof(1, check('Variables CSS', css.variables >= 5 && css.varUses >= 10, `${css.variables || 0} variable(s) CSS dans :root et ${css.varUses || 0} var() : mets couleurs et espacements en variables.`)),
        proof(1, check('Pas de valeurs en dur répétées', (css.repeatedColors || []).length === 0, `Couleurs répétées en dur : ${(css.repeatedColors || []).slice(0, 3).map((c) => `\`${c.value}\` ×${c.n}`).join(', ')}.`)),
        proof(1, check('Flexbox et Grid', css.flex && css.grid, 'Flexbox et Grid doivent être utilisés tous les deux, chacun à bon escient.')),
      ];
      const caps = [];
      if (!r.html.exists || !r.css.exists) caps.push({ max: 0, reason: 'index.html ou style.css absent' });
      if (overflow === 3) caps.push({ max: 0, reason: 'débordement horizontal aux trois largeurs' });
      if (lh !== null && lh < 80) caps.push({ max: 1, reason: `Lighthouse ${lh} < 80` });
      if (r.sem.labels.ok === false || !r.sem.facts.main || !r.sem.facts.nav) caps.push({ max: 1, reason: 'sémantique partielle (nav, main ou labels)' });
      if (lh !== null && lh < 90) caps.push({ max: 2, reason: `Lighthouse ${lh} < 90` });
      if (overflow > 0) caps.push({ max: 2, reason: 'défilement horizontal à une largeur' });
      return { proofs, caps, detail: `Lighthouse ${lh === null ? 'n/a' : lh} · validation ${r.html.errors.length} erreur(s) · débordements ${overflow}/3` };
    },
  },
  {
    name: 'Interface (UI) et expérience utilisateur (UX)',
    texts: [
      'Interface brute, sans travail de design ; l\'utilisateur reste bloqué ou perd des données sans avertissement.',
      'Ressemblance lointaine avec le produit, incohérences de couleurs ou d\'espacements, plusieurs éléments d\'UX manquants.',
      'Interface fidèle et cohérente, mais finitions inégales, ou un élément d\'UX manquant (par exemple aucune notification).',
      'L\'interface évoque immédiatement le produit d\'origine, avec sa propre identité (nom, logo, palette). Finitions soignées : états hover, focus, active, transitions. États vides, confirmation avant suppression, notification après chaque action, messages d\'erreur précis ; aucun parcours bloquant.',
    ],
    score: (r) => {
      const css = r.css.exists ? r.css : {};
      const nameOk = r.projet.checks.filter((c) => /Nom/.test(c.label));
      const ux = {
        etatVide: fromShare(2, 'États vides', r.ux.etatVide, 0.75, 'États vides absents ou non affichés.'),
        confirmation: fromShare(2, 'Confirmation avant suppression', r.ux.confirmation, 1, 'Au moins une suppression se fait sans confirmation.'),
        notification: fromShare(2, 'Notification après action', r.ux.notification, 0.75, 'Pas de notification `[data-test="notification"]` après les actions.'),
        erreur: fromShare(1, 'Messages d\'erreur', r.ux.erreur, 0.75, 'Les saisies invalides ne sont pas refusées avec un message précis.'),
      };
      const finitions = [css.hover, css.focus, css.active, css.transition].filter(Boolean).length;
      const proofs = [
        proof(1, check('Identité propre (nom)', nameOk.length > 0 && nameOk.every((c) => c.ok), (nameOk.find((c) => !c.ok) || { hint: 'Nom de l\'application absent de projet.json.' }).hint)),
        proof(1, check('Logo dans l\'en-tête', r.sem.facts.logo, 'Aucun logo (`<img>` ou `<svg>`) dans le `<header>`.')),
        proof(2, check('États hover, focus, active, transitions', finitions === 4, `Finitions CSS : ${finitions}/4 (:hover, :focus-visible, :active, transition).`)),
        ...Object.values(ux),
        proof(1, check('Aucun parcours bloquant', r.features.every((f) => f.statut !== 'erreur'), 'Une exception JavaScript bloque au moins une fonctionnalité.')),
      ];
      const missing = Object.values(ux).filter((p) => p.ok === false).map((p) => p.label);
      const caps = [];
      if (!r.css.exists || (css.size || 0) < 300) caps.push({ max: 0, reason: 'aucun travail de design (CSS absent)' });
      if (missing.length >= 2) caps.push({ max: 1, reason: `éléments d'UX manquants : ${missing.join(', ')}` });
      if (missing.length === 1) caps.push({ max: 2, reason: `élément d'UX manquant : ${missing[0]}` });
      if (proofs[0].ok === false || proofs[1].ok === false) caps.push({ max: 2, reason: 'pas d\'identité propre (nom ou logo)' });
      return { proofs, caps, detail: `${missing.length === 0 ? 'Tous les éléments d\'UX sont présents' : `Manquant : ${missing.join(', ')}`} · la ressemblance avec le produit est appréciée par le coach` };
    },
  },
  {
    name: 'Fonctionnalités et CRUD',
    texts: [
      'Moins de 5 fonctionnalités fonctionnent.',
      '5 à 7 fonctionnalités fonctionnent, ou le CRUD est incomplet (modifier ou supprimer manquant).',
      '8 ou 9 fonctionnalités fonctionnent, et le CRUD est complet.',
      'Les 10 fonctionnalités fonctionnent, sans rechargement de page. Créer, afficher, modifier et supprimer marchent dans tous les cas testés, y compris les cas limites (champ vide, liste vide).',
    ],
    // Seuils explicites du barème (pas de pourcentage).
    direct: (r) => {
      const ok = r.features.filter((f) => f.statut === 'ok').length;
      const crud = ['create', 'read', 'update', 'delete'].map((k) => r.features.find((f) => [].concat(f.crud || []).includes(k))).filter(Boolean);
      const crudOk = crud.length === 4 && crud.every((f) => f.statut === 'ok');
      let points = 0;
      if (ok === 10) points = 3;
      else if (ok >= 8 && crudOk) points = 2;
      else if (ok >= 5) points = 1;
      const missing = crud.filter((f) => f.statut !== 'ok').map((f) => f.id);
      return { points, ratio: ok / 10, detail: `${ok}/10 fonctionnalités · CRUD ${crudOk ? 'complet' : `incomplet (${missing.join(', ')})`}` };
    },
  },
  {
    name: 'Données et logique JavaScript',
    texts: [
      'Pas de modèle de données ; toute la logique est écrite dans les écouteurs, code copié-collé.',
      'Données mal structurées (doublons, informations relues dans le DOM), logique mélangée à l\'affichage, présence de var ou de ==.',
      'Modèle correct. Une ou deux méthodes de tableau absentes ou remplacées par des boucles manuelles ; quelques fonctions trop longues.',
      'Modèle de la fiche respecté : objets avec id, tableaux imbriqués, objet dictionnaire. find, filter, map, some, sort et reduce employés à bon escient, avec un return dans chaque callback. Fonctions de données courtes et nommées, avec paramètres et valeur renvoyée, sans accès au DOM. Règles de code Kadea respectées (const, ===, fléchées, gabarits littéraux).',
    ],
    score: (r) => {
      const js = r.js;
      const methods = ARRAY_METHODS.filter((m) => js.arrayMethods.has(m));
      const absentMethods = ARRAY_METHODS.filter((m) => !js.arrayMethods.has(m));
      const rules = [
        check('Aucun var', js.varCount === 0, `${js.varCount} \`var\` : utilise \`const\` / \`let\`.`),
        check('===', js.looseEq.length === 0, `\`==\` / \`!=\` : ${js.looseEq.slice(0, 3).map((e) => `${e.file} l.${e.line}`).join(', ')}.`),
        check('Fléchées', js.classicFunctions.length === 0, `Mot-clé \`function\` : ${js.classicFunctions.slice(0, 3).map((f) => `${f.file} l.${f.line}`).join(', ')}.`),
        check('Gabarits', js.templates > 0 && js.concat.length === 0, js.concat.length > 0 ? `Concaténation avec + : ${js.concat.slice(0, 3).map((c) => `${c.file} l.${c.line}`).join(', ')} → gabarit littéral.` : 'Aucun gabarit littéral.'),
        check('const par défaut', js.letNeverReassigned.length === 0, `\`let\` jamais réassigné : ${js.letNeverReassigned.slice(0, 3).map((l) => `\`${l.name}\``).join(', ')} → \`const\`.`),
      ];
      const proofs = [
        fromShare(3, 'Fonctions de la fiche', r.donnees.checks, 0.9),
        proof(2, check('6 méthodes de tableau', absentMethods.length === 0, `Méthode(s) absente(s) : ${absentMethods.map((m) => `\`${m}\``).join(', ')}.`)),
        proof(1, check('return dans chaque callback', js.callbacksWithoutReturn.length === 0, `Callback sans return : ${js.callbacksWithoutReturn.slice(0, 3).map((c) => `.${c.method}() ${c.file} l.${c.line}`).join(', ')}.`)),
        proof(2, check('donnees.js sans DOM', r.donnees.exists && js.donneesDom.length === 0, r.donnees.exists ? `\`js/donnees.js\` utilise ${js.donneesDom.map((g) => `\`${g}\``).join(', ')} : la logique de données ne touche pas au DOM.` : '`js/donnees.js` absent.')),
        fromShare(2, 'Modèle de la fiche', r.persistance.modele, 1),
        fromShare(2, 'Règles de code Kadea', rules, 1),
      ];
      const caps = [];
      if (!r.donnees.exists) caps.push({ max: 0, reason: 'js/donnees.js absent' });
      if (js.varCount > 0 || js.looseEq.length > 0) caps.push({ max: 1, reason: 'présence de var ou de ==' });
      if (absentMethods.length > 2) caps.push({ max: 1, reason: `${absentMethods.length} méthodes de tableau absentes` });
      if (absentMethods.length > 0) caps.push({ max: 2, reason: `méthode(s) absente(s) : ${absentMethods.join(', ')}` });
      return { proofs, caps, detail: `Méthodes ${methods.length}/6 · fonctions de la fiche ${Math.round((share(r.donnees.checks) || 0) * 100)} % · modèle ${Math.round((share(r.persistance.modele) || 0) * 100)} %` };
    },
  },
  {
    name: 'DOM, événements et persistance',
    texts: [
      'Aucune persistance, ou l\'application ne réagit pas aux actions.',
      'Rechargements de page, DOM modifié à la main sans passer par l\'état, persistance partielle ou erreur au premier lancement.',
      'Un seul écart : une partie de l\'état non sauvegardée, pas de données de démonstration, ou pas de délégation.',
      'Page reconstruite à partir de l\'état avec createElement et textContent ; formulaires écoutés sur submit avec preventDefault() ; délégation pour les listes ; chemin écouteur → données → sauvegarder() → affichage respecté. Clé kadea-<sujet> en JSON, données de démonstration au premier lancement, tout l\'état survit au rechargement.',
    ],
    score: (r) => {
      const js = r.js;
      const p = r.persistance;
      const premier = (label) => p.premier.find((c) => c.label.includes(label)) || check(label, false);
      const reloads = r.features.some((f) => f.details.some((d) => /rechargée/.test(d)));
      const key = premier('Clé');
      const demo = premier('démonstration');
      const reload = p.reload[0] || check('Rechargement', false);
      const delegation = check('Délégation d\'événements', js.delegation > 0, 'Aucune délégation : un seul écouteur sur la liste, avec `event.target.closest(...)`.');
      const proofs = [
        proof(2, check('createElement et textContent', js.createElement >= 1 && js.textContent >= 1, `createElement ×${js.createElement}, textContent ×${js.textContent} : construis la page avec ces deux outils.`)),
        proof(1, check('submit + preventDefault()', js.listeners.has('submit') && js.preventDefault > 0, 'Formulaires à écouter sur `submit` avec `event.preventDefault()`.')),
        proof(1, delegation),
        proof(2, key),
        proof(2, demo),
        proof(2, reload),
        proof(1, check('Aucun rechargement', !reloads, 'La page se recharge pendant certaines actions.')),
        proof(1, check('localStorage seulement dans stockage.js', js.localStorageOutside.length === 0, `localStorage utilisé hors de \`js/stockage.js\` : ${js.localStorageOutside.join(', ')}.`)),
      ];
      const ecarts = [reload, demo, delegation].filter((c) => !c.ok).map((c) => c.label);
      const caps = [];
      if (!key.ok && !reload.ok) caps.push({ max: 0, reason: 'aucune persistance' });
      if (reloads || p.exceptions.length > 0 || !reload.ok) caps.push({ max: 1, reason: reloads ? 'rechargements de page' : p.exceptions.length > 0 ? 'erreur au premier lancement' : 'persistance partielle' });
      if (ecarts.length >= 2) caps.push({ max: 1, reason: `écarts : ${ecarts.join(', ')}` });
      if (ecarts.length === 1) caps.push({ max: 2, reason: `un écart : ${ecarts[0]}` });
      return { proofs, caps, detail: `Clé ${key.ok ? '✅' : '❌'} · démo ${demo.ok ? '✅' : '❌'} · rechargement ${reload.ok ? '✅' : '❌'} · délégation ${delegation.ok ? '✅' : '❌'}` };
    },
  },
  {
    name: 'Bonnes pratiques, Git et documentation',
    texts: [
      'Faille d\'injection, application pas en ligne, tout le code en un seul commit, ou incapable d\'expliquer son propre code.',
      'Deux ou trois sont faibles, par exemple des commits regroupés en fin de projet ou un README succinct.',
      'Un de ces éléments est faible.',
      'Aucune erreur dans la console ; test d\'injection réussi (jamais d\'innerHTML avec une donnée saisie) ; au moins 15 commits sur au moins 6 jours, aux messages explicites ; application en ligne à l\'adresse de projet.json ; README complet avec captures ; démo claire qui explique et défend les choix techniques.',
    ],
    score: (r) => {
      const g = r.git;
      const unsafeSinks = r.js.htmlSinks.filter((x) => !x.constant);
      const elements = [
        check('Console sans erreur', r.consoleErrors.length === 0, `${r.consoleErrors.length} erreur(s) console, ex. « ${(r.consoleErrors[0] || '').slice(0, 120)} ».`),
        r.injection.check,
        check('Pas d\'innerHTML avec une donnée', unsafeSinks.length === 0, `innerHTML / insertAdjacentHTML avec une valeur dynamique : ${unsafeSinks.slice(0, 3).map((x) => `${x.file} l.${x.line}`).join(', ')}.`),
        check('15 commits sur 6 jours', g.count >= 15 && g.days >= 6, `${g.count} commit(s) sur ${g.days} jour(s) : au moins 15 commits sur 6 jours attendus.`),
        check('Messages de commit explicites', g.count > 0 && g.explicitRatio >= 0.8, `Messages trop vagues : ${g.vague.map((v) => `« ${v} »`).join(', ')}.`),
        r.pages,
        check('README complet', r.readme.ok, (r.readme.checks.find((c) => !c.ok) || {}).hint),
      ];
      const proofs = elements.map((c, i) => proof([2, 2, 1, 1, 1, 2, 2][i], c));
      const faibles = elements.filter((c) => c.ok === false).map((c) => c.label);
      const caps = [];
      if (r.injection.check.ok === false) caps.push({ max: 0, reason: 'faille d\'injection' });
      if (r.pages.ok === false) caps.push({ max: 0, reason: 'application pas en ligne' });
      if (g.count <= 1) caps.push({ max: 0, reason: 'tout le code en un seul commit' });
      if (faibles.length >= 2) caps.push({ max: 1, reason: `éléments faibles : ${faibles.join(', ')}` });
      if (faibles.length === 1) caps.push({ max: 2, reason: `élément faible : ${faibles[0]}` });
      return { proofs, caps, detail: `${g.count} commits · ${g.days} jours · console ${r.consoleErrors.length} erreur(s) · la démo orale est évaluée par le coach` };
    },
  },
];

const scoreRubric = (r) =>
  CRITERIA.map((criterion) => {
    if (criterion.direct) {
      const d = criterion.direct(r);
      return { name: criterion.name, points: d.points, level: LEVELS[d.points], percent: Math.round(d.ratio * 100), feedback: criterion.texts[d.points], detail: d.detail, failed: [] };
    }
    const { proofs, caps, detail } = criterion.score(r);
    const ratio = weighted(proofs);
    const cap = caps.reduce((min, c) => (c.max < min.max ? c : min), { max: 3 });
    const points = Math.min(toLevel(ratio), cap.max);
    return {
      name: criterion.name,
      points,
      level: LEVELS[points],
      percent: Math.round(ratio * 100),
      feedback: criterion.texts[points],
      detail: cap.max < 3 && cap.max < toLevel(ratio) ? `${detail} · plafonné à ${cap.max} : ${cap.reason}` : detail,
      failed: proofs.filter((p) => p.ok === false).map((p) => p.hint),
    };
  });

// Note sur 20 = total sur 18 × 10 ÷ 9 ; compétence validée à partir de 12/18 sans aucun critère à 0.
const summarize = (rubric) => {
  const total = rubric.reduce((sum, c) => sum + c.points, 0);
  const sur20 = Math.round(((total * 10) / 9) * 10) / 10;
  let niveau = LEVELS[0];
  if (total >= 16) niveau = LEVELS[3];
  else if (total >= 12) niveau = LEVELS[2];
  else if (total >= 7) niveau = LEVELS[1];
  const zero = rubric.filter((c) => c.points === 0);
  return { total, sur20, niveau, validee: total >= 12 && zero.length === 0, zero: zero.map((c) => c.name) };
};

module.exports = { scoreRubric, summarize, CRITERIA, LEVELS };
