'use strict';

const { openSession } = require('./browser');
const { check } = require('./rules');

const MAX_TABS = 80;

// Parcours au clavier : chaque contrôle visible est-il atteint par Tab, avec un focus visible ?
const checkClavier = async (browser, baseUrl) => {
  const session = await openSession(browser, baseUrl);
  const { page } = session;
  const controls = await page.evaluate(() => {
    const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), summary';
    const els = [...document.querySelectorAll(selector)].filter((el) => !el.disabled && el.getClientRects().length > 0 && !el.closest('dialog:not([open]), [inert], [aria-hidden="true"]'));
    els.forEach((el, i) => el.setAttribute('data-kadea-tab', String(i)));
    return els.length;
  });

  const reached = new Set();
  const invisible = [];
  for (let i = 0; i < Math.min(MAX_TABS, controls + 5); i += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = (e) => {
        const s = getComputedStyle(e);
        return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.backgroundColor, s.borderColor, s.textDecorationLine, s.transform].join('|');
      };
      const focused = getComputedStyle(el);
      const outline = focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0;
      const shadow = focused.boxShadow !== 'none';
      const withFocus = style(el);
      // Comparaison avec le même élément sans focus.
      el.blur();
      const without = style(el);
      el.focus({ focusVisible: true });
      const label = el.getAttribute('data-test') || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 25) || el.tagName.toLowerCase();
      return { id: el.getAttribute('data-kadea-tab'), visible: outline || shadow || withFocus !== without, label };
    });
    if (focus === null) continue;
    if (focus.id !== null) {
      if (reached.has(focus.id)) break;
      reached.add(focus.id);
    }
    if (!focus.visible && !invisible.includes(focus.label)) invisible.push(focus.label);
  }
  await session.close();
  const reachedRatio = controls === 0 ? 0 : Math.min(1, reached.size / controls);
  const focusOk = reached.size > 0 && invisible.length === 0;
  return {
    controls,
    reached: reached.size,
    checks: [
      check('Contrôles atteints au clavier', controls > 0 && reachedRatio >= 0.9, `Seulement ${reached.size} contrôle(s) sur ${controls} atteint(s) avec Tab : utilise des \`<button>\`, \`<a href>\` et des champs natifs.`),
      check('Focus visible', focusOk, `Focus invisible sur : ${invisible.slice(0, 4).map((l) => `« ${l} »`).join(', ')} → ajoute un style \`:focus-visible\` (ne supprime jamais l'outline sans le remplacer).`),
    ],
  };
};

module.exports = { checkClavier };
