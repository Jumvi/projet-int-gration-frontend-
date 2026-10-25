'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openSession } = require('./browser');
const { check } = require('./rules');

const LARGEURS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

// Aucune barre de défilement horizontale ; les éléments qui dépassent sont nommés dans le feedback.
const checkResponsive = async (browser, baseUrl, capturesDir) => {
  fs.mkdirSync(capturesDir, { recursive: true });
  const results = [];
  for (const viewport of LARGEURS) {
    const session = await openSession(browser, baseUrl, { viewport });
    const facts = await session.page.evaluate(() => {
      const width = window.innerWidth;
      const describe = (el) => {
        const test = el.getAttribute('data-test');
        const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
        return test ? `[data-test="${test}"]` : `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls}`;
      };
      // Un élément qui dépasse dans un conteneur à défilement horizontal (rangée, colonnes) n'est pas un débordement de page.
      const scrollsX = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
        }
        return false;
      };
      const offenders = [...document.body.querySelectorAll('*')]
        .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().right > width + 1 && !scrollsX(el))
        .filter((el, i, all) => !all.some((other) => other !== el && other.contains(el)))
        .slice(0, 3)
        .map(describe);
      return { scrollWidth: document.documentElement.scrollWidth, width, offenders };
    });
    const file = path.join(capturesDir, `${viewport.width}.png`);
    await session.page.screenshot({ path: file }).catch(() => {});
    await session.close();
    const ok = facts.scrollWidth <= facts.width + 1;
    results.push({
      width: viewport.width,
      capture: fs.existsSync(file) ? file : null,
      check: check(
        `${viewport.width} px`,
        ok,
        `Défilement horizontal à ${viewport.width} px (largeur ${facts.scrollWidth} px)${facts.offenders.length ? ` : ${facts.offenders.join(', ')} dépasse(nt)` : ''}.`,
      ),
    });
  }
  return results;
};

module.exports = { checkResponsive, LARGEURS };
