# XENOCLASH — Note de design

## Fantasme central
Deux espèces, pas deux camps symétriques. Les **Xénomorphes** (attaque) sont rapides,
mobiles, jouent l'espace et le temps. La **Coalition Humaine** (défense) tient les angles
avec de la puissance de feu et des gadgets. Chaque agent a un **caractère** qui se lit dans
ses répliques et son style de jeu.

## Roster Xéno (jouable)

| Agent | Rôle | Caractère | Capacité |
|-------|------|-----------|----------|
| **VEX** | Duelliste | Arrogante, adrénaline | Saut de Phase (blink 8 m) |
| **NULL** | Contrôleur | Calme, calculatrice | **Puits de Gravité** ⟡ |
| **ECHO** | Traqueur | Paranoïaque | **Vision de Ruche** ⟡ |
| **KRAG** | Sentinelle | Bourru, protecteur | Mur de Chitine |
| **RIFT** | Initiateur | Instable | **Rembobinage** ⟡ |

⟡ = mécanique **inédite** vs Valorant.

## Les mécaniques inédites — intention + réglage

### 1. Puits de Gravité (NULL)
- **Effet** : champ de 5 m qui **aspire** les ennemis vers son centre (6 u/s) et les
  **ralentit** (×0.4). Dure 6 s.
- **Pourquoi c'est mieux** : à Valorant, le contrôle de zone est *passif* (fumée = tu ne
  vois pas). Ici il est *actif* : il **repositionne** l'adversaire. Ça crée des plays
  d'équipe (« je l'aspire hors du couvert, tu le tues ») impossibles ailleurs.
- **Contre-jeu** : anticiper le placement, ne pas rusher au centre, le sniper le traverse.

### 2. Rembobinage (RIFT)
- **Effet** : restaure ta **position + PV** (+30 bonus) tels qu'il y a ~2 s.
- **Pourquoi c'est mieux** : transforme un « peek raté » en pari maîtrisé. Récompense la
  lecture et la prise d'info agressive plutôt que de la punir sèchement. Skill-ceiling élevé.
- **Contre-jeu** : le cooldown est long ; forcer un 2e engagement avant le reset.

### 3. Vision de Ruche (ECHO)
- **Effet** : révèle les ennemis **à toute l'équipe** pendant 4 s (contour rouge à travers
  les murs).
- **Pourquoi c'est mieux** : l'info devient une ressource **collective** et non solo. Pousse
  la coordination vocale et les exécutions coordonnées.
- **Contre-jeu** : se replier hors ligne de mire, jouer l'après-révélation.

### 4. Surcharge (utilitaire Humain)
- **Effet** : +50 % dégâts pendant 5 s, mais −2 PV/s (auto-brûlure).
- **Pourquoi c'est mieux** : un buff **risque/récompense** pur, quasi absent des tacticals.

## Économie : Free-to-Play **et** Pay-to-Win assumé

Deux monnaies :

- **Crédits ¢** — gagnés en jeu (kills, manches), dépensés chaque manche en armes. 100 %
  gratuit, cœur compétitif équilibré.
- **Cristaux ◈** — la couche premium. Achètent des avantages **limités à la manche**
  (ex. **Sur-bouclier** : +75 armure au spawn).

Le twist « F2P + P2W » demandé est **cadré** pour rester jouable :
- les non-payeurs **gagnent aussi** des Cristaux (petit flux gratuit chaque manche) ;
- les objets premium sont **consommables par manche**, pas des stats permanentes, donc
  l'avantage est ponctuel et lisible, pas un mur de progression.

> C'est le levier de monétisation que tu voulais, isolé dans `game/economy.js` pour pouvoir
> l'équilibrer (ou le désactiver en ranked) sans toucher au reste.

## Boucle de manche
`Cinématique d'intro → Phase d'achat (12 s) → Live (100 s) → Fin → suivante`.
Victoire Xéno : éliminer les 5 Humains **ou** faire détoner le Noyau. Victoire Humaine :
éliminer les 5 Xénos **ou** temps écoulé. Premier à **13** gagne le match.

## Roadmap réaliste vers du AAA
1. Remplacer les rigs procéduraux par des **GLB riggés** (Mixamo/artiste) — le loader et le
   système d'animation sont déjà en place, il suffit de brancher `GLTFLoader` + `AnimationMixer`.
2. Kit de map **GLB modulaire** à la place des `BoxGeometry`.
3. Netcode autoritatif (WebSocket/WebRTC) pour du vrai 5v5 en ligne.
4. Trailer pré-rendu : rejouer les caméras `cinematic/` dans Blender avec les assets finaux.
