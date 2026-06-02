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
- **Mode Octave (1→8)** : limite la séquence/forme à une octave ; en vue Position,
  les notes hors octave apparaissent estompées.
- **Sens de lecture** : montant, descendant, aller-retour.
- **Audio + métronome** : lecture de la séquence (Web Audio), tempo réglable,
  métronome, boucle, surlignage synchronisé.
- **Accordages** : 4 cordes (E A D G), 5 cordes (B E A D G), Drop D, 5 cordes (E A D G C).
- **Cercle des quintes / quartes** interactif (clic = nouvelle tonique).

## Pile technique

- HTML / CSS / JavaScript pur, sans dépendance ni build.
- Audio via la Web Audio API.

## Pistes d'évolution

- Sauvegarde des presets favoris.
- Sons de basse plus réalistes / subdivisions rythmiques.
- Vue « tous les modes » côte à côte.
- Portage mobile (ex. Capacitor → Android / iOS).
