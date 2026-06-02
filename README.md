# 🎸 Basse Trainer

Application web d'apprentissage de la basse : visualisation du manche, gammes,
modes, triades, positions et cercle des quintes, avec lecture audio et métronome.

Conçue pour fonctionner **sur PC dans le navigateur** (un simple fichier HTML,
aucune installation, hors-ligne), avec un objectif de **portage smartphone** ultérieur.

## Lancer

Ouvrir `index.html` dans un navigateur (double-clic). C'est tout.

## Fonctionnalités

- **Manche complet** : visualisation de toute la touche.
- **3 modes de sélection** :
  - **Gamme** : majeure, mineures (naturelle / harmonique / mélodique),
    pentatoniques majeure et mineure, blues, et les 7 modes
    (ionien, dorien, phrygien, lydien, mixolydien, éolien, locrien).
  - **Note** : toutes les positions d'une note sur le manche.
  - **Triade** : majeure, mineure, diminuée, augmentée.
- **Couleurs par fonction** : fondamentale / tierce / quinte / autres notes.
- **Bascule Notes ↔ Degrés** (`Do Mi Sol` ou `1 3 5`).
- **Vue Position** : forme jouable dans une fenêtre de cases, avec la formule
  d'intervalles (W–W–H…), positions ancrées sur les deux cordes graves.
- **Vue Tablature** : tablature dessinée, séquence dans l'ordre de jeu.
- **Vue Forme+Tab** : forme et tablature affichées en même temps.
- **Mode Octave (1→8)** : limite la séquence/forme à une octave ; en vue Position,
  les notes hors octave apparaissent estompées.
- **Sens de lecture** : montant, descendant, aller-retour.
- **Audio + métronome** : lecture de la séquence (Web Audio), tempo réglable,
  métronome, boucle, surlignage synchronisé. Choix du **son** : basse pincée
  réaliste (synthèse Karplus–Strong) ou synthé.
- **Accordages** : 4 cordes (E A D G), 5 cordes (B E A D G), Drop D, 5 cordes (E A D G C).
- **Cercle des quintes / quartes** interactif (clic = nouvelle tonique).

## Entraînement & progression

- **Exercices** : gamme sur une octave (montée / descente / aller-retour),
  gamme position complète, arpège de triade, et **Odds & Evens** /
  **Evens & Odds** (parcours par degrés impairs/pairs sur ~2 octaves, toutes cordes).
- **Validation manuelle** : on règle le tempo, on joue, et on valide le tempo
  réussi sans erreur.
- **Tableau de bord** : meilleur tempo validé par configuration, progression vers
  un objectif (BPM), nombre de validations, dernière session. Export JSON.
- Données enregistrées **localement** dans le navigateur (`localStorage`).

### Cercle des quartes (mémorisation notes & triades)

- **Play-along** : l'arpège de triade de chaque accord défile autour du cercle
  des quartes (C→F→B♭→…), dans une **zone de cases réglable**, avec métronome,
  highlight et auto-avance.
- **Guidé (toucher)** : pour chaque accord, on touche la fondamentale, la tierce
  puis la quinte sur le manche (rappel actif), avec score, chrono et record.
- Triades majeures ou mineures.

## Pile technique

- HTML / CSS / JavaScript pur, sans dépendance ni build.
- Audio via la Web Audio API ; progression via `localStorage`.
- Code organisé en modules chargés par `<script>` classiques (compatible `file://`) :
  `js/engine.js` (théorie), `js/views.js` (rendu), `js/audio.js` (séquence/audio),
  `js/tracker.js` (suivi), `js/exercises.js` (exercices), `js/app.js` (état/contrôles).

## Pistes d'évolution

- Sauvegarde des presets favoris.
- Sons de basse plus réalistes / subdivisions rythmiques.
- Vue « tous les modes » côte à côte.
- Portage mobile (ex. Capacitor → Android / iOS).
