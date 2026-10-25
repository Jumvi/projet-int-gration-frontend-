'use strict';

const o = require('./_outils');

const CONTACTS = o.fixture('CONTACTS', `[
  { id: 'a', prenom: 'Grâce', nom: 'Mbuyi', telephone: '+243 812 345 678', email: 'grace@exemple.cd', favori: true, etiquettes: ['e-1', 'e-2'] },
  { id: 'b', prenom: 'élodie', nom: 'Kasa', telephone: '0991234567', email: '', favori: false, etiquettes: ['e-1'] },
  { id: 'c', prenom: 'Amani', nom: 'Lukusa', telephone: '0822222222', email: 'amani@kin.cd', favori: false, etiquettes: [] }
]`);
const prenoms = (v) => (Array.isArray(v) ? v.map((c) => c.prenom).join(',') : null);

const VALIDE = () => ({ prenom: o.uid('Zoé'), nom: 'Kabeya', telephone: '0812345678', email: 'zoe@exemple.cd' });

const formulaire = (ctx) => o.openForm(ctx, 'form-contact', 'contact-nouveau');
const nouveau = async (ctx, valeurs = {}) => o.createOrFail(ctx, await formulaire(ctx), { ...VALIDE(), ...valeurs }, 'contact', 'Le contact');
const chiffres = (texte) => texte.replace(/\D/g, '').slice(-9);

const ouvrirFiche = async (ctx, id) => {
  await o.closeOverlays(ctx);
  const item = ctx.item('contact', id);
  await item.scrollIntoViewIfNeeded().catch(() => {});
  const bouton = item.locator('[data-test="contact-ouvrir"]');
  if ((await bouton.count()) > 0) await bouton.first().click();
  else await item.click({ position: { x: 5, y: 5 } });
  await ctx.settle();
  return ctx.firstVisible(await ctx.needTest('fiche', '`[data-test="fiche"]`'));
};

const nomsAffiches = (ctx) =>
  ctx.page.$$eval('[data-test="contact"]', (els) =>
    els.filter((el) => el.getClientRects().length > 0).map((el) => (el.querySelector('[data-test="contact-nom"]') || el).textContent.trim()),
  );

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Créer un contact validé',
    crud: 'create',
    attrs: ['form-contact', 'name="prenom"', 'name="telephone"', 'name="email"', 'erreur'],
    ok: 'Contact créé ; prénom vide, téléphone non congolais et e-mail invalide sont refusés avec un message.',
    partielle: 'La validation est incomplète : prénom obligatoire, téléphone congolais (+243 ou 0, puis 8 ou 9 et 8 chiffres), e-mail valide s\'il est rempli.',
    scenario: async (ctx) => {
      const since = await ctx.mark();
      const id = await nouveau(ctx);
      ctx.check('Contact affiché', await ctx.isVisible(ctx.item('contact', id)), 'Le contact créé n\'est pas affiché dans la liste.');
      await o.notified(ctx, since, 'Création d\'un contact');
      ctx.check('Format +243 accepté', (await o.create(ctx, await formulaire(ctx), { ...VALIDE(), telephone: '+243 991 234 567', email: '' }, 'contact')) !== null, '« +243 991 234 567 » (sans e-mail) doit être accepté.');
      await o.refuse(ctx, await formulaire(ctx), { ...VALIDE(), prenom: '' }, 'contact', 'Prénom vide refusé');
      await o.refuse(ctx, await formulaire(ctx), { ...VALIDE(), telephone: '0712345678' }, 'contact', 'Téléphone non congolais refusé');
      await o.refuse(ctx, await formulaire(ctx), { ...VALIDE(), telephone: '081234' }, 'contact', 'Téléphone trop court refusé');
      await o.refuse(ctx, await formulaire(ctx), { ...VALIDE(), email: 'pas-un-email' }, 'contact', 'E-mail invalide refusé');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Liste alphabétique avec séparateurs',
    crud: 'read',
    attrs: ['contact', 'contact-nom', 'separateur-lettre'],
    ok: 'La liste est triée par ordre alphabétique avec un séparateur par lettre.',
    partielle: 'Le tri ou les séparateurs sont incomplets : ordre alphabétique (localeCompare) et un `separateur-lettre` par première lettre.',
    scenario: async (ctx) => {
      await ctx.needTest('contact');
      await nouveau(ctx, { prenom: 'Aaron', nom: o.uid('Abedi') });
      await o.closeOverlays(ctx);
      const noms = await nomsAffiches(ctx);
      const trie = noms.every((n, i) => i === 0 || noms[i - 1].localeCompare(n, 'fr', { sensitivity: 'base' }) <= 0);
      ctx.check('Ordre alphabétique', noms.length >= 2 && trie, `Contacts affichés dans le désordre : ${noms.slice(0, 5).join(', ')}…`);
      ctx.check('Nouveau contact en tête', noms[0] && noms[0].startsWith('Aaron'), '« Aaron » devrait apparaître en premier.');
      const separateurs = await ctx.page.$$eval('[data-test="separateur-lettre"]', (els) => els.filter((e) => e.getClientRects().length > 0).map((e) => e.textContent.trim().toUpperCase()));
      const lettres = [...new Set(noms.map((n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()))];
      ctx.check('Un séparateur par lettre', separateurs.length === lettres.length && lettres.every((l) => separateurs.includes(l)), `Séparateurs ${separateurs.join(' ') || 'absents'} pour les lettres ${lettres.join(' ')}.`);
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'Avatar avec initiales',
    attrs: ['avatar'],
    ok: 'Chaque contact a un avatar avec ses initiales, sur une couleur calculée et stable.',
    partielle: 'L\'avatar est incomplet : initiales (prénom + nom) et une couleur calculée, identique après rechargement.',
    scenario: async (ctx) => {
      const id = await nouveau(ctx, { prenom: 'Mireille', nom: 'Tshala' });
      await o.closeOverlays(ctx);
      const avatar = ctx.t('avatar', ctx.item('contact', id));
      await ctx.need(avatar, '`[data-test="avatar"]` dans le contact');
      ctx.check('Initiales', (await ctx.text(avatar)).replace(/\s/g, '').toUpperCase() === 'MT', `L'avatar affiche « ${await ctx.text(avatar)} » au lieu de « MT ».`);
      const couleur = await avatar.first().evaluate((el) => getComputedStyle(el).backgroundColor);
      ctx.check('Fond coloré', !/rgba\(0, 0, 0, 0\)|transparent/.test(couleur), 'L\'avatar n\'a pas de couleur de fond.');
      const couleurs = await ctx.page.$$eval('[data-test="avatar"]', (els) => new Set(els.map((e) => getComputedStyle(e).backgroundColor)).size);
      ctx.check('Couleur calculée', couleurs >= 2, 'Tous les avatars ont la même couleur : calcule-la à partir du nom.');
      await ctx.reload();
      const apres = await ctx.t('avatar', ctx.item('contact', id)).first().evaluate((el) => getComputedStyle(el).backgroundColor);
      ctx.check('Couleur stable', apres === couleur, 'La couleur de l\'avatar change au rechargement : elle doit être calculée, pas tirée au hasard.');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Fiche détaillée',
    attrs: ['contact-ouvrir', 'fiche'],
    ok: 'La fiche détaillée affiche le téléphone et l\'e-mail du contact.',
    partielle: 'La fiche est incomplète : elle doit s\'ouvrir et afficher le téléphone et l\'e-mail.',
    scenario: async (ctx) => {
      const email = `${o.uid('fiche').replace(/\s/g, '').toLowerCase()}@exemple.cd`;
      const id = await nouveau(ctx, { telephone: '0897654321', email });
      const fiche = await ouvrirFiche(ctx, id);
      const texte = await fiche.innerText();
      ctx.check('Téléphone affiché', chiffres(texte).includes('897654321') || texte.replace(/\D/g, '').includes('897654321'), 'La fiche n\'affiche pas le téléphone du contact.');
      ctx.check('E-mail affiché', texte.includes(email), 'La fiche n\'affiche pas l\'e-mail du contact.');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Modifier un contact',
    crud: 'update',
    attrs: ['contact-modifier', 'form-contact'],
    ok: 'Le formulaire est pré-rempli, la validation est appliquée et la modification enregistrée.',
    partielle: 'La modification est incomplète : formulaire pré-rempli, même validation qu\'à la création, liste mise à jour.',
    scenario: async (ctx) => {
      const prenom = o.uid('Avant');
      const id = await nouveau(ctx, { prenom });
      await ctx.action('contact', id, 'contact-modifier');
      const form = await ctx.firstVisible(await ctx.needTest('form-contact'));
      ctx.check('Formulaire pré-rempli', (await form.locator('[name="prenom"]').first().inputValue()) === prenom, 'Le champ `prenom` n\'est pas pré-rempli avec le contact.');
      await ctx.fillAndSubmit(form, { telephone: '12' });
      ctx.check('Validation à la modification', (await ctx.text(ctx.item('contact', id))).includes(prenom) && (await ctx.refused(form)), 'Un téléphone invalide est accepté à la modification.');
      const nouveauPrenom = o.uid('Après');
      const since = await ctx.mark();
      await ctx.fillAndSubmit(await ctx.firstVisible(ctx.t('form-contact')), { prenom: nouveauPrenom, telephone: '0811111111' });
      await o.closeOverlays(ctx);
      ctx.check('Contact mis à jour', (await ctx.text(ctx.item('contact', id))).includes(nouveauPrenom), 'Le contact n\'affiche pas le prénom modifié.');
      ctx.check('Pas de doublon', (await ctx.count(ctx.page.locator(`[data-test="contact"][data-id="${id}"]`))) === 1, 'La modification a créé un doublon.');
      await o.notified(ctx, since, 'Modification');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Supprimer après confirmation',
    crud: 'delete',
    attrs: ['contact-supprimer', 'confirmation'],
    ok: 'La suppression demande une confirmation ; annuler conserve le contact.',
    partielle: 'La suppression est incomplète : confirmation obligatoire, « annuler » conserve, « confirmer » supprime.',
    scenario: async (ctx) => {
      const id = await nouveau(ctx);
      await o.closeOverlays(ctx);
      await o.deleteChecks(ctx, 'contact', id, 'contact-supprimer', 'Suppression du contact');
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Favoris',
    attrs: ['contact-favori', 'vue-favoris', 'vue-tous'],
    ok: 'Le favori s\'ajoute, se retire, et la vue Favoris n\'affiche que les favoris.',
    partielle: 'Les favoris sont incomplets : `contact-favori` bascule, la vue Favoris n\'affiche que les favoris.',
    scenario: async (ctx) => {
      const fav = await nouveau(ctx);
      const autre = await nouveau(ctx);
      await o.closeOverlays(ctx);
      await ctx.action('contact', fav, 'contact-favori');
      await o.navigate(ctx, 'vue-favoris');
      const visibles = await o.visibleIds(ctx, 'contact');
      ctx.check('Vue Favoris', visibles.includes(fav) && !visibles.includes(autre), 'La vue Favoris n\'affiche pas uniquement les favoris.');
      await ctx.action('contact', fav, 'contact-favori');
      await o.closeOverlays(ctx);
      ctx.check('Retirer des favoris', !(await o.visibleIds(ctx, 'contact')).includes(fav), 'Après un second clic sur `contact-favori`, le contact reste dans la vue Favoris.');
      await o.navigate(ctx, 'vue-tous');
      ctx.check('Vue Tous', (await o.visibleIds(ctx, 'contact')).includes(autre), 'La vue Tous n\'affiche pas tous les contacts.');
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Étiquettes et filtre',
    attrs: ['form-etiquette', 'filtre-etiquette', 'name="etiquettes"'],
    ok: 'L\'étiquette est créée, attribuée au contact et le filtre fonctionne.',
    partielle: 'Les étiquettes sont incomplètes : créer, cocher dans `form-contact`, puis filtrer.',
    scenario: async (ctx) => {
      const nom = o.uid('Étiq');
      await ctx.fillAndSubmit(await o.openForm(ctx, 'form-etiquette', 'etiquette-nouveau'), { nom });
      const filtre = ctx.page.locator('[data-test="filtre-etiquette"]', { hasText: nom }).first();
      await ctx.need(filtre, `Filtre \`filtre-etiquette\` « ${nom} »`);
      const etiquetteId = await filtre.getAttribute('data-id');
      const avec = await nouveau(ctx, { etiquettes: etiquetteId });
      const sans = await nouveau(ctx);
      await o.closeOverlays(ctx);
      await filtre.click();
      await ctx.settle();
      const visibles = await o.visibleIds(ctx, 'contact');
      ctx.check('Filtre par étiquette', visibles.includes(avec) && !visibles.includes(sans), 'Le filtre n\'affiche pas uniquement les contacts portant l\'étiquette.');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Recherche en direct',
    attrs: ['recherche'],
    ok: 'La recherche trouve un contact par son nom, son téléphone ou son e-mail.',
    partielle: 'La recherche est incomplète : nom, téléphone (espaces ignorés) et e-mail.',
    scenario: async (ctx) => {
      const id = await nouveau(ctx, { prenom: 'Zéphyrin', nom: o.uid('Ngoy'), telephone: '0998 877 665', email: 'unique.zz@exemple.cd' });
      await o.closeOverlays(ctx);
      await o.search(ctx, 'zéphyrin');
      ctx.check('Par nom', o.sameSet(await o.visibleIds(ctx, 'contact'), [id]), 'Rechercher le prénom n\'affiche pas uniquement le contact.');
      await o.search(ctx, '0998877');
      ctx.check('Par téléphone', o.sameSet(await o.visibleIds(ctx, 'contact'), [id]), 'Rechercher « 0998877 » ne trouve pas le téléphone « 0998 877 665 » (ignore les espaces).');
      await o.search(ctx, 'UNIQUE.ZZ');
      ctx.check('Par e-mail', o.sameSet(await o.visibleIds(ctx, 'contact'), [id]), 'Rechercher l\'e-mail (en majuscules) ne trouve pas le contact.');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Compteurs et état vide',
    attrs: ['compteur', 'compteur-etiquette', 'etat-vide'],
    ok: 'Le total, le nombre par étiquette et l\'état vide sont justes.',
    partielle: 'Les compteurs sont incomplets : total des contacts affichés, nombre par étiquette calculé, et `etat-vide`.',
    scenario: async (ctx) => {
      await ctx.needTest('compteur');
      await o.counterMatches(ctx, 'contact', 'Total des contacts');
      const filtre = ctx.t('filtre-etiquette').first();
      await ctx.need(filtre, '`[data-test="filtre-etiquette"]`');
      const etiquetteId = await filtre.getAttribute('data-id');
      const parEtiquette = () => ctx.number(ctx.t('compteur-etiquette', ctx.page.locator(`[data-test="filtre-etiquette"][data-id="${etiquetteId}"]`)));
      const avant = await parEtiquette();
      await nouveau(ctx, { etiquettes: etiquetteId });
      await o.closeOverlays(ctx);
      ctx.check('Nombre par étiquette recalculé', avant !== null && (await parEtiquette()) === avant + 1, `\`compteur-etiquette\` passe de ${avant} à ${await parEtiquette()} après l'ajout d'un contact étiqueté.`);
      await o.counterMatches(ctx, 'contact', 'Total après un ajout');
      await ctx.page.locator(`[data-test="filtre-etiquette"][data-id="${etiquetteId}"]`).first().click();
      await ctx.settle();
      ctx.check('Nombre par étiquette = contacts filtrés', (await o.visibleIds(ctx, 'contact')).length === (await parEtiquette()), 'Le nombre affiché pour l\'étiquette ne correspond pas aux contacts filtrés.');
      await o.navigate(ctx, 'vue-tous');
      await o.search(ctx, 'xqzw-aucun-contact');
      await o.counterMatches(ctx, 'contact', 'Compteur à zéro');
      await o.emptyStateVisible(ctx, 'État vide (recherche sans résultat)');
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [o.is(api, 'creerDonneesDemo().contacts.length', (n) => n >= 8, 'au moins 8 contacts de démonstration')]),
  o.fn('validerContact', (api) => [
    o.is(api, "Object.keys(validerContact({ prenom: '', nom: '', telephone: '123', email: 'x' })).sort().join(',')", (v) => v === 'email,prenom,telephone', 'les 3 erreurs : prenom, telephone, email'),
    o.is(api, "validerContact({ prenom: 'Ali', nom: '', telephone: '0812345678', email: '' })", (v) => v && Object.keys(v).length === 0, '{} pour un contact valide sans e-mail'),
  ]),
  o.fn('estTelephoneCongolais', (api) => [
    o.is(api, "estTelephoneCongolais('+243 812 345 678')", (v) => v === true, 'true pour +243 812 345 678'),
    o.is(api, "estTelephoneCongolais('099-123-4567')", (v) => v === true, 'true pour 099-123-4567 (tirets ignorés)'),
    o.is(api, "estTelephoneCongolais('0712345678')", (v) => v === false, 'false : après le 0, un 8 ou un 9'),
    o.is(api, "estTelephoneCongolais('+24381234567')", (v) => v === false, 'false : il manque un chiffre'),
  ]),
  o.fn('initiales', (api) => [
    o.is(api, "initiales({ prenom: 'grâce', nom: 'mbuyi' })", (v) => v === 'GM', "'GM'"),
    o.is(api, "initiales({ prenom: 'Zoé', nom: '' })", (v) => v === 'Z', "'Z' sans nom"),
  ]),
  o.fn('couleurAvatar', (api) => [
    o.is(api, "couleurAvatar({ prenom: 'Ana', nom: 'K' }) === couleurAvatar({ prenom: 'Ana', nom: 'K' }) && typeof couleurAvatar({ prenom: 'Ana', nom: 'K' })", (v) => v === 'string', 'la même couleur (chaîne) pour le même contact'),
  ]),
  o.fn('trierContacts', (api) => [
    o.is(api, `trierContacts(${CONTACTS})`, (v) => prenoms(v) === 'Amani,élodie,Grâce', 'Amani, élodie, Grâce (sans tenir compte des majuscules)'),
    o.is(api, `(() => { const l = ${CONTACTS}; trierContacts(l); return l[0].prenom; })()`, (v) => v === 'Grâce', 'une copie : le tableau d\'origine n\'est pas modifié'),
  ]),
  o.fn('grouperParLettre', (api) => [
    o.is(api, `Object.keys(grouperParLettre(${CONTACTS})).sort().join(',')`, (v) => v === 'A,E,G', "les lettres A, E (é sans accent), G"),
    o.is(api, `grouperParLettre(${CONTACTS}).G.length`, (v) => v === 1, 'un contact sous G'),
  ]),
  o.fn('rechercherContacts', (api) => [
    o.is(api, `rechercherContacts(${CONTACTS}, '812345')`, (v) => prenoms(v) === 'Grâce', 'Grâce (téléphone, espaces ignorés)'),
    o.is(api, `rechercherContacts(${CONTACTS}, 'KIN.CD')`, (v) => prenoms(v) === 'Amani', 'Amani (e-mail, majuscules ignorées)'),
    o.is(api, `rechercherContacts(${CONTACTS}, 'grâce mb')`, (v) => prenoms(v) === 'Grâce', 'Grâce (prénom + nom)'),
  ]),
  o.fn('compterParEtiquette', (api) => [
    o.is(api, `compterParEtiquette(${CONTACTS})`, (v) => v && v['e-1'] === 2 && v['e-2'] === 1, "{ 'e-1': 2, 'e-2': 1 }"),
  ]),
];

const modele = (etat) => {
  const contacts = Array.isArray(etat && etat.contacts) ? etat.contacts : [];
  return [
    o.modelCheck('`contacts` est un tableau', Array.isArray(etat && etat.contacts), 'L\'état sauvegardé doit contenir un tableau `contacts`.'),
    o.modelCheck('Chaque contact a un id unique', contacts.length > 0 && contacts.every(o.hasId) && o.unique(contacts), 'Chaque contact doit avoir un `id` unique.'),
    o.modelCheck('Champs de la fiche', contacts.length > 0 && contacts.every((c) => 'prenom' in c && 'nom' in c && 'telephone' in c && 'email' in c && typeof c.favori === 'boolean'), 'Chaque contact doit avoir `prenom`, `nom`, `telephone`, `email` et `favori` (booléen).'),
    o.modelCheck('Tableau imbriqué `etiquettes`', contacts.length > 0 && contacts.every((c) => Array.isArray(c.etiquettes)), 'Chaque contact doit avoir un tableau `etiquettes`.'),
    o.modelCheck('Dictionnaire `etiquettes`', o.isDict(etat && etat.etiquettes) && Object.values(etat.etiquettes).every((e) => e && 'nom' in e), '`etat.etiquettes` doit être un objet dictionnaire `{ id: { id, nom } }`.'),
  ];
};

module.exports = {
  id: 'contacts',
  demo: { item: 'contact', min: 8 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const prenom = o.uid('Persistant');
      const id = await nouveau(ctx, { prenom });
      await o.closeOverlays(ctx);
      await ctx.action('contact', id, 'contact-favori');
      return { id, prenom };
    },
    verifier: async (ctx, { id, prenom }) => {
      const present = (await ctx.text(ctx.item('contact', id))).includes(prenom);
      if (!present) return { ok: false, hint: 'Après rechargement, le contact créé a disparu : appelle `sauvegarder()` après chaque action.' };
      await o.navigate(ctx, 'vue-favoris');
      const favori = (await o.visibleIds(ctx, 'contact')).includes(id);
      return { ok: favori, hint: 'Après rechargement, le contact n\'est plus en favori : tout l\'état doit être sauvegardé.' };
    },
  },
  injection: async (ctx, payload) => {
    await ctx.fillAndSubmit(await formulaire(ctx), { ...VALIDE(), prenom: payload, nom: payload });
    await o.closeOverlays(ctx);
    if ((await ctx.t('form-etiquette').count()) > 0) await ctx.fillAndSubmit(await o.openForm(ctx, 'form-etiquette', 'etiquette-nouveau'), { nom: payload });
  },
};
