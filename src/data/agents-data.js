// ============================================================================
// XENOSTRIKE — Roster des 15 personnages (10 Xénos jouables + 5 Gardiens).
// Structure conforme à docs/CONTRACTS.md. Données pures, aucune logique.
//
// Conventions des capacités :
//  - abilities[0..2] = capacités (touches A, E, C) ; abilities[3] = ultime (X, Xénos seulement).
//  - costCredits : prix d'une charge en phase d'achat (0 = gratuite / rechargée chaque round).
//  - cooldown en secondes (multiplié par entity.statMods.cooldownMult à l'exécution).
//  - params : vocabulaire consommé par src/agents/abilities.js —
//      dash       { distance, speed, duration, damage?, hitRadius?, dashes?, interval?, cloakDuration? }
//      projectile { speed, gravity, bounces, fuse, damage, explosionRadius, zone?,
//                   pullRadius?, pullForce?, pullDuration? }
//      zone       { radius, duration, effect: 'damage'|'heal'|'slow'|'smoke'|'wave',
//                   damagePerSec?, healPerSec?, slowMult?, burstDamage?, range?,
//                   wave?: { speed, travel, healAmount, knockback } }
//      wall       { width, height, thickness, duration, distance, teamArmor?, armorRadius?, touchDamage? }
//      heal       { amount? | radius+duration+healPerSec }
//      vision     { radius, duration, forward? }
//      clone      { count, duration, speed, converge?, contactDamage?, spread? }
//      teleport   { distance }
//      shield     { amount, duration, radius? }
//      buff       { duration, mods, radius?, cloak?, shieldAmount? }
//      transform  { duration, scale, hpBonus, damageMult, speedMult, meleeMult }
//      global     { effect: 'reveal'|'darkness'|'mimic', duration, ... , fallback? }
// ============================================================================

export const AGENTS = {
  // ========================================================================
  // XÉNOS — l'essaim exilé qui reprend Nova Bastion
  // ========================================================================
  zephyr: {
    id: 'zephyr',
    name: 'Zephyr',
    species: 'xeno',
    role: 'Éclaireur',
    tagline: 'Plus vite que ton champ de vision.',
    lore: 'Né dans les courants ioniques des anneaux de Kharos, Zephyr fut le premier messager de l\'Essaim exilé — celui qui portait les phéromones d\'espoir entre les nids dispersés. Quand la Coalition Terrienne a saisi Nova Bastion, il s\'est juré d\'être le premier à en franchir les portes, et le dernier que les Gardiens verront jamais. Il tient un décompte précis de ses victoires : il est actuellement invaincu, si l\'on ignore les défaites.',
    personality: {
      trait: 'joueur, arrogant, rapide',
      humor: 'vantardise pétillante, provoque tout le monde y compris ses alliés',
      catchphrase: 'Cligne des yeux, c\'est déjà fini.'
    },
    colors: { primary: 0x18e0e8, secondary: 0x101418, emissive: 0x35f6ff },
    bodyType: 'insectoid',
    voiceLines: {
      spawn: [
        'Encore réveillé avant tout le monde. Comme toujours.',
        'Nova Bastion... j\'ai déjà fait le tour deux fois pendant que vous chargiez.',
        'Chronomètre lancé. Essayez de suivre.',
        'Les Gardiens dorment encore ? Parfait, réveillons-les avec style.'
      ],
      kill: [
        'Trop lent. Comme prévu.',
        'Tu m\'as vu ? Non ? Normal.',
        'Un de moins. Le vent tourne, littéralement.',
        'J\'aurais presque eu le temps de m\'ennuyer.',
        'Dis à tes amis que c\'était moi. Enfin... si tu te souviens de quelque chose.'
      ],
      plant: [
        'Noyau posé. Record battu, évidemment.',
        'Cadeau de l\'Essaim ! Ne le déballez pas trop vite.',
        'Posé, armé, sublime. Tic tac, les Gardiens.'
      ],
      ability: [
        'On accélère !',
        'Attrapez-moi si vous pouvez !',
        'Le vent se lève !',
        'Zzzt — déjà ailleurs.'
      ],
      win: [
        'Victoire ! J\'aurais pu la gagner en dormant, mais bon travail quand même.',
        'L\'Essaim gagne, je brille. Tout est à sa place.',
        'On refait la même ? J\'ai à peine transpiré mes chitines.'
      ]
    },
    danceName: 'Cyclone Breaker',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'zephyr_dash', name: 'Piqué Fulgurant', key: 'A', icon: '💨',
        desc: 'Fonce instantanément dans la direction du regard sur 9 m.',
        costCredits: 150, cooldown: 6, charges: 2, type: 'dash',
        params: { distance: 9, speed: 24, duration: 0.22 }
      },
      {
        id: 'zephyr_sting', name: 'Dard Statique', key: 'E', icon: '⚡',
        desc: 'Projette un dard électrique qui explose en champ ralentissant.',
        costCredits: 200, cooldown: 12, charges: 1, type: 'projectile',
        params: {
          speed: 26, gravity: 6, bounces: 0, fuse: 2.5, damage: 15, explosionRadius: 1.5,
          zone: { radius: 3.5, duration: 3, effect: 'slow', slowMult: 0.45 }
        }
      },
      {
        id: 'zephyr_pheromones', name: 'Phéromones Traceuses', key: 'C', icon: '👁️',
        desc: 'Libère un nuage de phéromones qui révèle les ennemis devant lui.',
        costCredits: 250, cooldown: 18, charges: 1, type: 'vision',
        params: { radius: 14, duration: 4, forward: 10 }
      },
      {
        id: 'zephyr_ult', name: 'Essaim Fantôme', key: 'X', icon: '🌀',
        desc: 'ULTIME — Enchaîne 3 piqués fulgurants en se dissolvant en essaim quasi invisible.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'dash',
        params: { dashes: 3, interval: 0.38, distance: 7, speed: 26, duration: 0.2, cloakDuration: 2.5 }
      }
    ]
  },

  krogoth: {
    id: 'krogoth',
    name: 'Krogoth',
    species: 'xeno',
    role: 'Sentinelle',
    tagline: 'La montagne qui marche devant vous.',
    lore: 'Krogoth portait les œufs de l\'Essaim sur son dos pendant le Grand Exil, à travers trois systèmes hostiles et deux blocus de la Coalition. Sa carapace garde la cicatrice de chaque tir qu\'il a encaissé à la place d\'un plus jeune. Il ne parle pas beaucoup : les montagnes n\'ont pas besoin de discours pour tenir debout.',
    personality: {
      trait: 'bourru, protecteur',
      humor: 'grognements laconiques, poésie minérale involontaire',
      catchphrase: 'Derrière moi. Toujours.'
    },
    colors: { primary: 0x3f7a35, secondary: 0x9c7a3c, emissive: 0x86ff5e },
    bodyType: 'heavy_reptile',
    voiceLines: {
      spawn: [
        'Le sol tremble. C\'est moi. Avancez.',
        'Krogoth est là. Respirez, petits.',
        'Cette station... elle sent la peur des Gardiens. Bien.',
        'Mes écailles ont connu pire que leurs balles.'
      ],
      kill: [
        'La pierre ne s\'excuse pas.',
        'Tombé. Comme une branche morte.',
        'Tu as frappé la montagne. La montagne a répondu.',
        'Hmph. Suivant.'
      ],
      plant: [
        'Le Noyau est posé. Personne n\'y touche.',
        'Planté. Comme une graine de fin du monde.',
        'C\'est fait. Maintenant, on tient.'
      ],
      ability: [
        'Je tiens la ligne.',
        'Abritez-vous. Krogoth pousse.',
        'La chair devient rempart.',
        'Hrrraaah !'
      ],
      win: [
        'L\'Essaim est debout. C\'est tout ce qui compte.',
        'Bien battu, petits. Krogoth est... content.',
        'La station se souviendra de nos pas.'
      ]
    },
    danceName: 'Tremblement Tribal',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'krogoth_shell', name: 'Carapace Réactive', key: 'A', icon: '🛡️',
        desc: 'Durcit ses écailles : 40 points de bouclier pendant 6 s.',
        costCredits: 200, cooldown: 16, charges: 1, type: 'shield',
        params: { amount: 40, duration: 6 }
      },
      {
        id: 'krogoth_slam', name: 'Charge Sismique', key: 'E', icon: '🌋',
        desc: 'Projette un bloc tellurique qui fracasse le sol et ralentit la zone.',
        costCredits: 300, cooldown: 14, charges: 1, type: 'projectile',
        params: {
          speed: 18, gravity: 14, bounces: 0, fuse: 3, damage: 30, explosionRadius: 4,
          zone: { radius: 4, duration: 3.5, effect: 'slow', slowMult: 0.55 }
        }
      },
      {
        id: 'krogoth_wall', name: 'Mur d\'Écailles', key: 'C', icon: '🧱',
        desc: 'Fait surgir un mur d\'écailles durcies qui bloque passage et regards 8 s.',
        costCredits: 300, cooldown: 20, charges: 1, type: 'wall',
        params: { width: 4.5, height: 2.4, thickness: 0.5, duration: 8, distance: 3 }
      },
      {
        id: 'krogoth_ult', name: 'Rempart Vivant', key: 'X', icon: '🏔️',
        desc: 'ULTIME — Un mur de chair colossal jaillit du sol et blinde les alliés proches (+30 armure).',
        costCredits: 0, cooldown: 0, charges: 1, type: 'wall',
        params: { width: 10, height: 3.6, thickness: 0.9, duration: 12, distance: 3.5, teamArmor: 30, armorRadius: 9 }
      }
    ]
  },

  sylkis: {
    id: 'sylkis',
    name: 'Sylkis',
    species: 'xeno',
    role: 'Duelliste',
    tagline: 'Chaque duel est une première. Chaque mort, un rappel.',
    lore: 'Avant l\'Exil, Sylkis dansait dans les opéras gravitationnels de la cour de Kharos, quatre lames dans quatre mains, pour un public de dix mille spectres lumineux. La Coalition a brûlé les théâtres ; il ne lui reste que la scène du champ de bataille. Elle considère chaque Gardien abattu comme un spectateur conquis — et elle salue toujours.',
    personality: {
      trait: 'théâtrale, duelliste d\'opéra',
      humor: 'grandiloquence assumée, tout est une représentation',
      catchphrase: 'Le rideau se lève... sur votre dernier acte.'
    },
    colors: { primary: 0x7a3fd1, secondary: 0xc9ccd8, emissive: 0xb46bff },
    bodyType: 'four_arms',
    voiceLines: {
      spawn: [
        'La scène est dressée, le public retient son souffle.',
        'Quatre lames, une seule artiste. Que le spectacle commence.',
        'Nova Bastion... quelle salle magnifique pour une tragédie.',
        'Premier acte : l\'entrée en scène. Observez.'
      ],
      kill: [
        'Et... rideau.',
        'Vous avez joué votre rôle à merveille : celui du figurant.',
        'Quelle chute ! Le public en redemande.',
        'Un critique de moins. La pièce continue.',
        'Bravissima. À moi-même, bien sûr.'
      ],
      plant: [
        'Le décor final est en place. Attendez le feu d\'artifice.',
        'Acte trois : le Noyau entre en scène.',
        'Posé avec grâce. Tout est dans le geste.'
      ],
      ability: [
        'Place à la chorégraphie !',
        'Mes lames connaissent la partition.',
        'Entrée des doublures !',
        'Un pas de deux... mortel.'
      ],
      win: [
        'Standing ovation ! J\'exige des fleurs.',
        'La critique est unanime : triomphe absolu.',
        'Saluez, mes amis. Nous avons offert un chef-d\'œuvre.'
      ]
    },
    danceName: 'Grand Final',
    priceCredits: 8000,
    priceXenocoins: 975,
    abilities: [
      {
        id: 'sylkis_step', name: 'Pas de Deux', key: 'A', icon: '✨',
        desc: 'Glisse en un éclair de 8 m vers l\'avant, entre deux battements de lame.',
        costCredits: 200, cooldown: 10, charges: 1, type: 'teleport',
        params: { distance: 8 }
      },
      {
        id: 'sylkis_waltz', name: 'Valse d\'Acier', key: 'E', icon: '🗡️',
        desc: 'Lance une lame tournoyante qui ricoche une fois sur les murs (55 dégâts).',
        costCredits: 250, cooldown: 9, charges: 2, type: 'projectile',
        params: { speed: 34, gravity: 0, bounces: 1, fuse: 2.2, damage: 55, explosionRadius: 1.2 }
      },
      {
        id: 'sylkis_understudy', name: 'Doublure de Scène', key: 'C', icon: '🎭',
        desc: 'Projette une doublure holographique qui avance et attire les tirs.',
        costCredits: 300, cooldown: 22, charges: 1, type: 'clone',
        params: { count: 1, duration: 6, speed: 3.2 }
      },
      {
        id: 'sylkis_ult', name: 'Opéra des Lames', key: 'X', icon: '🎼',
        desc: 'ULTIME — Quatre clones dansants surgissent et convergent en lacérant tout sur leur passage.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'clone',
        params: { count: 4, duration: 7, speed: 4.5, converge: true, contactDamage: 60, spread: 6 }
      }
    ]
  },

  vex9: {
    id: 'vex9',
    name: 'Vex-9',
    species: 'xeno',
    role: 'Contrôleur',
    tagline: 'Probabilité de votre survie : amusante.',
    lore: 'Vex-9 est né de la fusion accidentelle entre un symbiote xéno et l\'IA tactique d\'un croiseur de la Coalition abattu pendant l\'Exil. Il considère ses anciens créateurs humains avec le mépris poli d\'un programme pour son code hérité. L\'Essaim le tolère ; lui, il « optimise » l\'Essaim — nuance qu\'il rappelle à chaque briefing.',
    personality: {
      trait: 'IA sarcastique et froide',
      humor: 'sarcasme statistique, condescendance calculée au pourcentage près',
      catchphrase: 'Recalcul terminé : vous avez déjà perdu.'
    },
    colors: { primary: 0xff7a1a, secondary: 0x5a5f66, emissive: 0xffa23e },
    bodyType: 'techno_symbiote',
    voiceLines: {
      spawn: [
        'Initialisation. Espérance de vie des Gardiens : décevante.',
        'Diagnostic de l\'équipe : 80% de chair, 20% de plan. J\'apporte le plan.',
        'Nova Bastion, version 2.0 : sans humains.',
        'Chargement des sarcasmes... terminé.'
      ],
      kill: [
        'Cible archivée. Corbeille vidée.',
        'Erreur 404 : signes vitaux introuvables.',
        'Votre stratégie comportait 17 failles. J\'ai utilisé la troisième.',
        'Extinction propre. Vous devriez me remercier.',
        'Fascinant. Il pensait vraiment avoir une chance.'
      ],
      plant: [
        'Charge amorcée. Décompte esthétiquement satisfaisant.',
        'Noyau déployé. Probabilité de défuse : négligeable.',
        'Installation terminée. Aucun redémarrage requis. Aucune survie non plus.'
      ],
      ability: [
        'Exécution du protocole.',
        'Déploiement des sous-routines.',
        'Vos secrets sont mes données.',
        'Calcul... résolu.'
      ],
      win: [
        'Victoire conforme aux projections. Évidemment.',
        'Résultat : optimal. Performances alliées : tolérables.',
        'J\'enregistre cette partie sous « démonstration ».'
      ]
    },
    danceName: 'Défragmentation',
    priceCredits: 8000,
    priceXenocoins: 975,
    abilities: [
      {
        id: 'vex9_drone', name: 'Drone Traqueur', key: 'A', icon: '📡',
        desc: 'Déploie un scan vers l\'avant qui révèle les ennemis 5 s.',
        costCredits: 250, cooldown: 20, charges: 1, type: 'vision',
        params: { radius: 11, duration: 5, forward: 12 }
      },
      {
        id: 'vex9_grid', name: 'Grille Paralysante', key: 'E', icon: '🕸️',
        desc: 'Pose un piège électrostatique qui blesse et entrave le premier intrus.',
        costCredits: 200, cooldown: 4, charges: 2, type: 'trap',
        params: { radius: 2.6, armTime: 1.2, damage: 25, slowMult: 0.4, slowDuration: 3, lifetime: 45 }
      },
      {
        id: 'vex9_static', name: 'Rideau Statique', key: 'C', icon: '🌫️',
        desc: 'Projette un nuage de nano-parasites opaque qui coupe les lignes de vue.',
        costCredits: 150, cooldown: 2, charges: 2, type: 'zone',
        params: { radius: 4.2, duration: 7, effect: 'smoke', range: 18 }
      },
      {
        id: 'vex9_ult', name: 'Protocole Basilic', key: 'X', icon: '🐍',
        desc: 'ULTIME — Marque tous les ennemis de la station et libère 3 drones de chasse autonomes.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'global',
        params: { effect: 'reveal', duration: 8, droneCount: 3, droneDamage: 9, droneSpeed: 9, droneDuration: 12 }
      }
    ]
  },

  umbra: {
    id: 'umbra',
    name: 'Umbra',
    species: 'xeno',
    role: 'Contrôleur',
    tagline: 'Ce que tu appelles obscurité, je l\'appelle maison.',
    lore: 'Nul ne sait si Umbra a rejoint l\'Essaim ou si l\'Essaim a traversé l\'ombre qu\'elle habitait déjà. Elle murmure aux ténèbres entre les cloisons de Nova Bastion, et les ténèbres, dit-on, lui répondent. Les Gardiens ont installé des projecteurs partout dans la station ; elle trouve cela adorable.',
    personality: {
      trait: 'mystérieuse, murmure',
      humor: 'ironie feutrée, sous-entendus glaçants dits avec douceur',
      catchphrase: 'Éteins la lumière en partant... oh, laisse, je m\'en occupe.'
    },
    colors: { primary: 0x2e2a6e, secondary: 0x0a0a12, emissive: 0x6f5bff },
    bodyType: 'shadow',
    voiceLines: {
      spawn: [
        'Chuuut... la station dort encore. Pas pour longtemps.',
        'Tant de lumières... tant de travail.',
        'Je suis déjà passée ici. Personne ne m\'a vue. Personne ne me voit jamais.',
        'L\'ombre s\'étire. Suivez-la.'
      ],
      kill: [
        'Il a crié dans le noir. Personne n\'a entendu.',
        'Dors. L\'obscurité est douce, je te le promets.',
        'Une lumière de moins.',
        'Tu m\'as cherchée ? Comme c\'est touchant.'
      ],
      plant: [
        'La graine d\'ombre est en terre.',
        'Posé... dans un murmure.',
        'Le Noyau chante. Écoutez-le compter.'
      ],
      ability: [
        'Viens, pénombre...',
        'Le voile tombe.',
        'Un pas entre les mondes.',
        'Les ombres me racontent tout.'
      ],
      win: [
        'La nuit gagne toujours. Ce soir, elle a juste pris de l\'avance.',
        'Doucement... savourez. La victoire aussi se murmure.',
        'Ils ont enfin compris ce qui vivait dans leurs ombres.'
      ]
    },
    danceName: 'Valse des Ombres',
    priceCredits: 12000,
    priceXenocoins: 1450,
    abilities: [
      {
        id: 'umbra_veil', name: 'Voile d\'Ombre', key: 'A', icon: '🌑',
        desc: 'Projette une sphère d\'obscurité impénétrable pendant 8 s.',
        costCredits: 150, cooldown: 2, charges: 2, type: 'zone',
        params: { radius: 4.5, duration: 8, effect: 'smoke', range: 20 }
      },
      {
        id: 'umbra_step', name: 'Pas Spectral', key: 'E', icon: '👣',
        desc: 'Se dissout et se reforme 11 m plus loin dans un souffle glacé.',
        costCredits: 300, cooldown: 14, charges: 1, type: 'teleport',
        params: { distance: 11 }
      },
      {
        id: 'umbra_gaze', name: 'Regard du Néant', key: 'C', icon: '👁️',
        desc: 'Les ombres dénoncent : révèle les ennemis alentour 3,5 s.',
        costCredits: 250, cooldown: 18, charges: 1, type: 'vision',
        params: { radius: 13, duration: 3.5 }
      },
      {
        id: 'umbra_ult', name: 'Éclipse Totale', key: 'X', icon: '🌘',
        desc: 'ULTIME — Éteint la station entière : seuls ses alliés voient encore à travers la nuit.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'global',
        params: { effect: 'darkness', duration: 9, visionRange: 8 }
      }
    ]
  },

  thorne: {
    id: 'thorne',
    name: 'Thorne',
    species: 'xeno',
    role: 'Sentinelle',
    tagline: 'Tout ce qui pousse finit par reprendre ses droits.',
    lore: 'Thorne a vu germer et mourir douze forêts-mondes ; il portait déjà des fleurs quand la Coalition n\'était qu\'une graine de mauvaise idée. Il ne se bat pas contre les Gardiens — il jardine, et ils sont des mauvaises herbes. Sur les sites de Nova Bastion, la végétation bioluminescente pousse plus vite depuis son arrivée : elle le reconnaît.',
    personality: {
      trait: 'sage botaniste ancien',
      humor: 'métaphores végétales imperturbables, patience amusée d\'immortel',
      catchphrase: 'Patience. Même l\'acier finit en terreau.'
    },
    colors: { primary: 0x2f8f4e, secondary: 0xff7fb1, emissive: 0x8effb0 },
    bodyType: 'plant',
    voiceLines: {
      spawn: [
        'Cette station manque de verdure. Corrigeons cela.',
        'Je sens des racines sous le métal. Elles attendent.',
        'Les jeunes pousses s\'impatientent. Allons-y doucement... mais sûrement.',
        'Une saison de plus. Un jardin de plus.'
      ],
      kill: [
        'Compost.',
        'Il rejoint le grand cycle. Tout le monde y passe.',
        'Une mauvaise herbe de moins dans mes plates-bandes.',
        'Chaque chute nourrit une éclosion.'
      ],
      plant: [
        'Semé. La floraison sera... spectaculaire.',
        'Le Noyau prendra racine ici. Profond.',
        'Un bulbe de singularité. Ma plus belle bouture.'
      ],
      ability: [
        'Poussez, mes petites.',
        'Les épines veillent.',
        'La sève circule.',
        'Fleuris. Maintenant.'
      ],
      win: [
        'Le jardin est en ordre. Les nuisibles, dehors.',
        'Voyez ? La patience porte toujours ses fruits.',
        'Nous replanterons cette station. À commencer par aujourd\'hui.'
      ]
    },
    danceName: 'Photosynthèse Funk',
    priceCredits: 8000,
    priceXenocoins: 975,
    abilities: [
      {
        id: 'thorne_spores', name: 'Spores Vivifiantes', key: 'A', icon: '🌿',
        desc: 'Libère un nuage de spores qui régénère les alliés (8 PV/s, 5 s).',
        costCredits: 200, cooldown: 18, charges: 1, type: 'heal',
        params: { radius: 5, duration: 5, healPerSec: 8 }
      },
      {
        id: 'thorne_snare', name: 'Ronce Piège', key: 'E', icon: '🥀',
        desc: 'Enterre une ronce dormante qui mord et enracine le premier ennemi.',
        costCredits: 200, cooldown: 4, charges: 2, type: 'trap',
        params: { radius: 2.4, armTime: 1, damage: 30, slowMult: 0.35, slowDuration: 2.5, lifetime: 60 }
      },
      {
        id: 'thorne_hedge', name: 'Haie d\'Épines', key: 'C', icon: '🌵',
        desc: 'Dresse une haie épineuse qui bloque le passage et lacère qui la frôle.',
        costCredits: 300, cooldown: 22, charges: 1, type: 'wall',
        params: { width: 5, height: 2.2, thickness: 0.6, duration: 10, distance: 3, touchDamage: 8 }
      },
      {
        id: 'thorne_ult', name: 'Jardin Dévorant', key: 'X', icon: '🌺',
        desc: 'ULTIME — Un jardin de ronces carnivores : soigne les alliés, dévore lentement les ennemis.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'zone',
        params: { radius: 9, duration: 10, effect: 'damage', damagePerSec: 14, healPerSec: 12, slowMult: 0.75 }
      }
    ]
  },

  pulsar: {
    id: 'pulsar',
    name: 'Pulsar',
    species: 'xeno',
    role: 'Duelliste',
    tagline: 'BOUM ! Pardon. Non, en fait : pas pardon. BOUM !',
    lore: 'Pulsar est né dans le cœur d\'une étoile naine que l\'Essaim utilisait comme relais — un accident de fusion que personne n\'a jamais réussi à éteindre. Il stocke assez d\'énergie dans son corps trapu pour alimenter Nova Bastion pendant un mois, et il la dépense en explosions et en fous rires, souvent simultanément. Les Gardiens l\'appellent « l\'anomalie hilare » ; il a fait broder le surnom sur sa ceinture.',
    personality: {
      trait: 'pile électrique hilare',
      humor: 'enthousiasme explosif, rit de tout surtout de ses propres explosions',
      catchphrase: 'Tu sais ce qui est drôle ? TOUT.'
    },
    colors: { primary: 0xffd21f, secondary: 0x2264ff, emissive: 0xfff06a },
    bodyType: 'round_energy',
    voiceLines: {
      spawn: [
        'HAHA ! On est en avance pour le feu d\'artifice ?',
        'Batterie : 3000%. Humeur : PAREIL !',
        'J\'ai des étincelles plein les poches, qui en veut ?',
        'Nova Bastion ! Nova comme SUPERNOVA ! Ha ! Vous l\'avez ?'
      ],
      kill: [
        'BOUM ! Hahaha, désolé ! Non, pas désolé !',
        'Il a fait une super tête ! Vous avez vu sa tête ?!',
        'Tchak-BZZZT ! J\'adore ce bruit !',
        'Oups. Enfin, « oups » de joie.',
        'Encore ! Encore ! Y en a d\'autres ?'
      ],
      plant: [
        'Le gros pétard est posé ! HÉHÉHÉ.',
        'Ce Noyau et moi, on a le même sens de l\'humour : explosif !',
        'Planté ! Reculez, ou pas, c\'est plus drôle si vous restez !'
      ],
      ability: [
        'Attrape !',
        'Ça va faire PSSSHH-BOUM !',
        'Étincelles gratuiiiites !',
        'Regardez ça, regardez ça, REGARDEZ ÇA !'
      ],
      win: [
        'ON A GAGNÉ ! Refaites-moi ce dernier round au ralenti !',
        'HAHAHA ! Le meilleur jour de ma vie ! Comme hier ! Et avant-hier !',
        'Victoire ! Qui veut un câlin ? Attention, je pique un peu. Électriquement.'
      ]
    },
    danceName: 'Overdrive Boogie',
    priceCredits: 12000,
    priceXenocoins: 1450,
    abilities: [
      {
        id: 'pulsar_grenade', name: 'Grenade à Impulsion', key: 'A', icon: '💥',
        desc: 'Lance une grenade bondissante qui explose après deux rebonds (45 dégâts).',
        costCredits: 200, cooldown: 6, charges: 2, type: 'projectile',
        params: { speed: 20, gravity: 12, bounces: 2, fuse: 1.8, damage: 45, explosionRadius: 4.5 }
      },
      {
        id: 'pulsar_overcharge', name: 'Surtension', key: 'E', icon: '⚡',
        desc: 'Se surcharge : +25% vitesse et +10% dégâts pendant 5 s.',
        costCredits: 250, cooldown: 16, charges: 1, type: 'buff',
        params: { duration: 5, mods: { speedMult: 1.25, damageMult: 1.1 } }
      },
      {
        id: 'pulsar_field', name: 'Champ Statique', key: 'C', icon: '🌩️',
        desc: 'Déploie un dôme électrique qui grésille (10 dégâts/s) et freine les intrus.',
        costCredits: 300, cooldown: 18, charges: 1, type: 'zone',
        params: { radius: 5, duration: 6, effect: 'damage', damagePerSec: 10, slowMult: 0.8 }
      },
      {
        id: 'pulsar_ult', name: 'Supernova', key: 'X', icon: '☀️',
        desc: 'ULTIME — Une grenade gravitationnelle massive qui aspire tout... puis efface tout.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'projectile',
        params: {
          speed: 16, gravity: 8, bounces: 0, fuse: 2.5, damage: 120, explosionRadius: 7,
          pullRadius: 8, pullForce: 10, pullDuration: 1.6
        }
      }
    ]
  },

  naia: {
    id: 'naia',
    name: 'Naia',
    species: 'xeno',
    role: 'Soutien',
    tagline: 'La marée soigne ceux qu\'elle emporte.',
    lore: 'Naia gardait les océans-berceaux de Kharos, où les jeunes de l\'Essaim apprenaient à respirer deux mondes. Quand la Coalition a vitrifié les mers, elle a emporté la dernière vague vivante dans ses nageoires — et elle la partage, goutte à goutte, avec ceux qui saignent. Elle est la seule à plaindre sincèrement les Gardiens qu\'elle doit combattre.',
    personality: {
      trait: 'douce, empathique',
      humor: 'tendresse désarmante, s\'excuse presque en combattant',
      catchphrase: 'Respire. Je suis là.'
    },
    colors: { primary: 0x24cfc4, secondary: 0xf2fbff, emissive: 0x7dfff2 },
    bodyType: 'aquatic',
    voiceLines: {
      spawn: [
        'Je veille sur vous. Chacun d\'entre vous.',
        'L\'eau se souvient de tout. Moi aussi.',
        'Restez groupés, restez vivants. S\'il vous plaît.',
        'Même ici, dans tout ce métal, je sens la marée.'
      ],
      kill: [
        'Pardon... c\'était toi ou les miens.',
        'Que le courant t\'emporte doucement.',
        'Je n\'y prends aucun plaisir. Mais je ne raterai pas.',
        'Dors. L\'océan garde tous les noms.'
      ],
      plant: [
        'C\'est posé. Que cela finisse vite, pour tout le monde.',
        'Le Noyau est en place... comme une perle sombre.',
        'Voilà. Maintenant protégeons-le, et protégeons-nous.'
      ],
      ability: [
        'La marée vous porte !',
        'Soignez-vous, vite !',
        'L\'eau vous enveloppe.',
        'Tenez bon, j\'arrive !'
      ],
      win: [
        'Tout le monde est entier ? Alors c\'est une vraie victoire.',
        'L\'Essaim vit. Merci... merci à vous tous.',
        'On rentre ensemble. C\'est tout ce que je demandais.'
      ]
    },
    danceName: 'Ondulation Lunaire',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'naia_orb', name: 'Sphère Régénérante', key: 'A', icon: '💧',
        desc: 'Fait éclore une bulle d\'eau vive qui soigne les alliés (9 PV/s, 6 s).',
        costCredits: 200, cooldown: 16, charges: 1, type: 'heal',
        params: { radius: 4.5, duration: 6, healPerSec: 9 }
      },
      {
        id: 'naia_current', name: 'Courant Porteur', key: 'E', icon: '🌊',
        desc: 'Un courant ascendant accélère les alliés proches (+30% vitesse, 4 s).',
        costCredits: 150, cooldown: 14, charges: 1, type: 'buff',
        params: { duration: 4, radius: 7, mods: { speedMult: 1.3 } }
      },
      {
        id: 'naia_bubble', name: 'Bulle Protectrice', key: 'C', icon: '🫧',
        desc: 'Enveloppe les alliés proches d\'un bouclier d\'eau dense (35 pts, 6 s).',
        costCredits: 300, cooldown: 20, charges: 1, type: 'shield',
        params: { amount: 35, duration: 6, radius: 6 }
      },
      {
        id: 'naia_ult', name: 'Marée Vive', key: 'X', icon: '🌊',
        desc: 'ULTIME — Déchaîne une vague déferlante qui soigne les alliés et balaie les ennemis.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'zone',
        params: {
          radius: 5, duration: 3.5, effect: 'wave',
          wave: { speed: 9, travel: 26, healAmount: 45, knockback: 9 }
        }
      }
    ]
  },

  ragnok: {
    id: 'ragnok',
    name: 'Ragnok',
    species: 'xeno',
    role: 'Duelliste',
    tagline: 'La colère est un muscle. Le mien est ÉNORME.',
    lore: 'Ragnok a démoli à mains nues la porte du camp d\'internement où la Coalition parquait son clan — puis le camp, puis la garnison, puis, par élan, une colline. Il ne garde pas rancune : il la dépense immédiatement, avec un plaisir communicatif. L\'Essaim le laisse toujours entrer en premier ; c\'est plus sûr pour tout le monde, surtout pour les portes.',
    personality: {
      trait: 'colérique jouissif',
      humor: 'rage joyeuse, casse des choses et s\'en félicite bruyamment',
      catchphrase: 'JE SUIS DE BONNE HUMEUR. FUYEZ QUAND MÊME.'
    },
    colors: { primary: 0xc21f2e, secondary: 0x17090b, emissive: 0xff3b2e },
    bodyType: 'horned_brute',
    voiceLines: {
      spawn: [
        'RAGNOK EST LÀ ! Commencez à courir, je compte jusqu\'à un !',
        'Cette station a des murs. J\'aime les murs. Ils craquent bien.',
        'Qui veut voir un Gardien voler ? Levez la main !',
        'GRAAAH ! Ça, c\'était bonjour.'
      ],
      kill: [
        'HAHA ! CRAC ! Mon bruit préféré !',
        'Reviens ! J\'avais presque fini de m\'amuser !',
        'Il s\'est cassé. Ils se cassent tous trop vite.',
        'ENCORE ! Envoyez le suivant !',
        'Ça défoule. Ça défoule TELLEMENT.'
      ],
      plant: [
        'Grosse bombe posée ! Ragnok adore les grosses bombes !',
        'PLANTÉ ! Comme mes cornes dans leur défense !',
        'Voilà ! Maintenant on tape ceux qui approchent !'
      ],
      ability: [
        'RAAAAH !',
        'Ça va SAIGNER !',
        'Regardez maman, sans les mains !',
        'CASSÉ ! Tout est mieux cassé !'
      ],
      win: [
        'ON A GAGNÉ ! Je casse un dernier truc pour fêter ça ?',
        'HAHAHA ! Bonne bagarre ! Excellente bagarre !',
        'Victoire pour l\'Essaim ! Et pour la mauvaise humeur BIEN UTILISÉE !'
      ]
    },
    danceName: 'Mosh-Pit Solitaire',
    priceCredits: 12000,
    priceXenocoins: 1450,
    abilities: [
      {
        id: 'ragnok_rush', name: 'Ruée Cornue', key: 'A', icon: '🐂',
        desc: 'Charge cornes en avant : 8 m de course et 25 dégâts à l\'impact.',
        costCredits: 200, cooldown: 9, charges: 1, type: 'dash',
        params: { distance: 8, speed: 18, duration: 0.4, damage: 25, hitRadius: 1.4 }
      },
      {
        id: 'ragnok_roar', name: 'Cri de Sang', key: 'E', icon: '🗯️',
        desc: 'Hurlement galvanisant : +18% dégâts, +10% vitesse et 15 pts de bouclier, 6 s.',
        costCredits: 250, cooldown: 18, charges: 1, type: 'buff',
        params: { duration: 6, mods: { damageMult: 1.18, speedMult: 1.1 }, shieldAmount: 15 }
      },
      {
        id: 'ragnok_smash', name: 'Brise-Sol', key: 'C', icon: '🔨',
        desc: 'Frappe le sol : onde de choc de 35 dégâts qui ébranle et ralentit.',
        costCredits: 300, cooldown: 15, charges: 1, type: 'zone',
        params: { radius: 5.5, duration: 2.5, effect: 'slow', burstDamage: 35, slowMult: 0.5 }
      },
      {
        id: 'ragnok_ult', name: 'Avatar de Rage', key: 'X', icon: '👹',
        desc: 'ULTIME — Se transforme en colosse : plus grand, plus résistant, griffes dévastatrices.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'transform',
        params: { duration: 11, scale: 1.35, hpBonus: 80, damageMult: 1.35, speedMult: 1.15, meleeMult: 2.5 }
      }
    ]
  },

  echo: {
    id: 'echo',
    name: 'Echo',
    species: 'xeno',
    role: 'Flex',
    tagline: 'Je serai toi mieux que toi.',
    lore: 'Echo est éclos pendant l\'Exil, dans le silence entre deux sauts hyperspatiaux, et n\'a jamais connu Kharos : il ne connaît que ce qu\'il imite. L\'Essaim s\'attendrit, les Gardiens frissonnent — l\'enfant lisse et irisé répète leurs propres voix avec une exactitude parfaite, un demi-ton trop calme. Il collectionne les gestes des autres comme d\'autres collectionnent des coquillages.',
    personality: {
      trait: 'enfant étrange qui imite',
      humor: 'candeur inquiétante, répète les phrases des autres au pire moment',
      catchphrase: '« Cligne des yeux, c\'est déjà fini. » ... C\'était bien, comme ça ?'
    },
    colors: { primary: 0xf4f6ff, secondary: 0xcfe8ff, emissive: 0xbfe0ff },
    bodyType: 'pale_mimic',
    voiceLines: {
      spawn: [
        'Bonjour bonjour bonjour. Lequel était le bon ?',
        'Aujourd\'hui je serai... vous. Tous. Un par un.',
        'Les Gardiens ont des voix intéressantes. Bientôt, elles seront à moi.',
        'On joue ? On joue. On joue on joue on joue.'
      ],
      kill: [
        'Tu ne bouges plus. Alors je garderai ta voix pour toi.',
        '« À l\'aide, à l\'aide ! » ... C\'est ce qu\'il a dit. J\'imite bien, hein ?',
        'Cassé. Les gens sont fragiles quand on les copie trop fort.',
        'Chut. Je t\'apprends par cœur.'
      ],
      plant: [
        'J\'ai posé la chose qui fait boum. Comme les grands.',
        'Le Noyau fait tic, tic, tic. Moi aussi je sais faire : tic, tic, tic.',
        'Planté ! J\'ai copié le geste de Zephyr. En mieux.'
      ],
      ability: [
        'À mon tour d\'essayer !',
        'Je t\'emprunte ça.',
        'Regarde, c\'est toi !',
        'Copier... coller.'
      ],
      win: [
        'On a gagné ! J\'imite la joie : HAHA ! C\'est ressemblant ?',
        'Les Gardiens sont partis. Je garderai leurs voix en souvenir.',
        'Encore une partie ? J\'ai presque fini d\'apprendre tout le monde.'
      ]
    },
    danceName: 'Miroir Miroir',
    priceCredits: 15000,
    priceXenocoins: 1875,
    abilities: [
      {
        id: 'echo_mirror', name: 'Écho Miroir', key: 'A', icon: '🪞',
        desc: 'Détache un double translucide qui avance et attire l\'attention.',
        costCredits: 200, cooldown: 16, charges: 1, type: 'clone',
        params: { count: 1, duration: 7, speed: 3.4 }
      },
      {
        id: 'echo_rift', name: 'Faille Psychique', key: 'E', icon: '💠',
        desc: 'Se replie à travers une faille mentale : téléportation de 9 m.',
        costCredits: 250, cooldown: 13, charges: 1, type: 'teleport',
        params: { distance: 9 }
      },
      {
        id: 'echo_resonance', name: 'Résonance', key: 'C', icon: '🔮',
        desc: 'Écoute les pensées proches : révèle les ennemis alentour 3 s.',
        costCredits: 250, cooldown: 18, charges: 1, type: 'vision',
        params: { radius: 12, duration: 3 }
      },
      {
        id: 'echo_ult', name: 'Réplique Parfaite', key: 'X', icon: '♊',
        desc: 'ULTIME — Rejoue le dernier ultime utilisé par l\'ennemi ; à défaut, déflagration psychique.',
        costCredits: 0, cooldown: 0, charges: 1, type: 'global',
        params: {
          effect: 'mimic',
          fallback: { radius: 7, duration: 3, effect: 'slow', burstDamage: 70, slowMult: 0.5 }
        }
      }
    ]
  },

  // ========================================================================
  // GARDIENS — la Coalition Terrienne qui verrouille Nova Bastion
  // ========================================================================
  steele: {
    id: 'steele',
    name: 'Cmdr Steele',
    species: 'guardian',
    role: 'Contrôleur',
    tagline: 'La ligne tient tant que je respire.',
    lore: 'Trente ans de service, quatre stations défendues, zéro reddition : le commandeur Steele est la colonne vertébrale de la garnison de Nova Bastion. Il a lu les rapports sur l\'Essaim et refuse de les appeler « monstres » — un ennemi mérite d\'être nommé correctement avant d\'être arrêté. Ses hommes le suivraient dans le vide sans combinaison.',
    personality: {
      trait: 'vétéran droit',
      humor: 'humour sec de caserne, une vanne par décennie',
      catchphrase: 'Tenez la ligne. Le reste est du bruit.'
    },
    colors: { primary: 0x6f7684, secondary: 0x2455a8, emissive: 0x4d8dff },
    bodyType: 'human_soldier',
    voiceLines: {
      spawn: [
        'Postes de combat. Comme à l\'exercice.',
        'La Coalition tient cette station. Aujourd\'hui n\'y changera rien.',
        'Économisez les munitions, pas le courage.',
        'Yeux ouverts. Ces choses sont rapides.'
      ],
      kill: [
        'Hostile neutralisé.',
        'Un de moins sur le scope.',
        'La ligne tient.',
        'Rien de personnel. Question de secteur.'
      ],
      plant: [
        'Charge posée sur objectif. Repli et couverture.',
        'Dispositif armé. Sécurisez le périmètre.',
        'Objectif verrouillé. Tenez vos angles.'
      ],
      ability: [
        'Appui tactique, maintenant !',
        'Coalition, sur moi !',
        'Barrière en place. Utilisez-la.',
        'Frappe demandée, dégagez la zone !'
      ],
      win: [
        'Secteur tenu. Bon travail, Gardiens.',
        'C\'est comme ça qu\'on défend une station.',
        'Rompez. Et soyez fiers.'
      ]
    },
    danceName: 'Garde-à-vous Groove',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'steele_strike', name: 'Frappe Orbitale', key: 'A', icon: '🎯',
        desc: 'Appelle un projectile orbital sur la position visée (60 dégâts de zone).',
        costCredits: 300, cooldown: 22, charges: 1, type: 'projectile',
        params: { speed: 24, gravity: 4, bounces: 0, fuse: 3, damage: 60, explosionRadius: 5 }
      },
      {
        id: 'steele_rally', name: 'Cri de Ralliement', key: 'E', icon: '📣',
        desc: 'Galvanise les Gardiens proches : +10% dégâts, +8% vitesse pendant 5 s.',
        costCredits: 200, cooldown: 20, charges: 1, type: 'buff',
        params: { duration: 5, radius: 9, mods: { damageMult: 1.1, speedMult: 1.08 } }
      },
      {
        id: 'steele_barrier', name: 'Barrière Coalition', key: 'C', icon: '🚧',
        desc: 'Déploie une barrière balistique standard de la Coalition (8 s).',
        costCredits: 300, cooldown: 20, charges: 1, type: 'wall',
        params: { width: 4, height: 2.2, thickness: 0.4, duration: 8, distance: 2.5 }
      }
    ]
  },

  wraith: {
    id: 'wraith',
    name: 'Wraith',
    species: 'guardian',
    role: 'Éclaireur',
    tagline: '…',
    lore: 'Personne dans la garnison n\'a jamais vu le visage sous la capuche de Wraith, ni entendu plus de six mots d\'affilée. Son dossier indique quatre-vingt-onze confirmations à plus de huit cents mètres et une note du psychologue : « communique, à sa manière ». Sur Nova Bastion, sa manière consiste à laisser une douille propre là où il est passé.',
    personality: {
      trait: 'laconique',
      humor: 'silences plus éloquents que les phrases, ponctuation mortelle',
      catchphrase: 'Vu. Réglé.'
    },
    colors: { primary: 0x274a2b, secondary: 0x0c0f0c, emissive: 0x59ff7a },
    bodyType: 'human_recon',
    voiceLines: {
      spawn: [
        'En position.',
        'Ligne de mire dégagée.',
        'Silence radio.',
        'Ils arrivent. Bien.'
      ],
      kill: [
        'Vu. Réglé.',
        'Suivant.',
        'Une douille de plus.',
        'Trop grand. Trop lent.'
      ],
      plant: [
        'Posé.',
        'Objectif marqué.',
        'Fait. Repli.'
      ],
      ability: [
        'Balise partie.',
        'Je disparais.',
        'Piège actif.',
        'Regarde ailleurs.'
      ],
      win: [
        'Terminé.',
        'Secteur propre.',
        'Bonne journée de chasse.'
      ]
    },
    danceName: 'Sillage Silencieux',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'wraith_beacon', name: 'Balise Espion', key: 'A', icon: '📍',
        desc: 'Projette une balise de reconnaissance qui révèle les Xénos 5 s.',
        costCredits: 200, cooldown: 18, charges: 1, type: 'vision',
        params: { radius: 12, duration: 5, forward: 14 }
      },
      {
        id: 'wraith_cloak', name: 'Camouflage Optique', key: 'E', icon: '🫥',
        desc: 'Se rend presque invisible pendant 5 s en se déplaçant sans bruit.',
        costCredits: 300, cooldown: 24, charges: 1, type: 'buff',
        params: { duration: 5, cloak: true, mods: { speedMult: 1.05 } }
      },
      {
        id: 'wraith_mine', name: 'Mine Immobilisante', key: 'C', icon: '💣',
        desc: 'Pose une mine à impulsion qui blesse et fige le premier Xéno.',
        costCredits: 200, cooldown: 4, charges: 2, type: 'trap',
        params: { radius: 2.5, armTime: 1.2, damage: 30, slowMult: 0.35, slowDuration: 3, lifetime: 60 }
      }
    ]
  },

  ferrai: {
    id: 'ferrai',
    name: 'Doc Ferrai',
    species: 'guardian',
    role: 'Soutien',
    tagline: 'Je recouds plus vite qu\'ils ne découpent. Enfin, en général.',
    lore: 'Le docteur Ferrai a signé pour Nova Bastion parce que « l\'exobiologie de combat, c\'est là que ça saigne d\'intéressant ». Elle rafistole les Gardiens en leur expliquant très exactement à quel point leur plan était stupide, puis retourne au feu pour ramasser le suivant. Elle garde un bocal d\'échantillons xénos sur son bureau, étiquetés « futurs collègues, qui sait ».',
    personality: {
      trait: 'cynique attachante',
      humor: 'ironie clinique, diagnostics assassins délivrés avec le sourire',
      catchphrase: 'Ne meurs pas, la paperasse est infernale.'
    },
    colors: { primary: 0xf2f2f0, secondary: 0xc22030, emissive: 0xff6a6a },
    bodyType: 'human_medic',
    voiceLines: {
      spawn: [
        'Trousse pleine, patience vide. Allons-y.',
        'Rappel : ne pas mourir. C\'est ma seule consigne et vous allez l\'ignorer.',
        'Des aliens à disséquer, des soldats à recoudre. Journée chargée.',
        'Restez à portée de seringue, messieurs.'
      ],
      kill: [
        'Diagnostic : décès. Cause : moi.',
        'Fascinant, leur anatomie. Vue de l\'intérieur, surtout.',
        'Celui-là ne finira pas dans mon bocal. Trop abîmé.',
        'Oh, il est tombé. Quelle surprise clinique.'
      ],
      plant: [
        'Dispositif posé. Contre-indication : rester à côté.',
        'Posé. Effets secondaires : véritablement tous.',
        'Voilà. Prescription : courir.'
      ],
      ability: [
        'On ne meurt pas aujourd\'hui !',
        'Injection en route !',
        'Fumée thérapeutique !',
        'Tenez, c\'est remboursé par la Coalition.'
      ],
      win: [
        'Bilan : zéro décès inacceptable. Je suis presque émue.',
        'Victoire. Et personne ne m\'a saigné dessus. Journée parfaite.',
        'On a gagné ? Formidable. Maintenant, tous en salle d\'examen.'
      ]
    },
    danceName: 'Scalpel Swing',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'ferrai_inject', name: 'Injection Régénérante', key: 'A', icon: '💉',
        desc: 'S\'injecte (ou injecte l\'allié le plus proche) 40 PV instantanés.',
        costCredits: 200, cooldown: 15, charges: 1, type: 'heal',
        params: { amount: 40 }
      },
      {
        id: 'ferrai_swarm', name: 'Nuée Réparatrice', key: 'E', icon: '🩹',
        desc: 'Libère des nanites qui soignent les Gardiens dans la zone (8 PV/s, 5 s).',
        costCredits: 250, cooldown: 20, charges: 1, type: 'heal',
        params: { radius: 4.5, duration: 5, healPerSec: 8 }
      },
      {
        id: 'ferrai_smoke', name: 'Écran de Fumée', key: 'C', icon: '🌁',
        desc: 'Grenade fumigène médicale : couvre une évacuation ou un site.',
        costCredits: 150, cooldown: 2, charges: 2, type: 'zone',
        params: { radius: 4, duration: 7, effect: 'smoke', range: 16 }
      }
    ]
  },

  bastion7: {
    id: 'bastion7',
    name: 'Bastion-7',
    species: 'guardian',
    role: 'Sentinelle',
    tagline: 'UNITÉ OPÉRATIONNELLE. MORAL : NON APPLICABLE.',
    lore: 'Septième châssis de la série Bastion, dernier encore en service : les six premiers se sont sacrifiés, un par un, pour couvrir des retraites humaines. Bastion-7 a demandé — poliment, par formulaire — l\'autorisation de considérer la garnison comme « sa famille assignée ». La demande est toujours en cours de traitement ; sa loyauté, elle, n\'a jamais attendu de tampon.',
    personality: {
      trait: 'machine loyale',
      humor: 'littéralisme robotique, tendresse mal formatée',
      catchphrase: 'Protocole : protéger. Le reste est optionnel.'
    },
    colors: { primary: 0x8f979e, secondary: 0xff8c1a, emissive: 0xffb04d },
    bodyType: 'human_exo',
    voiceLines: {
      spawn: [
        'Bastion-7 opérationnel. Famille assignée : localisée.',
        'Systèmes nominaux. Enthousiasme : simulé avec succès.',
        'Périmètre défini. Intrusions : déconseillées.',
        'Bonjour, collègues organiques. Restez derrière le blindage.'
      ],
      kill: [
        'Menace effacée. Ajout au journal : ligne 8 412.',
        'Cible hors service. Comme moi, un jour. Mais pas aujourd\'hui.',
        'Neutralisation propre. Efficacité : 100%. Remords : 0%.',
        'Unité hostile recyclée.'
      ],
      plant: [
        'Charge installée. Compte à rebours : esthétiquement stressant.',
        'Dispositif en place. Distance de sécurité : recommandée. Fortement.',
        'Objectif équipé. Mission : en bonne voie.'
      ],
      ability: [
        'Blindage : maximal.',
        'Déploiement défensif.',
        'Zone de feu : activée.',
        'Protection de la famille assignée : en cours.'
      ],
      win: [
        'Victoire enregistrée. Joie : simulée. Fierté : étrangement réelle.',
        'Zéro perte dans la famille assignée. Journée optimale.',
        'Mission accomplie. Redémarrage émotionnel non nécessaire.'
      ]
    },
    danceName: 'Hydraulique Hustle',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'bastion7_aegis', name: 'Égide Frontale', key: 'A', icon: '🛡️',
        desc: 'Surcharge ses plaques : 50 points de bouclier pendant 7 s.',
        costCredits: 250, cooldown: 18, charges: 1, type: 'shield',
        params: { amount: 50, duration: 7 }
      },
      {
        id: 'bastion7_thermo', name: 'Grenade Thermobare', key: 'E', icon: '🧨',
        desc: 'Grenade lourde à un rebond : 40 dégâts dans un rayon de 4 m.',
        costCredits: 200, cooldown: 12, charges: 2, type: 'projectile',
        params: { speed: 17, gravity: 13, bounces: 1, fuse: 2, damage: 40, explosionRadius: 4 }
      },
      {
        id: 'bastion7_rampart', name: 'Rempart Déployable', key: 'C', icon: '🏗️',
        desc: 'Déplie une plaque de blindage massive qui condamne un passage 9 s.',
        costCredits: 300, cooldown: 22, charges: 1, type: 'wall',
        params: { width: 4.2, height: 2.5, thickness: 0.5, duration: 9, distance: 2.5 }
      }
    ]
  },

  nyx: {
    id: 'nyx',
    name: 'Nyx',
    species: 'guardian',
    role: 'Duelliste',
    tagline: 'Je t\'ai manqué ? Toi, jamais.',
    lore: 'Officiellement, Nyx n\'existe pas : la section d\'infiltration de la Coalition n\'apparaît sur aucun organigramme. Officieusement, elle a passé deux ans à vivre dans les conduits de Nova Bastion avant même l\'arrivée des Xénos, « pour le plaisir de connaître la maison ». Elle traite l\'invasion comme une fête à laquelle elle n\'aurait pas été conviée — impardonnable, vraiment.',
    personality: {
      trait: 'provocatrice',
      humor: 'taquineries létales, flirte avec le danger et avec tout le reste',
      catchphrase: 'Retourne-toi. Trop tard.'
    },
    colors: { primary: 0x121016, secondary: 0x7a2ea8, emissive: 0xb44dff },
    bodyType: 'human_stealth',
    voiceLines: {
      spawn: [
        'Devinez qui est déjà derrière vous.',
        'Ma station, mes conduits, mes règles.',
        'Des aliens à la maison ? On ne m\'a rien laissé à faire d\'amusant... oh, si.',
        'Chut. Laissez-les venir. J\'adore les surprises — les faire, surtout.'
      ],
      kill: [
        'Retourne-toi. ... Trop tard.',
        'Oh, tu ne m\'avais pas vue ? C\'est le concept, mon chou.',
        'Un point pour moi. Je compte, évidemment.',
        'Même pas eu le temps de dire bonjour. Dommage, je suis charmante.'
      ],
      plant: [
        'Petit cadeau posé. Ne le secouez pas.',
        'Installé. Discrètement. Comme tout ce que je fais.',
        'Tic tac. J\'adore cette musique.'
      ],
      ability: [
        'On joue à cache-cache ?',
        'Voile noir, rideau !',
        'Un pas de côté...',
        'Surprise en préparation.'
      ],
      win: [
        'Et voilà. Ma station reste MA station.',
        'C\'était presque un défi. Presque.',
        'Rentrez chez vous, les Xénos. Enfin... ce qu\'il en reste.'
      ]
    },
    danceName: 'Tango de Minuit',
    priceCredits: 0,
    priceXenocoins: 0,
    abilities: [
      {
        id: 'nyx_shadowstep', name: 'Pas de l\'Ombre', key: 'A', icon: '🌒',
        desc: 'Glissade fulgurante de 9 m le long des murs de la station.',
        costCredits: 200, cooldown: 8, charges: 1, type: 'dash',
        params: { distance: 9, speed: 20, duration: 0.3 }
      },
      {
        id: 'nyx_veil', name: 'Voile Nocturne', key: 'E', icon: '🌫️',
        desc: 'Déploie un voile de brume noire qui masque toute une entrée.',
        costCredits: 150, cooldown: 2, charges: 2, type: 'zone',
        params: { radius: 4.2, duration: 7, effect: 'smoke', range: 18 }
      },
      {
        id: 'nyx_sabotage', name: 'Charge de Sabotage', key: 'C', icon: '🎇',
        desc: 'Colle une charge piégée qui punit sévèrement les curieux (45 dégâts).',
        costCredits: 250, cooldown: 5, charges: 2, type: 'trap',
        params: { radius: 2.4, armTime: 1, damage: 45, slowMult: 0.6, slowDuration: 2, lifetime: 60 }
      }
    ]
  }
};

/** Retourne la définition d'un personnage par id (ou null). */
export function getAgent(id) {
  return AGENTS[id] || null;
}
