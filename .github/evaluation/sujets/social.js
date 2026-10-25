'use strict';

const o = require('./_outils');

const PUBS = o.fixture('PUBS', `[
  { id: 'p1', auteurId: 'u1', texte: '#a #b', creeLe: 1, modifie: false, jaime: ['u2', 'u3'], republications: ['u2'] },
  { id: 'p2', auteurId: 'u1', texte: '#a #b #c', creeLe: 3, modifie: false, jaime: ['u2'], republications: [] },
  { id: 'p3', auteurId: 'u2', texte: '#a #d #e #f', creeLe: 2, modifie: false, jaime: [], republications: [] }
]`);
const TAG = /#[\p{L}\p{N}_]+/gu;

const formulaire = async (ctx) => {
  await o.closeOverlays(ctx);
  if ((await ctx.vis(ctx.t('form-publication')).count()) === 0 && (await ctx.t('vue-fil').count()) > 0) await o.navigate(ctx, 'vue-fil');
  return ctx.firstVisible(await ctx.needTest('form-publication'));
};
const publier = async (ctx, texte = o.uid('Mbote Kinshasa')) => o.createOrFail(ctx, await formulaire(ctx), { texte }, 'publication', 'La publication');

const etat = async (ctx) => {
  const saved = await ctx.storage('kadea-social');
  return saved.json ? saved.value : null;
};

// Envoi d'un texte trop long : bouton désactivé ou envoi refusé.
const tenter = async (ctx, form, texte) => {
  const before = await ctx.ids('publication');
  await ctx.fill(form, { texte });
  const bouton = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first();
  const desactive = (await bouton.count()) > 0 && (await bouton.isDisabled());
  if (!desactive) await ctx.submit(form);
  return { ajoute: (await ctx.ids('publication')).length > before.length, desactive };
};

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Publier (280 caractères)',
    crud: 'create',
    attrs: ['form-publication', 'name="texte"', 'compteur-caracteres'],
    ok: 'La publication est créée, le compteur suit la saisie et les textes vides ou trop longs sont refusés.',
    partielle: 'La publication est incomplète : compteur en direct, 280 caractères acceptés, 281 et vide refusés.',
    scenario: async (ctx) => {
      const form = await formulaire(ctx);
      const compteur = await ctx.needTest('compteur-caracteres');
      await form.locator('[name="texte"]').first().fill('abc');
      await ctx.settle(150);
      const a = await ctx.text(compteur);
      await form.locator('[name="texte"]').first().fill('abcdefghij');
      await ctx.settle(150);
      ctx.check('Compteur en direct', a !== (await ctx.text(compteur)) && /\d/.test(a), 'Le `compteur-caracteres` ne change pas pendant la frappe.');
      const since = await ctx.mark();
      const id = await publier(ctx);
      await o.notified(ctx, since, 'Publication');
      ctx.check('280 caractères acceptés', (await o.create(ctx, await formulaire(ctx), { texte: 'a'.repeat(280) }, 'publication')) !== null, 'Un texte de 280 caractères exactement doit être accepté.');
      const trop = await tenter(ctx, await formulaire(ctx), 'b'.repeat(281));
      ctx.check('281 caractères refusés', !trop.ajoute, 'Un texte de 281 caractères a été publié.');
      ctx.ux('erreur', !trop.ajoute && (trop.desactive || (await ctx.refused(await formulaire(ctx)))), 'Texte trop long : aucun message ni bouton désactivé.');
      const vide = await tenter(ctx, await formulaire(ctx), '   ');
      ctx.check('Texte vide refusé', !vide.ajoute, 'Une publication vide a été acceptée.');
      ctx.check('Publication affichée', await ctx.isVisible(ctx.item('publication', id)), 'La publication n\'apparaît pas dans le fil.');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Fil antéchronologique et date relative',
    crud: 'read',
    attrs: ['publication', 'publication-date'],
    ok: 'Le fil va du plus récent au plus ancien, avec une date relative.',
    partielle: 'Le fil est incomplet : la publication la plus récente en haut, et une date relative (« à l\'instant », « 5 min »…).',
    scenario: async (ctx) => {
      const premiere = await publier(ctx, o.uid('Première'));
      const seconde = await publier(ctx, o.uid('Seconde'));
      const ordre = await o.visibleIds(ctx, 'publication');
      ctx.check('Plus récente en premier', ordre.indexOf(seconde) === 0 && ordre.indexOf(premiere) === 1, 'La dernière publication doit apparaître en haut du fil.');
      const date = await ctx.text(ctx.t('publication-date', ctx.item('publication', seconde)));
      ctx.check('Date relative', /instant|maintenant|\d+\s*(s|sec|min|h|j)\b/i.test(date), `La date affichée « ${date || 'rien'} » n'est pas relative (« à l'instant », « 5 min », « 3 h »).`);
      const dates = await ctx.page.$$eval('[data-test="publication"]', (els) => els.filter((e) => e.getClientRects().length > 0).map((e) => (e.querySelector('[data-test="publication-date"]') || {}).textContent || ''));
      ctx.check('Date sur chaque publication', dates.length > 2 && dates.every((d) => d.trim().length > 0), 'Certaines publications n\'ont pas de `publication-date`.');
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'J\'aime',
    attrs: ['publication-jaime', 'compteur-jaime'],
    ok: 'J\'aime et je n\'aime plus mettent le compteur à jour.',
    partielle: 'Le J\'aime est incomplet : +1 au premier clic, -1 au second.',
    scenario: async (ctx) => {
      const id = await publier(ctx);
      const compteur = () => ctx.number(ctx.t('compteur-jaime', ctx.item('publication', id)));
      const avant = await compteur();
      ctx.check('Compteur de J\'aime', avant !== null, '`compteur-jaime` introuvable ou sans nombre.');
      await ctx.action('publication', id, 'publication-jaime');
      ctx.check('J\'aime +1', (await compteur()) === avant + 1, 'Le compteur de J\'aime n\'augmente pas de 1.');
      await ctx.action('publication', id, 'publication-jaime');
      ctx.check('Je n\'aime plus -1', (await compteur()) === avant, 'Un second clic doit retirer le J\'aime.');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Republier',
    attrs: ['publication-republier', 'compteur-republier'],
    ok: 'La republication met le compteur à jour.',
    partielle: 'La republication est incomplète : le compteur doit augmenter de 1.',
    scenario: async (ctx) => {
      const id = await publier(ctx);
      const compteur = () => ctx.number(ctx.t('compteur-republier', ctx.item('publication', id)));
      const avant = await compteur();
      ctx.check('Compteur de republications', avant !== null, '`compteur-republier` introuvable ou sans nombre.');
      const since = await ctx.mark();
      await ctx.action('publication', id, 'publication-republier');
      ctx.check('Republier +1', (await compteur()) === avant + 1, 'Le compteur de republications n\'augmente pas de 1.');
      await o.notified(ctx, since, 'Republication');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Modifier sa publication',
    crud: 'update',
    attrs: ['publication-modifier', 'form-modifier', 'publication-modifie'],
    ok: 'La publication est modifiée et marquée « modifié ».',
    partielle: 'La modification est incomplète : formulaire pré-rempli, texte mis à jour, mention `publication-modifie` visible.',
    scenario: async (ctx) => {
      const texte = o.uid('Avant');
      const id = await publier(ctx, texte);
      await ctx.action('publication', id, 'publication-modifier');
      const form = await ctx.firstVisible(await ctx.needTest('form-modifier'));
      ctx.check('Texte pré-rempli', (await form.locator('[name="texte"]').first().inputValue()) === texte, 'Le champ `texte` n\'est pas pré-rempli.');
      const nouveau = o.uid('Après');
      const since = await ctx.mark();
      await ctx.fillAndSubmit(form, { texte: nouveau });
      await o.closeOverlays(ctx);
      ctx.check('Texte modifié', (await ctx.text(ctx.item('publication', id))).includes(nouveau), 'La publication n\'affiche pas le nouveau texte.');
      ctx.check('Mention « modifié »', await ctx.isVisible(ctx.t('publication-modifie', ctx.item('publication', id))), 'La mention `publication-modifie` n\'apparaît pas.');
      await o.notified(ctx, since, 'Modification');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Supprimer sa publication',
    crud: 'delete',
    attrs: ['publication-supprimer', 'confirmation'],
    ok: 'La suppression demande une confirmation ; annuler conserve la publication.',
    partielle: 'La suppression est incomplète : confirmation obligatoire, « annuler » conserve, « confirmer » supprime.',
    scenario: async (ctx) => {
      const id = await publier(ctx);
      await o.deleteChecks(ctx, 'publication', id, 'publication-supprimer', 'Suppression de la publication');
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Hashtags et mentions',
    attrs: ['hashtag', 'mention'],
    ok: 'Hashtags et mentions sont mis en évidence, et un clic sur un hashtag filtre le fil.',
    partielle: 'Les hashtags sont incomplets : `hashtag` et `mention` dans le texte, et un clic sur le hashtag ne garde que ses publications.',
    scenario: async (ctx) => {
      const tag = `#kadea${Date.now().toString(36).slice(-5)}`;
      const avec = await publier(ctx, `Atelier ${tag} avec @grace`);
      const sans = await publier(ctx);
      const item = ctx.item('publication', avec);
      const hashtag = ctx.t('hashtag', item);
      ctx.check('Hashtag mis en évidence', (await ctx.text(hashtag)).toLowerCase() === tag, `Aucun \`[data-test="hashtag"]\` « ${tag} » dans la publication.`);
      ctx.check('Mention mise en évidence', (await ctx.text(ctx.t('mention', item))).toLowerCase() === '@grace', 'Aucun `[data-test="mention"]` « @grace » dans la publication.');
      if ((await hashtag.count()) === 0) return;
      await hashtag.first().click();
      await ctx.settle();
      const visibles = await o.visibleIds(ctx, 'publication');
      ctx.check('Filtre par hashtag', visibles.includes(avec) && !visibles.includes(sans), 'Un clic sur le hashtag ne garde pas uniquement les publications qui le contiennent.');
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Profil modifiable et statistiques',
    attrs: ['vue-profil', 'profil', 'stat-publications', 'stat-jaime', 'form-profil'],
    ok: 'Le profil se modifie et ses statistiques sont calculées.',
    partielle: 'Le profil est incomplet : statistiques calculées à partir des publications, et `form-profil` qui enregistre le nom et la bio.',
    scenario: async (ctx) => {
      await o.navigate(ctx, 'vue-profil');
      const profil = await ctx.firstVisible(await ctx.needTest('profil'));
      const stat = () => ctx.number(ctx.t('stat-publications', profil));
      const e = await etat(ctx);
      const miennes = e && e.profil && Array.isArray(e.publications) ? e.publications.filter((p) => p.auteurId === e.profil.id).length : null;
      const avant = await stat();
      ctx.check('Nombre de publications', avant !== null && (miennes === null || avant === miennes), `\`stat-publications\` affiche ${avant} au lieu de ${miennes}.`);
      ctx.check('Statistique de J\'aime', (await ctx.number(ctx.t('stat-jaime', profil))) !== null, '`stat-jaime` introuvable ou sans nombre.');
      await publier(ctx);
      await o.navigate(ctx, 'vue-profil');
      ctx.check('Statistique recalculée', (await stat()) === avant + 1, 'Après une nouvelle publication, `stat-publications` n\'augmente pas.');
      const nom = o.uid('Judah');
      const since = await ctx.mark();
      await ctx.fillAndSubmit(await o.openForm(ctx, 'form-profil', 'profil-modifier'), { nom, bio: 'Bio mise à jour' });
      await o.closeOverlays(ctx);
      ctx.check('Profil modifié', (await ctx.text(await ctx.firstVisible(ctx.t('profil')))).includes(nom), 'Le profil n\'affiche pas le nouveau nom.');
      await o.notified(ctx, since, 'Modification du profil');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Recherche en direct',
    attrs: ['recherche'],
    ok: 'La recherche filtre le fil en direct.',
    partielle: 'La recherche est incomplète : seules les publications contenant le texte restent visibles, sans tenir compte des majuscules.',
    scenario: async (ctx) => {
      const id = await publier(ctx, `Le mot ${o.uid('zorglub')} est ici`);
      await o.search(ctx, 'ZORGLUB');
      ctx.check('Résultats filtrés', o.sameSet(await o.visibleIds(ctx, 'publication'), [id]), 'La recherche n\'affiche pas uniquement la publication correspondante.');
      await o.search(ctx, 'xqzw-aucune-publication');
      ctx.check('Aucun résultat', (await o.visibleIds(ctx, 'publication')).length === 0, 'Une recherche sans résultat affiche encore des publications.');
      const vide = await ctx.isVisible(ctx.t('etat-vide'));
      ctx.ux('etatVide', vide, 'Recherche sans résultat : aucun `etat-vide`.');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Les 5 hashtags tendance',
    attrs: ['tendance'],
    ok: 'Les 5 hashtags tendance sont calculés à partir des publications et mis à jour.',
    partielle: 'Les tendances sont incomplètes : au plus 5, du plus au moins utilisé, recalculées après chaque publication.',
    scenario: async (ctx) => {
      await ctx.needTest('tendance');
      const lire = async () => (await ctx.page.$$eval('[data-test="tendance"]', (els) => els.map((e) => e.textContent))).map((t) => ((t.match(/#[\p{L}\p{N}_]+/u) || [''])[0]).toLowerCase());
      const compter = async () => {
        const e = await etat(ctx);
        const textes = e && Array.isArray(e.publications) ? e.publications.map((p) => String(p.texte)) : [];
        return textes.flatMap((t) => t.match(TAG) || []).map((t) => t.toLowerCase()).reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});
      };
      const affiches = await lire();
      const totaux = await compter();
      const tries = Object.values(totaux).sort((a, b) => b - a);
      ctx.check('Au plus 5', affiches.length >= 1 && affiches.length <= 5 && affiches.length === Math.min(5, tries.length), `${affiches.length} tendance(s) affichée(s) : les 5 hashtags les plus utilisés attendus.`);
      const seuil = tries[Math.min(5, tries.length) - 1] || 0;
      ctx.check('Les plus utilisés, dans l\'ordre', affiches.every((t, i) => (totaux[t] || 0) >= seuil && (i === 0 || (totaux[affiches[i - 1]] || 0) >= (totaux[t] || 0))), 'Les tendances affichées ne sont pas les hashtags les plus utilisés, du plus au moins utilisé.');
      const tag = `#tendance${Date.now().toString(36).slice(-5)}`;
      for (let i = 0; i <= (tries[0] || 0); i += 1) await publier(ctx, `${tag} numéro ${i}`);
      ctx.check('Recalculées', (await lire())[0] === tag, `Après ${(tries[0] || 0) + 1} publications avec ${tag}, il devrait être la première tendance.`);
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [o.is(api, 'creerDonneesDemo().publications.length', (n) => n >= 8, 'au moins 8 publications de démonstration')]),
  o.fn('validerPublication', (api) => [
    o.is(api, "validerPublication('a'.repeat(280))", (v) => v === '', "'' pour 280 caractères"),
    o.is(api, "validerPublication('a'.repeat(281))", (v) => typeof v === 'string' && v.length > 0, 'un message pour 281 caractères'),
    o.is(api, "validerPublication('   ')", (v) => typeof v === 'string' && v.length > 0, 'un message pour un texte vide'),
  ]),
  o.fn('creerPublication', (api) => [
    o.is(api, "creerPublication('Mbote', 'u1')", (v) => v && v.texte === 'Mbote' && v.auteurId === 'u1' && typeof v.creeLe === 'number' && Array.isArray(v.jaime) && Array.isArray(v.republications) && v.modifie === false && v.id !== undefined, '{ id, auteurId, texte, creeLe, modifie: false, jaime: [], republications: [] }'),
  ]),
  o.fn('trierFil', (api) => [
    o.is(api, `trierFil(${PUBS}).map((p) => p.id).join(',')`, (v) => v === 'p2,p3,p1', "'p2,p3,p1' (du plus récent au plus ancien)"),
    o.is(api, `(() => { const l = ${PUBS}; trierFil(l); return l[0].id; })()`, (v) => v === 'p1', 'une copie : le tableau d\'origine n\'est pas modifié'),
  ]),
  o.fn('dateRelative', (api) => [
    o.is(api, 'dateRelative(0, 30000)', (v) => /instant/i.test(v), "'à l'instant' (< 60 s)"),
    o.is(api, 'dateRelative(0, 5 * 60000)', (v) => /^5\s*min/.test(v), "'5 min'"),
    o.is(api, 'dateRelative(0, 3 * 3600000)', (v) => /^3\s*h/.test(v), "'3 h'"),
    o.is(api, 'dateRelative(0, 2 * 86400000)', (v) => /^2\s*j/.test(v), "'2 j'"),
  ]),
  o.fn('basculerJaime', (api) => [
    o.is(api, "basculerJaime({ id: 'p', jaime: ['x'] }, 'y').jaime.slice().sort().join(',')", (v) => v === 'x,y', "ajoute 'y'"),
    o.is(api, "basculerJaime({ id: 'p', jaime: ['x'] }, 'x').jaime.length", (v) => v === 0, "retire 'x'"),
    o.is(api, "(() => { const p = { id: 'p', jaime: [] }; basculerJaime(p, 'x'); return p.jaime.length; })()", (v) => v === 0, 'une nouvelle publication : l\'originale n\'est pas modifiée'),
  ]),
  o.fn('extraireHashtags', (api) => [o.is(api, "extraireHashtags('Mbote #Kinshasa et #JS !')", (v) => Array.isArray(v) && v.join(',') === '#kinshasa,#js', "['#kinshasa', '#js']")]),
  o.fn('hashtagsTendance', (api) => [
    o.is(api, `hashtagsTendance(${PUBS})`, (v) => Array.isArray(v) && v.length === 5 && v[0].hashtag === '#a' && v[0].total === 3 && v[1].hashtag === '#b' && v[1].total === 2, "5 tendances, d'abord { hashtag: '#a', total: 3 } puis { hashtag: '#b', total: 2 }"),
  ]),
  o.fn('statistiques', (api) => [
    o.is(api, `statistiques(${PUBS}, 'u1')`, (v) => v && v.publications === 2 && v.jaimeRecus === 3 && v.republications === 1, '{ publications: 2, jaimeRecus: 3, republications: 1 }'),
  ]),
];

const modele = (etat) => {
  const pubs = Array.isArray(etat && etat.publications) ? etat.publications : [];
  return [
    o.modelCheck('`publications` est un tableau', Array.isArray(etat && etat.publications), 'L\'état sauvegardé doit contenir un tableau `publications`.'),
    o.modelCheck('Chaque publication a un id unique', pubs.length > 0 && pubs.every(o.hasId) && o.unique(pubs), 'Chaque publication doit avoir un `id` unique.'),
    o.modelCheck('Champs de la fiche', pubs.length > 0 && pubs.every((p) => 'auteurId' in p && typeof p.texte === 'string' && typeof p.creeLe === 'number'), 'Chaque publication doit avoir `auteurId`, `texte` et `creeLe` (Date.now()).'),
    o.modelCheck('Tableaux imbriqués `jaime` et `republications`', pubs.length > 0 && pubs.every((p) => Array.isArray(p.jaime) && Array.isArray(p.republications)), 'Chaque publication doit avoir les tableaux `jaime` et `republications`.'),
    o.modelCheck('Profil', Boolean(etat && etat.profil && o.hasId(etat.profil) && 'nom' in etat.profil), '`etat.profil` doit être un objet `{ id, nom, pseudo, bio }`.'),
    o.modelCheck('Dictionnaire `utilisateurs`', o.isDict(etat && etat.utilisateurs) && Object.keys(etat.utilisateurs).length >= 2, '`etat.utilisateurs` doit être un objet dictionnaire `{ id: { id, nom, pseudo } }`.'),
  ];
};

module.exports = {
  id: 'social',
  demo: { item: 'publication', min: 8 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const texte = o.uid('Persistante');
      const id = await publier(ctx, texte);
      await ctx.action('publication', id, 'publication-jaime');
      return { id, texte };
    },
    verifier: async (ctx, { id, texte }) => {
      if (!(await ctx.text(ctx.item('publication', id))).includes(texte)) return { ok: false, hint: 'Après rechargement, la publication a disparu : appelle `sauvegarder()` après chaque action.' };
      return { ok: (await ctx.number(ctx.t('compteur-jaime', ctx.item('publication', id)))) === 1, hint: 'Après rechargement, le J\'aime a disparu : tout l\'état doit être sauvegardé.' };
    },
  },
  injection: async (ctx, payload) => {
    await ctx.fillAndSubmit(await formulaire(ctx), { texte: payload });
    if ((await ctx.t('vue-profil').count()) > 0) {
      await o.navigate(ctx, 'vue-profil');
      if ((await ctx.t('form-profil').count()) > 0) await ctx.fillAndSubmit(await o.openForm(ctx, 'form-profil', 'profil-modifier'), { nom: payload, bio: payload });
    }
  },
};
