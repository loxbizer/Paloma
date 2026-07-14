# XENOSTRIKE

**FPS tactique 5v5 futuriste — l'Essaim Xéno contre les Gardiens de la Coalition Terrienne.**

Vous incarnez un **Xéno** : un alien de l'Essaim exilé venu reprendre la station orbitale
*Nova Bastion*. En face : cinq **Gardiens** humains. Posez le **Noyau de Singularité**,
tenez les sites, premier camp à 13 rounds.

Jeu 3D temps réel complet : rendu three.js, personnages squelettés animés (GLB), map GLB,
cinématiques de lancement façon trailer, bots, économie, boutique hybride free-to-play /
pay-to-win, et packaging **Electron** prêt pour une distribution type **Steam / Epic Games**.

---

## Lancer le jeu

```bash
npm install          # installe three.js + Electron
npm start            # lance l'application de bureau (Electron)
```

Sans Electron (navigateur) :

```bash
npm run dev          # sert le jeu sur http://127.0.0.1:8666
```

Si les modèles 3D manquent (dossier `assets/models/`), régénérez-les :

```bash
npm run assets       # génère les 27 GLB (15 personnages, 11 armes, 1 map) + données de map
```

## Créer l'exécutable téléchargeable (Steam / Epic)

```bash
npm run dist:win     # Windows : installateur NSIS + zip (dist/)
npm run dist:mac     # macOS : DMG + zip
npm run dist:linux   # Linux : AppImage + zip
```

Voir **docs/STEAM_EPIC.md** pour le dépôt Steamworks / Epic Online Services.

## Contrôles (AZERTY par défaut, QWERTY dans les paramètres)

| Touche | Action |
|---|---|
| Z Q S D | Déplacement |
| Souris / clic gauche | Viser / tirer — clic droit : visée (ADS) |
| Maj (double appui) | Sprint / **Dash** |
| Espace | Saut / **Wall-run** contre un mur / passer une cinématique |
| Ctrl | S'accroupir — en sprintant : **glissade** |
| A, E, C | Capacités — **X** : Ultime |
| F | Interagir : planter / désamorcer / **réanimer** |
| R | Recharger — B : menu d'achat — Tab : tableau des scores |
| N | **Danser** (chaque Xéno a sa danse signature) |

## Ce que XENOSTRIKE ajoute au genre (inexistant dans Valorant)

1. **Évolution Xéno** — vos actions rapportent des points d'évolution ; à chaque palier,
   choisissez une mutation (+dégâts, +vitesse, +PV, -cooldowns…) qui dure tout le match.
2. **Réanimation tactique** — 8 secondes pour relever un allié tombé (une fois par round).
3. **Aura de Résurgence** — l'équipe menée de 3 rounds reçoit bouclier et crédits bonus :
   les remontadas existent.
4. **Événements de map** — à mi-round : tempête ionique, ouverture de portes, inversion de
   gravité, marché flash. Aucun round ne se ressemble.
5. **Fusion d'ultimes** — deux ultimes lancés côte à côte fusionnent en version amplifiée.
6. **Overdrive** — 3 éliminations sans dégât subi : pulse de vision à travers les murs (2 s).
7. **Mouvement étendu** — dash, wall-run, glissade, zones basse gravité, jump pads, téléporteurs.

## Modèle économique hybride

- **Free-to-play** : tout se débloque en jouant (Fragments, missions, passe gratuit).
- **Pay-to-win assumé** : les **Xenocoins** (achat simulé) accélèrent tout et offrent des
  **variantes d'armes à bonus réels** (+5 % dégâts…) et des **boosters de match**
  (+10 % dégâts, armure de départ, -15 % cooldowns) — également gagnables en F2P, plus lentement.
- **Passe Xéno** : 20 paliers, piste gratuite + premium.

## Architecture

- `src/` — moteur (core), gameplay (game), personnages et capacités (agents), IA (ai),
  monde (world), interface (ui), cinématiques (cinematics), effets (fx), données (data).
- `tools/` — générateurs d'assets 3D (GLB écrits par code via three.js sous Node),
  serveur de dev, test de fumée automatisé (`npm run smoke`).
- `assets/models/` — les GLB générés. `assets/data/` — layout de la map (collisions,
  waypoints, spawns, rails de caméra).
- `docs/CONTRACTS.md` — contrats d'architecture entre modules.

Audio : 100 % synthétisé en Web Audio (aucun fichier son). Visuels : géométrie + couleurs
par sommet + émissifs (aucune texture image).
