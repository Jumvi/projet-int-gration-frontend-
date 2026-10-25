# Fiche 2 — Contacts, comme Google Contacts

`"sujet": "contacts"` · clé localStorage : `kadea-contacts` · démo : **au moins 8 contacts** sur au moins 4 lettres, dont 2 favoris, et 2 étiquettes.

## Modèle de données

```js
const etat = {
  contacts: [
    {
      id: 'c-1',
      prenom: 'Grâce',           // obligatoire
      nom: 'Mbuyi',
      telephone: '+243 812 345 678',
      email: 'grace@exemple.cd',
      favori: true,
      etiquettes: ['e-1'],       // tableau imbriqué
      notes: '',
    },
  ],
  etiquettes: {                  // objet dictionnaire
    'e-1': { id: 'e-1', nom: 'Famille' },
  },
};
```

**Téléphone congolais** : après suppression des espaces, points et tirets, `+243` ou `0`, puis `8` ou `9`, puis 8 chiffres
(`+243812345678`, `0812345678`, `0991 234 567`). **E-mail** : facultatif, mais valide s'il est rempli (`texte@texte.texte`).
Le téléphone est obligatoire.

## Fonctions de `js/donnees.js` (sans DOM)

| Fonction | Renvoie |
|---|---|
| `creerDonneesDemo()` | l'état de démonstration |
| `validerContact(saisie)` | un objet d'erreurs `{ prenom: '…', telephone: '…', email: '…' }` ne contenant **que** les champs invalides (`{}` si tout est valide) |
| `estTelephoneCongolais(telephone)` | `true` / `false` |
| `initiales(contact)` | `'GM'` (première lettre du prénom et du nom, en majuscules ; une seule lettre si pas de nom) |
| `couleurAvatar(contact)` | une couleur CSS **calculée** à partir du nom : toujours la même pour le même contact |
| `trierContacts(contacts)` | une **copie** triée par prénom puis nom (`localeCompare`, sans tenir compte des majuscules) |
| `grouperParLettre(contacts)` | un dictionnaire `{ G: [...], P: [...] }` par première lettre du prénom en majuscule, sans accent (avec `reduce`) |
| `rechercherContacts(contacts, texte)` | les contacts dont le prénom + nom, le téléphone (espaces ignorés) ou l'e-mail contient le texte |
| `compterParEtiquette(contacts)` | `{ 'e-1': 3, 'e-2': 1 }` (avec `reduce`) |

## Attributs `data-test`

| Fonctionnalité | Attributs |
|---|---|
| 1. Créer | (bouton `contact-nouveau` si le formulaire est caché) `<form data-test="form-contact">` avec `name="prenom"`, `name="nom"`, `name="telephone"`, `name="email"` ; erreurs `data-test="erreur"` |
| 2. Liste triée | `data-test="contact" data-id="…"` contenant `data-test="contact-nom"` ; séparateurs `data-test="separateur-lettre"` (texte : la lettre) |
| 3. Avatar | `data-test="avatar"` dans chaque contact : les initiales, sur un fond calculé |
| 4. Fiche détaillée | bouton `contact-ouvrir` (ou clic sur le contact) → `data-test="fiche"` visible avec le téléphone et l'e-mail |
| 5. Modifier | bouton `contact-modifier` → `form-contact` pré-rempli, même validation |
| 6. Supprimer | bouton `contact-supprimer`, après confirmation |
| 7. Favoris | bouton `contact-favori` ; navigation `vue-tous` et `vue-favoris` |
| 8. Étiquettes | `<form data-test="form-etiquette">` avec `name="nom"` ; filtres `filtre-etiquette` `data-id="…"` ; dans `form-contact`, des cases `name="etiquettes" value="<id>"` |
| 9. Recherche | `data-test="recherche"` : nom, téléphone ou e-mail |
| 10. Compteurs | `data-test="compteur"` (contacts affichés) ; `data-test="compteur-etiquette"` dans chaque filtre d'étiquette ; `data-test="etat-vide"` |
