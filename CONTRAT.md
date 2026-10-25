# Contrat technique — Projet de fin de module 6

L'évaluation automatique ouvre ton application dans un vrai navigateur (Chromium), clique, tape au clavier,
recharge la page et lit ton code. Pour qu'elle trouve tes éléments, tu dois respecter **ce contrat** et
**la fiche de ton sujet** (`fiches/`). Sans lui, une fonctionnalité qui marche peut être notée « Absente ».

> Le contrat impose des **noms** (fichiers, attributs `data-test`, clé de stockage, fonctions), jamais un design.
> Tu restes libre de ta mise en page, de tes couleurs et de ton nom d'application.

## 1. Fichiers imposés

```
index.html          une seule page (pas de rechargement, pas d'autre .html pour l'application)
style.css           tes styles (les couleurs et espacements en variables CSS dans :root)
js/stockage.js      charger() et sauvegarder() — le SEUL fichier qui touche à localStorage
js/donnees.js       le modèle et les fonctions de données de ta fiche — AUCUN accès au DOM
js/affichage.js     les fonctions qui reconstruisent la page avec createElement et textContent
js/app.js           les écouteurs d'événements et le démarrage
projet.json         ta fiche d'identité (voir ci-dessous)
README.md           présentation, captures, liens
captures/           tes captures d'écran (375, 768 et 1280 px)
```

Les scripts sont chargés **dans cet ordre**, en scripts classiques (pas de `type="module"`) :

```html
<script src="js/stockage.js" defer></script>
<script src="js/donnees.js" defer></script>
<script src="js/affichage.js" defer></script>
<script src="js/app.js" defer></script>
```

Déclare tes fonctions au premier niveau du fichier avec `const` (ex. `const creerNote = (saisie) => { … };`) :
l'évaluation les appelle par leur nom.

## 2. `projet.json`

```json
{
  "sujet": "notes",
  "nom": "KinNotes",
  "apprenant": "Prénom Nom",
  "github": "ton-pseudo-github",
  "pages": "https://ton-pseudo-github.github.io/nom-du-depot/",
  "demo": "https://lien-vers-ta-video-ou-ta-presentation"
}
```

| Clé | Valeur |
|---|---|
| `sujet` | `notes`, `contacts`, `tableau`, `social`, `messagerie` ou `streaming` |
| `nom` | le nom de **ton** application (pas « Google Keep », « Trello », « Netflix »…) |
| `pages` | l'adresse GitHub Pages de ton application, se terminant par `/` |

## 3. Données et localStorage

- Une seule clé : **`kadea-<sujet>`** (ex. `kadea-notes`), qui contient **tout l'état** en JSON.
- `js/stockage.js` expose :
  - `const CLE_STOCKAGE = 'kadea-<sujet>';`
  - `charger()` → renvoie l'état lu dans localStorage, ou **`null`** si la clé est absente ;
  - `sauvegarder(etat)` → écrit l'état en JSON.
- `js/donnees.js` expose `creerDonneesDemo()` → renvoie l'état de démonstration (au moins le nombre
  d'éléments indiqué dans ta fiche). Au premier lancement (clé absente), l'application l'affiche et le sauvegarde.
- Chaque action suit le chemin **écouteur → fonction de données → `sauvegarder()` → affichage**.
- Tout l'état décrit dans ta fiche doit survivre à un rechargement (F5).

## 4. Attributs `data-test` communs

L'évaluation repère tes éléments grâce à l'attribut `data-test` (et `data-id` pour les éléments de liste).

| Attribut | Élément | Comportement attendu |
|---|---|---|
| `data-test="recherche"` | `<input type="search">` avec un `<label>` | filtre **en direct** (événement `input`) |
| `data-test="compteur"` | n'importe quel élément | contient le **nombre** d'éléments affichés dans la vue courante (ex. « 12 notes ») |
| `data-test="etat-vide"` | n'importe quel élément | visible **uniquement** quand la liste affichée est vide |
| `data-test="notification"` | élément avec `role="status"` | un message visible après **chaque** action réussie (ajout, modification, suppression…) |
| `data-test="erreur"` | n'importe quel élément | message d'erreur **précis** affiché quand une saisie est refusée |
| `data-test="confirmation"` | `<dialog>` | confirmation avant **chaque** suppression, avec deux boutons `data-test="confirmer"` et `data-test="annuler"` |

Pour la confirmation, `window.confirm()` est aussi accepté. Une suppression sans confirmation est une erreur.

Chaque élément de liste porte **le type de l'élément et son identifiant** :

```html
<article data-test="note" data-id="n-3">…</article>
```

Les boutons d'action d'un élément (`note-modifier`, `contact-supprimer`…) se trouvent **dans** l'élément, ou
dans la fiche / la fenêtre modale qui s'ouvre quand on clique sur l'élément.

## 5. Formulaires

- Toujours un `<form>` écouté sur **`submit`**, avec `event.preventDefault()`.
- Chaque champ a un attribut **`name`** (imposé par la fiche) et un **`<label for="…">`**.
- Un bouton `type="submit"` dans chaque formulaire.
- Une saisie invalide n'ajoute rien et affiche `data-test="erreur"` (ou une validation HTML native : `required`, `pattern`…).
- Un formulaire de création caché (dans une modale, un panneau repliable…) s'ouvre avec un bouton
  `data-test="<type>-nouveau"` (ex. `contact-nouveau`, `profil-nouveau`).
- Les fenêtres modales sont des `<dialog data-test="modale">` (ou un élément visible `data-test="modale"`),
  fermables avec la touche Échap ou un bouton `data-test="fermer"`.

## 6. Règles de code

- `const` par défaut, `let` si la valeur change, **jamais `var`** ; toujours `===` / `!==`.
- Fonctions fléchées, gabarits littéraux `` `${x}` `` pour les textes.
- `find`, `filter`, `map`, `some`, `sort` et `reduce` utilisés **au moins une fois chacun**, avec un `return`
  dans chaque callback (ou un retour implicite).
- La page est construite avec `document.createElement` et `textContent`.
  **Jamais `innerHTML` (ni `insertAdjacentHTML`, `outerHTML`, `document.write`) avec une donnée saisie.**
- Aucune erreur dans la console. Pas de `fetch`, pas de bibliothèque, pas de framework.

## 7. Ce que vérifie l'évaluation automatique

| Vérification | Comment |
|---|---|
| HTML valide et sémantique | validateur HTML, `header` / `nav` / `main` / `footer`, un seul `h1`, un label par champ |
| Accessibilité | score Lighthouse « Accessibilité » |
| Responsive | 375, 768 et 1280 px : aucune barre de défilement horizontale ; captures d'écran |
| Clavier | la touche Tab atteint chaque contrôle, avec un focus visible |
| Les 10 fonctionnalités | un scénario par fonctionnalité, à partir d'un localStorage vide |
| Persistance | une action, un rechargement : l'état est conservé ; premier lancement avec démo |
| Injection | `<img src=x onerror=…>` saisi dans chaque formulaire ne doit **jamais** devenir une balise |
| Console | aucune erreur ni exception pendant tous les scénarios |
| Code | fonctions de la fiche, méthodes de tableau, règles de code, aucun DOM dans `donnees.js` |
| Git | au moins 15 commits sur au moins 6 jours différents, aux messages explicites |
| README et GitHub Pages | sections attendues, captures, application en ligne à l'adresse `pages` |

> Ne modifie pas le dossier `.github/` : il contient l'évaluateur. Toute modification est signalée au coach.
