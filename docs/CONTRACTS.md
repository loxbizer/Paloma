# XENOSTRIKE — Contrats d'architecture (SOURCE DE VÉRITÉ)

Tout module DOIT respecter ce document à la lettre. Toute déviation casse l'intégration.

## Vue d'ensemble

XENOSTRIKE : FPS tactique 5v5 futuriste. Les **XÉNOS** (aliens, côté joueur, attaquants en 1ère mi-temps)
affrontent les **GARDIENS** (humains, défenseurs). Les Xénos posent le **Noyau de Singularité**
(équivalent spike) sur un des 2 sites. 24 rounds max, premier à 13, changement de côté à 12.
Le joueur contrôle un Xéno + 4 bots alliés Xénos contre 5 bots Gardiens.

- Rendu : three.js 0.169 (import `three` et `three/addons/` via import map).
- Modules ES natifs, **pas de bundler**, pas de TypeScript, pas de framework UI (DOM pur).
- Langue de l'UI et des textes : **français**.
- Fichiers : chemins relatifs à la racine (le jeu est servi en http, racine = repo).
- `package.json` a `"type": "module"` → tout `.js` est un module ES.

## Services & communication

- Bus d'événements global : `import { bus } from '.../core/events.js'` (`bus.on/off/once/emit`).
- Localisateur : `import { registry } from '.../core/registry.js'` — `registry.get('engine')`, etc.
  Clés : `engine, world, collision, audio, fx, tracers, hud, menus, shop, match, economy,
  mechanics, save, profile, input, cinematics, assets, player, agentFactory`.
- **AUCUN import croisé entre sous-systèmes** en dehors de : `core/*`, `game/constants.js`,
  `game/entity.js`, `data/*`. Tout le reste passe par `bus` et `registry`.
- `registry.get('profile')` retourne l'objet profil joueur (voir `core/save.js`) ; le sauvegarder
  via `registry.get('save').save()` (fourni par main.js : `{ save() }` wrapper).

## Boucle & moteur (`src/core/engine.js` — FOURNI)

- `engine.scene`, `engine.camera` (caméra FPS par défaut), `engine.renderer`, `engine.timeScale`.
- `engine.onUpdate(fn)` → fn(dt, elapsed, rawDt) chaque frame ; retourne un désabonnement.
- `engine.setCamera(cam)` / `engine.getCamera()` — les cinématiques remplacent la caméra puis restaurent.
- `window.__SMOKE = { errors: [] }` existe en mode smoketest — y pousser toute erreur attrapée.

## Entités (`src/game/entity.js` — FOURNI)

`CombatEntity` : voir le fichier. Champs clés : `id, name, team, agentDef, isPlayer, isBot, hp, maxHp,
armor, shield, alive, object3D (THREE.Group, position = pieds), position, velocity, yaw, pitch,
crouching, onGround, inventory {primary, secondary, melee}, currentSlot, ammo {weaponId: {mag, reserve}},
credits, abilities {slot: {def, cooldownLeft, charges}}, ultCharge, ultReady, kills/deaths/assists,
evolutionPoints, evolutionLevel, statMods, eyeHeight, eyePosition(v3), forwardDir(v3),
takeDamage(amount, source, part), revive(by), resetForRound(), addUltCharge(pts), applyStatMods(mods)`.
Convention yaw=0 → regard vers **-Z** ; `forwardDir` en tient compte.

## Constantes (`src/game/constants.js` — FOURNI)

Importer TEAM_XENOS, TEAM_GUARDIANS, GAME_STATES, ROUND, ECONOMY, PLAYER, EVOLUTION, MOMENTUM,
XENO_IDS, GUARDIAN_IDS, WEAPON_IDS, MAP_ID, modelPathForAgent/Weapon/Map. NE PAS redéfinir ces valeurs.

## Catalogue d'événements du bus (noms EXACTS)

| Événement | Payload | Émis par |
|---|---|---|
| `game:state` | `{ state }` (GAME_STATES) | main/match |
| `match:start` | `{ config }` | match |
| `match:end` | `{ winner, score: {XENOS, GUARDIANS} }` | match |
| `round:prestart` | `{ roundNumber, score, switching }` | match |
| `phase:buy` | `{ duration, roundNumber }` | match |
| `phase:action` | `{ roundNumber }` | match |
| `round:end` | `{ winner, reason, score }` | match |
| `round:timer` | `{ remaining, phase }` (1×/s) | match |
| `spike:planted` | `{ site, entity, timeLeft }` | match/spike |
| `spike:defusing` | `{ entity, progress }` | spike |
| `spike:defused` | `{ entity }` | spike |
| `spike:exploded` | `{}` | spike |
| `entity:spawned` | `{ entity }` | match |
| `entity:damaged` | `{ entity, amount, source, part }` | entity |
| `entity:died` | `{ entity, killer, weapon, headshot }` | entity |
| `entity:revived` | `{ entity, by }` | entity |
| `weapon:fired` | `{ entity, weaponId, origin(V3), dir(V3) }` | combat/player/bot |
| `weapon:hit` | `{ shooter, target, part, damage, point(V3) }` | combat |
| `weapon:reload` | `{ entity, weaponId }` | player/bot |
| `weapon:switched` | `{ entity, slot, weaponId }` | player/bot |
| `ability:cast` | `{ entity, ability, slot }` | abilities |
| `ability:ready` | `{ entity, slot }` | abilities |
| `ult:charged` | `{ entity }` | entity |
| `ult:fusion` | `{ a, b, name }` | mechanics |
| `evolution:choice` | `{ entity, level, options: [c1, c2] }` | mechanics (joueur choisit via HUD) |
| `evolution:pick` | `{ entity, choiceId }` | hud → mechanics |
| `evolution:levelup` | `{ entity, level, choice }` | mechanics |
| `mapevent:trigger` | `{ type, name, data }` | mechanics |
| `momentum:aura` | `{ team, level }` | mechanics |
| `economy:update` | `{ entity, credits }` | economy |
| `shop:purchase` | `{ item, currency, price }` | shop |
| `buy:open` / `buy:close` | `{}` | hud/player |
| `ui:notification` | `{ text, type: 'info'\|'warn'\|'kill'\|'evo', duration }` | tous |
| `ui:killfeed` | `{ killerName, victimName, weaponId, headshot, killerTeam }` | match |
| `ui:hitmarker` | `{ headshot, kill }` | combat (si shooter = joueur) |
| `player:pov` | `{ entity }` | match (entité joueur créée) |
| `cinematic:start` / `cinematic:end` | `{ kind }` | cinematics |
| `audio:play` | `{ sfx, pos?, volume? }` | tous → audio |
| `music:mood` | `{ mood: 'menu'\|'buy'\|'tension'\|'clutch'\|'victory'\|'defeat' }` | match → audio |
| `revive:progress` | `{ entity, progress }` | mechanics |

Noms de sfx (audio DOIT tous les fournir) : `shot_kinetic, shot_plasma, shot_heavy, shot_sniper,
reload, dry_fire, footstep, jump, land, dash, wallrun, hit_body, hit_head, kill_confirm, death,
spike_plant, spike_beep, spike_defuse, spike_explode, ability_throw, ability_zone, ult_ready,
ult_cast, evo_levelup, revive, purchase, ui_click, ui_hover, round_win, round_lose, door, teleport,
storm, fusion, notification`.

## Assets 3D — conventions STRICTES

Tous les modèles sont des **.glb** générés par `tools/gen-*.mjs` via
`import { exportGLB } from './export-glb.mjs'` (FOURNI, testé — Node OK).
Matériaux : `MeshStandardMaterial` avec `vertexColors: true` OU `color`/`emissive` unis.
**AUCUNE texture image.** Détail visuel = géométrie + couleurs par sommet + émissif.

### Personnages — `assets/models/agent_<id>.glb` (15 fichiers)

- Taille ≈ 1.6–2.1 selon le gabarit, **origine aux pieds**, T-pose regardant **-Z**.
- Squelette OBLIGATOIRE (noms exacts) : `Hips, Spine, Chest, Neck, Head, Shoulder_L, UpperArm_L,
  LowerArm_L, Hand_L, Shoulder_R, UpperArm_R, LowerArm_R, Hand_R, UpperLeg_L, LowerLeg_L, Foot_L,
  UpperLeg_R, LowerLeg_R, Foot_R`. Extras selon gabarit : `Tail1..Tail3, Antenna_L, Antenna_R,
  Crest, Jaw, ArmB_UpperArm_L…` (2e paire de bras de Sylkis).
- Nœud vide `WeaponSocket_R` enfant de `Hand_R` (les armes s'y attachent à l'exécution).
- **Clips d'animation OBLIGATOIRES** (noms exacts, boucles fluides) :
  `idle, run, run_back, strafe_l, strafe_r, crouch_idle, crouch_walk, shoot, reload, plant,
  death, dance, intro, ability`.
  `dance` et `intro` sont SIGNATURE : uniques par personnage, expressives (6–10 s pour dance,
  2.5–4 s pour intro), reflètent la personnalité.
- Le rendu à l'exécution : `registry.get('assets').instantiate(path)` → `{ root, animations }`.

### Armes — `assets/models/weapon_<id>.glb` (11 fichiers)

- Origine à la poignée, canon vers **-Z**, échelle réaliste (fusil ≈ 0.8 long).
- Nœud vide nommé `Muzzle` au bout du canon (spawn des flashs/tracers).
- Style : futuriste, mélange métal sombre + accents émissifs (couleur par arme).

### Map — `assets/models/map_nova_bastion.glb` + `assets/data/map-layout.json`

Le GLB est **purement visuel**. TOUTES les données gameplay sont dans le JSON :

```json
{
  "name": "Nova Bastion",
  "bounds": { "min": [-45, -1, -60], "max": [45, 20, 60] },
  "colliders": [ { "min": [x,y,z], "max": [x,y,z] } ],
  "spawns": { "XENOS": [[x, y, z, yaw] ×5], "GUARDIANS": [[x, y, z, yaw] ×5] },
  "sites": [ { "id": "A", "center": [x,y,z], "radius": 7 }, { "id": "B", ... } ],
  "waypoints": [ { "id": 0, "pos": [x,y,z], "links": [1,2], "cover": false, "site": null } ],
  "gravityZones": [ { "min": [...], "max": [...], "gravityScale": 0.35, "name": "Puits Nord" } ],
  "jumpPads": [ { "pos": [x,y,z], "impulse": [0, 12, 0], "radius": 1.4 } ],
  "teleporters": [ { "from": [x,y,z], "to": [x,y,z], "radius": 1.2 } ],
  "doors": [ { "id": "door_mid", "min": [...], "max": [...], "closedAtStart": false } ],
  "hazards": [ { "type": "storm_zone", "center": [x,y,z], "radius": 8 } ],
  "lights": [ { "type": "point", "pos": [x,y,z], "color": 65484, "intensity": 30, "distance": 25 } ],
  "cameraRails": {
    "matchIntro": [[x,y,z] ×6+ points de spline],
    "roundIntroXenos": [[x,y,z] ×4+],
    "roundIntroGuardians": [[x,y,z] ×4+],
    "victory": [[x,y,z] ×4+]
  }
}
```

- Le graphe `waypoints` DOIT couvrir toute la map (spawns → mid → sites, ≥ 40 nœuds, liens bidirectionnels).
- Les `colliders` (AABB) DOIVENT correspondre aux murs/sols visuels du GLB (map jouable ≈ 80×100 m,
  2 sites, un mid, plusieurs couloirs, hauteurs variées, zone basse gravité, passerelles).
- Sol praticable à y=0 (plateformes plus hautes OK, accessibles par rampes/jump pads).

## Interfaces des modules (exports EXACTS)

### `src/data/weapons-data.js`
```js
export const WEAPONS = { <id>: {
  id, name, class: 'melee'|'sidearm'|'smg'|'shotgun'|'rifle'|'sniper'|'heavy',
  price, damage: { head, body, legs }, fireRate /* coups/s */, auto: bool,
  magSize, reserve, reloadTime, range /* m, début de falloff */, falloff /* mult à 50m */,
  penetration: 0|1|2, spread /* rad base */, adsSpread, recoil: [ [dx, dy] ×12 /* pattern */ ],
  moveSpeedMult, equipTime, sfx: 'shot_kinetic'|'shot_plasma'|'shot_heavy'|'shot_sniper',
  tracerColor /* hex int */, description,
  variants: [ { id, name, priceXenocoins, tint /* hex */, damageBonus /* ex 1.05 */ } ]
} };
export function weaponModelPath(id);       // délègue à constants.modelPathForWeapon
export const BUY_MENU_LAYOUT = [ { category, label, items: [weaponIds] } ];
```
IDs (constants.WEAPON_IDS) : `blade` (mêlée, gratuit), `stinger_p` (gratuit, sidearm),
`viper` (400), `nova_hand` (800), `wasp` (1000, smg), `hornet` (1600, smg), `maw` (950, shotgun),
`pulsar_r7` (2900, rifle plasma précis), `reaver` (2900, rifle bio cadence), `void_eye` (4500, sniper),
`devastator` (5200, heavy). Équilibrage type jeu tactique (TTK courts, headshot létal au rifle).

### `src/data/agents-data.js`
```js
export const AGENTS = { <id>: {
  id, name, species: 'xeno'|'guardian', role: 'Éclaireur'|'Duelliste'|'Contrôleur'|'Sentinelle'|'Soutien',
  tagline, lore /* 2-3 phrases */, personality: { trait, humor, catchphrase },
  colors: { primary, secondary, emissive /* hex ints */ },
  bodyType /* voir table gabarits */, voiceLines: { spawn: [..], kill: [..], plant: [..], ability: [..], win: [..] },
  danceName /* nom marketing de sa danse */, priceCredits /* déblocage F2P */, priceXenocoins,
  abilities: [ /* index 0..2 = capacités (touches A, E, C), index 3 = ult (X) */
    { id, name, key, icon /* emoji */, desc, costCredits /* achat en phase buy, 0 si gratuite */,
      cooldown, charges, type: 'dash'|'projectile'|'zone'|'wall'|'heal'|'vision'|'clone'|'teleport'|
      'shield'|'trap'|'buff'|'transform'|'global', params: { ...spécifique } }
  ]
} };
export function getAgent(id);
```
**Roster imposé** (id, espèce, rôle, gabarit `bodyType`, couleurs indicatives, personnalité) :

| id | nom | espèce | rôle | bodyType | palette | personnalité |
|---|---|---|---|---|---|---|
| zephyr | Zephyr | xeno | Éclaireur | insectoid (antennes) | cyan/noir | joueur, arrogant, rapide |
| krogoth | Krogoth | xeno | Sentinelle-tank | heavy_reptile (queue+crête) | vert/bronze | bourru, protecteur |
| sylkis | Sylkis | xeno | Duelliste | four_arms (4 bras) | violet/argent | théâtrale, duelliste d'opéra |
| vex9 | Vex-9 | xeno | Contrôleur | techno_symbiote (visière, câbles) | orange/gris | IA sarcastique et froide |
| umbra | Umbra | xeno | Contrôleur | shadow (silhouette fumée) | indigo/noir | mystérieuse, murmure |
| thorne | Thorne | xeno | Sentinelle | plant (crête feuillue) | vert/rose | sage botaniste ancien |
| pulsar | Pulsar | xeno | Duelliste | round_energy (trapu lumineux) | jaune/bleu | pile électrique hilare |
| naia | Naia | xeno | Soutien | aquatic (nageoires) | turquoise/blanc | douce, empathique |
| ragnok | Ragnok | xeno | Duelliste-brute | horned_brute (cornes) | rouge/noir | colérique jouissif |
| echo | Echo | xeno | Flex psychique | pale_mimic (lisse, iridescent) | blanc/irisé | enfant étrange qui imite |
| steele | Cmdr Steele | guardian | Leader | human_soldier | gris/bleu | vétéran droit |
| wraith | Wraith | guardian | Sniper | human_recon (capuche) | vert/noir | laconique |
| ferrai | Doc Ferrai | guardian | Soutien | human_medic | blanc/rouge | cynique attachante |
| bastion7 | Bastion-7 | guardian | Tank | human_exo (exosquelette) | acier/orange | machine loyale |
| nyx | Nyx | guardian | Infiltratrice | human_stealth | noir/violet | provocatrice |

Chaque Xéno : 3 capacités + 1 ultime, inspirées du gabarit (dash insecte, murs d'épines, fumées
ombre, drones, clones, soins, grenades gravité, transformation berserk, copie d'ultime, etc.).
Gardiens : kits simplifiés (3 capacités) utilisables par bots.

### `src/agents/abilities.js`
```js
export class AbilitySystem {
  constructor();                       // récupère engine/world/fx via registry au premier usage
  setupEntity(entity);                 // remplit entity.abilities depuis entity.agentDef.abilities
  tryCast(entity, slot);               // slot: 0,1,2,3 — vérifie cooldown/charges, exécute, émet ability:cast
  update(dt);                          // cooldowns, projectiles actifs, zones actives, effets
  activeZonesAt(pos);                  // -> [{type, owner, ...}] zones affectant une position (soin, dégâts, ralenti)
  visionBlockedThrough(a, b);          // fumées : true si le segment traverse une fumée active
}
```
Implémentations 3D réelles : projectiles avec gravité, zones sphériques avec mesh translucide,
murs (boîtes), fumées (sphères opaques), soins, dash (modifie entity.velocity), téléport,
clones (copie du mesh), transformation (échelle + statMods temporaires), etc. Effets visuels via
`registry.get('fx')`. TOUTES les capacités du roster doivent fonctionner (bots comprises).

### `src/agents/agent.js`
```js
export class AgentAvatar {
  // Gère le mesh 3D + AnimationMixer d'une entité (joueur en 3e personne = caché, bots visibles).
  static async create(entity);         // charge le GLB de entity.agentDef, attache à entity.object3D
  playClip(name, { loop, fade, once }); // crossfade vers un clip
  updateLocomotion(dt);                // choisit idle/run/strafe/crouch selon entity.velocity & état
  attachWeapon(weaponId);              // instancie le GLB d'arme sur WeaponSocket_R
  setRagdollDeath();                   // joue le clip death + effondre
  update(dt);                          // mixer.update
  dispose();
}
export class AgentFactory { async createAvatarFor(entity); }  // registry: 'agentFactory'
```

### `src/game/economy.js`
```js
export class Economy {
  constructor(match);
  startRound(roundNumber, lossStreaks); // crédite chaque entité (émet economy:update)
  award(entity, amount, reason);
  onRoundEnd(winner, reason);
  canAfford(entity, price); spend(entity, price);
  buyWeapon(entity, weaponId); buyArmor(entity, armorId); buyAbilityCharge(entity, slot);
}
```

### `src/game/match.js`
```js
export class MatchController {
  constructor(config /* { playerAgentId, difficulty: 'facile'|'normal'|'expert', boosters: [] } */);
  async start();                       // crée entités+avatars, joue cinématique d'intro, lance round 1
  update(dt);                          // machine d'état : buy/action/post, timers, victoire
  get entities(); get playerEntity(); get score(); get roundNumber(); get phase(); get spike();
  entitiesOfTeam(team); aliveOf(team);
  endMatch(winner);                    // cinématique victoire + écran de fin
}
```
Machine d'état par round : `round:prestart` → cinématique de round (director) → `phase:buy` (14 s)
→ `phase:action` (100 s ; les Xénos peuvent planter le Noyau ; timer 45 s après pose ; défuse 7 s)
→ `round:end` (élimination / explosion / défuse / temps écoulé) → post 6 s → round suivant.
Mi-temps à 12 rounds : inversion des camps (le joueur passe défenseur — les Gardiens qu'il combat
deviennent les attaquants IA). Victoire à 13. Émet TOUS les événements du catalogue. Les bots
morts restent réanimables pendant ROUND.REVIVE_WINDOW.
Le spike (Noyau) : géré dans `src/game/spike.js` (classe `SpikeSystem`, API : `carrier`, `planted`,
`plant(entity, site)`, `startDefuse(entity)`, `cancelDefuse()`, `update(dt)`).

### `src/game/mechanics.js` — LES INNOVATIONS (inexistantes dans les jeux du genre)
```js
export class MechanicsSystem {
  constructor(match);
  update(dt);
  // 1. Évolution Xéno : points par kill/plant/round (EVOLUTION.*) ; à chaque palier, 2 choix
  //    aléatoires proposés (evolution:choice pour le joueur → HUD ; auto pour bots) ; applique statMods.
  // 2. Réanimation tactique : allié mort < REVIVE_WINDOW s → un coéquipier proche (< 2 m) maintient F
  //    REVIVE_HOLD s → revive (1×/round/équipe). Progression émise via revive:progress.
  // 3. Aura de Résurgence (momentum) : équipe à 3+ défaites consécutives → +SHIELD bouclier et
  //    +CREDIT_AURA crédits au round suivant (émet momentum:aura).
  // 4. Événements de map : à ROUND.MAP_EVENT_AT s du round, tire au sort : tempête ionique (zone de
  //    dégâts 5 pv/s qui grossit), ouverture de portes secondaires, inversion gravité dans les
  //    gravityZones (scale -0.3), marché flash (-40% au respawn pendant 10 s). Émet mapevent:trigger.
  // 5. Fusion d'ultimes : 2 alliés ult prêts à < 8 m → cast simultané dans les 4 s = effet amplifié
  //    ×1.6 + bonus (émet ult:fusion).
  // 6. Overdrive : 3 kills sans dégât reçu → pulse wallhack 2 s pour l'entité (silhouettes ennemies).
}
```

### `src/game/combat.js`
```js
export class CombatSystem {
  constructor();                        // registry: collision, match, fx, tracers
  fire(entity, weaponId);               // gère cadence, muni, spread, recoil (retourne true si tiré)
  resolveShot(shooter, origin, dir, weapon);  // raycast murs + entités (tête/corps/jambes), falloff,
                                        // pénétration mur fine, dégâts × statMods, émet weapon:fired/hit
  update(dt);
}
```
Hitboxes : tête = sphère r 0.14 à y+1.52 (relatif aux pieds, ×hauteur/1.8), corps = capsule r 0.3
de y+0.35 à y+1.35, jambes en dessous. Fumées (`abilities.visionBlockedThrough`) ne bloquent PAS
les balles, seulement la vision des bots.

### `src/game/player.js` + `src/core/input.js`
```js
// input.js
export class InputManager {
  constructor(canvas);                 // pointer lock au clic, layout azerty/qwerty depuis profil
  isDown(action); onAction(action, fn) /* retourne off() */; consumeMouseDelta() /* {dx, dy} */;
  setLayout(l); rebind(action, code); get pointerLocked();
}
// actions : forward, back, left, right, jump, crouch, sprint, slide, fire, ads, reload,
// ability1, ability2, ability3, ult, use /* planter/défuser/réanimer */, buy, scoreboard,
// weapon1, weapon2, weapon3, dance, skipCinematic
// AZERTY : ZQSD, A=ability1, E=ability2, C=ability3, X=ult, F=use, B=buy, Tab=scoreboard,
// N=danse (danse en pleine partie !), Espace=jump/skip, Shift=sprint, Ctrl=crouch, R=reload.

// player.js
export class PlayerController {
  constructor(entity);                 // registry: engine, input, collision, combat, abilities
  update(dt);                          // déplacement capsule (collision.moveCapsule), saut, dash
                                       // (double appui sprint), wall-run (saut contre mur → glisse),
                                       // slide (sprint+crouch), zones de gravité, jump pads, téléporteurs,
                                       // viewmodel arme (GLB attaché caméra, bob + recul), tir/ADS/reload,
                                       // capacités (tryCast), use contextuel (plant/defuse/revive), danse.
  get viewmodel();
}
```
Le joueur est en vue FPS : son avatar 3D complet existe mais `visible = false` SAUF pendant les
cinématiques et la danse (passage bref en 3e personne pendant la danse N).

### `src/ai/navigation.js` + `src/ai/bot.js`
```js
// navigation.js
export class NavGraph {
  constructor(layoutJson);
  nearest(pos); path(fromId, toId) /* A*, -> [ids] */; pointOf(id);
  randomReachable(fromPos); nextCorner(path, pos);
}
// bot.js
export class Bot {
  constructor(entity, match);          // personnalité depuis agentDef (agressivité...)
  update(dt);                          // machine d'état : BUY (achats éco intelligents), MOVE,
                                       // PUSH site, HOLD angle, FIGHT (LOS via collision.raycast +
                                       // fumées via abilities.visionBlockedThrough, précision/réaction
                                       // selon difficulté, burst, headshot % borné), PLANT, DEFUSE,
                                       // RETREAT si hp bas, REVIVE allié proche, usage de capacités
                                       // par heuristique de type, danse aléatoire après un ace 😄
}
```
Difficulté : facile (réaction 650 ms, spread ×2.2), normal (400 ms, ×1.4), expert (240 ms, ×1.0).
Les bots se déplacent PHYSIQUEMENT (collision.moveCapsule), jouent leurs anims de locomotion via
avatar.updateLocomotion, tirent avec CombatSystem.fire.

### `src/world/map.js` + `src/world/collision.js`
```js
// map.js
export class GameWorld {
  static async load();                 // charge GLB map + layout JSON + lumières + skybox procédurale
  layout;                              // le JSON parsé
  addDynamic(obj3d); removeDynamic(obj3d);
  siteAt(pos);                         // 'A' | 'B' | null
  update(dt);                          // portes animées, plateformes, hologrammes animés
  setDoorOpen(id, open);
}
// collision.js
export class CollisionWorld {
  constructor(layout);
  moveCapsule(position, velocity, dt, radius, height, opts) // -> { position, velocity, onGround, wallNormal | null }
  raycast(origin, dir, maxDist);       // -> { point, distance, normal, collider } | null   (murs uniquement)
  gravityScaleAt(pos);                 // 1 par défaut, < 1 dans les gravityZones (peut être négatif si inversion)
  setGravityFlip(flipped);
  jumpPadAt(pos); teleporterAt(pos);
  setDoorSolid(id, solid);
}
```
Environnement visuel : station orbitale futuriste au-dessus d'une géante gazeuse — néons,
hologrammes, passerelles, végétation xéno bioluminescente sur les sites, skybox étoilée +
planète (mesh émissif), brouillard léger. AMBIANCE SOIGNÉE (c'est la vitrine du jeu).

### `src/ui/*` (hud.js, menus.js, shop.js, agentselect.js, scoreboard.js)
Chaque classe : `constructor()` + `mount(rootEl)` + écoute du bus. DOM pur, français, style
futuriste néon (styles/ui.css, préfixe de classes `xs-`). Écrans :
- **menus.js** : menu principal (JOUER / ENTRAÎNEMENT / BOUTIQUE / COLLECTION / PASSE XÉNO /
  PARAMÈTRES / QUITTER), choix difficulté, paramètres (sensibilité, volumes, layout clavier,
  qualité, skip intro), écran de fin de match (stats + XP + récompenses), pause (Échap).
- **agentselect.js** : grille des 10 Xénos (portraits = canvas 2D stylisés générés depuis
  colors + bodyType), fiche (rôle, capacités, lore, danse), verrouillage (agents non possédés,
  achetables), bouton VERROUILLER.
- **hud.js** : santé/armure/bouclier, munitions, capacités (icônes + cooldown radial + charges),
  ult (jauge %), timer de round + score + n° round, crédits, minimap canvas top-down (murs depuis
  layout.colliders, points alliés/ennemis repérés, sites A/B, spike), killfeed, hitmarkers,
  indicateur directionnel de dégâts, barre d'évolution + modal de choix (2 cartes), progression
  plant/defuse/revive, notifications, spectateur (« Vous êtes mort — réanimation possible 8 s »),
  crosshair dynamique, annonces centrales (ROUND X — PLANTÉ — FUSION D'ULTIMES etc.).
- **shop.js** : LA BOUTIQUE HYBRIDE F2P/P2W — onglets : Skins d'armes (variants des armes,
  Fragments OU Xenocoins), Agents (déblocage), Boosters P2W (+10% dégâts 1 match, armure de départ,
  +50% XP, -15% cooldowns — ACHETABLES en Xenocoins, ÉQUIPABLES avant match, aussi gagnables en
  missions F2P), Packs Xenocoins (simulés, créditent instantanément), Passe Xéno (20 paliers,
  gratuit + premium 950 XC : skins, danses bonus, XP). Émet shop:purchase, met à jour le profil.
- **scoreboard.js** : Tab — les 10 joueurs, K/D/A, évolution, crédits, ping fictif.

### `src/cinematics/*` (director.js, intro.js, killcam.js, victory.js)
```js
export class CinematicDirector {
  constructor();
  async playMatchIntro(matchCtx);      // « trailer » de lancement : survol spline de la map
                                       // (layout.cameraRails.matchIntro), letterbox 21:9, titres
                                       // (nom map / mode / VS), line-up des 2 équipes (avatars posés
                                       // jouant leur clip intro), slow-mo, transitions, ~18 s, skippable (Espace).
  async playRoundIntro(ctx);           // 5-7 s : caméra sur le spawn de l'équipe, agents en intro/idle,
                                       // bandeau « ROUND N — ATTAQUE/DÉFENSE », skippable.
  async playVictory(ctx);              // équipe gagnante au centre, chaque agent joue SA danse,
                                       // confettis fx, orbite caméra, « VICTOIRE XÉNOS » etc.
  async playKillcam(killer, victim);   // 2.5 s replay simplifié (caméra épaule du tueur), optionnel.
  skip();
}
```
Letterbox + titres : DOM dans #cinematic-layer (classes `xs-cine-*`). Pendant une cinématique :
`engine.setCamera(cineCam)`, `bus.emit('cinematic:start')`, timeScale éventuel 0.5, à la fin tout
restaurer + `cinematic:end`. Avatars visibles (y compris joueur). Musique via `music:mood`.

### `src/fx/*` (particles.js, tracers.js) et `src/core/audio.js`
```js
// particles.js
export class FXSystem {
  constructor(scene);
  muzzleFlash(pos, dir, color); impact(pos, normal, color); blood(pos, color /* sang alien = couleur agent */);
  explosion(pos, radius, color); smokePuff(pos); shieldBreak(pos); confetti(pos);
  teleportFlash(pos); evolutionBurst(entity); danceLights(pos); stormAmbient(center, radius);
  trail(object3d, color) /* -> stop() */; update(dt);
}
// tracers.js
export class TracerSystem { constructor(scene); spawn(from, to, color, speed); update(dt); }
// audio.js — WebAudio 100% procédural (AUCUN fichier audio)
export class AudioSystem {
  constructor();                       // AudioContext lazy (premier clic), écoute bus audio:play + music:mood
  play(sfx, { pos, volume });          // panning spatial simple selon caméra
  setMood(mood);                       // séquenceur musical : menu (synthwave calme), buy (pulsé),
                                       // tension (nappe sombre + percus), clutch (accéléré), victory/defeat (stings)
  setVolumes(sfxVol, musicVol);
}
```

## Intégration (src/main.js — écrit par l'intégrateur, PAS par les agents)

Boot : engine → assets.preload(tous les GLB) → world → systèmes → UI → menu.
Mode smoketest : `?smoketest=1` → `window.__SMOKE = { errors: [], ready: false, state: {} }`,
skip menu, agent zephyr, difficulté normal, cinématiques accélérées (durées ÷ 10), et
`__SMOKE.ready = true` une fois la phase action du round 1 atteinte.

## Règles de qualité

- Chaque fichier passe `node --check <fichier>`.
- `tools/*.mjs` : peuvent importer `three` (installé) et les modules Node natifs.
- JS des `src/` : uniquement `three`, `three/addons/*`, et les modules du projet.
- Aucune dépendance npm supplémentaire. Aucune texture binaire. Pas de fetch externe.
- Commentaires et chaînes UI en français.
- `Math.random()` OK côté jeu (pas dans les scripts de workflow).
