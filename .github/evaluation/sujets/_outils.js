'use strict';

const { check } = require('../lib/rules');
const { expect } = require('../lib/fiche');

// Fonctionnalité de la fiche : feedback des 4 statuts construit à partir des attributs attendus.
const feature = ({ id, titre, crud, viewport, attrs, ok, partielle, scenario }) => ({
  id,
  titre,
  crud,
  viewport,
  scenario,
  feedback: {
    ok: `Parfait ! ${ok}`,
    partielle: partielle,
    absente: `Fonctionnalité introuvable : vérifie les attributs de la fiche (${attrs.map((a) => `\`${a}\``).join(', ')}).`,
    erreur: 'Une exception JavaScript interrompt cette fonctionnalité : ouvre la console, corrige la ligne indiquée.',
  },
});

// Crée un élément avec un formulaire et renvoie son data-id (null si rien n'est apparu).
const create = async (ctx, form, values, type) => {
  const before = await ctx.ids(type);
  await ctx.fillAndSubmit(form, values);
  const after = await ctx.ids(type);
  const added = after.filter((id) => !before.includes(id));
  return added.length === 1 ? added[0] : null;
};

// Création + vérification qu'un seul élément est apparu ; sinon la suite du scénario est impossible.
const createOrFail = async (ctx, form, values, type, label) => {
  const id = await create(ctx, form, values, type);
  ctx.check(`${label} créé(e)`, id !== null, `Après l'envoi de \`${await form.getAttribute('data-test')}\`, aucun nouvel élément \`[data-test="${type}"][data-id]\` n'apparaît.`);
  if (id === null) throw Object.assign(new Error(`Impossible de créer ${label}`), { stop: true });
  return id;
};

// La saisie est refusée : aucun nouvel élément, et un message d'erreur (ou une validation native).
const refuse = async (ctx, form, values, type, label) => {
  const before = await ctx.ids(type);
  await ctx.fill(form, values);
  await ctx.submit(form);
  const after = await ctx.ids(type);
  const ok = ctx.check(label, after.length === before.length, `${label} : la saisie invalide a quand même été ajoutée.`);
  ctx.ux('erreur', ok && (await ctx.refused(form)), `${label} : aucun message \`[data-test="erreur"]\` affiché.`);
  return ok;
};

const visibleIds = (ctx, type) => ctx.ids(type, true);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Recherche en direct : saisie → seuls les éléments attendus sont visibles.
const search = async (ctx, text) => {
  const input = await ctx.firstVisible(await ctx.needTest('recherche'));
  await input.fill(text);
  await ctx.settle(300);
};

// Le compteur affiché correspond au nombre d'éléments visibles.
const counterMatches = async (ctx, type, label, scope) => {
  const counter = await ctx.firstVisible(ctx.t('compteur', scope));
  const shown = await ctx.number(counter);
  const visible = scope ? await scope.locator(`[data-test="${type}"]`).filter({ visible: true }).count() : (await visibleIds(ctx, type)).length;
  return ctx.check(label, shown === visible, `Le compteur affiche ${shown === null ? 'aucun nombre' : shown} alors que ${visible} élément(s) sont affichés.`);
};

const emptyStateVisible = async (ctx, label, scope) => {
  const ok = await ctx.isVisible(ctx.t('etat-vide', scope));
  ctx.check(label, ok, `${label} : aucun \`[data-test="etat-vide"]\` visible alors que la liste est vide.`);
  ctx.ux('etatVide', ok, label);
  return ok;
};

const notified = async (ctx, since, label) => ctx.ux('notification', await ctx.notifiedSince(since), `${label} : aucune notification.`);

// Suppression : confirmation exigée (annuler conserve, confirmer supprime).
const deleteChecks = async (ctx, type, id, action, label) => {
  const since = await ctx.mark();
  const res = await ctx.deleteWithConfirmation(type, id, action);
  ctx.ux('confirmation', res.confirmation && res.cancelled, `${label} sans confirmation.`);
  ctx.check(`${label} : confirmation demandée`, res.confirmation, `${label} sans confirmation : ajoute un \`<dialog data-test="confirmation">\` ou \`confirm()\`.`);
  if (res.confirmation) ctx.check(`${label} : annuler conserve`, res.cancelled, `« Annuler » la confirmation supprime quand même.`);
  ctx.check(`${label} : supprimé(e)`, res.deleted, `${label} : l'élément est toujours affiché après confirmation.`);
  await notified(ctx, since, label);
  return res;
};

// Ferme les fenêtres ouvertes (Échap, sinon bouton « fermer ») avant de naviguer.
const closeOverlays = async (ctx) => {
  for (let i = 0; i < 3; i += 1) {
    const open = (await ctx.page.locator('dialog[open]').count()) + (await ctx.vis(ctx.t('modale')).count()) + (await ctx.vis(ctx.t('fiche')).count());
    if (open === 0) return;
    await ctx.page.keyboard.press('Escape');
    await ctx.settle(150);
    const close = ctx.vis(ctx.t('fermer'));
    if ((await ctx.page.locator('dialog[open]').count()) + (await ctx.vis(ctx.t('modale')).count()) > 0 && (await close.count()) > 0) {
      await close.first().click().catch(() => {});
      await ctx.settle(150);
    }
  }
};

// Clique sur un élément de navigation du contrat (vue-…, filtre…).
const navigate = async (ctx, test) => {
  await closeOverlays(ctx);
  await (await ctx.firstVisible(await ctx.needTest(test))).click();
  await ctx.settle();
};

// Formulaire du contrat ; s'il est caché (modale), on l'ouvre avec son bouton (ex. contact-nouveau).
const openForm = async (ctx, test, opener) => {
  const forms = ctx.t(test);
  if ((await ctx.vis(forms).count()) === 0 && opener && (await ctx.t(opener).count()) > 0) {
    await closeOverlays(ctx);
    await (await ctx.firstVisible(ctx.t(opener))).click();
    await ctx.settle();
  }
  await ctx.need(forms, `\`[data-test="${test}"]\``);
  return ctx.firstVisible(forms);
};

// Tests de la fiche (hors navigateur).
const fn = (nom, tests) => ({ nom, tests });

// Jeux de données nommés : le feedback affiche « filtrerNotes(NOTES, …) » au lieu du tableau complet.
const FIXTURES = new Map();
const fixture = (label, code) => {
  FIXTURES.set(code, label);
  return code;
};
const shorten = (text) => [...FIXTURES.entries()].reduce((acc, [code, label]) => acc.split(code).join(label), text);
const is = (api, expression, predicate, attendu) => {
  const c = expect(api, expression, predicate, attendu);
  return { ...c, label: shorten(c.label), hint: shorten(c.hint) };
};

const isDict = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasId = (o) => o !== null && typeof o === 'object' && (typeof o.id === 'string' || typeof o.id === 'number') && String(o.id).length > 0;
const unique = (arr) => new Set(arr.map((o) => String(o.id))).size === arr.length;

// Vérifications du modèle sur l'état sauvegardé.
const modelCheck = (label, ok, hint) => check(label, ok, hint);

let counter = 0;
const uid = (prefix) => `${prefix} ${Date.now().toString(36).slice(-4)}${(counter += 1)}`;

module.exports = {
  feature,
  create,
  createOrFail,
  refuse,
  visibleIds,
  sameSet,
  search,
  counterMatches,
  emptyStateVisible,
  notified,
  deleteChecks,
  closeOverlays,
  navigate,
  openForm,
  fn,
  fixture,
  is,
  isDict,
  hasId,
  unique,
  modelCheck,
  uid,
};
