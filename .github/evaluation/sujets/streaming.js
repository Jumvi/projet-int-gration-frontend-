'use strict';

const o = require('./_outils');

const CATALOGUE = o.fixture('CATALOGUE', `[
  { id: 't1', titre: 'Kin la belle', genre: 'documentaire', vedette: true },
  { id: 't2', titre: 'Fleuve Congo', genre: 'documentaire', vedette: false },
  { id: 't3', titre: 'Course poursuite', genre: 'action', vedette: false }
]`);
const PROFIL = o.fixture('PROFIL', "{ id: 'p', nom: 'A', maListe: ['t1'], progression: { t2: 40, t3: 100 } }");

const formProfil = (ctx) => o.openForm(ctx, 'form-profil', 'profil-nouveau');
const creerProfil = async (ctx, nom = o.uid('Profil')) => o.createOrFail(ctx, await formProfil(ctx), { nom }, 'profil', 'Le profil');

const etat = async (ctx) => {
  const saved = await ctx.storage('kadea-streaming');
  return saved.json ? saved.value : null;
};

const choisir = async (ctx, id) => {
  await o.closeOverlays(ctx);
  const item = ctx.item('profil', id);
  await ctx.need(item, `\`[data-test="profil"][data-id="${id}"]\``);
  const bouton = item.locator('[data-test="profil-choisir"]');
  if ((await bouton.count()) > 0) await bouton.first().click();
  else await item.click({ position: { x: 10, y: 10 } });
  await ctx.settle();
};
const entrer = async (ctx) => {
  const [id] = await ctx.ids('profil');
  if (!id) throw new (require('../lib/browser').Absent)('`[data-test="profil"][data-id]` introuvable.');
  await choisir(ctx, id);
  await ctx.needTest('catalogue');
  return id;
};
const changerProfil = async (ctx) => {
  await o.closeOverlays(ctx);
  await (await ctx.firstVisible(await ctx.needTest('changer-profil'))).click();
  await ctx.settle();
};

const affiche = (ctx, id, scope = ctx.page) => scope.locator(`[data-test="affiche"][data-id="${id}"]`);
const premiereAffiche = async (ctx) => {
  const ids = await o.visibleIds(ctx, 'affiche');
  if (ids.length === 0) throw new (require('../lib/browser').Absent)('`[data-test="affiche"][data-id]` introuvable.');
  return ids[0];
};
const ouvrir = async (ctx, id) => {
  await o.closeOverlays(ctx);
  const cible = await ctx.firstVisible(affiche(ctx, id));
  await cible.scrollIntoViewIfNeeded().catch(() => {});
  await cible.click();
  await ctx.settle();
  return ctx.firstVisible(await ctx.needTest('modale'));
};
const dansRangee = (ctx, rangee, id) => ctx.t(rangee).locator(`[data-test="affiche"][data-id="${id}"]`).count();

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Profils : créer, modifier, supprimer (5 max)',
    crud: ['create', 'update', 'delete'],
    attrs: ['ecran-profils', 'profil', 'form-profil', 'profil-modifier', 'profil-supprimer', 'erreur'],
    ok: 'Création, modification, suppression confirmée et limite de 5 profils fonctionnent.',
    partielle: 'La gestion des profils est incomplète : nom obligatoire, modification pré-remplie, suppression confirmée, 6e profil refusé avec un message.',
    scenario: async (ctx) => {
      await ctx.needTest('ecran-profils');
      ctx.check('Profils de démo', (await ctx.ids('profil')).length >= 2, 'Au moins 2 profils de démonstration attendus.');
      const since = await ctx.mark();
      const id = await creerProfil(ctx);
      await o.notified(ctx, since, 'Création d\'un profil');
      await o.refuse(ctx, await formProfil(ctx), { nom: '  ' }, 'profil', 'Nom vide refusé');
      const nom = o.uid('Renommé');
      await ctx.action('profil', id, 'profil-modifier');
      const form = await ctx.firstVisible(await ctx.needTest('form-profil'));
      ctx.check('Formulaire pré-rempli', (await form.locator('[name="nom"]').first().inputValue()).length > 0, 'Le champ `nom` n\'est pas pré-rempli à la modification.');
      await ctx.fillAndSubmit(form, { nom });
      await o.closeOverlays(ctx);
      ctx.check('Profil modifié', (await ctx.text(ctx.item('profil', id))).includes(nom), 'Le profil n\'affiche pas le nouveau nom.');
      while ((await ctx.ids('profil')).length < 5) await creerProfil(ctx);
      await o.refuse(ctx, await formProfil(ctx), { nom: o.uid('Sixième') }, 'profil', 'Sixième profil refusé');
      await o.closeOverlays(ctx);
      await o.deleteChecks(ctx, 'profil', id, 'profil-supprimer', 'Suppression du profil');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Choisir et changer de profil',
    attrs: ['profil-choisir', 'catalogue', 'profil-actif', 'changer-profil'],
    ok: 'Le profil choisi s\'affiche dans l\'en-tête et on en change depuis l\'en-tête.',
    partielle: 'Le choix du profil est incomplet : catalogue affiché, `profil-actif` avec le nom, `changer-profil` vers l\'écran des profils.',
    scenario: async (ctx) => {
      const [id] = await ctx.ids('profil');
      const nom = await ctx.text(ctx.item('profil', id));
      await choisir(ctx, id);
      ctx.check('Catalogue affiché', (await ctx.isVisible(ctx.t('catalogue'))) && !(await ctx.isVisible(ctx.t('ecran-profils'))), 'Après le choix, le catalogue doit remplacer l\'écran des profils.');
      const actif = await ctx.text(ctx.t('profil-actif'));
      ctx.check('Profil actif dans l\'en-tête', actif.length > 0 && nom.includes(actif.split('\n')[0].trim()), `\`profil-actif\` affiche « ${actif} » au lieu du nom du profil.`);
      await changerProfil(ctx);
      ctx.check('Changer de profil', await ctx.isVisible(ctx.t('ecran-profils')), '`changer-profil` ne ramène pas à l\'écran des profils.');
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'Bannière mise en avant',
    attrs: ['banniere'],
    ok: 'La bannière met en avant le titre vedette.',
    partielle: 'La bannière est incomplète : elle doit afficher le titre mis en avant (`vedette`).',
    scenario: async (ctx) => {
      await entrer(ctx);
      const banniere = await ctx.needTest('banniere');
      ctx.check('Bannière visible', await ctx.isVisible(banniere), '`banniere` n\'est pas visible.');
      const e = await etat(ctx);
      const vedette = e && Array.isArray(e.catalogue) ? e.catalogue.find((t) => t.vedette) : null;
      const texte = await ctx.text(banniere);
      ctx.check('Titre mis en avant', vedette ? texte.includes(vedette.titre) : texte.length > 0, vedette ? `La bannière n'affiche pas « ${vedette.titre} » (vedette).` : 'La bannière ne contient pas de titre.');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Rangées par genre',
    crud: 'read',
    attrs: ['rangee', 'affiche', 'data-genre'],
    ok: 'Une rangée par genre, qui défile horizontalement.',
    partielle: 'Les rangées sont incomplètes : une `rangee` par genre (affiches du même `data-genre`) avec un défilement horizontal.',
    scenario: async (ctx) => {
      await entrer(ctx);
      const rangees = await ctx.page.$$eval('[data-test="rangee"]', (els) =>
        els.map((el) => {
          const genres = [...el.querySelectorAll('[data-test="affiche"]')].map((a) => a.dataset.genre);
          const piste = [el, ...el.querySelectorAll('*')].find((x) => ['auto', 'scroll'].includes(getComputedStyle(x).overflowX));
          return { n: genres.length, genres: [...new Set(genres)], defile: Boolean(piste) && piste.scrollWidth > piste.clientWidth };
        }),
      );
      ctx.check('Au moins 4 rangées', rangees.length >= 4, `${rangees.length} rangée(s) : une par genre attendue (au moins 4).`);
      ctx.check('Une rangée par genre', rangees.length > 0 && rangees.every((r) => r.n > 0 && r.genres.length === 1 && r.genres[0]), 'Chaque `rangee` doit contenir des affiches d\'un seul `data-genre`.');
      ctx.check('Défilement horizontal', rangees.some((r) => r.defile), 'Aucune rangée ne défile horizontalement : `overflow-x: auto` et des affiches qui ne passent pas à la ligne.');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Fenêtre de détail',
    attrs: ['affiche', 'modale', 'fermer'],
    ok: 'La modale de détail s\'ouvre à la souris et au clavier, et se ferme.',
    partielle: 'La modale est incomplète : titre et description, ouverture au clavier (Entrée), fermeture par Échap ou `fermer`.',
    scenario: async (ctx) => {
      await entrer(ctx);
      const id = await premiereAffiche(ctx);
      const modale = await ouvrir(ctx, id);
      const e = await etat(ctx);
      const titre = e && Array.isArray(e.catalogue) ? e.catalogue.find((t) => String(t.id) === id) : null;
      const texte = await modale.innerText();
      ctx.check('Titre et description', titre ? texte.includes(titre.titre) && (!titre.description || texte.includes(titre.description)) : texte.length > 20, 'La modale n\'affiche pas le titre et la description.');
      await ctx.page.keyboard.press('Escape');
      await ctx.settle();
      ctx.check('Fermeture par Échap', !(await ctx.isVisible(ctx.t('modale'))), 'La touche Échap ne ferme pas la modale.');
      await (await ctx.firstVisible(affiche(ctx, id))).focus();
      await ctx.page.keyboard.press('Enter');
      await ctx.settle();
      ctx.check('Ouverture au clavier', await ctx.isVisible(ctx.t('modale')), 'La touche Entrée sur une affiche n\'ouvre pas la modale (utilise un `<button>` ou un lien).');
      const fermer = ctx.vis(ctx.t('fermer'));
      if ((await fermer.count()) > 0) {
        await fermer.first().click();
        await ctx.settle();
      }
      ctx.check('Bouton fermer', (await fermer.count()) >= 0 && !(await ctx.isVisible(ctx.t('modale'))), 'Le bouton `fermer` ne ferme pas la modale.');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Ma liste, par profil',
    attrs: ['ma-liste-basculer', 'rangee-ma-liste'],
    ok: 'Ajout et retrait de Ma liste, avec une liste propre à chaque profil.',
    partielle: 'Ma liste est incomplète : `ma-liste-basculer` ajoute puis retire, et chaque profil a sa propre liste.',
    scenario: async (ctx) => {
      const [p1, p2] = await ctx.ids('profil');
      await choisir(ctx, p1);
      const ids = await o.visibleIds(ctx, 'affiche');
      const avant = [];
      for (const id of ids) if ((await dansRangee(ctx, 'rangee-ma-liste', id)) > 0) avant.push(id);
      const id = ids.find((x) => !avant.includes(x));
      if (!id) throw new (require('../lib/browser').Absent)('Aucune affiche hors de Ma liste.');
      await ouvrir(ctx, id);
      const since = await ctx.mark();
      await (await ctx.firstVisible(await ctx.needTest('ma-liste-basculer'))).click();
      await ctx.settle();
      await o.notified(ctx, since, 'Ajout à Ma liste');
      await o.closeOverlays(ctx);
      ctx.check('Ajout à Ma liste', (await dansRangee(ctx, 'rangee-ma-liste', id)) > 0, 'Le titre n\'apparaît pas dans `rangee-ma-liste`.');
      if (p2) {
        await changerProfil(ctx);
        await choisir(ctx, p2);
        ctx.check('Une liste par profil', (await dansRangee(ctx, 'rangee-ma-liste', id)) === 0, 'Le titre ajouté par un profil apparaît dans la liste d\'un autre profil.');
        await changerProfil(ctx);
        await choisir(ctx, p1);
      }
      await ouvrir(ctx, id);
      await (await ctx.firstVisible(ctx.t('ma-liste-basculer'))).click();
      await ctx.settle();
      await o.closeOverlays(ctx);
      ctx.check('Retrait de Ma liste', (await dansRangee(ctx, 'rangee-ma-liste', id)) === 0, 'Un second clic sur `ma-liste-basculer` ne retire pas le titre.');
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Continuer à regarder',
    attrs: ['regarder', 'rangee-continuer', 'progression'],
    ok: 'La progression est mémorisée et le titre apparaît dans « Continuer à regarder ».',
    partielle: '« Continuer à regarder » est incomplet : `regarder` ajoute de la progression, le titre apparaît dans `rangee-continuer` avec `progression`, même après rechargement.',
    scenario: async (ctx) => {
      await entrer(ctx);
      const ids = await o.visibleIds(ctx, 'affiche');
      let id = null;
      for (const x of ids) if (!id && (await dansRangee(ctx, 'rangee-continuer', x)) === 0) id = x;
      if (!id) throw new (require('../lib/browser').Absent)('Aucune affiche hors de « Continuer à regarder ».');
      await ouvrir(ctx, id);
      await (await ctx.firstVisible(await ctx.needTest('regarder'))).click();
      await ctx.settle();
      await o.closeOverlays(ctx);
      const dans = () => ctx.t('rangee-continuer').locator(`[data-test="affiche"][data-id="${id}"]`);
      ctx.check('Dans « Continuer à regarder »', (await dans().count()) > 0, 'Après `regarder`, le titre n\'apparaît pas dans `rangee-continuer`.');
      ctx.check('Progression affichée', (await ctx.t('progression', dans().first()).count()) > 0 || (await ctx.t('progression', ctx.t('rangee-continuer')).count()) > 0, 'Aucune barre `progression` sur l\'affiche.');
      await ctx.reload();
      if ((await ctx.isVisible(ctx.t('ecran-profils'))) && !(await ctx.isVisible(ctx.t('catalogue')))) await entrer(ctx);
      ctx.check('Progression mémorisée', (await dans().count()) > 0, 'Après rechargement, le titre a disparu de « Continuer à regarder ».');
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Recherche en grille',
    attrs: ['recherche', 'resultats'],
    ok: 'La recherche affiche les titres correspondants dans une grille.',
    partielle: 'La recherche est incomplète : `resultats` en `display: grid` avec uniquement les titres correspondants, et `etat-vide` sans résultat.',
    scenario: async (ctx) => {
      await entrer(ctx);
      const e = await etat(ctx);
      const catalogue = e && Array.isArray(e.catalogue) ? e.catalogue : [];
      const cible = catalogue[catalogue.length - 1];
      const mot = cible ? cible.titre.split(/\s+/).sort((a, b) => b.length - a.length)[0] : 'a';
      await o.search(ctx, mot.toUpperCase());
      const resultats = await ctx.needTest('resultats');
      ctx.check('Résultats en grille', await resultats.first().evaluate((el) => getComputedStyle(el).display.includes('grid')), '`resultats` doit être affiché en grille (`display: grid`).');
      const trouves = await resultats.first().locator('[data-test="affiche"]').evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => el.dataset.id));
      const attendus = catalogue.filter((t) => t.titre.toLowerCase().includes(mot.toLowerCase())).map((t) => String(t.id));
      ctx.check('Titres correspondants', trouves.length > 0 && (attendus.length === 0 || o.sameSet(trouves, attendus)), `La recherche « ${mot} » affiche ${trouves.length} résultat(s) au lieu de ${attendus.length}.`);
      await o.search(ctx, 'xqzw-aucun-titre');
      await o.emptyStateVisible(ctx, 'État vide (recherche sans résultat)');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Filtrer par genre',
    attrs: ['filtre-genre', 'data-genre'],
    ok: 'Le filtre par genre ne garde que les titres du genre choisi.',
    partielle: 'Le filtre est incomplet : après le choix d\'un genre, seules ses affiches restent ; `""` réaffiche tout.',
    scenario: async (ctx) => {
      await entrer(ctx);
      const select = await ctx.firstVisible(await ctx.needTest('filtre-genre'));
      const valeurs = (await select.evaluate((el) => [...el.options].map((op) => op.value))).filter(Boolean);
      ctx.check('Genres proposés', valeurs.length >= 4, `${valeurs.length} genre(s) dans \`filtre-genre\` : au moins 4 attendus.`);
      const genre = valeurs[1] || valeurs[0];
      await select.selectOption(genre);
      await ctx.settle();
      const genres = await ctx.page.$$eval('[data-test="affiche"]', (els) => els.filter((el) => el.getClientRects().length > 0).map((el) => el.dataset.genre));
      ctx.check('Seulement ce genre', genres.length > 0 && genres.every((g) => g === genre), `Après le filtre « ${genre} », des affiches d'autres genres restent visibles.`);
      await select.selectOption('');
      await ctx.settle();
      const tous = await ctx.page.$$eval('[data-test="affiche"]', (els) => new Set(els.filter((el) => el.getClientRects().length > 0).map((el) => el.dataset.genre)).size);
      ctx.check('Tous les genres', tous >= 2, 'La valeur `""` ne réaffiche pas tout le catalogue.');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Animations au survol et au focus',
    attrs: ['affiche'],
    ok: 'Les affiches s\'animent au survol et au focus.',
    partielle: 'Les animations sont incomplètes : `transition` sur `transform`, au survol (`:hover`) ET au focus (`:focus-visible`).',
    scenario: async (ctx) => {
      await entrer(ctx);
      const ids = await o.visibleIds(ctx, 'affiche');
      if (ids.length < 2) throw new (require('../lib/browser').Absent)('Moins de 2 affiches visibles.');
      const cible = await ctx.firstVisible(affiche(ctx, ids[1]));
      const style = () => cible.evaluate((el) => ({ transform: getComputedStyle(el).transform, duree: getComputedStyle(el).transitionDuration, prop: getComputedStyle(el).transitionProperty }));
      const repos = await style();
      ctx.check('Transition', repos.duree.split(',').some((d) => parseFloat(d) > 0) && /transform|all/.test(repos.prop), 'Les affiches n\'ont pas de `transition` sur `transform`.');
      await cible.hover();
      await ctx.settle(500);
      ctx.check('Au survol', (await style()).transform !== repos.transform, 'Aucune transformation au survol (`:hover`).');
      await ctx.page.mouse.move(0, 0);
      await ctx.settle(500);
      await cible.focus();
      await ctx.page.keyboard.press('Shift+Tab');
      await ctx.page.keyboard.press('Tab');
      await ctx.settle(500);
      ctx.check('Au focus', (await style()).transform !== repos.transform, 'Aucune transformation au focus clavier (`:focus-visible`) : l\'affiche doit être focusable (bouton ou lien).');
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [
    o.is(api, 'creerDonneesDemo().catalogue.length', (n) => n >= 18, 'au moins 18 titres au catalogue'),
    o.is(api, 'creerDonneesDemo().profils.length', (n) => n >= 2, 'au moins 2 profils'),
  ]),
  o.fn('creerProfil', (api) => [
    o.is(api, "creerProfil([], 'Ali')", (v) => v && v.nom === 'Ali' && Array.isArray(v.maListe) && v.progression && typeof v.progression === 'object' && v.id !== undefined, "{ id, nom: 'Ali', couleur, maListe: [], progression: {} }"),
    o.is(api, "creerProfil([], '  ')", (v) => v === null, 'null pour un nom vide'),
    o.is(api, "creerProfil([{id:1},{id:2},{id:3},{id:4},{id:5}], 'Sixième')", (v) => v === null, 'null quand il y a déjà 5 profils'),
  ]),
  o.fn('titreVedette', (api) => [o.is(api, `titreVedette(${CATALOGUE}).id`, (v) => v === 't1', "le titre vedette (t1)")]),
  o.fn('titresParGenre', (api) => [
    o.is(api, `Object.keys(titresParGenre(${CATALOGUE})).sort().join(',')`, (v) => v === 'action,documentaire', "{ action: [...], documentaire: [...] }"),
    o.is(api, `titresParGenre(${CATALOGUE}).documentaire.length`, (v) => v === 2, '2 documentaires'),
  ]),
  o.fn('basculerMaListe', (api) => [
    o.is(api, `basculerMaListe(${PROFIL}, 't2').maListe.slice().sort().join(',')`, (v) => v === 't1,t2', 'ajoute t2'),
    o.is(api, `basculerMaListe(${PROFIL}, 't1').maListe.length`, (v) => v === 0, 'retire t1'),
    o.is(api, `(() => { const p = ${PROFIL}; basculerMaListe(p, 't2'); return p.maListe.length; })()`, (v) => v === 1, 'un nouveau profil : l\'original n\'est pas modifié'),
  ]),
  o.fn('estDansMaListe', (api) => [
    o.is(api, `estDansMaListe(${PROFIL}, 't1')`, (v) => v === true, 'true'),
    o.is(api, `estDansMaListe(${PROFIL}, 't3')`, (v) => v === false, 'false'),
  ]),
  o.fn('continuerARegarder', (api) => [o.is(api, `continuerARegarder(${PROFIL}, ${CATALOGUE}).map((t) => t.id).join(',')`, (v) => v === 't2', "seulement t2 (40 %) : t3 est terminé (100 %)")]),
  o.fn('rechercherTitres', (api) => [o.is(api, `rechercherTitres(${CATALOGUE}, 'FLEUVE').map((t) => t.id).join(',')`, (v) => v === 't2', "t2 (majuscules ignorées)")]),
  o.fn('filtrerParGenre', (api) => [
    o.is(api, `filtrerParGenre(${CATALOGUE}, 'action').map((t) => t.id).join(',')`, (v) => v === 't3', 't3'),
    o.is(api, `filtrerParGenre(${CATALOGUE}, '').length`, (v) => v === 3, "tout le catalogue pour ''"),
  ]),
];

const modele = (etat) => {
  const profils = Array.isArray(etat && etat.profils) ? etat.profils : [];
  const catalogue = Array.isArray(etat && etat.catalogue) ? etat.catalogue : [];
  return [
    o.modelCheck('`profils` est un tableau', Array.isArray(etat && etat.profils), 'L\'état sauvegardé doit contenir un tableau `profils`.'),
    o.modelCheck('Profils avec id unique', profils.length > 0 && profils.every(o.hasId) && o.unique(profils), 'Chaque profil doit avoir un `id` unique.'),
    o.modelCheck('Tableau imbriqué `maListe`', profils.length > 0 && profils.every((p) => Array.isArray(p.maListe)), 'Chaque profil doit avoir un tableau `maListe`.'),
    o.modelCheck('Dictionnaire `progression`', profils.length > 0 && profils.every((p) => o.isDict(p.progression)), 'Chaque profil doit avoir un objet dictionnaire `progression` `{ titreId: pourcentage }`.'),
    o.modelCheck('Catalogue', catalogue.length >= 18 && catalogue.every((t) => o.hasId(t) && 'titre' in t && 'genre' in t) && catalogue.some((t) => t.vedette), 'L\'état doit contenir `catalogue` (au moins 18 titres `{ id, titre, genre, … }`, dont un `vedette`).'),
  ];
};

module.exports = {
  id: 'streaming',
  demo: { item: 'profil', min: 2 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const nom = o.uid('Persistant');
      const id = await creerProfil(ctx, nom);
      await choisir(ctx, id);
      const titre = await premiereAffiche(ctx);
      await ouvrir(ctx, titre);
      await (await ctx.firstVisible(await ctx.needTest('ma-liste-basculer'))).click();
      await ctx.settle();
      await o.closeOverlays(ctx);
      return { id, nom, titre };
    },
    verifier: async (ctx, { id, nom, titre }) => {
      if ((await ctx.isVisible(ctx.t('ecran-profils'))) && !(await ctx.isVisible(ctx.t('catalogue')))) {
        if (!(await ctx.text(ctx.item('profil', id))).includes(nom)) return { ok: false, hint: 'Après rechargement, le profil créé a disparu : appelle `sauvegarder()` après chaque action.' };
        await choisir(ctx, id);
      }
      return { ok: (await dansRangee(ctx, 'rangee-ma-liste', titre)) > 0, hint: 'Après rechargement, « Ma liste » a perdu le titre ajouté : tout l\'état doit être sauvegardé.' };
    },
  },
  injection: async (ctx, payload) => {
    await ctx.fillAndSubmit(await formProfil(ctx), { nom: payload.slice(0, 60) });
    await o.closeOverlays(ctx);
    const ids = await ctx.ids('profil');
    if (ids.length > 0) {
      await choisir(ctx, ids[ids.length - 1]);
      if ((await ctx.t('recherche').count()) > 0) await o.search(ctx, payload);
    }
  },
};
