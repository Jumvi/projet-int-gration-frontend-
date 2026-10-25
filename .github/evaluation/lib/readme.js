'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { check } = require('./rules');

// Phrase présente uniquement dans le README fourni par le template.
const TEMPLATE_MARKER = '<!-- README DU TEMPLATE -->';

const SECTIONS = [
  { label: 'Présentation / fonctionnalités', regex: /fonctionnalit|pr[ée]sentation|description|à propos/i },
  { label: 'Captures d\'écran', regex: /captur|aper[çc]u|screenshot/i },
  { label: 'Utilisation / installation', regex: /utilis|install|lancer|d[ée]marr/i },
  { label: 'Choix techniques / structure', regex: /technique|technolog|structure|architecture|choix|donn[ée]es/i },
];

const checkReadme = (root, projet) => {
  const file = path.join(root, 'README.md');
  if (!fs.existsSync(file)) return { checks: [check('README.md présent', false, '`README.md` est introuvable.')], ok: false };
  const md = fs.readFileSync(file, 'utf8');
  if (md.includes(TEMPLATE_MARKER)) {
    return { checks: [check('README personnalisé', false, 'Le README est encore celui du template : présente TON application.')], ok: false };
  }
  const headings = md.split('\n').filter((l) => /^#{1,3}\s+\S/.test(l));
  const images = [...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img\s[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1] || m[2]);
  const localImages = images.filter((src) => !/^https?:/i.test(src));
  const missingImages = localImages.filter((src) => !fs.existsSync(path.join(root, decodeURIComponent(src.split('#')[0]))));
  const pages = String((projet && projet.pages) || '').replace(/\/$/, '');
  const demo = String((projet && projet.demo) || '');
  const checks = [
    check('Contenu suffisant', md.trim().length >= 800, `README trop court (${md.trim().length} caractères) : au moins 800 caractères attendus.`),
    ...SECTIONS.map((s) => check(s.label, headings.some((h) => s.regex.test(h)), `Section « ${s.label} » absente du README.`)),
    check('Captures d\'écran', images.length >= 1 && missingImages.length === 0, images.length === 0 ? 'Aucune capture d\'écran dans le README.' : `Image(s) introuvable(s) : ${missingImages.join(', ')}.`),
    check('Lien GitHub Pages', (pages && md.includes(pages)) || /https:\/\/[\w-]+\.github\.io\//i.test(md), 'Le lien vers ton application en ligne (GitHub Pages) est absent du README.'),
    check('Lien de la démo', (demo && md.includes(demo)) || /d[ée]mo/i.test(md.replace(/^#.*$/gm, '')), 'Le lien de la démo est absent du README.'),
  ];
  return { checks, ok: checks.every((c) => c.ok) };
};

module.exports = { checkReadme, TEMPLATE_MARKER };
