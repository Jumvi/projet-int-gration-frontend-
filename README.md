<!-- README DU TEMPLATE -->
# Projet de fin de module 6 — Application web complète

En deux semaines, construis une application web complète inspirée d'un produit que tu utilises tous les jours,
en **HTML, CSS et JavaScript vanilla**, avec tes données sauvegardées dans **localStorage**.

> ✏️ **Remplace ce README** par celui de ton application (voir « README attendu » plus bas).
> Tant que cette ligne est là, le critère « README » est noté comme non rendu.

## 1. Choisis ton sujet

| Sujet | `projet.json` → `sujet` | Fiche |
|---|---|---|
| Notes, comme Google Keep | `notes` | [fiches/1-notes.md](fiches/1-notes.md) |
| Contacts, comme Google Contacts | `contacts` | [fiches/2-contacts.md](fiches/2-contacts.md) |
| Tableau de projet, comme Trello | `tableau` | [fiches/3-tableau.md](fiches/3-tableau.md) |
| Réseau social, comme X | `social` | [fiches/4-social.md](fiches/4-social.md) |
| Messagerie, comme WhatsApp Web | `messagerie` | [fiches/5-messagerie.md](fiches/5-messagerie.md) |
| Streaming, comme Netflix | `streaming` | [fiches/6-streaming.md](fiches/6-streaming.md) |

Ton application porte **son propre nom et son propre logo** (ex. « KinFlix ») : tu reproduis l'expérience, pas la marque.

## 2. Respecte le contrat technique

Lis [CONTRAT.md](CONTRAT.md) **avant de coder** : fichiers imposés, clé `kadea-<sujet>`, attributs `data-test`,
formulaires, règles de code. La fiche de ton sujet donne le modèle de données, les fonctions de `js/donnees.js`
et les attributs des 10 fonctionnalités.

```
index.html  style.css  projet.json  README.md  captures/
js/stockage.js  js/donnees.js  js/affichage.js  js/app.js
```

## 3. Rendu

1. Remplis `projet.json` (sujet, nom de ton application, adresse GitHub Pages, lien de la démo).
2. Commite **souvent** : au moins 15 commits sur au moins 6 jours, avec des messages explicites
   (`feat: recherche en direct des notes`, `fix: compteur de la corbeille`).
3. Active GitHub Pages (Settings → Pages) et vérifie l'adresse de `projet.json`.
4. **Merge sur la branche `develop`, puis push.** Sans ce merge et ce push, pas d'évaluation automatique.
5. Dépose le lien du dépôt et celui de GitHub Pages dans le devoir Canvas.

## 4. Évaluation automatique

À chaque push sur `develop`, GitHub Actions ouvre ton application dans un vrai navigateur, joue un scénario
pour chacune des 10 fonctionnalités, vérifie le HTML, l'accessibilité (Lighthouse), le responsive (375, 768 et
1280 px), le clavier, la persistance, l'injection, ton code et ton historique Git. Il écrit `evaluation.md` à la
racine (note /18 et /20, feedback par fonctionnalité et par critère du barème) et des captures dans `evaluation/`.
Récupère-les avec `git pull`.

| Statut d'une fonctionnalité | Signification |
|---|---|
| ⬜ Absente | les éléments `data-test` de la fiche sont introuvables |
| ❌ Erreur JavaScript | une exception s'est produite pendant le scénario |
| 🟠 Partielle | au moins une vérification échoue (cas limites compris : champ vide, liste vide…) |
| ✅ Fonctionne | toutes les vérifications réussissent, sans rechargement de page |

Barème : 6 critères notés de 0 à 3 (/18), note sur 20 = total × 10 ÷ 9. La compétence est validée à partir de
12 / 18, sans aucun critère à 0. Le coach complète l'évaluation : ressemblance avec le produit, démo de 5 minutes,
explication de ton code.

> Ne modifie pas le dossier `.github/` : il contient l'évaluateur. Toute modification est signalée au coach.

## 5. README attendu

Ton README final doit contenir (au moins 800 caractères) :

- **Présentation / fonctionnalités** : ce que fait ton application, les 10 fonctionnalités ;
- **Captures d'écran** : 375, 768 et 1280 px, rangées dans `captures/` ;
- **Utilisation** : comment l'ouvrir, l'adresse GitHub Pages ;
- **Choix techniques** : structure des fichiers, modèle de données, choix CSS ;
- le **lien de la démo**.

## Avant de rendre

- [ ] J'ai ouvert mon application en ligne sur mon téléphone.
- [ ] J'ai vidé localStorage pour tester le premier lancement.
- [ ] J'ai tout fait au clavier, sans la souris.
- [ ] Ma console ne montre aucune erreur.
- [ ] Le dernier `evaluation.md` est au vert, ou je sais pourquoi il ne l'est pas.
- [ ] Mon README a des captures d'écran et le lien de démo.
