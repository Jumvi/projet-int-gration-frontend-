# Fiche 1 — Notes, comme Google Keep

`"sujet": "notes"` · clé localStorage : `kadea-notes` · démo : **au moins 6 notes**, dont 1 épinglée et 1 archivée, et 2 étiquettes.

## Modèle de données

```js
const etat = {
  notes: [
    {
      id: 'n-1',                 // chaîne unique
      titre: 'Courses',
      contenu: 'Pain, lait, sombe',
      couleur: 'jaune',          // une clé de COULEURS
      epinglee: false,
      statut: 'active',          // 'active' | 'archivee' | 'corbeille'
      etiquettes: ['e-1'],       // tableau imbriqué : identifiants d'étiquettes
      creeLe: 1761400000000,     // Date.now()
    },
  ],
  etiquettes: {                  // objet dictionnaire : identifiant → étiquette
    'e-1': { id: 'e-1', nom: 'Maison' },
  },
};

const COULEURS = { defaut: '#ffffff', jaune: '#fff8b8', vert: '#ccff90', bleu: '#cbf0f8', rose: '#fdcfe8', violet: '#d7aefb' };
```

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `creerNote(saisie)` | une note `{ id, titre, contenu, couleur: 'defaut', epinglee: false, statut: 'active', etiquettes: [], creeLe }` avec titre et contenu nettoyés (`trim`), ou **`null`** si les deux sont vides |
| `trouverNote(notes, id)` | la note ou `undefined` |
| `filtrerNotes(notes, vue, etiquetteId, recherche)` | les notes de la vue (`'notes'` = statut active, `'archives'`, `'corbeille'`), portant l'étiquette si `etiquetteId` n'est pas vide, dont le titre **ou** le contenu contient `recherche` (sans tenir compte des majuscules) |
| `compterParVue(notes)` | `{ notes: 4, archives: 1, corbeille: 0 }` (avec `reduce`) |
| `utiliseEtiquette(notes, etiquetteId)` | `true` si au moins une note porte l'étiquette (avec `some`) |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Créer | `<form data-test="form-note">` avec les champs `name="titre"` et `name="contenu"` |
| 2. Grille | chaque carte `data-test="note" data-id="…"` ; cartes de hauteurs différentes, sur plusieurs colonnes à 1280 px |
| 3. Modifier | bouton `note-modifier` → `<dialog data-test="modale">` contenant `<form data-test="form-modifier">` avec `titre`, `contenu`, `couleur` |
| 4. Couleur | dans `form-modifier`, `name="couleur"` : un `<select>` ou des boutons radio, **au moins 6** valeurs ; la carte prend la couleur |
| 5. Épingler | bouton `note-epingler` ; sections `data-test="notes-epinglees"` (en haut) et `data-test="notes-autres"` |
| 6. Archiver | boutons `note-archiver` et `note-restaurer` ; navigation `vue-notes`, `vue-archives` |
| 7. Corbeille | boutons `note-corbeille`, `note-restaurer`, `note-supprimer` (suppression définitive après confirmation) ; navigation `vue-corbeille` |
| 8. Étiquettes | `<form data-test="form-etiquette">` avec `name="nom"` ; filtres `data-test="filtre-etiquette" data-id="…"` ; dans `form-modifier`, des cases `name="etiquettes" value="<id de l'étiquette>"` |
| 9. Recherche | `data-test="recherche"` : titre **et** contenu |
| 10. Compteur et état vide | `data-test="compteur"` (nombre de notes affichées dans la vue) et `data-test="etat-vide"` dans chaque vue |
