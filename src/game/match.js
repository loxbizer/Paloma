// ============================================================================
// XENOSTRIKE — MatchController : le cœur du jeu.
// Machine d'état d'un match complet : création des 10 combattants (joueur +
// 9 bots), cinématiques, boucle de rounds (préparation → achat → action →
// post-round), économie, mi-temps, prolongation, victoire et récompenses de
// profil. Conforme à docs/CONTRACTS.md.
//
// Communication : uniquement via `bus` et `registry` (aucun import croisé,
// hors sous-modules de game/* qui font partie du même sous-système).
// Robustesse : chaque service externe est récupéré via registry.get() avec
// garde-fous — l'absence d'un module ne fait jamais planter le match.
// ============================================================================
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { CombatEntity } from './entity.js';
import {
  TEAM_XENOS, TEAM_GUARDIANS, GAME_STATES, ROUND, ECONOMY,
  XENO_IDS, GUARDIAN_IDS
} from './constants.js';
import { getAgent } from '../data/agents-data.js';
import { WEAPONS } from '../data/weapons-data.js';
import { Economy } from './economy.js';
import { SpikeSystem } from './spike.js';
import { MechanicsSystem } from './mechanics.js';

// Phases internes — alignées sur GAME_STATES quand un état équivalent existe,
// pour que les autres systèmes puissent comparer directement les chaînes.
const PHASE = {
  IDLE: 'idle',
  INTRO: 'intro',
  PRESTART: 'prestart',
  BUY: GAME_STATES.BUY,          // 'buy'
  ACTION: GAME_STATES.ACTION,    // 'action'
  POST: GAME_STATES.POST_ROUND,  // 'post'
  ENDED: 'ended'
};

const OVERTIME_CAP = 30;        // rounds joués maximum (prolongation comprise)
const OVERTIME_CREDITS = 5000;  // crédits fixes de chaque round de prolongation
const KILL_ULT_CHARGE = 20;     // charge d'ultime par élimination
const PLANT_ULT_CHARGE = 15;    // charge d'ultime pour une pose / une désamorce

// Boosters P2W — définitions canoniques + mots-clés tolérants : la boutique
// (autre sous-système) nomme ses boosters librement, on reconnaît l'intention
// dans l'identifiant pour rester découplés.
const BOOSTER_DEFS = [
  { id: 'booster_damage', keys: ['damage', 'degat', 'dgt', 'dmg'], label: '+10 % de dégâts', mods: { damageMult: 1.10 } },
  { id: 'booster_armor', keys: ['armor', 'armure'], label: 'Armure de départ', mods: { armorBonus: 25 } },
  { id: 'booster_cooldown', keys: ['cooldown', 'recharge', 'cd'], label: '-15 % de recharge', mods: { cooldownMult: 0.85 } },
  { id: 'booster_xp', keys: ['xp'], label: '+50 % d’XP', xpMult: 1.5 }
];

/** Copie mélangée d'une liste (Fisher–Yates). */
function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Autre équipe. */
function otherTeam(team) {
  return team === TEAM_XENOS ? TEAM_GUARDIANS : TEAM_XENOS;
}

// Un seul match actif à la fois : le précédent est nettoyé au lancement.
let ACTIVE_MATCH = null;

export class MatchController {
  /**
   * @param {{ playerAgentId: string, difficulty: 'facile'|'normal'|'expert',
   *           boosters: string[], mode?: string }} config
   */
  constructor(config = {}) {
    this.config = {
      playerAgentId: 'zephyr',
      difficulty: 'normal',
      mode: 'standard',
      boosters: [],
      ...config
    };

    this._entities = [];
    this._player = null;
    this._bots = [];                 // instances de src/ai/bot.js (une par bot)
    this._score = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };
    this._lossStreaks = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };
    this._roundNumber = 0;
    this._phase = PHASE.IDLE;
    this._phaseLeft = 0;
    this._started = false;
    this._generation = 0;            // invalide les flux asynchrones après dispose

    // Camp attaquant : les Xénos attaquent en première mi-temps.
    this.attackTeam = TEAM_XENOS;

    this._freshEconomy = false;      // force les crédits de départ (mi-temps / OT)
    this._overtime = false;
    this._roundOver = false;
    this._lastKill = null;           // { killer, victim } — pour la killcam
    this._mood = null;               // dernière ambiance musicale émise
    this._lastTimerEmit = -1;
    this._lastTimerPhase = null;
    this._xpMult = 1;                // booster +XP
    this._boosterLabels = [];

    // Statistiques du joueur cumulées sur le match (pour le profil).
    this._playerStats = { headshots: 0, plants: 0, revives: 0 };

    // Résultats exposés à l'écran de fin (rempli par endMatch).
    this.results = null;

    // Sous-systèmes du cœur de jeu — créés dès le constructeur : main.js les
    // enregistre dans le registry juste après `new MatchController(...)`.
    this.economy = new Economy(this);
    this._spike = new SpikeSystem(this);
    this.mechanics = new MechanicsSystem(this);

    // Écouteurs de bus (désabonnés dans dispose()).
    this._offs = [
      bus.on('entity:died', (e) => this._onEntityDied(e)),
      bus.on('entity:revived', (e) => this._onEntityRevived(e)),
      bus.on('spike:planted', (e) => this._onSpikePlanted(e)),
      bus.on('spike:defused', (e) => this._onSpikeDefused(e)),
      bus.on('spike:exploded', () => this._onSpikeExploded())
    ];
  }

  // ------------------------------------------------------------ accesseurs --
  get entities() { return this._entities; }
  get playerEntity() { return this._player; }
  get score() { return { ...this._score }; }
  get roundNumber() { return this._roundNumber; }
  get phase() { return this._phase; }
  get spike() { return this._spike; }
  get defendTeam() { return otherTeam(this.attackTeam); }
  get difficulty() { return this.config.difficulty; }
  get roundsPlayed() { return this._score[TEAM_XENOS] + this._score[TEAM_GUARDIANS]; }

  entitiesOfTeam(team) {
    return this._entities.filter((e) => e.team === team);
  }

  aliveOf(team) {
    return this._entities.filter((e) => e.team === team && e.alive);
  }

  /** Camp (côté de spawn) d'une équipe : les attaquants utilisent le côté XENOS
   *  du layout (côté attaque en 1re mi-temps), les défenseurs le côté GUARDIANS. */
  spawnSideOf(team) {
    return team === this.attackTeam ? TEAM_XENOS : TEAM_GUARDIANS;
  }

  // ---------------------------------------------------------------- départ --
  /** Crée les entités et avatars, joue la cinématique d'intro, lance le round 1. */
  async start() {
    if (this._started) return;
    if (ACTIVE_MATCH && ACTIVE_MATCH !== this) {
      try { ACTIVE_MATCH.dispose(); } catch (err) { console.error('[match] nettoyage du match précédent:', err); }
    }
    ACTIVE_MATCH = this;
    this._started = true;
    this._phase = PHASE.INTRO;
    const gen = ++this._generation;

    await this._createEntities();
    if (gen !== this._generation) return;

    this._applyBoosters();

    // L'entité joueur est désignée : main.js crée le PlayerController.
    if (this._player) bus.emit('player:pov', { entity: this._player });

    bus.emit('match:start', { config: this.config });
    bus.emit('game:state', { state: GAME_STATES.CINEMATIC });

    // Positionne tout le monde avant le trailer pour que la caméra ait
    // quelque chose à filmer.
    this._placeEntities();

    const cinematics = registry.get('cinematics');
    if (cinematics && cinematics.playMatchIntro) {
      try { await cinematics.playMatchIntro(this); }
      catch (err) { console.error('[match] cinématique d’intro:', err); }
    }
    if (gen !== this._generation) return;

    await this._beginRound();
  }

  /** Crée les 10 CombatEntity : joueur + 4 bots Xénos + 5 bots Gardiens. */
  async _createEntities() {
    const engine = registry.get('engine');
    const abilities = registry.get('abilities');
    const factory = registry.get('agentFactory');

    // Roster : le joueur + 4 Xénos tirés au sort sans doublon + les 5 Gardiens.
    const playerId = XENO_IDS.includes(this.config.playerAgentId)
      ? this.config.playerAgentId : XENO_IDS[0];
    const allyIds = shuffled(XENO_IDS.filter((id) => id !== playerId)).slice(0, 4);

    const specs = [
      { agentId: playerId, team: TEAM_XENOS, isPlayer: true },
      ...allyIds.map((agentId) => ({ agentId, team: TEAM_XENOS, isPlayer: false })),
      ...GUARDIAN_IDS.map((agentId) => ({ agentId, team: TEAM_GUARDIANS, isPlayer: false }))
    ];

    const avatarJobs = [];
    for (const spec of specs) {
      const agentDef = getAgent(spec.agentId) || { id: spec.agentId, name: spec.agentId, abilities: [] };
      const entity = new CombatEntity({
        name: agentDef.name || spec.agentId,
        team: spec.team,
        agentDef,
        isPlayer: spec.isPlayer,
        isBot: !spec.isPlayer
      });
      this._entities.push(entity);
      if (spec.isPlayer) this._player = entity;

      if (engine && engine.scene) engine.scene.add(entity.object3D);
      if (abilities && abilities.setupEntity) {
        try { abilities.setupEntity(entity); }
        catch (err) { console.error('[match] setup capacités:', err); }
      }

      // Avatar 3D (mesh + animations) — asynchrone, tolérant à l'échec.
      if (factory && factory.createAvatarFor) {
        avatarJobs.push(
          factory.createAvatarFor(entity).catch((err) => {
            console.error(`[match] avatar de ${entity.name} indisponible:`, err);
            return null;
          })
        );
      }
    }
    await Promise.all(avatarJobs);

    // Bots IA — import dynamique : si le module manque, le match reste jouable
    // (entités immobiles) au lieu de planter au chargement.
    let BotClass = null;
    try {
      const mod = await import('../ai/bot.js');
      BotClass = mod.Bot || null;
    } catch (err) {
      console.error('[match] module ai/bot.js indisponible:', err);
      if (window.__SMOKE) window.__SMOKE.errors.push(`bot: ${err && err.stack || err}`);
    }
    if (BotClass) {
      for (const entity of this._entities) {
        if (!entity.isBot) continue;
        try { this._bots.push(new BotClass(entity, this)); }
        catch (err) { console.error(`[match] création du bot ${entity.name}:`, err); }
      }
    }

    for (const entity of this._entities) {
      bus.emit('entity:spawned', { entity });
    }
  }

  /** Applique les boosters P2W équipés aux statMods du joueur et les consomme. */
  _applyBoosters() {
    const ids = Array.isArray(this.config.boosters) ? this.config.boosters : [];
    if (!this._player || ids.length === 0) return;

    for (const rawId of ids) {
      const id = String(rawId).toLowerCase();
      const def = BOOSTER_DEFS.find((b) => b.id === id || b.keys.some((k) => id.includes(k)));
      if (!def) continue;
      if (def.mods) this._player.applyStatMods(def.mods);
      if (def.xpMult) this._xpMult *= def.xpMult;
      this._boosterLabels.push(def.label);
    }
    if (this._boosterLabels.length > 0) {
      bus.emit('ui:notification', {
        text: `Boosters actifs : ${this._boosterLabels.join(' · ')}`,
        type: 'info', duration: 5
      });
    }

    // Consommation : un booster équipé ne vaut que pour un match.
    const profile = registry.get('profile');
    const save = registry.get('save');
    if (profile) {
      for (const rawId of ids) {
        if (profile.ownedBoosters && profile.ownedBoosters[rawId] !== undefined) {
          profile.ownedBoosters[rawId] = Math.max(0, (profile.ownedBoosters[rawId] || 0) - 1);
        }
      }
      profile.activeBoosters = [];
      if (save && save.save) { try { save.save(); } catch (err) { console.error('[match] sauvegarde boosters:', err); } }
    }
  }

  // ------------------------------------------------------- boucle de rounds --
  /** Prépare et lance le round suivant : prestart → cinématique → phase d'achat. */
  async _beginRound() {
    const gen = this._generation;
    this._roundNumber = this.roundsPlayed + 1;
    this._roundOver = false;
    this._lastKill = null;
    this._mood = null;
    this._phase = PHASE.PRESTART;

    const switching = this.roundsPlayed === ROUND.SWITCH_SIDES_AT || this._justSwapped === true;
    this._justSwapped = false;

    bus.emit('round:prestart', {
      roundNumber: this._roundNumber,
      score: this.score,
      switching
    });

    // Remise en place AVANT la cinématique de round : la caméra filme les
    // agents en position sur leur spawn.
    this._placeEntities();
    this._resetEntitiesForRound();
    this._spike.reset();

    const cinematics = registry.get('cinematics');
    if (cinematics && cinematics.playRoundIntro) {
      bus.emit('game:state', { state: GAME_STATES.CINEMATIC });
      try { await cinematics.playRoundIntro(this); }
      catch (err) { console.error('[match] cinématique de round:', err); }
    }
    if (gen !== this._generation) return;

    this._startBuyPhase();
  }

  /** Positionne chaque entité sur son point de spawn (layout.spawns selon camp). */
  _placeEntities() {
    const world = registry.get('world');
    const layout = world && world.layout ? world.layout : null;
    const spawns = layout && layout.spawns ? layout.spawns : null;

    for (const team of [TEAM_XENOS, TEAM_GUARDIANS]) {
      const side = this.spawnSideOf(team);
      const list = (spawns && spawns[side]) || [];
      const members = this.entitiesOfTeam(team);
      members.forEach((entity, i) => {
        const s = list[i % Math.max(1, list.length)] || [0, 0, i * 2, 0];
        entity.position.set(s[0], s[1], s[2]);
        entity.yaw = s[3] || 0;
        entity.pitch = 0;
        entity.velocity.set(0, 0, 0);
        entity.object3D.rotation.set(0, entity.yaw, 0);
        entity.onGround = true;
        entity.crouching = false;
      });
    }
  }

  /** resetForRound + réattribution des armes achetées + munitions pleines. */
  _resetEntitiesForRound() {
    const factory = registry.get('agentFactory');
    for (const entity of this._entities) {
      entity.resetForRound();

      // Munitions pleines pour tout l'inventaire conservé.
      for (const slot of ['primary', 'secondary', 'melee']) {
        const weaponId = entity.inventory[slot];
        const def = weaponId ? WEAPONS[weaponId] : null;
        if (def) entity.ammo[weaponId] = { mag: def.magSize, reserve: def.reserve };
      }

      // Slot actif : l'arme principale si possédée, sinon l'arme de poing.
      entity.currentSlot = entity.inventory.primary ? 'primary' : 'secondary';
      const weaponId = entity.inventory[entity.currentSlot];
      bus.emit('weapon:switched', { entity, slot: entity.currentSlot, weaponId });

      // Réattache le modèle d'arme au socket de la main droite.
      const avatar = entity.avatar || (factory && factory.avatarOf ? factory.avatarOf(entity) : null);
      if (avatar && avatar.attachWeapon && weaponId) {
        try {
          const p = avatar.attachWeapon(weaponId);
          if (p && p.catch) p.catch(() => {});
        } catch (err) { console.error('[match] attache d’arme:', err); }
      }
    }
  }

  /** Phase d'achat : 14 s, crédits versés, les bots achètent d'eux-mêmes. */
  _startBuyPhase() {
    this._phase = PHASE.BUY;
    this._phaseLeft = ROUND.BUY_TIME;
    this._lastTimerEmit = -1;

    this.economy.startRound(this._roundNumber, { ...this._lossStreaks }, {
      fresh: this._freshEconomy,
      credits: this._overtime ? OVERTIME_CREDITS : undefined
    });
    this._freshEconomy = false;

    bus.emit('phase:buy', { duration: ROUND.BUY_TIME, roundNumber: this._roundNumber });
    bus.emit('game:state', { state: GAME_STATES.BUY });
    this._setMood('buy');
  }

  /** Phase d'action : 100 s — plant, défuse, éliminations. */
  _startActionPhase() {
    this._phase = PHASE.ACTION;
    this._phaseLeft = ROUND.ACTION_TIME;
    this._lastTimerEmit = -1;

    bus.emit('buy:close', {});
    bus.emit('phase:action', { roundNumber: this._roundNumber });
    bus.emit('game:state', { state: GAME_STATES.ACTION });
    this._setMood('tension');
  }

  // -------------------------------------------------------------- update ----
  /**
   * Avance la machine d'état : bots, spike, mécaniques inédites, minuteries.
   * NB : combat/abilities/fx/tracers sont mis à jour par la boucle de main.js —
   * on ne les rappelle pas ici pour éviter un double update par frame.
   */
  update(dt) {
    if (!this._started || dt <= 0) return;

    const inRound = this._phase === PHASE.BUY || this._phase === PHASE.ACTION || this._phase === PHASE.POST;

    // Bots : chacun est isolé dans un try/catch pour qu'une IA défaillante
    // n'immobilise pas les neuf autres.
    if (inRound) {
      for (const bot of this._bots) {
        try { if (bot && bot.update) bot.update(dt); }
        catch (err) { console.error('[match] bot:', err); if (window.__SMOKE) window.__SMOKE.errors.push(String(err && err.stack || err)); }
      }
    }

    // Noyau de Singularité + mécaniques inédites.
    if (inRound) {
      try { this._spike.update(dt); }
      catch (err) { console.error('[match] spike:', err); }
      try { this.mechanics.update(dt); }
      catch (err) { console.error('[match] mechanics:', err); }
    }

    switch (this._phase) {
      case PHASE.BUY: {
        this._phaseLeft -= dt;
        this._emitTimer(this._phaseLeft, PHASE.BUY);
        if (this._phaseLeft <= 0) this._startActionPhase();
        break;
      }
      case PHASE.ACTION: {
        if (!this._spike.planted) {
          this._phaseLeft -= dt;
          this._emitTimer(this._phaseLeft, PHASE.ACTION);
          if (this._phaseLeft <= 0 && !this._roundOver) {
            // Temps écoulé sans pose : victoire des défenseurs.
            this._endRound(this.defendTeam, 'timeout');
            break;
          }
        } else {
          // Une fois le Noyau posé, le chrono affiché est celui de l'explosion.
          this._emitTimer(this._spike.timeLeft, PHASE.ACTION);
        }
        this._checkElimination();
        break;
      }
      case PHASE.POST: {
        this._phaseLeft -= dt;
        if (this._phaseLeft <= 0) this._afterPost();
        break;
      }
      default:
        break;
    }
  }

  /** Émet round:timer une fois par seconde entière (phases buy / action). */
  _emitTimer(remainingRaw, phase) {
    const remaining = Math.max(0, Math.ceil(remainingRaw));
    if (remaining === this._lastTimerEmit && phase === this._lastTimerPhase) return;
    this._lastTimerEmit = remaining;
    this._lastTimerPhase = phase;
    bus.emit('round:timer', { remaining, phase });
  }

  /** Fin de round par élimination totale d'un camp. */
  _checkElimination() {
    if (this._roundOver || this._phase !== PHASE.ACTION) return;
    const attackersAlive = this.aliveOf(this.attackTeam).length;
    const defendersAlive = this.aliveOf(this.defendTeam).length;

    if (defendersAlive === 0) {
      // Plus personne pour désamorcer / défendre : les attaquants l'emportent.
      this._endRound(this.attackTeam, 'elimination');
    } else if (attackersAlive === 0 && !this._spike.planted) {
      // Si le Noyau est posé, le round continue jusqu'à explosion / désamorce.
      this._endRound(this.defendTeam, 'elimination');
    }
  }

  // ------------------------------------------------------------ fin de round --
  _endRound(winner, reason) {
    if (this._roundOver || this._phase === PHASE.ENDED) return;
    this._roundOver = true;

    this._score[winner]++;
    const loser = otherTeam(winner);
    this._lossStreaks[winner] = 0;
    this._lossStreaks[loser]++;

    this._spike.endRound();
    this.economy.onRoundEnd(winner, reason);

    bus.emit('round:end', { winner, reason, score: this.score });

    // Jingle de round selon le camp du joueur.
    const playerWon = this._player && this._player.team === winner;
    bus.emit('audio:play', { sfx: playerWon ? 'round_win' : 'round_lose', volume: 0.9 });

    // Killcam du frag décisif (optionnelle — le réalisateur peut l'ignorer).
    if (reason === 'elimination' && this._lastKill && this._lastKill.killer) {
      const cinematics = registry.get('cinematics');
      if (cinematics && cinematics.playKillcam) {
        try {
          const p = cinematics.playKillcam(this._lastKill.killer, this._lastKill.victim);
          if (p && p.catch) p.catch(() => {});
        } catch (err) { console.error('[match] killcam:', err); }
      }
    }

    this._phase = PHASE.POST;
    this._phaseLeft = ROUND.POST_TIME;
    bus.emit('game:state', { state: GAME_STATES.POST_ROUND });
  }

  /** Après le post-round : victoire, mi-temps, prolongation ou round suivant. */
  _afterPost() {
    const played = this.roundsPlayed;
    const sx = this._score[TEAM_XENOS];
    const sg = this._score[TEAM_GUARDIANS];

    // Victoire : 13 rounds avec 2 d'écart (l'écart de 2 ne joue qu'en
    // prolongation — avant 12-12, premier à 13 = 2 d'écart garanti).
    for (const team of [TEAM_XENOS, TEAM_GUARDIANS]) {
      const a = this._score[team];
      const b = this._score[otherTeam(team)];
      if (a >= ROUND.ROUNDS_TO_WIN && a - b >= 2) {
        this.endMatch(team);
        return;
      }
    }

    // Plafond absolu de la prolongation : 30 rounds.
    if (played >= OVERTIME_CAP) {
      let winner;
      if (sx !== sg) winner = sx > sg ? TEAM_XENOS : TEAM_GUARDIANS;
      else winner = this._lastKill && this._lastKill.killer ? this._lastKill.killer.team : TEAM_XENOS;
      this.endMatch(winner);
      return;
    }

    // Mi-temps à 12 rounds joués : inversion des camps.
    if (played === ROUND.SWITCH_SIDES_AT) {
      this._halftime();
    } else if (played >= ROUND.MAX_ROUNDS) {
      // Prolongation « simple » : un round de chaque côté, économie fixe,
      // jusqu'à 2 rounds d'écart (plafond 30).
      this._overtimeSwap(played === ROUND.MAX_ROUNDS);
    }

    this._beginRound();
  }

  /** Mi-temps : swap des camps, le Noyau change de mains, économie/streaks à zéro. */
  _halftime() {
    this.attackTeam = otherTeam(this.attackTeam);
    this._justSwapped = true;
    this._freshEconomy = true;
    this._lossStreaks = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };

    // Retour au « pistol round » : plus d'arme principale, plus d'armure.
    for (const entity of this._entities) {
      entity.inventory.primary = null;
      entity.currentSlot = 'secondary';
      entity.armor = 0;
      entity.shield = 0;
      entity.ammo = {};
    }

    const playerAttacks = this._player && this._player.team === this.attackTeam;
    bus.emit('ui:notification', {
      text: playerAttacks
        ? 'MI-TEMPS — Changement de camp : à vous de porter le Noyau !'
        : 'MI-TEMPS — Changement de camp : défendez les sites contre le Noyau !',
      type: 'warn', duration: 5
    });
  }

  /** Entrée / alternance de prolongation : swap de camp + économie fixe. */
  _overtimeSwap(entering) {
    this._overtime = true;
    this.attackTeam = otherTeam(this.attackTeam);
    this._justSwapped = true;
    this._freshEconomy = true;

    for (const entity of this._entities) {
      entity.inventory.primary = null;
      entity.currentSlot = 'secondary';
      entity.armor = 0;
      entity.shield = 0;
      entity.ammo = {};
    }

    if (entering) {
      bus.emit('ui:notification', {
        text: 'PROLONGATION — 2 rounds d’écart pour l’emporter !',
        type: 'warn', duration: 5
      });
    }
  }

  // ------------------------------------------------------------ fin de match --
  /** Cinématique de victoire, récompenses de profil, écran de fin. */
  async endMatch(winner) {
    if (this._phase === PHASE.ENDED) return;
    this._phase = PHASE.ENDED;
    const gen = this._generation;

    const playerWon = this._player ? this._player.team === winner : winner === TEAM_XENOS;
    this._setMood(playerWon ? 'victory' : 'defeat');
    bus.emit('match:end', { winner, score: this.score });
    bus.emit('game:state', { state: GAME_STATES.CINEMATIC });

    const cinematics = registry.get('cinematics');
    if (cinematics && cinematics.playVictory) {
      try { await cinematics.playVictory(this); }
      catch (err) { console.error('[match] cinématique de victoire:', err); }
    }
    if (gen !== this._generation) return;

    this._grantProfileRewards(winner, playerWon);

    bus.emit('game:state', { state: GAME_STATES.VICTORY });
  }

  /** XP, crédits et statistiques versés au profil selon la performance. */
  _grantProfileRewards(winner, playerWon) {
    const p = this._player;
    const kills = p ? p.kills : 0;
    const deaths = p ? p.deaths : 0;
    const assists = p ? p.assists : 0;
    const myScore = p ? this._score[p.team] : 0;

    const xpGained = Math.round(
      (180 + kills * 25 + assists * 10 + myScore * 30 + (playerWon ? 350 : 120)) * this._xpMult
    );
    const creditsGained = 300 + kills * 40 + myScore * 60 + (playerWon ? 500 : 150);

    this.results = {
      winner,
      won: playerWon,
      score: this.score,
      rounds: this.roundsPlayed,
      kills, deaths, assists,
      headshots: this._playerStats.headshots,
      plants: this._playerStats.plants,
      revives: this._playerStats.revives,
      evolutionLevel: p ? p.evolutionLevel : 0,
      xpGained,
      creditsGained,
      boosters: this._boosterLabels.slice()
    };

    const profile = registry.get('profile');
    if (profile) {
      profile.stats = profile.stats || {};
      profile.stats.matches = (profile.stats.matches || 0) + 1;
      if (playerWon) profile.stats.wins = (profile.stats.wins || 0) + 1;
      profile.stats.kills = (profile.stats.kills || 0) + kills;
      profile.stats.deaths = (profile.stats.deaths || 0) + deaths;
      profile.stats.headshots = (profile.stats.headshots || 0) + this._playerStats.headshots;
      profile.stats.plants = (profile.stats.plants || 0) + this._playerStats.plants;
      profile.stats.revives = (profile.stats.revives || 0) + this._playerStats.revives;

      profile.credits = (profile.credits || 0) + creditsGained;
      profile.xp = (profile.xp || 0) + xpGained;
      profile.level = Math.max(profile.level || 1, Math.floor(profile.xp / 1000) + 1);

      // Passe Xéno : 800 XP par palier, plafond 20.
      profile.battlePass = profile.battlePass || { tier: 1, xp: 0, premium: false };
      profile.battlePass.xp += xpGained;
      while (profile.battlePass.xp >= 800 && profile.battlePass.tier < 20) {
        profile.battlePass.xp -= 800;
        profile.battlePass.tier++;
      }

      const save = registry.get('save');
      if (save && save.save) {
        try { save.save(); } catch (err) { console.error('[match] sauvegarde profil:', err); }
      }
    }
  }

  // ------------------------------------------------------------- écouteurs --
  _onEntityDied({ entity, killer, weapon, headshot }) {
    if (!this._started || this._phase === PHASE.ENDED) return;
    this._lastKill = { killer: killer || null, victim: entity };

    bus.emit('ui:killfeed', {
      killerName: killer ? killer.name : '',
      victimName: entity.name,
      weaponId: weapon || 'blade',
      headshot: !!headshot,
      killerTeam: killer ? killer.team : null
    });

    if (killer && killer !== entity && killer.team !== entity.team) {
      this.economy.award(killer, ECONOMY.KILL_REWARD, 'kill');
      killer.addUltCharge(KILL_ULT_CHARGE);
      if (killer.isPlayer) {
        bus.emit('audio:play', { sfx: 'kill_confirm', volume: 0.8 });
        if (headshot) this._playerStats.headshots++;
      }
    }

    this._refreshMood();
  }

  _onEntityRevived({ by }) {
    if (by && by.isPlayer) this._playerStats.revives++;
  }

  _onSpikePlanted({ entity }) {
    if (this._phase !== PHASE.ACTION) return;
    if (entity) {
      this.economy.award(entity, ECONOMY.PLANT_BONUS, 'plant');
      entity.addUltCharge(PLANT_ULT_CHARGE);
      if (entity.isPlayer) this._playerStats.plants++;
    }
    this._refreshMood();
  }

  _onSpikeDefused({ entity }) {
    if (this._roundOver || this._phase !== PHASE.ACTION) return;
    if (entity) {
      this.economy.award(entity, ECONOMY.DEFUSE_BONUS, 'defuse');
      entity.addUltCharge(PLANT_ULT_CHARGE);
    }
    this._endRound(this.defendTeam, 'defuse');
  }

  _onSpikeExploded() {
    if (this._roundOver || this._phase !== PHASE.ACTION) return;
    this._endRound(this.attackTeam, 'explosion');
  }

  /** Ambiance musicale : tension par défaut, clutch en 1 contre X ou Noyau posé. */
  _refreshMood() {
    if (this._phase !== PHASE.ACTION || !this._player) return;
    const allies = this.aliveOf(this._player.team).length;
    const foes = this.aliveOf(otherTeam(this._player.team)).length;

    let mood = 'tension';
    if (this._spike.planted) mood = 'clutch';
    if ((allies === 1 && foes >= 2) || (foes === 1 && allies >= 2)) mood = 'clutch';
    this._setMood(mood);
  }

  _setMood(mood) {
    if (mood === this._mood) return;
    this._mood = mood;
    bus.emit('music:mood', { mood });
  }

  // -------------------------------------------------------------- nettoyage --
  /** Détache tout : écouteurs, entités de la scène, sous-systèmes. */
  dispose() {
    this._generation++;
    this._started = false;
    this._phase = PHASE.ENDED;

    for (const off of this._offs) { try { off(); } catch { /* déjà détaché */ } }
    this._offs = [];

    const engine = registry.get('engine');
    for (const entity of this._entities) {
      try {
        if (entity.avatar && entity.avatar.dispose) entity.avatar.dispose();
        if (engine && engine.scene) engine.scene.remove(entity.object3D);
      } catch (err) { console.error('[match] dispose entité:', err); }
    }
    this._entities = [];
    this._bots = [];

    try { this._spike.dispose(); } catch { /* rien */ }
    try { this.mechanics.dispose(); } catch { /* rien */ }
    try { this.economy.dispose(); } catch { /* rien */ }

    if (ACTIVE_MATCH === this) ACTIVE_MATCH = null;
  }
}
