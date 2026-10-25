'use strict';

const { chromium } = require('playwright');

const DESKTOP = { width: 1280, height: 800 };
const ACTION_TIMEOUT = 2500;

// Élément du contrat introuvable : la fonctionnalité est « Absente » (si rien d'autre n'a réussi).
class Absent extends Error {}

// Installé avant le code de l'apprenant à chaque chargement : horodate les changements de la notification.
const INIT_SCRIPT = () => {
  window.__kadea = { notification: 0 };
  const touches = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(el && el.closest && el.closest('[data-test="notification"]'));
  };
  const contains = (node) => node.nodeType === 1 && (node.matches('[data-test="notification"]') || Boolean(node.querySelector('[data-test="notification"]')));
  new MutationObserver((mutations) => {
    if (mutations.some((m) => touches(m.target) || [...m.addedNodes].some(contains))) window.__kadea.notification = Date.now();
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};

// Chromium complet en mode headless récent : rendu identique au navigateur, un seul téléchargement (--no-shell).
const launch = (options = {}) => chromium.launch({ headless: true, channel: 'chromium', ...options });

const cleanError = (e) => {
  const first = String((e && e.message) || e).split('\n')[0];
  const selector = (String(e && e.message).match(/locator\(['"](.+?)['"]\)/) || [])[1];
  if (/Timeout \d+ms exceeded/.test(first)) return selector ? `Élément introuvable, masqué ou inactif : \`${selector.replace(/\\"/g, '"')}\`.` : 'Action impossible (délai dépassé).';
  return first.replace(/^\w+\.\w+: /, '');
};

/**
 * Ouvre l'application dans un contexte neuf (localStorage vide) et renvoie les outils des scénarios.
 */
const openSession = async (browser, baseUrl, options = {}) => {
  const context = await browser.newContext({ viewport: options.viewport || DESKTOP, locale: 'fr-FR', timezoneId: 'Africa/Kinshasa' });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT);

  const s = { page, context, exceptions: [], consoleErrors: [], loads: 0, dialogs: [], confirmReply: true, promptReply: null };
  page.on('pageerror', (e) => s.exceptions.push(String(e.message || e).split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && s.consoleErrors.push(m.text().split('\n')[0]));
  page.on('load', () => {
    s.loads += 1;
  });
  page.on('dialog', async (d) => {
    s.dialogs.push({ type: d.type(), message: d.message() });
    if (d.type() === 'confirm') await (s.confirmReply ? d.accept() : d.dismiss());
    else if (d.type() === 'prompt') await (s.promptReply === null ? d.dismiss() : d.accept(s.promptReply));
    else await d.accept();
  });

  const settle = (ms = 250) => page.waitForTimeout(ms);

  s.goto = async () => {
    await page.goto(baseUrl, { waitUntil: 'load' });
    await settle(400);
    s.loads = 0;
  };
  s.reload = async () => {
    await page.reload({ waitUntil: 'load' });
    await settle(400);
    s.loads = 0;
  };
  s.settle = settle;
  s.close = () => context.close();

  // --- Sélection -------------------------------------------------------------
  s.t = (name, scope = page) => scope.locator(`[data-test="${name}"]`);
  s.vis = (locator) => locator.filter({ visible: true });
  s.item = (type, id) => page.locator(`[data-test="${type}"][data-id="${id}"]`).first();
  s.ids = (type, visibleOnly = false) =>
    page.$$eval(
      `[data-test="${type}"][data-id]`,
      (els, onlyVisible) => [...new Set(els.filter((el) => !onlyVisible || el.getClientRects().length > 0).map((el) => el.dataset.id))],
      visibleOnly,
    );
  s.count = async (locator) => locator.count();
  s.isVisible = async (locator) => (await s.vis(locator).count()) > 0;
  s.text = async (locator) => ((await locator.count()) === 0 ? '' : (await locator.first().innerText()).trim());
  s.number = async (locator) => {
    const match = (await s.text(locator)).match(/\d+/);
    return match ? Number(match[0]) : null;
  };

  // Exige la présence d'un élément du contrat ; sinon la fonctionnalité est « Absente ».
  s.need = async (locator, label) => {
    if ((await locator.count()) === 0) throw new Absent(`${label} introuvable.`);
    return locator;
  };
  s.needTest = (name, label) => s.need(s.t(name), label || `\`[data-test="${name}"]\``);

  // Le premier élément visible (ex. le formulaire ouvert dans la modale), sinon le premier tout court.
  s.firstVisible = async (locator) => ((await s.vis(locator).count()) > 0 ? s.vis(locator).first() : locator.first());

  // --- Formulaires ------------------------------------------------------------
  s.fill = async (form, values) => {
    for (const [name, value] of Object.entries(values)) {
      const fields = form.locator(`[name="${name}"]`);
      if ((await fields.count()) === 0) throw new Absent(`Champ \`name="${name}"\` introuvable dans le formulaire.`);
      const field = fields.first();
      const tag = await field.evaluate((el) => `${el.tagName.toLowerCase()}:${el.type || ''}`);
      if (tag.startsWith('select')) await field.selectOption(String(value));
      else if (tag.endsWith(':checkbox') || tag.endsWith(':radio')) {
        const wanted = Array.isArray(value) ? value.map(String) : [String(value)];
        for (const v of wanted) {
          const box = form.locator(`[name="${name}"][value="${v}"]`);
          if ((await box.count()) === 0) throw new Absent(`Option \`${name}=${v}\` introuvable.`);
          await box.first().check({ force: true });
        }
      } else await field.fill(String(value));
    }
  };
  s.submit = async (form) => {
    const button = form.locator('button[type="submit"], input[type="submit"], button:not([type])');
    if ((await s.vis(button).count()) > 0) await s.vis(button).first().click();
    else await form.evaluate((f) => f.requestSubmit());
    await settle();
  };
  s.fillAndSubmit = async (form, values) => {
    await s.fill(form, values);
    await s.submit(form);
  };
  // Saisie refusée : message d'erreur visible ou validation HTML native.
  s.refused = async (form) => {
    const message = s.vis(s.t('erreur'));
    if ((await message.count()) > 0 && (await message.first().innerText()).trim().length > 0) return true;
    return form.evaluate((f) => !f.checkValidity()).catch(() => false);
  };

  // --- Actions sur un élément de liste ----------------------------------------
  // Le bouton est dans l'élément ; sinon on ouvre l'élément (bouton <type>-ouvrir ou clic) et on le cherche à l'écran.
  s.action = async (type, id, action) => {
    const item = s.item(type, id);
    await s.need(item, `\`[data-test="${type}"][data-id="${id}"]\``);
    await item.scrollIntoViewIfNeeded().catch(() => {});
    await item.hover().catch(() => {});
    let button = item.locator(`[data-test="${action}"]`);
    if ((await s.vis(button).count()) === 0) {
      const opener = item.locator(`[data-test="${type}-ouvrir"]`);
      if ((await opener.count()) > 0) await opener.first().click();
      else if ((await s.vis(page.locator(`[data-test="${action}"]`)).count()) === 0) await item.click({ position: { x: 5, y: 5 } });
      await settle(200);
      button = page.locator(`[data-test="${action}"]`);
    }
    if ((await button.count()) === 0) throw new Absent(`Bouton \`[data-test="${action}"]\` introuvable.`);
    const target = await s.firstVisible(button);
    try {
      await target.click({ timeout: 1500 });
    } catch {
      await target.evaluate((el) => el.click());
    }
    await settle();
  };

  // Une confirmation (window.confirm ou <dialog data-test="confirmation">) répondue « accepter » ou « annuler ».
  // Renvoie 'native', 'dialog' ou null (aucune confirmation demandée).
  s.confirm = async (trigger, accept) => {
    const before = s.dialogs.length;
    s.confirmReply = accept;
    await trigger();
    await settle(150);
    s.confirmReply = true;
    if (s.dialogs.slice(before).some((d) => d.type === 'confirm')) return 'native';
    const box = s.vis(s.t('confirmation'));
    if ((await box.count()) > 0) {
      const button = s.t(accept ? 'confirmer' : 'annuler', box.first());
      if ((await button.count()) === 0) throw new Absent(`Bouton \`[data-test="${accept ? 'confirmer' : 'annuler'}"]\` introuvable dans la confirmation.`);
      await button.first().click();
      await settle();
      return 'dialog';
    }
    return null;
  };

  // Suppression d'un élément : annuler (l'élément reste), puis confirmer (il disparaît).
  // Renvoie { confirmation, cancelled, deleted }.
  s.deleteWithConfirmation = async (type, id, action) => {
    const first = await s.confirm(() => s.action(type, id, action), false);
    const stillThere = (await s.item(type, id).count()) > 0;
    if (!first) return { confirmation: false, cancelled: false, deleted: !stillThere };
    let second = 'done';
    if (stillThere) second = await s.confirm(() => s.action(type, id, action), true);
    const deleted = (await s.item(type, id).count()) === 0;
    return { confirmation: Boolean(second), cancelled: stillThere, deleted };
  };

  // --- Retours à l'utilisateur ------------------------------------------------
  s.mark = () => page.evaluate(() => Date.now());
  s.notifiedSince = async (since) => {
    try {
      await page.waitForFunction(
        (t) =>
          window.__kadea.notification >= t &&
          [...document.querySelectorAll('[data-test="notification"]')].some((el) => el.getClientRects().length > 0 && el.textContent.trim().length > 0),
        since,
        { timeout: 1500 },
      );
      return true;
    } catch {
      return false;
    }
  };

  // --- État sauvegardé --------------------------------------------------------
  s.storage = (key) =>
    page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      if (raw === null) return { exists: false };
      try {
        return { exists: true, json: true, value: JSON.parse(raw) };
      } catch {
        return { exists: true, json: false };
      }
    }, key);

  await s.goto();
  return s;
};

module.exports = { launch, openSession, Absent, cleanError, DESKTOP };
