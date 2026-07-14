// ============================================================================
// XENOSTRIKE — Economy : crédits, récompenses et achats.
// Crédits de départ, récompenses de victoire/défaite avec bonus de série de
// défaites (ECONOMY.*), primes de kill/pose/désamorce, plafond 9000, achats
// d'armes (WEAPONS), d'armures et de charges de capacité, munitions pleines à
// l'achat. Applique aussi le « Marché Noir Éclair » (remise -40 % pendant
// 10 s au début du round suivant), signalé par mechanics via mapevent:trigger.
// ============================================================================
import { bus } from '../core/events.js';
import { registry } from '../core/registry.js';
import { ECONOMY } from './constants.js';
import { WEAPONS } from '../data/weapons-data.js';

const FLASH_DISCOUNT = 0.6;   // multiplicateur de prix pendant le marché flash
const FLASH_DURATION = 10;    // durée de la remise (s) au début du round suivant

export class Economy {
  constructor(match) {
    this.match = match;

    this._lastResult = null;                        // { winner, reason } du round écoulé
    this._streaks = {};                             // séries de défaites (secours interne)
    this._flashPending = false;                     // marché flash annoncé pour le prochain round
    this._discountUntil = 0;                        // horodatage mur de fin de remise

    this._offs = [
      bus.on('mapevent:trigger', (e) => {
        if (e && e.type === 'flash_market') this._flashPending = true;
      })
    ];
  }

  _now() { return performance.now() / 1000; }

  _entities() {
    return (this.match && this.match.entities) ? this.match.entities : [];
  }

  /** La remise du marché flash est-elle active en ce moment ? */
  get discountActive() {
    return this._now() < this._discountUntil;
  }

  /** Prix effectif d'un montant, remise du marché flash comprise. */
  effectivePrice(price) {
    if (!Number.isFinite(price) || price <= 0) return 0;
    return this.discountActive ? Math.round(price * FLASH_DISCOUNT) : price;
  }

  // ------------------------------------------------------------- round flow --
  /**
   * Crédite chaque entité en début de round (émet economy:update).
   * @param {number} roundNumber
   * @param {Object} lossStreaks — séries de défaites par équipe (fournies par match)
   * @param {{ fresh?: boolean, credits?: number }} opts — fresh : crédits de
   *        départ imposés (round 1, mi-temps, prolongation).
   */
  startRound(roundNumber, lossStreaks = {}, opts = {}) {
    const fresh = roundNumber === 1 || opts.fresh === true;
    const streaks = (lossStreaks && Object.keys(lossStreaks).length > 0) ? lossStreaks : this._streaks;

    // Activation du marché flash annoncé au round précédent.
    if (this._flashPending) {
      this._flashPending = false;
      this._discountUntil = this._now() + FLASH_DURATION;
      bus.emit('ui:notification', {
        text: 'MARCHÉ NOIR ÉCLAIR — -40 % sur tout l’équipement pendant 10 s !',
        type: 'warn', duration: 5
      });
    }

    for (const entity of this._entities()) {
      if (fresh) {
        entity.credits = Math.min(ECONOMY.MAX_CREDITS, opts.credits ?? ECONOMY.START_CREDITS);
      } else if (this._lastResult) {
        const won = entity.team === this._lastResult.winner;
        let gain = ECONOMY.WIN_REWARD;
        if (!won) {
          // 1re défaite : 1900 ; puis +500 par défaite consécutive (max +1000).
          const streak = Math.max(0, (streaks[entity.team] || 0) - 1);
          gain = ECONOMY.LOSS_REWARD
            + ECONOMY.LOSS_STREAK_BONUS * Math.min(streak, ECONOMY.LOSS_STREAK_MAX);
        }
        entity.credits = Math.min(ECONOMY.MAX_CREDITS, entity.credits + gain);
      }
      bus.emit('economy:update', { entity, credits: entity.credits });
    }
  }

  /** Prime immédiate (kill, pose, désamorce, aura...) — plafonnée à 9000. */
  award(entity, amount, reason = '') {
    if (!entity || !Number.isFinite(amount) || amount <= 0) return;
    entity.credits = Math.min(ECONOMY.MAX_CREDITS, entity.credits + Math.round(amount));
    bus.emit('economy:update', { entity, credits: entity.credits });
    void reason; // trace sémantique pour les appelants / le débogage
  }

  /** Mémorise le résultat du round : les gains sont versés au startRound suivant. */
  onRoundEnd(winner, reason) {
    this._lastResult = { winner, reason };
    // Comptabilité de secours des séries (si match ne fournit pas les siennes).
    for (const entity of this._entities()) {
      if (this._streaks[entity.team] === undefined) this._streaks[entity.team] = 0;
    }
    for (const team of Object.keys(this._streaks)) {
      this._streaks[team] = team === winner ? 0 : this._streaks[team] + 1;
    }
  }

  // ----------------------------------------------------------------- achats --
  canAfford(entity, price) {
    return !!entity && entity.credits >= this.effectivePrice(price);
  }

  /** Débite le prix effectif. Retourne false si les fonds manquent. */
  spend(entity, price) {
    const cost = this.effectivePrice(price);
    if (!entity || entity.credits < cost) return false;
    entity.credits -= cost;
    bus.emit('economy:update', { entity, credits: entity.credits });
    return true;
  }

  /**
   * Achat d'une arme : place dans le bon slot (mêlée / poing / principale),
   * munitions pleines, arme équipée et modèle attaché à la main droite.
   */
  buyWeapon(entity, weaponId) {
    const def = WEAPONS[weaponId];
    if (!def || !entity || !entity.alive) return false;

    const slot = def.class === 'melee' ? 'melee'
      : def.class === 'sidearm' ? 'secondary'
      : 'primary';

    // Déjà possédée : pas de rachat (les munitions sont pleines à chaque round).
    if (entity.inventory[slot] === weaponId) return false;

    if (!this.spend(entity, def.price)) {
      if (entity.isPlayer) bus.emit('audio:play', { sfx: 'dry_fire', volume: 0.5 });
      return false;
    }

    entity.inventory[slot] = weaponId;
    entity.ammo[weaponId] = { mag: def.magSize, reserve: def.reserve };
    entity.currentSlot = slot;
    bus.emit('weapon:switched', { entity, slot, weaponId });

    // Modèle 3D attaché au WeaponSocket_R de l'avatar (asynchrone, tolérant).
    const factory = registry.get('agentFactory');
    const avatar = entity.avatar || (factory && factory.avatarOf ? factory.avatarOf(entity) : null);
    if (avatar && avatar.attachWeapon) {
      try {
        const p = avatar.attachWeapon(weaponId);
        if (p && p.catch) p.catch(() => {});
      } catch (err) { console.error('[economy] attache d’arme:', err); }
    }

    if (entity.isPlayer) bus.emit('audio:play', { sfx: 'purchase', volume: 0.8 });
    return true;
  }

  /** Achat d'armure : légère (25) ou lourde (50) — jamais de déclassement. */
  buyArmor(entity, armorId) {
    if (!entity || !entity.alive) return false;
    const id = String(armorId || '').toLowerCase();
    const def = id.includes('heavy') || id.includes('lourd')
      ? ECONOMY.ARMOR_HEAVY : ECONOMY.ARMOR_LIGHT;

    if (entity.armor >= def.value) return false;
    if (!this.spend(entity, def.price)) {
      if (entity.isPlayer) bus.emit('audio:play', { sfx: 'dry_fire', volume: 0.5 });
      return false;
    }
    entity.armor = def.value;
    if (entity.isPlayer) bus.emit('audio:play', { sfx: 'purchase', volume: 0.8 });
    return true;
  }

  /**
   * Recharge d'une capacité (slots 0..2) au coût défini par l'agent
   * (abilities[slot].def.costCredits). L'ultime (slot 3) n'est pas achetable.
   */
  buyAbilityCharge(entity, slot) {
    if (!entity || !entity.alive || slot === 3) return false;
    const ab = entity.abilities ? entity.abilities[slot] : null;
    if (!ab || !ab.def) return false;

    const cost = ab.def.costCredits || 0;
    if (cost <= 0) return false; // capacité gratuite : rechargée chaque round

    const maxCharges = ab.def.charges ?? 1;
    if (ab.charges >= maxCharges) return false;

    if (!this.spend(entity, cost)) {
      if (entity.isPlayer) bus.emit('audio:play', { sfx: 'dry_fire', volume: 0.5 });
      return false;
    }
    ab.charges += 1;
    if (entity.isPlayer) bus.emit('audio:play', { sfx: 'purchase', volume: 0.8 });
    return true;
  }

  // -------------------------------------------------------------- nettoyage --
  dispose() {
    for (const off of this._offs) { try { off(); } catch { /* déjà détaché */ } }
    this._offs = [];
  }
}
