// Bus d'événements global — colonne vertébrale de la communication entre modules.
// Tous les modules communiquent via `bus` plutôt que par imports croisés.
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  once(event, fn) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }
  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (set) {
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[bus] erreur dans un écouteur de "${event}":`, err);
        }
      }
    }
  }
  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }
}

export const bus = new EventBus();
