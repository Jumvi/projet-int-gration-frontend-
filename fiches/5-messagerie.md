# Fiche 5 — Messagerie, comme WhatsApp Web

`"sujet": "messagerie"` · clé localStorage : `kadea-messagerie` · démo : **au moins 5 discussions** avec des messages, dont au moins 1 avec des non-lus.

## Modèle de données

```js
const etat = {
  discussions: [
    {
      id: 'd-1',
      nom: 'Grâce',
      numero: '+243 812 345 678',
      nonLus: 2,
      messages: [                         // tableau imbriqué
        { id: 'm-1', auteur: 'contact', texte: 'Mbote !', envoyeLe: 1761400000000, modifie: false },
        { id: 'm-2', auteur: 'moi', texte: 'Sango nini ?', envoyeLe: 1761400060000, modifie: false },
      ],
    },
  ],
  discussionActive: null,                 // id de la discussion ouverte
};

const REPONSES_AUTO = {                    // objet dictionnaire : mot-clé → réponse
  mbote: 'Mbote ! Ça va ?',
  merci: 'Avec plaisir 🙂',
  defaut: 'Bien reçu, je te réponds vite.',
};
```

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `creerDiscussion(nom, numero)` | `{ id, nom, numero, nonLus: 0, messages: [] }` ou `null` si le nom ou le numéro est vide |
| `creerMessage(texte, auteur)` | `{ id, auteur, texte, envoyeLe, modifie: false }` ou `null` si le texte est vide après `trim` |
| `dernierMessage(discussion)` | le dernier message ou `undefined` |
| `trierDiscussions(discussions)` | une **copie** triée par date du dernier message, la plus récente en premier (sans message : à la fin) |
| `formaterHeure(timestamp)` | `'09:05'` |
| `choisirReponse(texte)` | la réponse de `REPONSES_AUTO` dont le mot-clé apparaît dans le texte (sans tenir compte des majuscules), sinon `REPONSES_AUTO.defaut` |
| `totalNonLus(discussions)` | la somme des non-lus (avec `reduce`) |
| `rechercherDiscussions(discussions, texte)` | les discussions dont le nom, le numéro ou un message contient le texte |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Créer | `<form data-test="form-discussion">` avec `name="nom"` et `name="numero"` |
| 2. Liste triée | `data-test="liste-discussions"` ; `data-test="discussion" data-id="…"` (clic ou bouton `discussion-ouvrir` pour l'ouvrir) avec `discussion-apercu` et `discussion-heure` ; la discussion du dernier message en haut |
| 3. Bulles | `data-test="conversation"` contenant `data-test="liste-messages"` (zone à défilement vertical) ; chaque `data-test="message" data-id="…"` porte `data-auteur="moi"` (à droite) ou `data-auteur="contact"` (à gauche) et contient `data-test="message-heure"` |
| 4. Envoyer | `<form data-test="form-message">` avec `name="texte"` : bouton ou touche Entrée ; message vide refusé |
| 5. Défilement | `liste-messages` défile jusqu'au dernier message après l'ouverture et chaque envoi |
| 6. Réponse auto | `data-test="ecrit"` (« en train d'écrire… ») visible, puis la réponse arrive **entre 1 et 3 secondes** après l'envoi, dans la discussion d'origine |
| 7. Non-lus | `data-test="badge-non-lus"` dans la discussion ; une réponse reçue dans une discussion fermée l'incrémente ; remis à zéro à l'ouverture |
| 8. Modifier / supprimer | boutons `message-modifier` (ouvre `<form data-test="form-modifier">` avec `name="texte"`, ou `prompt()`) et `message-supprimer` ; bouton `discussion-supprimer` après confirmation |
| 9. Recherche | `data-test="recherche"` dans les discussions |
| 10. Mobile | à 375 px, une seule vue à la fois (`liste-discussions` **ou** `conversation`) ; bouton `data-test="retour"` |
