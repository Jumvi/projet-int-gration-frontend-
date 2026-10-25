'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { check } = require('./rules');

// Sujets du brief : identifiant (projet.json, clé localStorage) → fiche et marque d'origine à ne pas copier.
const SUJETS = {
  notes: { fiche: 'fiches/1-notes.md', titre: 'Notes, comme Google Keep', marque: /\b(google|keep)\b/i },
  contacts: { fiche: 'fiches/2-contacts.md', titre: 'Contacts, comme Google Contacts', marque: /\bgoogle\b/i },
  tableau: { fiche: 'fiches/3-tableau.md', titre: 'Tableau de projet, comme Trello', marque: /\btrello\b/i },
  social: { fiche: 'fiches/4-social.md', titre: 'Réseau social, comme X', marque: /^(x|twitter)$|\btwitter\b/i },
  messagerie: { fiche: 'fiches/5-messagerie.md', titre: 'Messagerie, comme WhatsApp Web', marque: /\bwhats\s?app\b/i },
  streaming: { fiche: 'fiches/6-streaming.md', titre: 'Streaming, comme Netflix', marque: /\bnetflix\b/i },
};

// Fichiers imposés par le contrat technique.
const FICHIERS = ['index.html', 'style.css', 'js/stockage.js', 'js/donnees.js', 'js/affichage.js', 'js/app.js', 'README.md', 'projet.json'];
const SCRIPTS = ['js/stockage.js', 'js/donnees.js', 'js/affichage.js', 'js/app.js'];

const PAGES_URL = /^https:\/\/[a-z0-9-]+\.github\.io\/[^\s]*$/i;

const loadProjet = (root) => {
  const file = path.join(root, 'projet.json');
  const result = { ok: false, data: {}, sujet: null, checks: [] };
  if (!fs.existsSync(file)) {
    result.checks.push(check('projet.json présent', false, '`projet.json` est introuvable à la racine du dépôt.'));
    return result;
  }
  try {
    result.data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    result.checks.push(check('projet.json valide', false, `\`projet.json\` n'est pas un JSON valide : ${e.message}.`));
    return result;
  }
  const d = result.data;
  const sujet = String(d.sujet || '').trim().toLowerCase();
  result.checks.push(
    check(
      'Sujet reconnu',
      Boolean(SUJETS[sujet]),
      `\`sujet\` vaut ${JSON.stringify(d.sujet)} : choisis parmi ${Object.keys(SUJETS).map((s) => `\`${s}\``).join(', ')}.`,
    ),
  );
  const nom = String(d.nom || '').trim();
  result.checks.push(check('Nom de l\'application', nom.length >= 2, '`nom` est vide : donne un nom à ton application.'));
  if (SUJETS[sujet] && nom) {
    result.checks.push(
      check('Nom propre (pas la marque d\'origine)', !SUJETS[sujet].marque.test(nom), `« ${nom} » reprend la marque du produit d'origine : ton application porte son propre nom.`),
    );
  }
  result.checks.push(
    check('Adresse GitHub Pages', PAGES_URL.test(String(d.pages || '')), '`pages` doit être l\'adresse GitHub Pages de ton application (https://pseudo.github.io/depot/).'),
  );
  result.sujet = SUJETS[sujet] ? sujet : null;
  result.nom = nom;
  result.ok = result.checks.every((c) => c.ok);
  return result;
};

const checkFiles = (root) => {
  const files = FICHIERS.map((f) => check(`\`${f}\``, fs.existsSync(path.join(root, f)), `\`${f}\` est introuvable : respecte l'arborescence du contrat.`));
  const indexPath = path.join(root, 'index.html');
  const scripts = [];
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const tags = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
    tags.forEach((attrs) => {
      const src = (attrs.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
      if (src) scripts.push({ src: src.replace(/^\.\//, ''), module: /type\s*=\s*["']?module/i.test(attrs) });
    });
  }
  const order = scripts.map((s) => s.src).filter((s) => SCRIPTS.includes(s));
  const ordered = SCRIPTS.every((s, i) => order[i] === s);
  return {
    checks: [
      ...files,
      check(
        'Scripts dans l\'ordre du contrat',
        ordered,
        `index.html doit charger ${SCRIPTS.map((s) => `\`${s}\``).join(' → ')} dans cet ordre (trouvé : ${order.join(', ') || 'aucun'}).`,
      ),
    ],
    modules: scripts.some((s) => s.module),
  };
};

module.exports = { SUJETS, FICHIERS, SCRIPTS, loadProjet, checkFiles };
