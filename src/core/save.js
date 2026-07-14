// Persistance du profil joueur (localStorage) — progression, monnaies, cosmétiques.
import { bus } from './events.js';

const KEY = 'xenostrike_profile_v1';

export function defaultProfile() {
  return {
    name: 'Xéno-Recrue',
    xp: 0,
    level: 1,
    credits: 5000,        // monnaie gratuite (Fragments) gagnée en jouant
    xenocoins: 1200,      // monnaie premium (achetable — simulé)
    ownedAgents: ['zephyr', 'krogoth', 'naia'],
    ownedSkins: [],
    ownedBoosters: {},    // id -> quantité
    activeBoosters: [],   // ids actifs pour le prochain match
    battlePass: { tier: 1, xp: 0, premium: false },
    missions: [],
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0, plants: 0, revives: 0 },
    settings: {
      sensitivity: 1.0,
      volume: 0.7,
      musicVolume: 0.5,
      quality: 'high',
      layout: 'azerty',
      skipIntro: false
    }
  };
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw);
    // fusion avec les valeurs par défaut (migrations douces)
    return { ...defaultProfile(), ...p, settings: { ...defaultProfile().settings, ...(p.settings || {}) } };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    bus.emit('profile:saved', profile);
  } catch (err) {
    console.error('[save] échec de sauvegarde:', err);
  }
}
