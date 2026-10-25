'use strict';

const o = require('./_outils');

const NOTES = o.fixture('NOTES', `[
  { id: 'a', titre: 'Courses', contenu: 'Pain et LAIT', couleur: 'jaune', epinglee: true, statut: 'active', etiquettes: ['e-1'], creeLe: 3 },
  { id: 'b', titre: 'Idées', contenu: 'Projet', couleur: 'defaut', epinglee: false, statut: 'active', etiquettes: [], creeLe: 2 },
  { id: 'c', titre: 'Vieux', contenu: 'Archive', couleur: 'vert', epinglee: false, statut: 'archivee', etiquettes: ['e-1'], creeLe: 1 },
  { id: 'd', titre: 'Jeté', contenu: 'Poubelle', couleur: 'rose', epinglee: false, statut: 'corbeille', etiquettes: [], creeLe: 0 }
]`);
const ids = (v) => (Array.isArray(v) ? v.map((n) => n.id).sort().join(',') : null);

const nouvelleNote = async (ctx, titre, contenu = 'Contenu de test') => o.createOrFail(ctx, await ctx.needTest('form-note'), { titre, contenu }, 'note', 'La note');

const ouvrirModale = async (ctx, id) => {
  await ctx.action('note', id, 'note-modifier');
  const form = ctx.vis(ctx.t('form-modifier'));
  await ctx.need(ctx.t('form-modifier'), '`[data-test="form-modifier"]`');
  ctx.check('Modale ouverte', (await ctx.isVisible(ctx.t('modale'))) && (await form.count()) > 0, '`note-modifier` n\'ouvre pas de `[data-test="modale"]` visible avec `form-modifier`.');
  return ctx.firstVisible(ctx.t('form-modifier'));
};

const vue = (ctx, nom) => o.navigate(ctx, `vue-${nom}`);

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Créer une note',
    crud: 'create',
    attrs: ['form-note', 'name="titre"', 'name="contenu"', 'note'],
    ok: 'La note est créée, affichée, et une note vide est refusée.',
    partielle: 'La création ne marche pas dans tous les cas : une note avec titre OU contenu doit être créée, une note vide (ou faite d\'espaces) refusée.',
    scenario: async (ctx) => {
      const form = await ctx.needTest('form-note');
      const since = await ctx.mark();
      const titre = o.uid('Liste marché');
      const id = await o.createOrFail(ctx, form, { titre, contenu: 'Tomates, oignons' }, 'note', 'La note');
      ctx.check('Titre affiché', (await ctx.text(ctx.item('note', id))).includes(titre), 'Le titre saisi n\'apparaît pas dans la carte.');
      await o.notified(ctx, since, 'Création d\'une note');
      ctx.check('Contenu seul accepté', (await o.create(ctx, form, { titre: '', contenu: o.uid('Seulement du contenu') }, 'note')) !== null, 'Une note avec un contenu mais sans titre doit être acceptée.');
      await o.refuse(ctx, form, { titre: '', contenu: '' }, 'note', 'Note vide refusée');
      await o.refuse(ctx, form, { titre: '   ', contenu: '  ' }, 'note', 'Note faite d\'espaces refusée');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Grille de cartes',
    crud: 'read',
    attrs: ['note', 'data-id'],
    ok: 'Les cartes s\'affichent en grille sur plusieurs colonnes, avec des hauteurs différentes.',
    partielle: 'La grille n\'est pas complète : à 1280 px, plusieurs colonnes de cartes dont la hauteur suit le contenu.',
    scenario: async (ctx) => {
      await ctx.needTest('note');
      const court = await nouvelleNote(ctx, o.uid('Court'), 'Ok');
      const long = await nouvelleNote(ctx, o.uid('Long'), 'Une note beaucoup plus longue.\n'.repeat(8));
      const a = await ctx.item('note', court).boundingBox();
      const b = await ctx.item('note', long).boundingBox();
      ctx.check('Hauteurs différentes', a && b && Math.abs(a.height - b.height) > 15, 'Toutes les cartes ont la même hauteur : la hauteur doit suivre le contenu.');
      const xs = await ctx.page.$$eval('[data-test="note"]', (els) => [...new Set(els.filter((e) => e.getClientRects().length > 0).map((e) => Math.round(e.getBoundingClientRect().left)))]);
      ctx.check('Plusieurs colonnes', xs.length >= 2, 'À 1280 px, les cartes sont sur une seule colonne : utilise une grille (Grid ou colonnes CSS).');
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'Modifier dans une modale',
    crud: 'update',
    attrs: ['note-modifier', 'modale', 'form-modifier'],
    ok: 'La modale s\'ouvre pré-remplie et la modification est enregistrée.',
    partielle: 'La modification n\'est pas complète : modale pré-remplie, carte mise à jour, modale refermée.',
    scenario: async (ctx) => {
      const titre = o.uid('Avant');
      const id = await nouvelleNote(ctx, titre);
      const form = await ouvrirModale(ctx, id);
      ctx.check('Champs pré-remplis', (await form.locator('[name="titre"]').first().inputValue()) === titre, 'Le champ `titre` de la modale n\'est pas pré-rempli avec la note.');
      const nouveau = o.uid('Après');
      const since = await ctx.mark();
      await ctx.fillAndSubmit(form, { titre: nouveau, contenu: 'Contenu modifié' });
      ctx.check('Carte mise à jour', (await ctx.text(ctx.item('note', id))).includes(nouveau), 'La carte n\'affiche pas le nouveau titre après l\'enregistrement.');
      ctx.check('Modale refermée', !(await ctx.isVisible(ctx.t('modale'))), 'La modale reste ouverte après l\'enregistrement.');
      await o.notified(ctx, since, 'Modification');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Couleur parmi au moins 6',
    attrs: ['form-modifier', 'name="couleur"'],
    ok: 'Au moins 6 couleurs proposées, la carte prend la couleur choisie.',
    partielle: 'Le choix de couleur est incomplet : au moins 6 valeurs pour `couleur`, et la carte change de fond.',
    scenario: async (ctx) => {
      const id = await nouvelleNote(ctx, o.uid('Couleur'));
      const avant = await ctx.item('note', id).evaluate((el) => getComputedStyle(el).backgroundColor);
      const form = await ouvrirModale(ctx, id);
      const field = await ctx.need(form.locator('[name="couleur"]'), 'Champ `name="couleur"`');
      const values = await field.evaluateAll((els) => (els[0].tagName === 'SELECT' ? [...els[0].options].map((op) => op.value) : els.map((e) => e.value)));
      ctx.check('Au moins 6 couleurs', values.length >= 6, `${values.length} couleur(s) proposée(s) : au moins 6 attendues.`);
      await ctx.fillAndSubmit(form, { couleur: values[values.length - 1] });
      const apres = await ctx.item('note', id).evaluate((el) => getComputedStyle(el).backgroundColor);
      ctx.check('Carte colorée', apres !== avant, 'La carte garde le même fond après le choix d\'une couleur.');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Épingler une note',
    attrs: ['note-epingler', 'notes-epinglees', 'notes-autres'],
    ok: 'La note épinglée s\'affiche à part, en haut, et se désépingle.',
    partielle: 'L\'épinglage est incomplet : la note doit passer dans `notes-epinglees` (au-dessus des autres) puis en ressortir.',
    scenario: async (ctx) => {
      const id = await nouvelleNote(ctx, o.uid('Épingle'));
      await ctx.action('note', id, 'note-epingler');
      const dans = (section) => ctx.page.locator(`[data-test="${section}"] [data-test="note"][data-id="${id}"]`).count();
      ctx.check('Dans les épinglées', (await dans('notes-epinglees')) > 0, 'Après `note-epingler`, la note n\'est pas dans `[data-test="notes-epinglees"]`.');
      const haut = await ctx.t('notes-epinglees').first().boundingBox();
      const bas = await ctx.t('notes-autres').first().boundingBox().catch(() => null);
      ctx.check('Section en haut', haut && (!bas || haut.y < bas.y), 'La section des notes épinglées doit être au-dessus des autres.');
      await ctx.action('note', id, 'note-epingler');
      ctx.check('Désépingler', (await dans('notes-epinglees')) === 0, 'Un second clic sur `note-epingler` doit désépingler la note.');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Archiver et restaurer',
    attrs: ['note-archiver', 'note-restaurer', 'vue-notes', 'vue-archives'],
    ok: 'La note passe dans les archives et revient avec « restaurer ».',
    partielle: 'L\'archivage est incomplet : la note quitte la vue Notes, apparaît dans Archives, puis revient.',
    scenario: async (ctx) => {
      const id = await nouvelleNote(ctx, o.uid('Archive'));
      const since = await ctx.mark();
      await ctx.action('note', id, 'note-archiver');
      ctx.check('Quitte la vue Notes', !(await ctx.isVisible(ctx.item('note', id))), 'La note archivée reste affichée dans la vue Notes.');
      await o.notified(ctx, since, 'Archivage');
      await vue(ctx, 'archives');
      ctx.check('Visible dans Archives', await ctx.isVisible(ctx.item('note', id)), 'La note archivée n\'apparaît pas dans la vue Archives.');
      await ctx.action('note', id, 'note-restaurer');
      await vue(ctx, 'notes');
      ctx.check('Restaurée', await ctx.isVisible(ctx.item('note', id)), 'Après `note-restaurer`, la note ne revient pas dans la vue Notes.');
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Corbeille et suppression définitive',
    crud: 'delete',
    attrs: ['note-corbeille', 'note-restaurer', 'note-supprimer', 'vue-corbeille', 'confirmation'],
    ok: 'Corbeille, restauration et suppression définitive après confirmation fonctionnent.',
    partielle: 'La corbeille est incomplète : envoyer, restaurer, puis supprimer définitivement après confirmation (annuler doit conserver la note).',
    scenario: async (ctx) => {
      const id = await nouvelleNote(ctx, o.uid('Corbeille'));
      await ctx.action('note', id, 'note-corbeille');
      ctx.check('Quitte la vue Notes', !(await ctx.isVisible(ctx.item('note', id))), 'La note envoyée à la corbeille reste dans la vue Notes.');
      await vue(ctx, 'corbeille');
      ctx.check('Dans la corbeille', await ctx.isVisible(ctx.item('note', id)), 'La note n\'apparaît pas dans la vue Corbeille.');
      await ctx.action('note', id, 'note-restaurer');
      await vue(ctx, 'notes');
      ctx.check('Restaurée', await ctx.isVisible(ctx.item('note', id)), 'La note restaurée ne revient pas dans la vue Notes.');
      await ctx.action('note', id, 'note-corbeille');
      await vue(ctx, 'corbeille');
      await o.deleteChecks(ctx, 'note', id, 'note-supprimer', 'Suppression définitive');
      await vue(ctx, 'archives');
      const ailleurs = await ctx.count(ctx.item('note', id));
      await vue(ctx, 'notes');
      ctx.check('Supprimée partout', ailleurs + (await ctx.count(ctx.item('note', id))) === 0, 'La note supprimée définitivement réapparaît dans une autre vue.');
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Étiquettes et filtre',
    attrs: ['form-etiquette', 'filtre-etiquette', 'name="etiquettes"'],
    ok: 'L\'étiquette est créée, attribuée dans la modale, et le filtre n\'affiche que ses notes.',
    partielle: 'Les étiquettes sont incomplètes : créer, cocher dans `form-modifier`, puis filtrer.',
    scenario: async (ctx) => {
      const nom = o.uid('Étiq');
      await ctx.fillAndSubmit(await ctx.firstVisible(await ctx.needTest('form-etiquette')), { nom });
      const filtre = ctx.page.locator('[data-test="filtre-etiquette"]', { hasText: nom }).first();
      await ctx.need(filtre, `Filtre \`filtre-etiquette\` « ${nom} »`);
      const etiquetteId = await filtre.getAttribute('data-id');
      ctx.check('Étiquette créée', Boolean(etiquetteId), 'Le filtre d\'étiquette n\'a pas de `data-id`.');
      const avec = await nouvelleNote(ctx, o.uid('Avec étiquette'));
      const sans = await nouvelleNote(ctx, o.uid('Sans étiquette'));
      const form = await ouvrirModale(ctx, avec);
      await ctx.fillAndSubmit(form, { etiquettes: etiquetteId });
      await filtre.click();
      await ctx.settle();
      const visibles = await o.visibleIds(ctx, 'note');
      ctx.check('Filtre par étiquette', visibles.includes(avec) && !visibles.includes(sans), 'Le filtre n\'affiche pas uniquement les notes portant l\'étiquette.');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Recherche en direct',
    attrs: ['recherche'],
    ok: 'La recherche filtre en direct dans les titres et les contenus, sans tenir compte des majuscules.',
    partielle: 'La recherche est incomplète : elle doit porter sur le titre ET le contenu, sans tenir compte des majuscules.',
    scenario: async (ctx) => {
      const a = await nouvelleNote(ctx, o.uid('Zébulon'), 'premier');
      const b = await nouvelleNote(ctx, o.uid('Autre'), 'mot zorglub caché');
      const total = (await o.visibleIds(ctx, 'note')).length;
      await o.search(ctx, 'zébulon');
      ctx.check('Dans le titre', o.sameSet(await o.visibleIds(ctx, 'note'), [a]), 'Rechercher un mot du titre n\'affiche pas uniquement la note correspondante.');
      await o.search(ctx, 'ZORGLUB');
      ctx.check('Dans le contenu, majuscules ignorées', o.sameSet(await o.visibleIds(ctx, 'note'), [b]), 'Rechercher « ZORGLUB » (présent dans le contenu) n\'affiche pas la note.');
      await o.search(ctx, '');
      ctx.check('Recherche vidée', (await o.visibleIds(ctx, 'note')).length === total, 'Vider la recherche ne réaffiche pas toutes les notes.');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Compteur et état vide',
    attrs: ['compteur', 'etat-vide'],
    ok: 'Le compteur suit les notes affichées et chaque vue a son état vide.',
    partielle: 'Le compteur ou l\'état vide est incomplet : le compteur doit égaler le nombre de notes affichées, et `etat-vide` apparaître dans une vue vide.',
    scenario: async (ctx) => {
      await ctx.needTest('compteur');
      await o.counterMatches(ctx, 'note', 'Compteur de la vue Notes');
      await nouvelleNote(ctx, o.uid('Compte'));
      await o.counterMatches(ctx, 'note', 'Compteur après un ajout');
      await o.search(ctx, 'xqzw-aucune-note');
      await o.counterMatches(ctx, 'note', 'Compteur à zéro');
      await o.emptyStateVisible(ctx, 'État vide (recherche sans résultat)');
      await o.search(ctx, '');
      ctx.check('État vide masqué', !(await ctx.isVisible(ctx.t('etat-vide'))), '`etat-vide` reste visible alors que des notes sont affichées.');
      await vue(ctx, 'archives');
      await o.counterMatches(ctx, 'note', 'Compteur de la vue Archives');
      await vue(ctx, 'corbeille');
      if ((await o.visibleIds(ctx, 'note')).length === 0) await o.emptyStateVisible(ctx, 'État vide de la corbeille');
      else await o.counterMatches(ctx, 'note', 'Compteur de la corbeille');
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [
    o.is(api, 'creerDonneesDemo().notes.length', (n) => n >= 6, 'au moins 6 notes de démonstration'),
  ]),
  o.fn('creerNote', (api) => [
    o.is(api, "creerNote({ titre: '  Pain ', contenu: '' })", (v) => v && v.titre === 'Pain' && v.statut === 'active' && v.epinglee === false && Array.isArray(v.etiquettes) && v.id !== undefined, 'une note active, non épinglée, titre nettoyé, avec un id'),
    o.is(api, "creerNote({ titre: '', contenu: '  ' })", (v) => v === null, 'null quand titre et contenu sont vides'),
    o.is(api, "creerNote({ titre: 'a', contenu: '' }).id !== creerNote({ titre: 'b', contenu: '' }).id", (v) => v === true, 'des id différents à chaque note'),
  ]),
  o.fn('trouverNote', (api) => [
    o.is(api, `trouverNote(${NOTES}, 'b').titre`, (v) => v === 'Idées', 'la note dont l\'id correspond'),
    o.is(api, `trouverNote(${NOTES}, 'zz')`, (v) => v === undefined, 'undefined si l\'id n\'existe pas'),
  ]),
  o.fn('filtrerNotes', (api) => [
    o.is(api, `filtrerNotes(${NOTES}, 'notes', '', '')`, (v) => ids(v) === 'a,b', 'les notes actives (a, b)'),
    o.is(api, `filtrerNotes(${NOTES}, 'archives', '', '')`, (v) => ids(v) === 'c', 'les notes archivées (c)'),
    o.is(api, `filtrerNotes(${NOTES}, 'corbeille', '', '')`, (v) => ids(v) === 'd', 'les notes de la corbeille (d)'),
    o.is(api, `filtrerNotes(${NOTES}, 'notes', 'e-1', '')`, (v) => ids(v) === 'a', 'les notes actives portant l\'étiquette e-1 (a)'),
    o.is(api, `filtrerNotes(${NOTES}, 'notes', '', 'lait')`, (v) => ids(v) === 'a', 'la recherche porte sur le contenu, sans tenir compte des majuscules (a)'),
  ]),
  o.fn('compterParVue', (api) => [
    o.is(api, `compterParVue(${NOTES})`, (v) => v && v.notes === 2 && v.archives === 1 && v.corbeille === 1, '{ notes: 2, archives: 1, corbeille: 1 }'),
    o.is(api, 'compterParVue([])', (v) => v && v.notes === 0 && v.archives === 0 && v.corbeille === 0, '{ notes: 0, archives: 0, corbeille: 0 } pour une liste vide'),
  ]),
  o.fn('utiliseEtiquette', (api) => [
    o.is(api, `utiliseEtiquette(${NOTES}, 'e-1')`, (v) => v === true, 'true : des notes portent e-1'),
    o.is(api, `utiliseEtiquette(${NOTES}, 'e-9')`, (v) => v === false, 'false : aucune note ne porte e-9'),
  ]),
];

const STATUTS = ['active', 'archivee', 'corbeille'];

const modele = (etat) => {
  const notes = Array.isArray(etat && etat.notes) ? etat.notes : [];
  return [
    o.modelCheck('`notes` est un tableau', Array.isArray(etat && etat.notes), 'L\'état sauvegardé doit contenir un tableau `notes`.'),
    o.modelCheck('Chaque note a un id unique', notes.length > 0 && notes.every(o.hasId) && o.unique(notes), 'Chaque note doit avoir un `id` unique.'),
    o.modelCheck('Champs de la fiche', notes.length > 0 && notes.every((n) => 'titre' in n && 'contenu' in n && 'couleur' in n && typeof n.epinglee === 'boolean' && STATUTS.includes(n.statut)), 'Chaque note doit avoir `titre`, `contenu`, `couleur`, `epinglee` (booléen) et `statut` (active, archivee, corbeille).'),
    o.modelCheck('Tableau imbriqué `etiquettes`', notes.length > 0 && notes.every((n) => Array.isArray(n.etiquettes)), 'Chaque note doit avoir un tableau `etiquettes`.'),
    o.modelCheck('Dictionnaire `etiquettes`', o.isDict(etat && etat.etiquettes) && Object.values(etat.etiquettes).every((e) => e && 'nom' in e), '`etat.etiquettes` doit être un objet dictionnaire `{ id: { id, nom } }`.'),
    o.modelCheck('Démo variée', notes.some((n) => n.epinglee) && notes.some((n) => n.statut === 'archivee'), 'La démo doit contenir au moins une note épinglée et une note archivée.'),
  ];
};

module.exports = {
  id: 'notes',
  demo: { item: 'note', min: 4 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const titre = o.uid('Persistante');
      const id = await nouvelleNote(ctx, titre);
      await ctx.action('note', id, 'note-epingler');
      return { id, titre };
    },
    verifier: async (ctx, { id, titre }) => {
      const texte = await ctx.text(ctx.item('note', id));
      const epinglee = (await ctx.page.locator(`[data-test="notes-epinglees"] [data-test="note"][data-id="${id}"]`).count()) > 0;
      return { ok: texte.includes(titre) && epinglee, hint: !texte.includes(titre) ? 'Après rechargement, la note créée a disparu : appelle `sauvegarder()` après chaque action.' : 'Après rechargement, la note n\'est plus épinglée : tout l\'état doit être sauvegardé.' };
    },
  },
  injection: async (ctx, payload) => {
    await ctx.fillAndSubmit(await ctx.needTest('form-note'), { titre: payload, contenu: payload });
    const etiquette = ctx.t('form-etiquette');
    if ((await etiquette.count()) > 0) await ctx.fillAndSubmit(await ctx.firstVisible(etiquette), { nom: payload });
  },
};
