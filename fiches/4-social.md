# Fiche 4 — Réseau social, comme X

`"sujet": "social"` · clé localStorage : `kadea-social` · démo : **au moins 8 publications** de plusieurs auteurs, avec au moins 6 hashtags différents.

## Modèle de données

```js
const etat = {
  profil: { id: 'u-moi', nom: 'Judah Mvi', pseudo: 'judah', bio: 'Dev front-end à Kinshasa' },
  utilisateurs: {                       // objet dictionnaire
    'u-moi': { id: 'u-moi', nom: 'Judah Mvi', pseudo: 'judah' },
    'u-2': { id: 'u-2', nom: 'Grâce M.', pseudo: 'grace' },
  },
  publications: [
    {
      id: 'p-1',
      auteurId: 'u-2',
      texte: 'Mbote #kinshasa ! @judah tu viens ?',
      creeLe: 1761400000000,            // Date.now()
      modifie: false,
      jaime: ['u-moi'],                 // tableau imbriqué : qui a aimé
      republications: [],               // qui a republié
    },
  ],
};
```

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `validerPublication(texte)` | `''` si valide, sinon un message d'erreur (vide après `trim`, ou plus de 280 caractères) |
| `creerPublication(texte, auteurId)` | `{ id, auteurId, texte, creeLe, modifie: false, jaime: [], republications: [] }` |
| `trierFil(publications)` | une **copie** triée de la plus récente à la plus ancienne |
| `dateRelative(creeLe, maintenant)` | `'à l'instant'` (< 60 s), `'5 min'`, `'3 h'`, `'2 j'` |
| `basculerJaime(publication, utilisateurId)` | une **nouvelle** publication avec l'utilisateur ajouté ou retiré de `jaime` |
| `extraireHashtags(texte)` | `['#kinshasa', '#js']` en minuscules |
| `hashtagsTendance(publications)` | les **5** hashtags les plus utilisés `[{ hashtag: '#kinshasa', total: 4 }, …]`, du plus au moins utilisé |
| `statistiques(publications, utilisateurId)` | pour les publications de l'utilisateur : `{ publications: 3, jaimeRecus: 7, republications: 1 }` (J'aime et republications **reçus**, avec `reduce`) |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Publier | `<form data-test="form-publication">` avec `<textarea name="texte">` ; `data-test="compteur-caracteres"` mis à jour à chaque frappe ; au-delà de 280 caractères, rien n'est publié |
| 2. Fil | `data-test="publication" data-id="…"` du plus récent au plus ancien ; `data-test="publication-date"` : date relative |
| 3. J'aime | bouton `publication-jaime` ; `data-test="compteur-jaime"` |
| 4. Republier | bouton `publication-republier` ; `data-test="compteur-republier"` |
| 5. Modifier | bouton `publication-modifier` (sur **ses** publications) → `<form data-test="form-modifier">` avec `name="texte"` ; ensuite `data-test="publication-modifie"` visible (« modifié ») |
| 6. Supprimer | bouton `publication-supprimer` (sur ses publications), après confirmation |
| 7. Hashtags et mentions | dans le texte, `data-test="hashtag"` (cliquable : filtre le fil) et `data-test="mention"` |
| 8. Profil | navigation `vue-profil` / `vue-fil` (le formulaire de publication est dans la vue Fil) ; `data-test="profil"` avec `data-test="stat-publications"`, `stat-jaime` ; `<form data-test="form-profil">` avec `name="nom"` et `name="bio"` (bouton `profil-modifier` s'il est caché) |
| 9. Recherche | `data-test="recherche"` dans le texte des publications |
| 10. Tendances | `data-test="tendance"` (au plus 5), du plus au moins utilisé, calculés à partir des publications |
