# Fiche 6 — Streaming, comme Netflix

`"sujet": "streaming"` · clé localStorage : `kadea-streaming` · démo : **au moins 2 profils**, et un catalogue d'au moins 18 titres sur au moins 4 genres.

Les affiches sont des dégradés CSS, des images libres de droits ou tes propres images : jamais les visuels protégés du produit d'origine.

## Modèle de données

```js
const etat = {
  profils: [
    {
      id: 'p-1',
      nom: 'Judah',
      couleur: '#e50914',
      maListe: ['t-3', 't-7'],        // tableau imbriqué : identifiants de titres
      progression: { 't-2': 40 },     // objet dictionnaire : titre → pourcentage regardé
    },
  ],
  profilActif: null,                  // id du profil choisi
  catalogue: [
    { id: 't-1', titre: 'Kin la belle', genre: 'documentaire', annee: 2024, duree: '52 min', description: '…', vedette: true },
  ],
};

const GENRES = { action: 'Action', comedie: 'Comédie', documentaire: 'Documentaire', drame: 'Drame' }; // dictionnaire
```

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `creerProfil(profils, nom)` | `{ id, nom, couleur, maListe: [], progression: {} }`, ou `null` si le nom est vide ou s'il y a déjà **5** profils |
| `titreVedette(catalogue)` | le titre mis en avant (avec `find`) |
| `titresParGenre(catalogue)` | un dictionnaire `{ action: [...], drame: [...] }` (avec `reduce`) |
| `basculerMaListe(profil, titreId)` | un **nouveau** profil avec le titre ajouté ou retiré de `maListe` |
| `estDansMaListe(profil, titreId)` | `true` / `false` (avec `some` ou `includes`) |
| `continuerARegarder(profil, catalogue)` | les titres dont la progression est entre 1 et 99 % |
| `rechercherTitres(catalogue, texte)` | les titres dont le titre contient le texte (sans tenir compte des majuscules) |
| `filtrerParGenre(catalogue, genre)` | les titres du genre (`''` = tous) |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Profils | écran `data-test="ecran-profils"` ; chaque `data-test="profil" data-id="…"` ; `<form data-test="form-profil">` avec `name="nom"` (bouton `profil-nouveau` s'il est caché ; création, et modification pré-remplie) ; boutons `profil-modifier`, `profil-supprimer` (après confirmation) ; 6e profil refusé avec `data-test="erreur"` |
| 2. Choisir | bouton `profil-choisir` (ou clic sur le profil) → `data-test="catalogue"` ; dans l'en-tête `data-test="profil-actif"` (nom du profil) et bouton `changer-profil` |
| 3. Bannière | `data-test="banniere"` avec le titre mis en avant |
| 4. Rangées | `data-test="rangee"` (une par genre) qui défilent horizontalement ; chaque affiche `data-test="affiche" data-id="…" data-genre="…"` |
| 5. Détail | clic ou Entrée sur une affiche → `data-test="modale"` avec le titre et la description ; fermeture par `fermer` ou Échap |
| 6. Ma liste | dans la modale, bouton `ma-liste-basculer` ; rangée `data-test="rangee-ma-liste"` ; une liste par profil |
| 7. Continuer | dans la modale, bouton `regarder` (ajoute de la progression) ; rangée `data-test="rangee-continuer"` avec `data-test="progression"` sur l'affiche |
| 8. Recherche | `data-test="recherche"` → `data-test="resultats"` en grille (`display: grid`) |
| 9. Genre | `<select data-test="filtre-genre">` (`value=""` = tous) : seules les affiches du genre restent visibles |
| 10. Animations | les affiches sont focusables ; au survol **et** au focus, une transformation animée (`transition` + `transform`) |
