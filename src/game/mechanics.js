// ============================================================================
// XENOSTRIKE — MechanicsSystem : LES 6 MÉCANIQUES INÉDITES.
//
//  1. Évolution Xéno       — points par kill/assist/pose/round ; à chaque
//                            palier, 2 choix d'amélioration (le joueur choisit
//                            via evolution:choice/evolution:pick, les bots
//                            décident seuls) ; applique les statMods.
//  2. Réanimation tactique — allié mort depuis < 8 s : un coéquipier à < 2 m
//                            maintient F pendant 3,5 s (1×/round/équipe).
//                            Progression émise via revive:progress.
//  3. Aura de Résurgence   — 3+ défaites consécutives : bouclier + crédits
//                            bonus au round suivant (momentum:aura).
//  4. Événements de map    — à 50 s du round : tempête ionique (zone de dégâts
//                            croissante), ouverture des sas auxiliaires,
//                            inversion gravitationnelle, marché noir éclair.
//                            Chaque événement a un nom français annoncé.
//  5. Fusion d'ultimes     — 2 alliés ultime prêt à < 8 m qui lancent dans une
//                            fenêtre de 4 s : effet amplifié ×1,6 + bonus
//                            (abilities.castUltimateFused, ult:fusion).
//  6. Overdrive            — 3 kills sans dégât reçu : pulse « wallhack » de
//                            2 s (silhouettes ennemies révélées).
//
// Aucun service n'est indispensable : chaque accès registry est gardé.
// ============================================================================
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { TEAM_XENOS, TEAM_GUARDIANS, ROUND, EVOLUTION, MOMENTUM } from './constants.js';

// --- Réanimation tactique ---------------------------------------------------
const REVIVE_RANGE = 2.0;       // distance max au corps (m)
const REVIVE_USES_PER_ROUND = 1;
const HOLD_REFRESH = 0.3;       // fenêtre de rafraîchissement du maintien (s)

// --- Fusion d'ultimes ---------------------------------------------------------
const FUSION_RANGE = 8;
const FUSION_WINDOW = 4;
const FUSION_MULT = 1.6;
const FUSION_BOT_DELAY = 0.9;   // délai avant que le bot partenaire ne fusionne

// --- Overdrive ----------------------------------------------------------------
const OVERDRIVE_KILLS = 3;
const OVERDRIVE_DURATION = 2;

// --- Tempête ionique ----------------------------------------------------------
const STORM = { DPS: 5, START_RADIUS: 3.5, MAX_RADIUS: 15, GROW_TIME: 22, TICK: 0.5 };
const GRAVITY_FLIP_DURATION = 10;

// Événements de map — noms français annoncés à l'écran.
const MAP_EVENT_DEFS = [
  { type: 'ion_storm', name: 'Tempête Ionique', sfx: 'storm' },
  { type: 'doors', name: 'Ouverture des Sas Auxiliaires', sfx: 'door' },
  { type: 'gravity_flip', name: 'Inversion Gravitationnelle', sfx: 'storm' },
  { type: 'flash_market', name: 'Marché Noir Éclair', sfx: 'notification' }
];

// Préférence d'évolution des bots selon leur rôle (petite touche de caractère).
const BOT_EVO_PREFS = {
  'Duelliste': ['evo_damage', 'evo_speed'],
  'Éclaireur': ['evo_speed', 'evo_cd'],
  'Sentinelle': ['evo_hp', 'evo_armor'],
  'Contrôleur': ['evo_cd', 'evo_ult'],
  'Soutien': ['evo_cd', 'evo_hp']
};

function wallNow() { return performance.now() / 1000; }

export class MechanicsSystem {
  constructor(match) {
    this.match = match;

    this._clock = 0;                     // horloge interne (suit engine.timeScale)

    // 1. Évolution
    this._pendingEvo = new Map();        // entityId -> { entity, level, options, botDecideAt }
    this._takenEvo = new Map();          // entityId -> Set(choiceId)

    // 2. Réanimation
    this._reviveUses = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };
    this._revivers = new Map();          // reviverId -> { reviver, target, progress, lastRefresh }

    // 3. Aura de Résurgence
    this._streaks = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };

    // 4. Événements de map
    this._actionClock = 0;
    this._actionActive = false;
    this._eventDone = false;
    this._storm = null;                  // { center, radius, t, tickIn, fxIn }
    this._gravityFlipUntil = 0;
    this._doorsOpened = [];              // ids des sas ouverts par l'événement

    // 5. Fusion d'ultimes
    this._fusionWindow = null;           // { caster, casterId, team, until, partnerIds }
    this._fusionBotTask = null;          // { at, caster, partner }
    this._pendingFusedId = null;         // id du cast fusionné déclenché par nous

    // 6. Overdrive
    this._odCounters = new Map();        // entityId -> kills sans dégât reçu

    // Registre des dégâts récents (assists) : victimId -> Map(sourceId -> { source, time })
    this._damagers = new Map();

    this._offs = [
      bus.on('entity:damaged', (e) => this._onDamaged(e)),
      bus.on('entity:died', (e) => this._onDied(e)),
      bus.on('spike:planted', (e) => this._onPlanted(e)),
      bus.on('round:end', (e) => this._onRoundEnd(e)),
      bus.on('round:prestart', (e) => this._onPrestart(e)),
      bus.on('phase:buy', () => this._onBuyPhase()),
      bus.on('phase:action', () => { this._actionActive = true; this._actionClock = 0; }),
      bus.on('ability:cast', (e) => this._onAbilityCast(e)),
      bus.on('evolution:pick', (e) => this._onEvolutionPick(e))
    ];
  }

  // ------------------------------------------------------------- utilitaires --
  _entities() { return this.match ? this.match.entities : []; }
  _economy() { return (this.match && this.match.economy) || registry.get('economy'); }
  _fx() { return registry.get('fx'); }
  _sfx(sfx, pos, volume = 1) {
    bus.emit('audio:play', { sfx, pos: pos ? pos.clone() : undefined, volume });
  }
  _notify(text, type = 'info', duration = 4) {
    bus.emit('ui:notification', { text, type, duration });
  }

  // ---------------------------------------------------------------- update ----
  update(dt) {
    if (dt <= 0) return;
    this._clock += dt;

    this._updateEvolutionBots();
    this._updateRevives(dt);
    this._updateMapEvents(dt);
    this._updateFusion();
  }

  // ============================================================ 1. ÉVOLUTION ==
  /** Points d'évolution — réservés aux Xénos (l'Essaim mute, pas les humains). */
  _addEvolution(entity, points) {
    if (!entity || !entity.agentDef || entity.agentDef.species !== 'xeno') return;
    entity.evolutionPoints += points;
    this._checkEvolutionLevel(entity);
  }

  _checkEvolutionLevel(entity) {
    const next = entity.evolutionLevel; // niveau 0 → seuil THRESHOLDS[0], etc.
    if (next >= EVOLUTION.THRESHOLDS.length) return;
    if (entity.evolutionPoints < EVOLUTION.THRESHOLDS[next]) return;
    if (this._pendingEvo.has(entity.id)) return; // un choix à la fois

    const level = next + 1;
    const options = this._pickEvolutionOptions(entity);
    this._pendingEvo.set(entity.id, {
      entity, level, options,
      botDecideAt: this._clock + 1.2 + Math.random() * 1.5
    });

    if (entity.isPlayer) {
      bus.emit('evolution:choice', { entity, level, options });
      this._sfx('evo_levelup', entity.position, 0.7);
    }
  }

  /** Deux choix aléatoires distincts, en évitant les améliorations déjà prises. */
  _pickEvolutionOptions(entity) {
    const taken = this._takenEvo.get(entity.id) || new Set();
    let pool = EVOLUTION.CHOICES.filter((c) => !taken.has(c.id));
    if (pool.length < 2) pool = EVOLUTION.CHOICES.slice();
    const shuffledPool = pool.slice();
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }
    const first = shuffledPool[0];
    const second = shuffledPool.find((c) => c.id !== first.id) || shuffledPool[0];
    return [first, second];
  }

  _onEvolutionPick({ entity, choiceId }) {
    if (!entity) return;
    const pending = this._pendingEvo.get(entity.id);
    if (!pending) return;
    const choice = pending.options.find((c) => c.id === choiceId) || pending.options[0];
    this._applyEvolution(pending, choice);
  }

  /** Les bots choisissent seuls, selon la préférence de leur rôle. */
  _updateEvolutionBots() {
    for (const pending of [...this._pendingEvo.values()]) {
      const e = pending.entity;
      if (!e.isBot || this._clock < pending.botDecideAt) continue;
      const prefs = BOT_EVO_PREFS[e.agentDef && e.agentDef.role] || [];
      const choice = pending.options.find((c) => prefs.includes(c.id))
        || pending.options[Math.floor(Math.random() * pending.options.length)];
      this._applyEvolution(pending, choice);
    }
  }

  _applyEvolution(pending, choice) {
    const entity = pending.entity;
    this._pendingEvo.delete(entity.id);

    if (!this._takenEvo.has(entity.id)) this._takenEvo.set(entity.id, new Set());
    this._takenEvo.get(entity.id).add(choice.id);

    entity.applyStatMods(choice.apply);
    // Bénéfices immédiats : les PV et l'armure bonus valent dès maintenant.
    if (choice.apply.hpBonus) entity.hp = Math.min(entity.maxHp, entity.hp + choice.apply.hpBonus);
    if (choice.apply.armorBonus) entity.armor = Math.max(entity.armor, choice.apply.armorBonus);

    entity.evolutionLevel = pending.level;
    bus.emit('evolution:levelup', { entity, level: pending.level, choice });

    const fx = this._fx();
    if (fx && fx.evolutionBurst) {
      try { fx.evolutionBurst(entity); } catch { /* fx optionnel */ }
    }
    this._sfx('evo_levelup', entity.position, 0.9);
    if (entity.isPlayer) {
      this._notify(`ÉVOLUTION NIVEAU ${pending.level} — ${choice.name} : ${choice.desc}`, 'evo', 4.5);
    }

    // Palier suivant déjà atteint ? (grosse série de kills)
    this._checkEvolutionLevel(entity);
  }

  // ======================================================== 2. RÉANIMATION ==
  /**
   * API publique de maintien (joueur ET bots) : à rappeler chaque frame tant
   * que la touche/l'intention est tenue. Retourne true si une réanimation
   * progresse pour ce sauveteur.
   */
  tryRevive(reviver) {
    if (!reviver || !reviver.alive) return false;
    if ((this._reviveUses[reviver.team] || 0) >= REVIVE_USES_PER_ROUND) return false;

    let rec = this._revivers.get(reviver.id);
    if (rec && !this._reviveTargetValid(reviver, rec.target)) {
      this._revivers.delete(reviver.id);
      rec = null;
    }
    if (!rec) {
      const target = this._findRevivable(reviver);
      if (!target) return false;
      rec = { reviver, target, progress: 0, lastRefresh: this._clock };
      this._revivers.set(reviver.id, rec);
    } else {
      rec.lastRefresh = this._clock;
    }
    return true;
  }

  _reviveTargetValid(reviver, target) {
    if (!target || target.alive || target.revivedThisRound) return false;
    if (wallNow() - target.downedAt > ROUND.REVIVE_WINDOW) return false;
    return reviver.position.distanceTo(target.position) <= REVIVE_RANGE + 0.4;
  }

  _findRevivable(reviver) {
    let best = null, bestD = Infinity;
    for (const e of this._entities()) {
      if (e === reviver || e.team !== reviver.team || e.alive || e.revivedThisRound) continue;
      if (e.downedAt < 0 || wallNow() - e.downedAt > ROUND.REVIVE_WINDOW) continue;
      const d = reviver.position.distanceTo(e.position);
      if (d <= REVIVE_RANGE && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  _updateRevives(dt) {
    // Auto-assistance des bots : un bot presque immobile près d'un allié
    // réanimable entretient le maintien même si son IA ne le fait pas.
    for (const e of this._entities()) {
      if (!e.isBot || !e.alive || this._revivers.has(e.id)) continue;
      if ((this._reviveUses[e.team] || 0) >= REVIVE_USES_PER_ROUND) continue;
      if (e.velocity.length() > 1.5) continue;
      const target = this._findRevivable(e);
      if (target) this.tryRevive(e);
    }

    for (const rec of [...this._revivers.values()]) {
      const stale = this._clock - rec.lastRefresh > HOLD_REFRESH;
      if (stale || !rec.reviver.alive || !this._reviveTargetValid(rec.reviver, rec.target)) {
        this._revivers.delete(rec.reviver.id);
        bus.emit('revive:progress', { entity: rec.target, progress: 0 });
        continue;
      }
      rec.progress += dt;
      bus.emit('revive:progress', {
        entity: rec.target,
        progress: Math.min(1, rec.progress / ROUND.REVIVE_HOLD)
      });
      if (rec.progress >= ROUND.REVIVE_HOLD) {
        this._completeRevive(rec);
      }
    }
  }

  _completeRevive(rec) {
    this._revivers.delete(rec.reviver.id);
    // Purge des autres maintiens sur la même cible.
    for (const [id, other] of [...this._revivers.entries()]) {
      if (other.target === rec.target) this._revivers.delete(id);
    }
    this._reviveUses[rec.reviver.team] = (this._reviveUses[rec.reviver.team] || 0) + 1;

    rec.target.revive(rec.reviver);
    this._sfx('revive', rec.target.position, 1);
    const fx = this._fx();
    if (fx && fx.teleportFlash) {
      try { fx.teleportFlash(rec.target.position.clone()); } catch { /* fx optionnel */ }
    }
    if (rec.reviver.isPlayer || rec.target.isPlayer) {
      this._notify(`RÉANIMATION TACTIQUE — ${rec.target.name} est de retour !`, 'info', 4);
    }
  }

  // ==================================================== 3. AURA DE RÉSURGENCE ==
  /** Appliquée au début de la phase d'achat (après resetForRound). */
  _onBuyPhase() {
    const economy = this._economy();
    for (const team of [TEAM_XENOS, TEAM_GUARDIANS]) {
      const streak = this._streaks[team] || 0;
      if (streak < MOMENTUM.TRIGGER_STREAK) continue;

      const level = streak - MOMENTUM.TRIGGER_STREAK + 1;
      for (const e of this.match ? this.match.entitiesOfTeam(team) : []) {
        e.shield = Math.max(e.shield, MOMENTUM.SHIELD_BONUS);
        if (economy && economy.award) economy.award(e, MOMENTUM.CREDIT_AURA, 'aura');
      }
      bus.emit('momentum:aura', { team, level });

      const player = this.match && this.match.playerEntity;
      if (player && player.team === team) {
        this._notify(
          `AURA DE RÉSURGENCE — l’Essaim gronde : +${MOMENTUM.SHIELD_BONUS} bouclier et +${MOMENTUM.CREDIT_AURA} crédits !`,
          'evo', 5
        );
      }
      this._sfx('notification', null, 0.8);
    }
  }

  // ===================================================== 4. ÉVÉNEMENTS DE MAP ==
  _updateMapEvents(dt) {
    const phase = this.match ? this.match.phase : null;

    if (this._actionActive && phase === 'action') {
      this._actionClock += dt;
      if (!this._eventDone && this._actionClock >= ROUND.MAP_EVENT_AT) {
        this._eventDone = true;
        this._triggerMapEvent();
      }
    }

    // Tempête ionique : croissance + dégâts par tick.
    if (this._storm) this._updateStorm(dt);

    // Fin de l'inversion gravitationnelle.
    if (this._gravityFlipUntil > 0 && this._clock >= this._gravityFlipUntil) {
      this._gravityFlipUntil = 0;
      const collision = registry.get('collision');
      if (collision && collision.setGravityFlip) {
        try { collision.setGravityFlip(false); } catch { /* collision optionnelle */ }
      }
      this._notify('La gravité se stabilise.', 'info', 3);
    }
  }

  _triggerMapEvent() {
    const world = registry.get('world');
    const collision = registry.get('collision');
    const layout = world && world.layout ? world.layout : null;

    // Événements réellement disponibles selon les services / la map.
    const candidates = MAP_EVENT_DEFS.filter((ev) => {
      if (ev.type === 'doors') {
        return !!(layout && Array.isArray(layout.doors) && layout.doors.length > 0
          && world && world.setDoorOpen);
      }
      if (ev.type === 'gravity_flip') {
        return !!(collision && collision.setGravityFlip
          && layout && Array.isArray(layout.gravityZones) && layout.gravityZones.length > 0);
      }
      return true;
    });
    if (candidates.length === 0) return;

    const ev = candidates[Math.floor(Math.random() * candidates.length)];
    let data = {};

    switch (ev.type) {
      case 'ion_storm': {
        const center = this._stormCenter(layout);
        this._storm = {
          center, radius: STORM.START_RADIUS, t: 0,
          tickIn: 0, fxIn: 0
        };
        data = { center: center.toArray(), radius: STORM.START_RADIUS, maxRadius: STORM.MAX_RADIUS, dps: STORM.DPS };
        this._sfx('storm', center, 1);
        break;
      }
      case 'doors': {
        this._doorsOpened = [];
        for (const door of layout.doors) {
          try {
            world.setDoorOpen(door.id, true);
            if (collision && collision.setDoorSolid) collision.setDoorSolid(door.id, false);
            this._doorsOpened.push(door.id);
            const c = door.min && door.max
              ? new THREE.Vector3(
                  (door.min[0] + door.max[0]) / 2,
                  (door.min[1] + door.max[1]) / 2,
                  (door.min[2] + door.max[2]) / 2)
              : null;
            this._sfx('door', c, 0.9);
          } catch (err) { console.error('[mechanics] sas:', err); }
        }
        data = { doors: this._doorsOpened.slice(), open: true };
        break;
      }
      case 'gravity_flip': {
        try { collision.setGravityFlip(true); } catch (err) { console.error('[mechanics] gravité:', err); }
        this._gravityFlipUntil = this._clock + GRAVITY_FLIP_DURATION;
        data = { duration: GRAVITY_FLIP_DURATION };
        this._sfx('storm', null, 0.6);
        break;
      }
      case 'flash_market': {
        // L'économie écoute mapevent:trigger et applique -40 % pendant 10 s
        // au début du round suivant.
        data = { discount: 0.4, duration: 10 };
        this._sfx('notification', null, 0.8);
        break;
      }
      default:
        break;
    }

    bus.emit('mapevent:trigger', { type: ev.type, name: ev.name, data });
    this._notify(`ÉVÉNEMENT DE MAP — ${ev.name}`, 'warn', 4.5);
  }

  /** Centre de la tempête : hazard dédié, sinon un site, sinon le milieu. */
  _stormCenter(layout) {
    if (layout && Array.isArray(layout.hazards)) {
      const hz = layout.hazards.find((h) => h.type === 'storm_zone');
      if (hz && hz.center) return new THREE.Vector3(hz.center[0], hz.center[1], hz.center[2]);
    }
    if (layout && Array.isArray(layout.sites) && layout.sites.length > 0) {
      const site = layout.sites[Math.floor(Math.random() * layout.sites.length)];
      if (site && site.center) return new THREE.Vector3(site.center[0], site.center[1], site.center[2]);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  _updateStorm(dt) {
    const st = this._storm;
    st.t += dt;
    st.radius = STORM.START_RADIUS
      + (STORM.MAX_RADIUS - STORM.START_RADIUS) * Math.min(1, st.t / STORM.GROW_TIME);

    // Visuel : ambiance de tempête entretenue par le système de particules.
    st.fxIn -= dt;
    if (st.fxIn <= 0) {
      st.fxIn = 0.7;
      const fx = this._fx();
      if (fx && fx.stormAmbient) {
        try { fx.stormAmbient(st.center.clone(), st.radius); } catch { /* fx optionnel */ }
      }
    }

    // Dégâts : 5 pv/s appliqués par ticks de 0,5 s (les deux camps souffrent).
    st.tickIn -= dt;
    if (st.tickIn <= 0) {
      st.tickIn = STORM.TICK;
      const dmg = STORM.DPS * STORM.TICK;
      for (const e of this._entities()) {
        if (!e.alive) continue;
        if (e.position.distanceTo(st.center) <= st.radius) {
          e.takeDamage(dmg, null, 'body');
        }
      }
    }
  }

  /** Fin de round : la map retrouve son état nominal. */
  _cleanupMapEvent() {
    this._storm = null;
    this._actionActive = false;

    if (this._gravityFlipUntil > 0) {
      this._gravityFlipUntil = 0;
      const collision = registry.get('collision');
      if (collision && collision.setGravityFlip) {
        try { collision.setGravityFlip(false); } catch { /* collision optionnelle */ }
      }
    }

    if (this._doorsOpened.length > 0) {
      const world = registry.get('world');
      const collision = registry.get('collision');
      const layout = world && world.layout ? world.layout : null;
      for (const id of this._doorsOpened) {
        const def = layout && Array.isArray(layout.doors)
          ? layout.doors.find((d) => d.id === id) : null;
        const closedAtStart = !!(def && def.closedAtStart);
        try {
          if (world && world.setDoorOpen) world.setDoorOpen(id, !closedAtStart);
          if (collision && collision.setDoorSolid) collision.setDoorSolid(id, closedAtStart);
        } catch (err) { console.error('[mechanics] restauration sas:', err); }
      }
      this._doorsOpened = [];
    }
  }

  // ======================================================= 5. FUSION D'ULTIMES ==
  _onAbilityCast({ entity, slot }) {
    if (slot !== 3 || !entity) return;

    // Cast fusionné que nous venons de déclencher nous-mêmes : ignorer.
    if (this._pendingFusedId === entity.id) {
      this._pendingFusedId = null;
      return;
    }

    // Un partenaire attendu (le joueur) lance son ultime dans la fenêtre.
    const w = this._fusionWindow;
    if (w && this._clock <= w.until && entity.team === w.team
        && entity.id !== w.casterId && w.partnerIds.has(entity.id)) {
      this._fusionWindow = null;
      this._fusionBotTask = null;
      this._completeFusion(w.caster, entity);
      return;
    }

    // Nouveau lanceur : y a-t-il un allié ultime prêt à moins de 8 m ?
    const partners = this._entities().filter((e) =>
      e !== entity && e.alive && e.team === entity.team && e.ultReady
      && e.position.distanceTo(entity.position) <= FUSION_RANGE);
    if (partners.length === 0) return;

    this._fusionWindow = {
      caster: entity,
      casterId: entity.id,
      team: entity.team,
      until: this._clock + FUSION_WINDOW,
      partnerIds: new Set(partners.map((p) => p.id))
    };

    const bot = partners.find((p) => p.isBot);
    if (bot) {
      // Le bot synchronise son ultime de lui-même (cast amplifié ×1,6).
      this._fusionBotTask = { at: this._clock + FUSION_BOT_DELAY, caster: entity, partner: bot };
    }
    const human = partners.find((p) => p.isPlayer);
    if (human) {
      this._notify('FUSION D’ULTIMES POSSIBLE — lancez votre ultime (X) dans les 4 s !', 'evo', 4);
      this._sfx('ult_ready', null, 0.8);
    }
  }

  _updateFusion() {
    // Expiration de la fenêtre.
    if (this._fusionWindow && this._clock > this._fusionWindow.until) {
      this._fusionWindow = null;
      this._fusionBotTask = null;
    }

    // Le bot partenaire déclenche son ultime fusionné.
    const task = this._fusionBotTask;
    if (!task || this._clock < task.at) return;
    this._fusionBotTask = null;

    const { caster, partner } = task;
    if (!partner.alive || !partner.ultReady || !caster.alive) return;
    if (partner.position.distanceTo(caster.position) > FUSION_RANGE + 1.5) return;

    const abilities = registry.get('abilities');
    if (!abilities || !abilities.castUltimateFused) return;

    this._pendingFusedId = partner.id;
    let ok = false;
    try { ok = abilities.castUltimateFused(partner, FUSION_MULT); }
    catch (err) { console.error('[mechanics] fusion:', err); }
    if (!ok) { this._pendingFusedId = null; return; }

    this._fusionWindow = null;
    this._completeFusion(caster, partner);
  }

  /** Résonance : annonce, bonus défensif aux deux lanceurs, effets. */
  _completeFusion(a, b) {
    const name = `${a.name} × ${b.name}`;
    bus.emit('ult:fusion', { a, b, name });

    for (const e of [a, b]) {
      e.shield = Math.max(e.shield, 30);
      e.hp = Math.min(e.maxHp, e.hp + 20);
    }

    const fx = this._fx();
    if (fx) {
      try {
        const mid = a.position.clone().add(b.position).multiplyScalar(0.5);
        mid.y += 1.2;
        if (fx.explosion) fx.explosion(mid, 3.5, 0xf2ccff);
        if (fx.teleportFlash) { fx.teleportFlash(a.position.clone()); fx.teleportFlash(b.position.clone()); }
      } catch { /* fx optionnel */ }
    }
    this._sfx('fusion', a.position, 1);
    this._notify(`FUSION D’ULTIMES — ${name} ! Effet amplifié ×${FUSION_MULT}`, 'evo', 5);
  }

  // ============================================================ 6. OVERDRIVE ==
  _triggerOverdrive(entity) {
    const until = wallNow() + OVERDRIVE_DURATION;
    entity.overdriveUntil = until; // drapeau consommé par le HUD / le rendu

    // « Wallhack » : les silhouettes ennemies sont révélées 2 s (même
    // convention que les capacités de vision — revealedUntil en horloge mur).
    const foes = this._entities().filter((e) => e.team !== entity.team && e.alive);
    for (const foe of foes) {
      foe.revealedUntil = Math.max(foe.revealedUntil || 0, until);
    }

    const fx = this._fx();
    if (fx && fx.evolutionBurst) {
      try { fx.evolutionBurst(entity); } catch { /* fx optionnel */ }
    }
    this._sfx('notification', entity.position, 0.9);
    if (entity.isPlayer) {
      this._notify('OVERDRIVE — 3 éliminations parfaites : vision transcendante 2 s !', 'evo', 3.5);
    }
  }

  // ------------------------------------------------------------- écouteurs ---
  _onDamaged({ entity, source, amount }) {
    if (!entity || !(amount > 0)) return;
    // Overdrive : encaisser des dégâts remet la série à zéro.
    this._odCounters.set(entity.id, 0);
    // Registre d'assists.
    if (source && source !== entity && source.team !== entity.team) {
      if (!this._damagers.has(entity.id)) this._damagers.set(entity.id, new Map());
      this._damagers.get(entity.id).set(source.id, { source, time: wallNow() });
    }
  }

  _onDied({ entity, killer }) {
    if (!entity) return;

    if (killer && killer !== entity && killer.team !== entity.team) {
      // 1. Évolution du tueur.
      this._addEvolution(killer, EVOLUTION.KILL_POINTS);

      // 6. Overdrive du tueur.
      const streak = (this._odCounters.get(killer.id) || 0) + 1;
      if (streak >= OVERDRIVE_KILLS) {
        this._odCounters.set(killer.id, 0);
        this._triggerOverdrive(killer);
      } else {
        this._odCounters.set(killer.id, streak);
      }

      // Assists : quiconque a blessé la victime dans les 5 dernières secondes.
      const ledger = this._damagers.get(entity.id);
      if (ledger) {
        for (const { source, time } of ledger.values()) {
          if (source === killer || source.team === entity.team) continue;
          if (wallNow() - time > 5) continue;
          source.assists++;
          this._addEvolution(source, EVOLUTION.ASSIST_POINTS);
        }
      }
    }

    this._damagers.delete(entity.id);
    this._odCounters.set(entity.id, 0);

    // Un maintien de réanimation mené par le défunt s'interrompt.
    if (this._revivers.has(entity.id)) {
      const rec = this._revivers.get(entity.id);
      this._revivers.delete(entity.id);
      bus.emit('revive:progress', { entity: rec.target, progress: 0 });
    }
  }

  _onPlanted({ entity }) {
    if (entity) this._addEvolution(entity, EVOLUTION.PLANT_POINTS);
  }

  _onRoundEnd({ winner }) {
    // 1. Évolution : +10 points de round pour chaque Xéno.
    for (const e of this._entities()) {
      this._addEvolution(e, EVOLUTION.ROUND_POINTS);
    }
    // 3. Séries de défaites.
    for (const team of [TEAM_XENOS, TEAM_GUARDIANS]) {
      this._streaks[team] = team === winner ? 0 : (this._streaks[team] || 0) + 1;
    }
    // 4. La map retrouve son état nominal.
    this._cleanupMapEvent();
  }

  _onPrestart({ switching }) {
    if (switching) {
      // Mi-temps / prolongation : les séries repartent de zéro.
      this._streaks = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };
    }
    this._reviveUses = { [TEAM_XENOS]: 0, [TEAM_GUARDIANS]: 0 };
    this._revivers.clear();
    this._odCounters.clear();
    this._damagers.clear();
    this._actionClock = 0;
    this._actionActive = false;
    this._eventDone = false;
    this._fusionWindow = null;
    this._fusionBotTask = null;
    this._pendingFusedId = null;
    this._cleanupMapEvent();
  }

  // -------------------------------------------------------------- nettoyage --
  dispose() {
    this._cleanupMapEvent();
    for (const off of this._offs) { try { off(); } catch { /* déjà détaché */ } }
    this._offs = [];
    this._pendingEvo.clear();
    this._revivers.clear();
    this._damagers.clear();
  }
}
