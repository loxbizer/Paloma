// Localisateur de services — chaque système s'enregistre ici au boot.
// Clés standard : engine, bus, world, collision, audio, fx, tracers, hud,
// menus, shop, match, economy, mechanics, save, profile, input, cinematics, assets, player.
export const registry = {
  _services: new Map(),
  set(key, service) {
    this._services.set(key, service);
    return service;
  },
  get(key) {
    return this._services.get(key) || null;
  },
  has(key) {
    return this._services.has(key);
  },
  require(key) {
    const s = this._services.get(key);
    if (!s) throw new Error(`[registry] service manquant: "${key}"`);
    return s;
  }
};
