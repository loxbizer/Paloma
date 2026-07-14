import * as THREE from 'three'

// A scripted camera cinematic (the "trailer") — sweeping crane shots over the
// map with title cards. Not pre-rendered, but a real in-engine sequence that
// plays at game boot and at the start of each round's "buy phase".
export class Cinematic {
  constructor(camera, uiRoot) {
    this.camera = camera
    this.uiRoot = uiRoot
    this.active = false
    this.t = 0
    this.dur = 8
    this.onDone = null
    this.cards = []
    this._el = null
  }

  // keyframes: [{t, pos:[x,y,z], look:[x,y,z]}], cards:[{t, title, sub}]
  play({ keyframes, cards = [], duration = 8, onDone }) {
    this.keyframes = keyframes
    this.cards = cards
    this.dur = duration
    this.t = 0
    this.active = true
    this.onDone = onDone
    this._shownCards = new Set()
    this._el = document.createElement('div')
    this._el.className = 'overlay'
    this._el.style.background = 'linear-gradient(to bottom, rgba(5,6,10,0.0), rgba(5,6,10,0.0))'
    this._el.innerHTML = `<div class="cine-card" style="opacity:0"></div>`
    this.uiRoot.appendChild(this._el)
  }

  skip() { if (this.active) this._finish() }

  _finish() {
    this.active = false
    if (this._el) { this._el.remove(); this._el = null }
    this.onDone?.()
    this.onDone = null
  }

  update(dt) {
    if (!this.active) return
    this.t += dt
    const p = Math.min(1, this.t / this.dur)

    // Interpolate camera between keyframes by normalized time.
    const kf = this.keyframes
    let a = kf[0], b = kf[kf.length - 1]
    for (let i = 0; i < kf.length - 1; i++) {
      if (p >= kf[i].t && p <= kf[i + 1].t) { a = kf[i]; b = kf[i + 1]; break }
    }
    const span = (b.t - a.t) || 1
    const lt = smooth((p - a.t) / span)
    const pos = lerpV(a.pos, b.pos, lt)
    const look = lerpV(a.look, b.look, lt)
    this.camera.position.set(pos.x, pos.y, pos.z)
    this.camera.lookAt(look.x, look.y, look.z)

    // Title cards.
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i]
      if (p >= c.t && !this._shownCards.has(i)) {
        this._shownCards.add(i)
        const card = this._el.querySelector('.cine-card')
        card.innerHTML = `<div class="title">${c.title}</div>${c.sub ? `<div class="subtitle">${c.sub}</div>` : ''}`
        card.animate(
          [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }, { opacity: 1 }, { opacity: 0 }],
          { duration: 2600, easing: 'ease-out' }
        )
      }
    }

    if (p >= 1) this._finish()
  }
}

function lerpV(a, b, t) {
  return new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }

// The signature boot cinematic keyframes over ORBITAL-7.
export const BOOT_CINEMATIC = {
  duration: 9,
  keyframes: [
    { t: 0.0, pos: [0, 40, 70], look: [0, 2, 0] },
    { t: 0.25, pos: [-40, 8, 40], look: [-38, 1, 38] },
    { t: 0.5, pos: [0, 3, 20], look: [0, 3, 0] },
    { t: 0.75, pos: [35, 6, -20], look: [38, 1, -38] },
    { t: 1.0, pos: [6, 1.8, 12], look: [0, 1.6, 0] },
  ],
  cards: [
    { t: 0.05, title: 'XENOCLASH', sub: 'Orbital-7 // Zone de conflit' },
    { t: 0.4, title: 'XÉNOMORPHES', sub: 'vs Coalition Humaine' },
    { t: 0.78, title: '5 v 5', sub: 'Que le meilleur essaim gagne' },
  ],
}
