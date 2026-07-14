import { XENO_SQUAD, WEAPONS } from '../game/roster.js'

// All DOM UI: main menu, agent picker, shop (free + premium currency), in-match
// HUD, banners and killfeed. Talks to the game via callbacks.
export class UI {
  constructor(root, audio) {
    this.root = root
    this.audio = audio
  }
  clear() { this.root.innerHTML = '' }

  // ---------- MAIN MENU ----------
  mainMenu({ onPlay, onReplayIntro }) {
    this.clear()
    const el = document.createElement('div')
    el.className = 'overlay'
    el.innerHTML = `
      <div class="title">XENOCLASH</div>
      <div class="subtitle">5v5 Tactical // Aliens vs Humains</div>
      <div class="tagline">Un FPS tactique futuriste. Contrôle un essaim de Xénomorphes face à la Coalition Humaine.
        Puits de gravité, rembobinage temporel, vision de ruche — des mécaniques qui n'existent nulle part ailleurs.</div>
      <div style="display:flex; gap:16px; margin-top:10px;">
        <button class="btn" id="play">Jouer</button>
        <button class="btn secondary" id="intro">Revoir la cinématique</button>
      </div>
      <div class="hint">WASD déplacer · SOURIS viser · CLIC tirer · R recharger · E capacité · F danser · TAB boutique</div>`
    this.root.appendChild(el)
    el.querySelector('#play').onclick = () => { this.audio.ui(); onPlay() }
    el.querySelector('#intro').onclick = () => { this.audio.ui(); onReplayIntro() }
  }

  // ---------- AGENT SELECT ----------
  agentSelect({ onConfirm }) {
    this.clear()
    let selected = XENO_SQUAD[0]
    const el = document.createElement('div')
    el.className = 'overlay'
    el.innerHTML = `<div class="title" style="font-size:48px">Choisis ton Xéno</div>
      <div class="roster-pick"></div>
      <button class="btn" id="lock">Verrouiller</button>`
    const grid = el.querySelector('.roster-pick')
    XENO_SQUAD.forEach((a) => {
      const c = document.createElement('div')
      c.className = 'agent-card' + (a === selected ? ' sel' : '')
      c.style.borderColor = '#' + a.color.toString(16).padStart(6, '0') + '55'
      c.innerHTML = `<div class="an" style="color:#${a.color.toString(16).padStart(6, '0')}">${a.name}</div>
        <div class="ar">${a.role}</div>
        <div class="ap">${a.personality}</div>
        <div class="aa">◇ ${a.abilityName}${a.novel ? '<span class="badge-novel">INÉDIT</span>' : ''}</div>`
      c.onclick = () => { this.audio.ui(); selected = a; grid.querySelectorAll('.agent-card').forEach((x) => x.classList.remove('sel')); c.classList.add('sel') }
      grid.appendChild(c)
    })
    this.root.appendChild(el)
    el.querySelector('#lock').onclick = () => { this.audio.ui(); onConfirm(selected) }
  }

  // ---------- SHOP (buy phase) ----------
  shop({ credits, premium, timeLeft, onBuy, onBuyPremium, onClose }) {
    let el = this.root.querySelector('.shop')
    if (!el) {
      el = document.createElement('div')
      el.className = 'shop'
      this.root.appendChild(el)
    }
    el.classList.add('active')
    const w = (id) => WEAPONS[id]
    el.innerHTML = `
      <h2>BOUTIQUE — Phase d'achat</h2>
      <div class="shop-timer">Fermeture dans ${Math.ceil(timeLeft)}s · Crédits: <b style="color:#ffd254">${credits}</b> · Cristaux: <b style="color:#ff8ad8">${premium}◈</b></div>
      <div class="shop-grid">
        ${['smg', 'rifle', 'sniper'].map((id) => `
          <div class="shop-card" data-buy="${id}">
            <h3>${w(id).name}</h3>
            <div class="stat">Dégâts ${w(id).dmg} · Cadence ${w(id).rpm}</div>
            <div class="stat">Chargeur ${w(id).mag}</div>
            <div class="price">${w(id).cost} ¢</div>
          </div>`).join('')}
        <div class="shop-card premium" data-prem="overshield">
          <h3>Sur-bouclier ◈</h3>
          <div class="stat">+75 armure au spawn (cette manche)</div>
          <div class="stat">Cosmétique + avantage — Free2Play & Pay2Win</div>
          <div class="price prem">3 ◈</div>
        </div>
      </div>
      <button class="btn secondary" id="closeshop">Prêt (fermer)</button>`
    el.querySelectorAll('[data-buy]').forEach((c) => c.onclick = () => { this.audio.ui(); onBuy(c.dataset.buy) })
    el.querySelector('[data-prem]').onclick = () => { this.audio.ui(); onBuyPremium('overshield') }
    el.querySelector('#closeshop').onclick = () => { this.audio.ui(); onClose() }
  }
  // Lightweight per-second update so we don't rebuild (and steal clicks from) the shop DOM.
  shopTimer(credits, premium, timeLeft) {
    const el = this.root.querySelector('.shop .shop-timer')
    if (el) el.innerHTML = `Fermeture dans ${Math.ceil(timeLeft)}s · Crédits: <b style="color:#ffd254">${credits}</b> · Cristaux: <b style="color:#ff8ad8">${premium}◈</b>`
  }
  closeShop() { const el = this.root.querySelector('.shop'); if (el) el.classList.remove('active') }

  // ---------- IN-MATCH HUD ----------
  buildHUD() {
    let hud = this.root.querySelector('.hud')
    if (hud) return hud
    hud = document.createElement('div')
    hud.className = 'hud active'
    hud.innerHTML = `
      <div class="crosshair"></div>
      <div class="hitmarker"><div style="top:-14px"></div><div style="bottom:-14px"></div><div style="left:-14px;width:10px;height:3px"></div><div style="right:-14px;width:10px;height:3px"></div></div>
      <div class="topbar">
        <span class="score xeno" id="scoreX">0</span>
        <span class="round-tag" id="roundtag">Manche 1</span>
        <span class="timer" id="timer">1:40</span>
        <span class="score human" id="scoreH">0</span>
      </div>
      <div class="killfeed" id="killfeed"></div>
      <div class="banner" id="banner"></div>
      <div class="bottomleft">
        <div class="hp-row"><div class="hp-bar"><div class="hp-fill" id="hpfill"></div></div><div class="hp-num" id="hpnum">100</div></div>
        <div class="hp-row" style="margin-top:6px"><div class="hp-bar"><div class="hp-fill armor-fill" id="armfill"></div></div><div class="hp-num" id="armnum" style="color:#8a5cff">50</div></div>
        <div class="ability-slot"><div class="ability-key">E</div><div class="ability-info"><div class="ability-name" id="abname">—</div><div class="ability-ready" id="abstate">Prêt</div></div></div>
      </div>
      <div class="bottomright">
        <div class="weapon-name" id="wname">Fléau-X</div>
        <div class="ammo"><span id="ammo">25</span> <span class="mag" id="reserve">/75</span></div>
        <div class="creds" id="creds">2000 ¢</div>
      </div>`
    this.root.appendChild(hud)
    this._hud = hud
    return hud
  }
  hideHUD() { if (this._hud) this._hud.classList.remove('active') }
  showHUD() { if (this._hud) this._hud.classList.add('active') }

  updateHUD(s) {
    if (!this._hud) return
    const $ = (id) => this._hud.querySelector('#' + id)
    $('scoreX').textContent = s.scoreX
    $('scoreH').textContent = s.scoreH
    $('roundtag').textContent = 'Manche ' + s.round
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60)
    $('timer').textContent = `${m}:${sec.toString().padStart(2, '0')}`
    $('hpfill').style.width = Math.max(0, s.hp) + '%'
    $('hpnum').textContent = Math.ceil(Math.max(0, s.hp))
    $('armfill').style.width = Math.min(100, s.armor) + '%'
    $('armnum').textContent = Math.ceil(s.armor)
    $('abname').textContent = s.abilityName
    $('abstate').textContent = s.abilityReady ? 'Prêt' : `⟳ ${Math.ceil(s.abilityCd)}s`
    $('abstate').className = s.abilityReady ? 'ability-ready' : 'ability-cd'
    $('wname').textContent = s.weaponName
    $('ammo').textContent = s.reloading ? '...' : s.ammo
    $('reserve').textContent = '/' + s.reserve
    $('creds').textContent = s.credits + ' ¢'
  }

  killfeed(text, color = '#dfe') {
    const feed = this._hud?.querySelector('#killfeed')
    if (!feed) return
    const item = document.createElement('div')
    item.className = 'kf-item'
    item.style.color = color
    item.textContent = text
    feed.appendChild(item)
    setTimeout(() => item.remove(), 4000)
  }
  hitmarker() { const h = this._hud?.querySelector('.hitmarker'); if (h) { h.classList.remove('show'); void h.offsetWidth; h.classList.add('show') } }
  banner(text, color = '#35ffb0', ms = 2200) {
    const b = this._hud?.querySelector('#banner')
    if (!b) return
    b.textContent = text; b.style.color = color; b.classList.add('show')
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms)
  }
}
