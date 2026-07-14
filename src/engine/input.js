import * as THREE from 'three'

// Pointer-lock FPS input: mouse look + WASD + action keys. Exposes a simple
// state object the player controller polls each frame.
export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.mouseDX = 0
    this.mouseDY = 0
    this.locked = false
    this.mouseDown = false
    this.sensitivity = 0.0022
    this._justPressed = new Set()

    canvas.addEventListener('click', () => { if (!this.locked) canvas.requestPointerLock() })
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas })
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      this.mouseDX += e.movementX * this.sensitivity
      this.mouseDY += e.movementY * this.sensitivity
    })
    document.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true })
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false })
    document.addEventListener('keydown', (e) => {
      const k = e.code
      if (!this.keys.has(k)) this._justPressed.add(k)
      this.keys.add(k)
    })
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  down(code) { return this.keys.has(code) }
  pressed(code) { return this._justPressed.has(code) }
  consumeLook() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy } }
  endFrame() { this._justPressed.clear() }
  unlock() { document.exitPointerLock?.() }
}
