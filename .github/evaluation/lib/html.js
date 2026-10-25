'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { HtmlValidate } = require('html-validate');
const { check } = require('./rules');

// Règles de correction HTML (pas de style d'écriture : guillemets, espaces, majuscules…).
const validator = new HtmlValidate({
  extends: ['html-validate:standard'],
  rules: { 'no-inline-style': 'off', 'prefer-native-element': 'off', 'no-trailing-whitespace': 'off' },
});

const validateHtml = async (root) => {
  const file = path.join(root, 'index.html');
  if (!fs.existsSync(file)) return { exists: false, errors: [] };
  const report = await validator.validateString(fs.readFileSync(file, 'utf8'), 'index.html');
  const errors = report.results.flatMap((r) => r.messages.filter((m) => m.severity === 2).map((m) => `l.${m.line} ${m.message} (${m.ruleId})`));
  return { exists: true, errors };
};

// Structure de la page affichée (après exécution du JavaScript).
const semantics = async (page) => {
  const facts = await page.evaluate(() => {
    const describe = (el) => `<${el.tagName.toLowerCase()}${el.name ? ` name="${el.name}"` : ''}${el.id ? ` id="${el.id}"` : ''}>`;
    const fields = [...document.querySelectorAll('input, select, textarea')].filter((el) => !['hidden', 'submit', 'button', 'reset', 'image'].includes(el.type));
    const unlabeled = fields.filter((el) => !(el.labels && el.labels.length > 0) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'));
    const header = document.querySelector('header');
    return {
      header: Boolean(header),
      nav: Boolean(document.querySelector('nav')),
      main: document.querySelectorAll('main').length === 1,
      footer: Boolean(document.querySelector('footer')),
      h1: document.querySelectorAll('h1').length,
      lang: document.documentElement.lang,
      title: document.title.trim(),
      fields: fields.length,
      unlabeled: unlabeled.map(describe),
      logo: Boolean(header && header.querySelector('img, svg, [class*="logo" i], [data-test="logo"]')),
      bodyText: document.body.innerText.trim().length,
    };
  });
  const checks = [
    check('`<header>`', facts.header, 'Aucune balise `<header>`.'),
    check('`<nav>`', facts.nav, 'Aucune balise `<nav>` pour la navigation.'),
    check('Un seul `<main>`', facts.main, 'Il faut exactement une balise `<main>`.'),
    check('`<footer>`', facts.footer, 'Aucune balise `<footer>`.'),
    check('Un seul `<h1>`', facts.h1 === 1, `${facts.h1} balise(s) \`<h1>\` : il en faut une seule.`),
    check('`lang` et `<title>`', Boolean(facts.lang) && facts.title.length > 0, '`<html lang="fr">` et un `<title>` sont attendus.'),
  ];
  const labels = check(
    'Un label par champ',
    facts.unlabeled.length === 0,
    `Champ(s) sans label : ${facts.unlabeled.slice(0, 4).join(', ')} → ajoute \`<label for="…">\`.`,
  );
  return { facts, checks, labels };
};

module.exports = { validateHtml, semantics };
