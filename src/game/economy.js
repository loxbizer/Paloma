import { WEAPONS } from './roster.js'

// Dual-currency economy: earned Credits (free, spent each round) and Cristaux
// (premium ◈, the free-to-play + pay-to-win layer). Cristaux buy round-scoped
// advantages like the over-shield, but you also EARN a trickle for free so
// non-payers still access the system.
export class Economy {
  constructor() {
    this.credits = 2000
    this.premium = 12 // starting free stash of Cristaux
    this.pendingOvershield = 0
  }

  roundReward(won) {
    this.credits += won ? 3000 : 1900
    this.credits = Math.min(9000, this.credits)
    this.premium += won ? 2 : 1 // free trickle — F2P players still progress
  }
  killReward() { this.credits += 200 }

  buyWeapon(id) {
    const w = WEAPONS[id]
    if (!w || this.credits < w.cost) return null
    this.credits -= w.cost
    return { ...w }
  }
  buyPremium(kind) {
    if (kind === 'overshield' && this.premium >= 3) {
      this.premium -= 3
      this.pendingOvershield = 75
      return true
    }
    return false
  }
  consumeOvershield() { const v = this.pendingOvershield; this.pendingOvershield = 0; return v }
}
