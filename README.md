# XENOCLASH — 5v5 Tactical (Aliens vs Humains)

Un FPS tactique **5v5 entièrement en 3D** (aucun 2.5D), futuriste, inspiré de Valorant
mais avec ses propres mécaniques. Tu contrôles un essaim de **Xénomorphes** face à la
**Coalition Humaine** — pas de terro/gardien. Moteur **Three.js**, packagé en app desktop
**Electron** (distribuable Steam/Epic).

> ⚠️ **Statut : prototype jouable.** Personnages, armes et map sont en **géométrie 3D
> procédurale** (kit modulaire de primitives, look cartoon-réaliste), pas des modèles GLB
> d'artiste ni de la mocap — ceux-ci demandent un studio. Tout le **gameplay** demandé est
> là et fonctionnel. C'est une base solide sur laquelle brancher de vrais assets GLB.

## Lancer le jeu

```bash
npm install            # (le binaire Electron peut nécessiter un réseau non filtré)
npm run dev            # dev navigateur : http://localhost:5173
npm run electron:dev   # build + fenêtre desktop native
npm run dist           # génère l'installeur (release/) — Windows/macOS/Linux
```

Si l'installation d'Electron échoue (téléchargement du binaire bloqué), le jeu tourne
quand même en navigateur avec `npm run dev` / `npm run build && npm run preview`.

## Contrôles

| Touche | Action |
|--------|--------|
| WASD | Déplacement · **Shift** sprint |
| Souris | Viser · **Clic gauche** tirer |
| R | Recharger · **E** capacité · **F** danse (emote) |
| G | Amorcer le Noyau (sur un site) · **Tab/Prêt** fermer la boutique |

## Ce qui est demandé → ce qui est livré

- ✅ **3D complète**, thème futuriste, station orbitale « Orbital-7 »
- ✅ **Aliens (Xénomorphes) vs Humains** — factions réécrites
- ✅ **5 agents Aliens** jouables, chacun avec **personnalité + capacité unique**
- ✅ **Cinématiques** : trailer au boot + travelling au début de chaque manche (in-engine)
- ✅ **Manches**, économie, objectif **Noyau** (plant/détonation), score en 13
- ✅ **Free-to-Play + Pay-to-Win** assumé : double monnaie (Crédits gratuits + Cristaux ◈)
- ✅ **Animations** procédurales : idle, course, recul de tir, **danse**
- ✅ **Mécaniques inédites** absentes de Valorant (voir `docs/DESIGN.md`)

## Les mécaniques inédites (le « statistiquement mieux »)

| Capacité | Agent | Pourquoi c'est nouveau |
|----------|-------|------------------------|
| **Puits de Gravité** | NULL | Aspire les ennemis vers un point + les ralentit — contrôle de zone actif, pas juste bloquant |
| **Rembobinage** | RIFT | Rends ta position **et** tes PV d'il y a 2 s — une « seconde chance » skill-based |
| **Vision de Ruche** | ECHO | Wallhack **partagé à toute l'équipe** quelques secondes |
| **Surcharge** | (Humains) | +50 % dégâts mais auto-brûlure : risque/récompense pur |

Détail complet, valeurs et intentions de design dans **`docs/DESIGN.md`**.

## Architecture

```
src/
  engine/    renderer, input (pointer-lock FPS), audio (SFX synthétisés)
  world/     map procédurale modulaire · rig de perso animable
  entities/  combattant (PV/collision/historique) · IA des bots · système d'armes hitscan
  game/      roster (agents/armes) · abilities (mécaniques inédites) · économie
  ui/        HUD, menus, boutique · styles
  cinematic/ séquences caméra scriptées (trailer + intro de manche)
  main.js    machine à états : boot → menu → sélection → [achat → live → fin]*
electron/    coquille desktop (Steam/Epic)
```
