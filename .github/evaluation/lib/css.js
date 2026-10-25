'use strict';

const fs = require('node:fs');
const path = require('node:path');

const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi;
const SPACING = /(?<![\w.-])\d*\.?\d+(?:px|rem|em)\b/g;

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Corps des blocs :root (définitions de variables), retirés du reste pour compter les valeurs en dur.
const splitRoot = (css) => {
  const roots = [];
  const rest = css.replace(/:root\s*\{([^}]*)\}/g, (m, body) => {
    roots.push(body);
    return '';
  });
  return { roots: roots.join('\n'), rest };
};

const repeated = (text, regex, min) => {
  const counts = (text.match(regex) || []).map((v) => v.toLowerCase()).reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  return Object.entries(counts)
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => ({ value, n }));
};

const analyzeCss = (root) => {
  const file = path.join(root, 'style.css');
  if (!fs.existsSync(file)) return { exists: false };
  const css = stripComments(fs.readFileSync(file, 'utf8'));
  const { roots, rest } = splitRoot(css);
  const variables = (roots.match(/--[\w-]+\s*:/g) || []).length;
  const varUses = (css.match(/var\(--[\w-]+/g) || []).length;
  return {
    exists: true,
    size: css.trim().length,
    variables,
    varUses,
    colorVariables: (roots.match(/--[\w-]+\s*:\s*(#|rgb|hsl|oklch)/gi) || []).length,
    // Hors :root et hors @media (prefers-color-scheme), une même couleur répétée 3 fois = valeur en dur.
    repeatedColors: repeated(rest.replace(/@media\s*\(prefers-color-scheme[^{]*\{[\s\S]*?\}\s*\}/g, ''), COLOR, 3),
    repeatedSpacings: repeated(rest.replace(/@media[^{]*\{/g, ''), SPACING, 5).filter((s) => !/^(0|1px|2px)$/.test(s.value)),
    hover: /:hover\b/.test(css),
    focus: /:focus(-visible|-within)?\b/.test(css),
    focusVisible: /:focus-visible\b/.test(css),
    active: /:active\b/.test(css),
    transition: /\btransition\s*:|\btransition-property\s*:|\banimation\s*:/.test(css),
    grid: /display\s*:\s*(inline-)?grid\b/.test(css),
    flex: /display\s*:\s*(inline-)?flex\b/.test(css),
    media: (css.match(/@media\b/g) || []).length,
  };
};

module.exports = { analyzeCss };
