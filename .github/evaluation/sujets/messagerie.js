'use strict';

const o = require('./_outils');

const DISCUSSIONS = o.fixture('DISCUSSIONS', `[
  { id: 'd1', nom: 'Grâce', numero: '+243 812 345 678', nonLus: 2, messages: [{ id: 'm1', auteur: 'contact', texte: 'Mbote', envoyeLe: 100, modifie: false }] },
  { id: 'd2', nom: 'Papa', numero: '0991234567', nonLus: 0, messages: [{ id: 'm2', auteur: 'moi', texte: 'On se voit au marché', envoyeLe: 300, modifie: false }] },
  { id: 'd3', nom: 'Nouveau', numero: '0822222222', nonLus: 1, messages: [] }
]`);

const formDiscussion = (ctx) => o.openForm(ctx, 'form-discussion', 'discussion-nouveau');
const creer = async (ctx, nom = o.uid('Ami')) => o.createOrFail(ctx, await formDiscussion(ctx), { nom, numero: '0812345678' }, 'discussion', 'La discussion');

const ouvrir = async (ctx, id) => {
  await o.closeOverlays(ctx);
  const item = ctx.item('discussion', id);
  await ctx.need(item, `\`[data-test="discussion"][data-id="${id}"]\``);
  const bouton = item.locator('[data-test="discussion-ouvrir"]');
  if ((await bouton.count()) > 0) await bouton.first().click();
  else await item.click({ position: { x: 10, y: 10 } });
  await ctx.settle();
};

const messages = (ctx) => ctx.vis(ctx.page.locator('[data-test="conversation"] [data-test="message"]'));
const formMessage = async (ctx) => ctx.firstVisible(await ctx.needTest('form-message'));

// Envoie un message et renvoie l'id du nouveau message « moi ».
const envoyer = async (ctx, texte, viaEntree = false) => {
  const avant = await ctx.ids('message');
  const form = await formMessage(ctx);
  const champ = form.locator('[name="texte"]').first();
  await champ.fill(texte);
  if (viaEntree) {
    await champ.press('Enter');
    await ctx.settle();
  } else await ctx.submit(form);
  return (await ctx.ids('message')).filter((id) => !avant.includes(id))[0] || null;
};

const attendre = (ctx, predicat, ms = 4000, arg = null) =>
  ctx.page
    .waitForFunction(predicat, arg, { timeout: ms })
    .then(() => true)
    .catch(() => false);

const fonctionnalites = [
  o.feature({
    id: 'F1',
    titre: 'Créer une discussion',
    crud: 'create',
    attrs: ['form-discussion', 'name="nom"', 'name="numero"', 'discussion'],
    ok: 'La discussion est créée ; un nom ou un numéro vide est refusé.',
    partielle: 'La création est incomplète : nom et numéro obligatoires, la discussion apparaît dans la liste.',
    scenario: async (ctx) => {
      const since = await ctx.mark();
      const nom = o.uid('Kalala');
      const id = await creer(ctx, nom);
      ctx.check('Discussion affichée', (await ctx.text(ctx.item('discussion', id))).includes(nom), 'Le nom de la discussion n\'apparaît pas dans la liste.');
      await o.notified(ctx, since, 'Création d\'une discussion');
      await o.refuse(ctx, await formDiscussion(ctx), { nom: '', numero: '0812345678' }, 'discussion', 'Nom vide refusé');
      await o.refuse(ctx, await formDiscussion(ctx), { nom: o.uid('Sans numéro'), numero: '' }, 'discussion', 'Numéro vide refusé');
    },
  }),
  o.feature({
    id: 'F2',
    titre: 'Discussions triées par dernier message',
    crud: 'read',
    attrs: ['liste-discussions', 'discussion', 'discussion-apercu', 'discussion-heure'],
    ok: 'La discussion du dernier message remonte en haut, avec l\'aperçu et l\'heure.',
    partielle: 'Le tri est incomplet : après un envoi, la discussion passe en haut avec l\'aperçu du message et son heure (HH:MM).',
    scenario: async (ctx) => {
      await ctx.needTest('liste-discussions');
      const ordre = await o.visibleIds(ctx, 'discussion');
      ctx.check('Plusieurs discussions', ordre.length >= 3, 'La démo doit contenir plusieurs discussions.');
      const derniere = ordre[ordre.length - 1];
      await ouvrir(ctx, derniere);
      const texte = o.uid('Remonte');
      await envoyer(ctx, texte);
      ctx.check('En haut de la liste', (await o.visibleIds(ctx, 'discussion'))[0] === derniere, 'Après un envoi, la discussion ne passe pas en haut de la liste.');
      const item = ctx.item('discussion', derniere);
      ctx.check('Aperçu', (await ctx.text(ctx.t('discussion-apercu', item))).includes(texte), '`discussion-apercu` n\'affiche pas le dernier message.');
      ctx.check('Heure', /\b\d{1,2}:\d{2}\b/.test(await ctx.text(ctx.t('discussion-heure', item))), '`discussion-heure` n\'affiche pas une heure au format HH:MM.');
    },
  }),
  o.feature({
    id: 'F3',
    titre: 'Bulles à droite et à gauche',
    attrs: ['conversation', 'message', 'data-auteur', 'message-heure'],
    ok: 'Mes messages sont à droite, ceux du contact à gauche, chacun avec son heure.',
    partielle: 'Les bulles sont incomplètes : `data-auteur="moi"` à droite, `data-auteur="contact"` à gauche, et `message-heure` dans chaque bulle.',
    scenario: async (ctx) => {
      const [id] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, id);
      await envoyer(ctx, o.uid('Ma bulle'));
      await attendre(ctx, () => document.querySelectorAll('[data-test="conversation"] [data-test="message"][data-auteur="contact"]').length > 0);
      const position = await ctx.page.evaluate(() => {
        const liste = document.querySelector('[data-test="liste-messages"]') || document.querySelector('[data-test="conversation"]');
        const box = liste.getBoundingClientRect();
        const milieu = box.left + box.width / 2;
        const centre = (el) => {
          const r = el.getBoundingClientRect();
          return r.left + r.width / 2;
        };
        const de = (auteur) => [...liste.querySelectorAll(`[data-test="message"][data-auteur="${auteur}"]`)].filter((el) => el.getClientRects().length > 0);
        const moi = de('moi');
        const contact = de('contact');
        return {
          moi: moi.length > 0 && moi.every((el) => centre(el) > milieu),
          contact: contact.length > 0 && contact.every((el) => centre(el) < milieu),
          heures: [...liste.querySelectorAll('[data-test="message"]')].every((el) => /\b\d{1,2}:\d{2}\b/.test((el.querySelector('[data-test="message-heure"]') || {}).textContent || '')),
        };
      });
      ctx.check('Mes messages à droite', position.moi, 'Les messages `data-auteur="moi"` doivent être alignés à droite.');
      ctx.check('Messages du contact à gauche', position.contact, 'Les messages `data-auteur="contact"` doivent être alignés à gauche.');
      ctx.check('Heure dans chaque bulle', position.heures, 'Chaque message doit contenir `message-heure` au format HH:MM.');
    },
  }),
  o.feature({
    id: 'F4',
    titre: 'Envoyer avec le bouton ou Entrée',
    attrs: ['form-message', 'name="texte"'],
    ok: 'Le message part avec le bouton et avec Entrée ; un message vide est refusé.',
    partielle: 'L\'envoi est incomplet : bouton, touche Entrée, et refus d\'un message vide.',
    scenario: async (ctx) => {
      const [id] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, id);
      const bouton = await envoyer(ctx, o.uid('Par le bouton'));
      ctx.check('Envoi par le bouton', bouton !== null && (await ctx.item('message', bouton).getAttribute('data-auteur')) === 'moi', 'Le bouton d\'envoi n\'ajoute pas de message `data-auteur="moi"`.');
      ctx.check('Envoi par Entrée', (await envoyer(ctx, o.uid('Par Entrée'), true)) !== null, 'La touche Entrée n\'envoie pas le message.');
      const avant = await messages(ctx).count();
      await envoyer(ctx, '   ');
      ctx.check('Message vide refusé', (await messages(ctx).count()) === avant, 'Un message vide (espaces) a été envoyé.');
    },
  }),
  o.feature({
    id: 'F5',
    titre: 'Défilement jusqu\'au dernier message',
    attrs: ['liste-messages'],
    ok: 'La conversation défile automatiquement jusqu\'au dernier message.',
    partielle: 'Le défilement est incomplet : `liste-messages` doit avoir son propre défilement vertical et descendre jusqu\'en bas après chaque envoi.',
    scenario: async (ctx) => {
      const [id] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, id);
      await ctx.needTest('liste-messages');
      for (let i = 0; i < 14; i += 1) await envoyer(ctx, `Message ${i} ${'du texte '.repeat(4)}`);
      await ctx.settle(300);
      const facts = await ctx.page.evaluate(() => {
        const el = document.querySelector('[data-test="liste-messages"]');
        return { deborde: el.scrollHeight > el.clientHeight + 5, enBas: el.scrollTop + el.clientHeight >= el.scrollHeight - 30 };
      });
      ctx.check('Zone à défilement', facts.deborde, '`liste-messages` ne défile pas : donne-lui une hauteur et `overflow-y: auto`.');
      ctx.check('En bas après l\'envoi', facts.deborde && facts.enBas, 'Après un envoi, la conversation ne défile pas jusqu\'au dernier message (`scrollTop = scrollHeight`).');
    },
  }),
  o.feature({
    id: 'F6',
    titre: 'Réponse automatique',
    attrs: ['ecrit', 'data-auteur="contact"'],
    ok: '« En train d\'écrire… » s\'affiche puis la réponse arrive.',
    partielle: 'La réponse automatique est incomplète : `ecrit` visible, puis un message `data-auteur="contact"` 1 à 3 s plus tard.',
    scenario: async (ctx) => {
      const [id] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, id);
      const avant = await ctx.page.locator('[data-test="message"][data-auteur="contact"]').count();
      await envoyer(ctx, 'Mbote !');
      ctx.check('« En train d\'écrire… »', await ctx.isVisible(ctx.t('ecrit')), '`[data-test="ecrit"]` n\'apparaît pas après l\'envoi.');
      const arrivee = await attendre(ctx, (n) => document.querySelectorAll('[data-test="message"][data-auteur="contact"]').length > n, 4500, avant);
      const recu = arrivee || (await ctx.page.locator('[data-test="message"][data-auteur="contact"]').count()) > avant;
      ctx.check('Réponse reçue', recu, 'Aucune réponse `data-auteur="contact"` dans les 4 secondes.');
      ctx.check('Indicateur masqué', !(await ctx.isVisible(ctx.t('ecrit'))), '`ecrit` reste affiché après la réponse.');
    },
  }),
  o.feature({
    id: 'F7',
    titre: 'Badge de non-lus',
    attrs: ['badge-non-lus'],
    ok: 'Le badge compte les messages reçus dans une discussion fermée et se remet à zéro à l\'ouverture.',
    partielle: 'Le badge est incomplet : +1 quand une réponse arrive dans une discussion fermée, 0 à l\'ouverture.',
    scenario: async (ctx) => {
      ctx.check('Non-lus de la démo', await ctx.isVisible(ctx.t('badge-non-lus')), 'Aucun `badge-non-lus` visible au premier lancement : la démo doit contenir des non-lus.');
      const [a, b] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, a);
      await envoyer(ctx, 'Tu es là ?');
      await ouvrir(ctx, b);
      await ctx.settle(3500);
      const badge = ctx.t('badge-non-lus', ctx.item('discussion', a));
      ctx.check('Badge incrémenté', (await ctx.isVisible(badge)) && (await ctx.number(badge)) >= 1, 'La réponse reçue pendant qu\'une autre discussion est ouverte n\'affiche pas de badge.');
      await ouvrir(ctx, a);
      ctx.check('Remis à zéro', !(await ctx.isVisible(badge)) || (await ctx.number(badge)) === 0, 'Le badge ne disparaît pas à l\'ouverture de la discussion.');
    },
  }),
  o.feature({
    id: 'F8',
    titre: 'Modifier, supprimer',
    crud: ['update', 'delete'],
    attrs: ['message-modifier', 'message-supprimer', 'discussion-supprimer', 'confirmation'],
    ok: 'Messages modifiés et supprimés ; la discussion est supprimée après confirmation.',
    partielle: 'Il manque une action : modifier un message, supprimer un message, ou supprimer une discussion après confirmation.',
    scenario: async (ctx) => {
      const id = await creer(ctx);
      await ouvrir(ctx, id);
      const message = await envoyer(ctx, o.uid('Avant'));
      ctx.check('Message envoyé', message !== null, 'Impossible d\'envoyer un message.');
      if (message === null) return;
      const nouveau = o.uid('Après');
      ctx.promptReply = nouveau;
      await ctx.action('message', message, 'message-modifier');
      ctx.promptReply = null;
      const form = ctx.vis(ctx.t('form-modifier'));
      if ((await form.count()) > 0) await ctx.fillAndSubmit(form.first(), { texte: nouveau });
      ctx.check('Message modifié', (await ctx.text(ctx.item('message', message))).includes(nouveau), 'Le message n\'affiche pas le texte modifié.');
      await ctx.confirm(() => ctx.action('message', message, 'message-supprimer'), true);
      ctx.check('Message supprimé', (await ctx.count(ctx.item('message', message))) === 0, 'Le message est toujours affiché après `message-supprimer`.');
      await o.closeOverlays(ctx);
      await o.deleteChecks(ctx, 'discussion', id, 'discussion-supprimer', 'Suppression de la discussion');
    },
  }),
  o.feature({
    id: 'F9',
    titre: 'Recherche en direct',
    attrs: ['recherche'],
    ok: 'La recherche filtre les discussions en direct.',
    partielle: 'La recherche est incomplète : par nom (sans tenir compte des majuscules), seules les discussions correspondantes restent.',
    scenario: async (ctx) => {
      const id = await creer(ctx, o.uid('Zorglub'));
      await o.search(ctx, 'zorglub');
      ctx.check('Résultats filtrés', o.sameSet(await o.visibleIds(ctx, 'discussion'), [id]), 'La recherche n\'affiche pas uniquement la discussion correspondante.');
      await o.search(ctx, 'xqzw-aucune-discussion');
      await o.emptyStateVisible(ctx, 'État vide (recherche sans résultat)');
    },
  }),
  o.feature({
    id: 'F10',
    titre: 'Mobile : une vue à la fois',
    viewport: { width: 375, height: 812 },
    attrs: ['liste-discussions', 'conversation', 'retour'],
    ok: 'Sur mobile, la liste et la conversation s\'affichent l\'une après l\'autre, avec un bouton retour.',
    partielle: 'L\'affichage mobile est incomplet : à 375 px, la liste OU la conversation, et `retour` pour revenir.',
    scenario: async (ctx) => {
      const liste = await ctx.needTest('liste-discussions');
      const conversation = ctx.t('conversation');
      ctx.check('Liste seule au départ', (await ctx.isVisible(liste)) && !(await ctx.isVisible(conversation)), 'À 375 px, seule la liste des discussions doit être visible au départ.');
      const [id] = await o.visibleIds(ctx, 'discussion');
      await ouvrir(ctx, id);
      ctx.check('Conversation seule', (await ctx.isVisible(conversation)) && !(await ctx.isVisible(liste)), 'À 375 px, ouvrir une discussion doit masquer la liste.');
      await (await ctx.firstVisible(await ctx.needTest('retour'))).click();
      await ctx.settle();
      ctx.check('Bouton retour', (await ctx.isVisible(liste)) && !(await ctx.isVisible(conversation)), 'Le bouton `retour` ne réaffiche pas la liste.');
    },
  }),
];

const fonctions = [
  o.fn('creerDonneesDemo', (api) => [o.is(api, 'creerDonneesDemo().discussions.length', (n) => n >= 5, 'au moins 5 discussions de démonstration')]),
  o.fn('creerDiscussion', (api) => [
    o.is(api, "creerDiscussion('Ali', '0812345678')", (v) => v && v.nom === 'Ali' && v.nonLus === 0 && Array.isArray(v.messages) && v.id !== undefined, "{ id, nom: 'Ali', numero, nonLus: 0, messages: [] }"),
    o.is(api, "creerDiscussion('', '0812345678')", (v) => v === null, 'null sans nom'),
    o.is(api, "creerDiscussion('Ali', '  ')", (v) => v === null, 'null sans numéro'),
  ]),
  o.fn('creerMessage', (api) => [
    o.is(api, "creerMessage(' Mbote ', 'moi')", (v) => v && v.texte === 'Mbote' && v.auteur === 'moi' && typeof v.envoyeLe === 'number' && v.modifie === false, "{ id, auteur: 'moi', texte: 'Mbote', envoyeLe, modifie: false }"),
    o.is(api, "creerMessage('   ', 'moi')", (v) => v === null, 'null pour un texte vide'),
  ]),
  o.fn('dernierMessage', (api) => [
    o.is(api, `dernierMessage(${DISCUSSIONS}[0]).id`, (v) => v === 'm1', "le dernier message (m1)"),
    o.is(api, `dernierMessage(${DISCUSSIONS}[2])`, (v) => v === undefined, 'undefined sans message'),
  ]),
  o.fn('trierDiscussions', (api) => [
    o.is(api, `trierDiscussions(${DISCUSSIONS}).map((d) => d.id).join(',')`, (v) => v === 'd2,d1,d3', "'d2,d1,d3' (sans message : à la fin)"),
    o.is(api, `(() => { const l = ${DISCUSSIONS}; trierDiscussions(l); return l[0].id; })()`, (v) => v === 'd1', 'une copie : le tableau d\'origine n\'est pas modifié'),
  ]),
  o.fn('formaterHeure', (api) => [o.is(api, 'formaterHeure(new Date(2026, 0, 1, 9, 5).getTime())', (v) => v === '09:05', "'09:05'")]),
  o.fn('choisirReponse', (api) => [
    o.is(api, "choisirReponse('MBOTE les amis') === REPONSES_AUTO.mbote", (v) => v === true, 'la réponse du mot-clé « mbote » (majuscules ignorées)'),
    o.is(api, "choisirReponse('Rien à voir') === REPONSES_AUTO.defaut", (v) => v === true, 'REPONSES_AUTO.defaut sinon'),
  ]),
  o.fn('totalNonLus', (api) => [o.is(api, `totalNonLus(${DISCUSSIONS})`, (v) => v === 3, '3')]),
  o.fn('rechercherDiscussions', (api) => [
    o.is(api, `rechercherDiscussions(${DISCUSSIONS}, 'MARCHÉ').map((d) => d.id).join(',')`, (v) => v === 'd2', "'d2' (texte d'un message, majuscules ignorées)"),
    o.is(api, `rechercherDiscussions(${DISCUSSIONS}, 'grâce').map((d) => d.id).join(',')`, (v) => v === 'd1', "'d1' (nom)"),
  ]),
];

const modele = (etat) => {
  const discussions = Array.isArray(etat && etat.discussions) ? etat.discussions : [];
  const msgs = discussions.flatMap((d) => (Array.isArray(d.messages) ? d.messages : []));
  return [
    o.modelCheck('`discussions` est un tableau', Array.isArray(etat && etat.discussions), 'L\'état sauvegardé doit contenir un tableau `discussions`.'),
    o.modelCheck('Chaque discussion a un id unique', discussions.length > 0 && discussions.every(o.hasId) && o.unique(discussions), 'Chaque discussion doit avoir un `id` unique.'),
    o.modelCheck('Champs de la discussion', discussions.length > 0 && discussions.every((d) => 'nom' in d && 'numero' in d && typeof d.nonLus === 'number' && Array.isArray(d.messages)), 'Chaque discussion doit avoir `nom`, `numero`, `nonLus` (nombre) et un tableau imbriqué `messages`.'),
    o.modelCheck('Messages', msgs.length > 0 && msgs.every((m) => o.hasId(m) && ['moi', 'contact'].includes(m.auteur) && typeof m.texte === 'string' && typeof m.envoyeLe === 'number'), 'Chaque message doit avoir `id`, `auteur` (moi / contact), `texte` et `envoyeLe` (Date.now()).'),
  ];
};

module.exports = {
  id: 'messagerie',
  demo: { item: 'discussion', min: 5 },
  fonctionnalites,
  fonctions,
  modele,
  persistance: {
    agir: async (ctx) => {
      const nom = o.uid('Persistante');
      const id = await creer(ctx, nom);
      await ouvrir(ctx, id);
      const texte = o.uid('Message conservé');
      await envoyer(ctx, texte);
      return { id, nom, texte };
    },
    verifier: async (ctx, { id, nom, texte }) => {
      if (!(await ctx.text(ctx.item('discussion', id))).includes(nom)) return { ok: false, hint: 'Après rechargement, la discussion créée a disparu : appelle `sauvegarder()` après chaque action.' };
      await ouvrir(ctx, id);
      return { ok: (await ctx.text(ctx.t('conversation'))).includes(texte), hint: 'Après rechargement, le message envoyé a disparu : tout l\'état doit être sauvegardé.' };
    },
  },
  injection: async (ctx, payload) => {
    const id = await o.create(ctx, await formDiscussion(ctx), { nom: payload, numero: '0812345678' }, 'discussion');
    if (id) {
      await ouvrir(ctx, id);
      await envoyer(ctx, payload);
    }
  },
};
