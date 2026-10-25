# Fiche 3 — Tableau de projet, comme Trello

`"sujet": "tableau"` · clé localStorage : `kadea-tableau` · démo : **exactement 3 colonnes** et au moins 6 cartes, dont 1 en retard et 1 avec des sous-tâches.

## Modèle de données

```js
const etat = {
  colonnes: [
    {
      id: 'col-1',
      titre: 'À faire',
      cartes: [                       // tableau imbriqué
        {
          id: 'c-1',
          titre: 'Maquette mobile',
          description: '',
          echeance: '2026-11-02',      // 'AAAA-MM-JJ' ou ''
          etiquettes: ['rouge'],       // clés de ETIQUETTES
          sousTaches: [{ id: 's-1', texte: 'Accueil', faite: true }],
        },
      ],
    },
  ],
};

const ETIQUETTES = {                    // objet dictionnaire
  rouge: { nom: 'Urgent', couleur: '#eb5a46' },
  vert: { nom: 'Fait', couleur: '#61bd4f' },
  bleu: { nom: 'Front', couleur: '#0079bf' },
  jaune: { nom: 'Idée', couleur: '#f2d600' },
};
```

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `creerColonne(titre)` | `{ id, titre, cartes: [] }` (titre nettoyé) ou `null` si vide |
| `creerCarte(titre)` | `{ id, titre, description: '', echeance: '', etiquettes: [], sousTaches: [] }` ou `null` si vide |
| `trouverCarte(colonnes, carteId)` | la carte ou `undefined` |
| `deplacerCarte(colonnes, carteId, colonneCibleId)` | un **nouveau** tableau de colonnes où la carte est à la fin de la colonne cible |
| `progression(carte)` | `'2/5'` (sous-tâches faites / total) ; `'0/0'` sans sous-tâche |
| `estEnRetard(carte, aujourdhui)` | `true` si l'échéance n'est pas vide et est **strictement avant** `aujourdhui` (`'AAAA-MM-JJ'`) |
| `carteCorrespond(carte, texte)` | `true` si le titre ou la description contient le texte (sans tenir compte des majuscules) |
| `totalCartes(colonnes)` | le nombre total de cartes (avec `reduce`) |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Colonnes | `data-test="colonne" data-id="…"` avec `data-test="colonne-titre"` ; `<form data-test="form-colonne">` avec `name="titre"` ; bouton `colonne-renommer` (ouvre un `<form data-test="form-renommer">` avec `name="titre"`, ou `prompt()`) ; bouton `colonne-supprimer` après confirmation |
| 2. Créer une carte | dans chaque colonne, `<form data-test="form-carte">` avec `name="titre"` ; carte `data-test="carte" data-id="…"` |
| 3. Modifier | bouton `carte-ouvrir` (ou clic sur la carte) → `data-test="modale"` avec `<form data-test="form-modifier">` : `titre`, `description`, `echeance` (`type="date"`) |
| 4. Déplacer | `<select data-test="carte-deplacer">` dont les `<option value>` sont les id des colonnes (dans la carte ou la modale) ; le glisser-déposer est un bonus |
| 5. Supprimer | bouton `carte-supprimer`, après confirmation |
| 6. Étiquettes | dans `form-modifier`, des cases `name="etiquettes" value="rouge"…` ; sur la carte, `data-test="carte-etiquette"` colorées |
| 7. Sous-tâches | dans la modale, `<form data-test="form-sous-tache">` avec `name="texte"` ; chaque `data-test="sous-tache"` contient une case à cocher ; sur la carte, `data-test="progression"` : « 1/2 » |
| 8. Retard | la carte en retard porte `data-retard="true"` (et un style visible) |
| 9. Recherche | `data-test="recherche"` : les cartes qui ne correspondent pas sont **masquées** |
| 10. Compteurs | dans chaque colonne, `data-test="compteur"` (nombre de cartes de la colonne) et `data-test="etat-vide"` si la colonne est vide |
