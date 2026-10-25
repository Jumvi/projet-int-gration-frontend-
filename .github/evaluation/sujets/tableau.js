'use strict';

const o = require('./_outils');

const COLONNES = o.fixture('COLONNES', `[
  { id: 'k1', titre: 'À faire', cartes: [
    { id: 'c1', titre: 'Maquette', description: 'version mobile', echeance: '2026-01-01', etiquettes: ['rouge'], sousTaches: [{ id: 's1', texte: 'A', faite: true }, { id: 's2', texte: 'B', faite: false }] },
    { id: 'c2', titre: 'README', description: '', echeance: '', etiquettes: [], sousTaches: [] }
  ] },
  { id: 'k2', titre: 'En cours', cartes: [{ id: 'c3', titre: 'Tests', description: '', echeance: '', etiquettes: [], sousTaches: [] }] }
]`);

const colonne = (ctx, id) => ctx.item('colonne', id);
const colonnes = (ctx) => ctx.ids('colonne');
const dansColonne = (ctx, colonneId, carteId) => colonne(ctx, colonneId).locator(`[data-test="carte"][data-id="${carteId}"]`).count();

const formCarte = async (ctx, colonneId) => {
  const col = colonne(ctx, colonneId);
  const forms = ctx.t('form-carte', col);
  if ((await ctx.vis(forms).count()) === 0 && (await ctx.t('carte-nouveau', col).count()) > 0) {
    await ctx.t('carte-nouveau', col).first().click();
    await ctx.settle();
  }
  await ctx.need(forms, '`[data-test="form-carte"]` dans la colonne');
  return ctx.firstVisible(forms);
};

const nouvelleCarte = async (ctx, colonneId, titre = o.uid('Carte')) => {
  const id = await o.createOrFail(ctx, await formCarte(ctx, colonneId), { titre }, 'carte', 'La carte');
  return id;
};

const premiereColonne = async (ctx) => {
  const ids = await colonnes(ctx);
  if (ids.length === 0) throw new (require('../lib/browser').Absent)('`[data-test="colonne"][data-id]` introuvable.');
  return ids;
};

const ouvrirCarte = async (ctx, id) => {
  await o.closeOverlays(ctx);
  const item = ctx.item('carte', id);
  await item.scrollIntoViewIfNeeded().catch(() => {});
  const bouton = item.locator('[data-test="carte-ouvrir"]');
  if ((await bouton.count()) > 0) await bouton.first().click();
  else await item.click({ position: { x: 5, y: 5 } });
  await ctx.settle();
  await ctx.need(ctx.t('form-modifier'), '`[data-test="form-modifier"]`');
  ctx.check('Modale ouverte', await ctx.isVisible(ctx.t('modale')), 'Ouvrir la carte n\'affiche pas de `[data-test="modale"]`.');
  return ctx.firstVisible(ctx.t('form-modifier'));
};

// Le select de déplacement est dans la carte, ou dans la modale.
const deplacer = async (ctx, carteId, cibleId) => {
  let select = ctx.item('carte', carteId).locator('[data-test="carte-deplacer"]');
  if ((await select.count()) === 0) {
    await ouvrirCarte(ctx, carteId);
    select = ctx.vis(ctx.t('carte-deplacer'));
  }
  await ctx.need(select, '`<select data-test="carte-deplacer">`');
  await select.first().selectOption(cibleId);
  await ctx.settle();
  await o.closeOverlays(ctx);
};

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Colonnes : ajouter, renommer, supprimer',
    crud: 'read',
    attrs: ['colonne', 'colonne-titre', 'form-colonne', 'colonne-renommer', 'colonne-supprimer'],
    ok: 'Trois colonnes au départ ; ajout, renommage et suppression après confirmation fonctionnent.',
    partielle: 'La gestion des colonnes est incomplète : 3 colonnes au départ, ajout (titre vide refusé), renommage, suppression confirmée.',
    scenario: async (ctx) => {
      ctx.check('Trois colonnes au départ', (await colonnes(ctx)).length === 3, `${(await colonnes(ctx)).length} colonne(s) au premier lancement : exactement 3 attendues.`);
      const form = await o.openForm(ctx, 'form-colonne', 'colonne-nouveau');
      const since = await ctx.mark();
      const id = await o.createOrFail(ctx, form, { titre: o.uid('Recette') }, 'colonne', 'La colonne');
      await o.notified(ctx, since, 'Ajout d\'une colonne');
      await o.refuse(ctx, await o.openForm(ctx, 'form-colonne', 'colonne-nouveau'), { titre: '  ' }, 'colonne', 'Titre de colonne vide refusé');
      const nom = o.uid('Renommée');
      ctx.promptReply = nom;
      await ctx.action('colonne', id, 'colonne-renommer');
      ctx.promptReply = null;
      const renommer = ctx.vis(ctx.t('form-renommer'));
      if ((await renommer.count()) > 0) await ctx.fillAndSubmit(renommer.first(), { titre: nom });
      ctx.check('Colonne renommée', (await ctx.text(ctx.t('colonne-titre', colonne(ctx, id)))).includes(nom), 'Le titre de la colonne ne change pas après `colonne-renommer`.');
      await o.deleteChecks(ctx, 'colonne', id, 'colonne-supprimer', 'Suppression de la colonne');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Créer une carte',
    crud: 'create',
    attrs: ['form-carte', 'name="titre"', 'carte'],
    ok: 'La carte est créée dans sa colonne ; un titre vide est refusé.',
    partielle: 'La création est incomplète : la carte doit apparaître dans la colonne du formulaire, un titre vide être refusé.',
    scenario: async (ctx) => {
      const [premiere, deuxieme] = await premiereColonne(ctx);
      const since = await ctx.mark();
      const id = await nouvelleCarte(ctx, deuxieme || premiere);
      ctx.check('Dans la bonne colonne', (await dansColonne(ctx, deuxieme || premiere, id)) > 0, 'La carte n\'apparaît pas dans la colonne dont on a utilisé le formulaire.');
      await o.notified(ctx, since, 'Création d\'une carte');
      await o.refuse(ctx, await formCarte(ctx, premiere), { titre: '' }, 'carte', 'Titre de carte vide refusé');
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'Modifier dans une modale',
    crud: 'update',
    attrs: ['carte-ouvrir', 'modale', 'form-modifier', 'name="echeance"'],
    ok: 'Titre, description et échéance sont modifiés et conservés.',
    partielle: 'La modification est incomplète : modale pré-remplie, titre, description et échéance enregistrés.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const titre = o.uid('Avant');
      const id = await nouvelleCarte(ctx, premiere, titre);
      let form = await ouvrirCarte(ctx, id);
      ctx.check('Titre pré-rempli', (await form.locator('[name="titre"]').first().inputValue()) === titre, 'Le champ `titre` de la modale n\'est pas pré-rempli.');
      const nouveau = o.uid('Après');
      const since = await ctx.mark();
      await ctx.fillAndSubmit(form, { titre: nouveau, description: 'Description modifiée', echeance: '2030-12-31' });
      await o.closeOverlays(ctx);
      ctx.check('Carte mise à jour', (await ctx.text(ctx.item('carte', id))).includes(nouveau), 'La carte n\'affiche pas le nouveau titre.');
      await o.notified(ctx, since, 'Modification');
      form = await ouvrirCarte(ctx, id);
      ctx.check('Description et échéance conservées', (await form.locator('[name="description"]').first().inputValue()) === 'Description modifiée' && (await form.locator('[name="echeance"]').first().inputValue()) === '2030-12-31', 'La description ou l\'échéance n\'est pas conservée.');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Déplacer une carte',
    attrs: ['carte-deplacer'],
    ok: 'La carte passe dans la colonne choisie.',
    partielle: 'Le déplacement est incomplet : après le choix dans `carte-deplacer`, la carte doit quitter sa colonne et apparaître dans la cible.',
    scenario: async (ctx) => {
      const [premiere, deuxieme] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere);
      const since = await ctx.mark();
      await deplacer(ctx, id, deuxieme);
      ctx.check('Dans la colonne cible', (await dansColonne(ctx, deuxieme, id)) > 0, 'La carte n\'apparaît pas dans la colonne cible.');
      ctx.check('Hors de la colonne d\'origine', (await dansColonne(ctx, premiere, id)) === 0, 'La carte est toujours dans sa colonne d\'origine (doublon ?).');
      await o.notified(ctx, since, 'Déplacement');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Supprimer après confirmation',
    crud: 'delete',
    attrs: ['carte-supprimer', 'confirmation'],
    ok: 'La suppression demande une confirmation ; annuler conserve la carte.',
    partielle: 'La suppression est incomplète : confirmation obligatoire, « annuler » conserve, « confirmer » supprime.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere);
      await o.deleteChecks(ctx, 'carte', id, 'carte-supprimer', 'Suppression de la carte');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Étiquettes de couleur',
    attrs: ['name="etiquettes"', 'carte-etiquette'],
    ok: 'Les étiquettes cochées s\'affichent en couleur sur la carte.',
    partielle: 'Les étiquettes sont incomplètes : cases `etiquettes` dans la modale, et `carte-etiquette` colorée sur la carte.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere);
      const form = await ouvrirCarte(ctx, id);
      const valeurs = await form.locator('[name="etiquettes"]').evaluateAll((els) => els.map((e) => e.value));
      ctx.check('Étiquettes proposées', valeurs.length >= 2, `${valeurs.length} étiquette(s) proposée(s) dans la modale : au moins 2 attendues.`);
      if (valeurs.length === 0) return;
      await ctx.fillAndSubmit(form, { etiquettes: valeurs[0] });
      await o.closeOverlays(ctx);
      const pastilles = ctx.t('carte-etiquette', ctx.item('carte', id));
      ctx.check('Étiquette sur la carte', (await pastilles.count()) >= 1, 'Aucun `carte-etiquette` sur la carte après l\'attribution.');
      if ((await pastilles.count()) > 0) {
        const fond = await pastilles.first().evaluate((el) => getComputedStyle(el).backgroundColor);
        ctx.check('Étiquette colorée', !/rgba\(0, 0, 0, 0\)|transparent/.test(fond), 'L\'étiquette n\'a pas de couleur de fond.');
      }
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Sous-tâches et progression',
    attrs: ['form-sous-tache', 'sous-tache', 'progression'],
    ok: 'Les sous-tâches se cochent et la progression « 1/2 » s\'affiche sur la carte.',
    partielle: 'Les sous-tâches sont incomplètes : ajout avec `form-sous-tache`, case à cocher, progression « faites/total » sur la carte.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere);
      await ouvrirCarte(ctx, id);
      const form = await ctx.firstVisible(await ctx.needTest('form-sous-tache'));
      await ctx.fillAndSubmit(form, { texte: 'Première étape' });
      await ctx.fillAndSubmit(await ctx.firstVisible(ctx.t('form-sous-tache')), { texte: 'Deuxième étape' });
      const items = ctx.vis(ctx.t('sous-tache'));
      ctx.check('Deux sous-tâches', (await items.count()) === 2, `${await items.count()} sous-tâche(s) affichée(s) après deux ajouts.`);
      const box = items.first().locator('input[type="checkbox"]');
      await ctx.need(box, 'Case à cocher dans `sous-tache`');
      await box.first().check({ force: true });
      await ctx.settle();
      await o.closeOverlays(ctx);
      const texte = await ctx.text(ctx.t('progression', ctx.item('carte', id)));
      ctx.check('Progression 1/2', /1\s*\/\s*2/.test(texte), `La carte affiche « ${texte || 'rien'} » au lieu de « 1/2 ».`);
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Cartes en retard',
    attrs: ['data-retard="true"'],
    ok: 'Une échéance passée met la carte en évidence, une échéance future non.',
    partielle: 'La mise en évidence est incomplète : `data-retard="true"` seulement si l\'échéance est passée.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere);
      await ctx.fillAndSubmit(await ouvrirCarte(ctx, id), { echeance: '2020-01-01' });
      await o.closeOverlays(ctx);
      const retard = await ctx.item('carte', id).getAttribute('data-retard');
      ctx.check('Échéance passée', retard === 'true', 'Une carte avec une échéance passée doit porter `data-retard="true"`.');
      await ctx.fillAndSubmit(await ouvrirCarte(ctx, id), { echeance: '2099-01-01' });
      await o.closeOverlays(ctx);
      ctx.check('Échéance future', (await ctx.item('carte', id).getAttribute('data-retard')) !== 'true', 'Une carte avec une échéance future ne doit pas être en retard.');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Recherche en direct',
    attrs: ['recherche'],
    ok: 'La recherche masque les cartes qui ne correspondent pas.',
    partielle: 'La recherche est incomplète : les autres cartes doivent être masquées, puis réapparaître quand on vide le champ.',
    scenario: async (ctx) => {
      const [premiere] = await premiereColonne(ctx);
      const id = await nouvelleCarte(ctx, premiere, o.uid('Zorglub'));
      const total = (await o.visibleIds(ctx, 'carte')).length;
      await o.search(ctx, 'ZORGLUB');
      ctx.check('Autres cartes masquées', o.sameSet(await o.visibleIds(ctx, 'carte'), [id]), 'La recherche n\'affiche pas uniquement la carte correspondante.');
      await o.search(ctx, '');
      ctx.check('Recherche vidée', (await o.visibleIds(ctx, 'carte')).length === total, 'Vider la recherche ne réaffiche pas toutes les cartes.');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Compteur et état vide par colonne',
    attrs: ['compteur', 'etat-vide'],
    ok: 'Chaque colonne affiche son nombre de cartes et un état vide.',
    partielle: 'Les compteurs sont incomplets : un `compteur` par colonne égal à ses cartes, et `etat-vide` dans une colonne vide.',
    scenario: async (ctx) => {
      const ids = await premiereColonne(ctx);
      for (const id of ids) await o.counterMatches(ctx, 'carte', `Compteur de la colonne ${id}`, colonne(ctx, id));
      const vide = await o.createOrFail(ctx, await o.openForm(ctx, 'form-colonne', 'colonne-nouveau'), { titre: o.uid('Vide') }, 'colonne', 'La colonne');
      await o.counterMatches(ctx, 'carte', 'Compteur d\'une colonne vide', colonne(ctx, vide));
      await o.emptyStateVisible(ctx, 'État vide de la colonne', colonne(ctx, vide));
      await nouvelleCarte(ctx, vide);
      await o.counterMatches(ctx, 'carte', 'Compteur après un ajout', colonne(ctx, vide));
      ctx.check('État vide masqué', !(await ctx.isVisible(ctx.t('etat-vide', colonne(ctx, vide)))), '`etat-vide` reste visible dans une colonne qui a une carte.');
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [
    o.is(api, 'creerDonneesDemo().colonnes.length', (n) => n === 3, 'exactement 3 colonnes de démonstration'),
    o.is(api, "typeof ETIQUETTES === 'object' && !Array.isArray(ETIQUETTES) && Object.keys(ETIQUETTES).length", (n) => n >= 2, 'un objet dictionnaire ETIQUETTES (au moins 2 étiquettes)'),
  ]),
  o.fn('creerColonne', (api) => [
    o.is(api, "creerColonne('  Recette ')", (v) => v && v.titre === 'Recette' && Array.isArray(v.cartes) && v.cartes.length === 0 && v.id !== undefined, '{ id, titre: \'Recette\', cartes: [] }'),
    o.is(api, "creerColonne('   ')", (v) => v === null, 'null pour un titre vide'),
  ]),
  o.fn('creerCarte', (api) => [
    o.is(api, "creerCarte('Maquette')", (v) => v && v.titre === 'Maquette' && v.echeance === '' && Array.isArray(v.etiquettes) && Array.isArray(v.sousTaches), 'une carte avec etiquettes et sousTaches vides'),
    o.is(api, "creerCarte('')", (v) => v === null, 'null pour un titre vide'),
  ]),
  o.fn('trouverCarte', (api) => [
    o.is(api, `trouverCarte(${COLONNES}, 'c3').titre`, (v) => v === 'Tests', 'la carte c3 (dans la 2e colonne)'),
    o.is(api, `trouverCarte(${COLONNES}, 'zz')`, (v) => v === undefined, 'undefined si la carte n\'existe pas'),
  ]),
  o.fn('deplacerCarte', (api) => [
    o.is(api, `deplacerCarte(${COLONNES}, 'c1', 'k2').map((c) => c.cartes.map((x) => x.id).join('+')).join('|')`, (v) => v === 'c2|c3+c1', 'c1 à la fin de k2 : « c2|c3+c1 »'),
    o.is(api, `(() => { const cols = ${COLONNES}; deplacerCarte(cols, 'c1', 'k2'); return cols[0].cartes.length; })()`, (v) => v === 2, 'un nouveau tableau : l\'original n\'est pas modifié'),
  ]),
  o.fn('progression', (api) => [
    o.is(api, `progression(${COLONNES}[0].cartes[0])`, (v) => v === '1/2', "'1/2'"),
    o.is(api, "progression({ sousTaches: [] })", (v) => v === '0/0', "'0/0' sans sous-tâche"),
  ]),
  o.fn('estEnRetard', (api) => [
    o.is(api, "estEnRetard({ echeance: '2026-01-01' }, '2026-01-02')", (v) => v === true, 'true : échéance passée'),
    o.is(api, "estEnRetard({ echeance: '2026-01-02' }, '2026-01-02')", (v) => v === false, 'false le jour même'),
    o.is(api, "estEnRetard({ echeance: '' }, '2026-01-02')", (v) => v === false, 'false sans échéance'),
  ]),
  o.fn('carteCorrespond', (api) => [
    o.is(api, "carteCorrespond({ titre: 'Maquette', description: 'version mobile' }, 'MOBILE')", (v) => v === true, 'true : la description contient « mobile »'),
    o.is(api, "carteCorrespond({ titre: 'Maquette', description: '' }, 'readme')", (v) => v === false, 'false'),
  ]),
  o.fn('totalCartes', (api) => [o.is(api, `totalCartes(${COLONNES})`, (v) => v === 3, '3'), o.is(api, 'totalCartes([])', (v) => v === 0, '0')]),
];

const modele = (etat) => {
  const cols = Array.isArray(etat && etat.colonnes) ? etat.colonnes : [];
  const cartes = cols.flatMap((c) => (Array.isArray(c.cartes) ? c.cartes : []));
  return [
    o.modelCheck('`colonnes` est un tableau', Array.isArray(etat && etat.colonnes), 'L\'état sauvegardé doit contenir un tableau `colonnes`.'),
    o.modelCheck('Colonnes avec id et `cartes`', cols.length > 0 && cols.every((c) => o.hasId(c) && 'titre' in c && Array.isArray(c.cartes)) && o.unique(cols), 'Chaque colonne doit avoir un `id` unique, un `titre` et un tableau imbriqué `cartes`.'),
    o.modelCheck('Cartes avec id unique', cartes.length > 0 && cartes.every(o.hasId) && o.unique(cartes), 'Chaque carte doit avoir un `id` unique.'),
    o.modelCheck('Champs de la carte', cartes.length > 0 && cartes.every((c) => 'titre' in c && 'description' in c && 'echeance' in c && Array.isArray(c.etiquettes) && Array.isArray(c.sousTaches)), 'Chaque carte doit avoir `titre`, `description`, `echeance`, et les tableaux `etiquettes` et `sousTaches`.'),
    o.modelCheck('Sous-tâches', cartes.some((c) => Array.isArray(c.sousTaches) && c.sousTaches.length > 0 && c.sousTaches.every((s) => typeof s.faite === 'boolean')), 'La démo doit contenir une carte avec des sous-tâches `{ id, texte, faite }`.'),
  ];
};

module.exports = {
  id: 'tableau',
  demo: { item: 'carte', min: 6 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const [premiere, deuxieme] = await premiereColonne(ctx);
      const titre = o.uid('Persistante');
      const id = await nouvelleCarte(ctx, premiere, titre);
      await deplacer(ctx, id, deuxieme);
      return { id, deuxieme, titre };
    },
    verifier: async (ctx, { id, deuxieme, titre }) => {
      if (!(await ctx.text(ctx.item('carte', id))).includes(titre)) return { ok: false, hint: 'Après rechargement, la carte créée a disparu : appelle `sauvegarder()` après chaque action.' };
      return { ok: (await dansColonne(ctx, deuxieme, id)) > 0, hint: 'Après rechargement, la carte n\'est plus dans la colonne où elle a été déplacée.' };
    },
  },
  injection: async (ctx, payload) => {
    const [premiere] = await premiereColonne(ctx);
    await ctx.fillAndSubmit(await formCarte(ctx, premiere), { titre: payload });
    await ctx.fillAndSubmit(await o.openForm(ctx, 'form-colonne', 'colonne-nouveau'), { titre: payload });
  },
};
