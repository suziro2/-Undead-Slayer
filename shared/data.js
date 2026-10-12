// Static game content shared by the browser client, the Express server and the
// pixel-art generator. Everything here is original content for this project.

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

export const RARITY = {
  common: { label: 'Common', color: '#b8c4cf', fragments: 5, statMult: 1.0, weight: 70 },
  rare: { label: 'Rare', color: '#4fa3ff', fragments: 10, statMult: 1.5, weight: 22 },
  epic: { label: 'Epic', color: '#b26bff', fragments: 25, statMult: 2.2, weight: 7 },
  legendary: { label: 'Legendary', color: '#ffb83d', fragments: 60, statMult: 3.2, weight: 1 },
};

// ---------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------
// style drives the battle attack shape on the client; unlock describes how the
// hero can be obtained besides summoning (summoning is always possible).
export const HEROES = {
  aiden: {
    id: 'aiden', name: 'Aiden', title: 'Sword Knight', rarity: 'common', style: 'sword',
    weapon: 'Longsword & Kite Shield', color: '#4aa3ff',
    description: 'A disciplined knight who never breaks formation. Balanced in every stat.',
    base: { hp: 120, atk: 14, def: 8 }, growth: { hp: 7, atk: 1.2, def: 0.8 },
    speed: 92, range: 34, mana: 30,
    skill: { id: 'radiant_slash', name: 'Radiant Slash', mult: 2.4, cooldown: 5, desc: 'Sweeping light arc that hits everything in front of you.' },
    unlock: { type: 'starter', text: 'Starting hero' },
  },
  luna: {
    id: 'luna', name: 'Luna', title: 'Moon Archer', rarity: 'rare', style: 'bow',
    weapon: 'Moonwood Bow', color: '#a8c8ff',
    description: 'Quick and precise. Her arrows glow faintly under the moon.',
    base: { hp: 95, atk: 13, def: 5 }, growth: { hp: 5, atk: 1.3, def: 0.5 },
    speed: 104, range: 150, mana: 28,
    skill: { id: 'moon_volley', name: 'Moon Volley', mult: 1.6, cooldown: 5, desc: 'Fires a fan of three silver arrows.' },
    unlock: { type: 'coins', cost: 2500, text: 'Buy with 2,500 coins' },
  },
  ronan: {
    id: 'ronan', name: 'Ronan', title: 'Berserker', rarity: 'rare', style: 'berserk',
    weapon: 'Twin Battleaxes', color: '#ff6b4a',
    description: 'Fights harder the more he bleeds. Terrifying up close.',
    base: { hp: 150, atk: 17, def: 6 }, growth: { hp: 8, atk: 1.4, def: 0.6 },
    speed: 86, range: 40, mana: 34,
    skill: { id: 'rage_spin', name: 'Rage Spin', mult: 2.0, cooldown: 6, desc: 'Spins both axes in a wide circle around the hero.' },
    unlock: { type: 'chapter', chapter: 3, text: 'Clear Chapter 3' },
  },
  mira: {
    id: 'mira', name: 'Mira', title: 'Elemental Mage', rarity: 'epic', style: 'fire',
    weapon: 'Ember Staff', color: '#ff8a3d',
    description: 'Commands flame and frost. Her fireballs explode on impact.',
    base: { hp: 90, atk: 16, def: 4 }, growth: { hp: 5, atk: 1.6, def: 0.4 },
    speed: 92, range: 170, mana: 26,
    skill: { id: 'fire_nova', name: 'Fire Nova', mult: 2.2, cooldown: 6, desc: 'Launches a fireball that detonates in an area.' },
    unlock: { type: 'fragments', cost: 30, text: 'Spend 30 fragments' },
  },
  kael: {
    id: 'kael', name: 'Kael', title: 'Shadow Assassin', rarity: 'epic', style: 'dagger',
    weapon: 'Twin Shadow Daggers', color: '#7a5cff',
    description: 'Strikes from the dark and vanishes before the blow lands.',
    base: { hp: 100, atk: 18, def: 5 }, growth: { hp: 5, atk: 1.6, def: 0.5 },
    speed: 118, range: 30, mana: 32,
    skill: { id: 'shadow_dash', name: 'Shadow Dash', mult: 2.6, cooldown: 6, desc: 'Blinks behind the nearest enemy and strikes twice.' },
    unlock: { type: 'achievement', id: 'slayer_150', text: 'Achievement: Slayer (150 kills)' },
  },
  bruno: {
    id: 'bruno', name: 'Bruno', title: 'Guardian', rarity: 'common', style: 'guard',
    weapon: 'Tower Shield & Mace', color: '#c9a04a',
    description: 'An immovable wall. Protects allies with a stone-hard shield.',
    base: { hp: 170, atk: 10, def: 14 }, growth: { hp: 10, atk: 0.9, def: 1.2 },
    speed: 80, range: 34, mana: 36,
    skill: { id: 'iron_bastion', name: 'Iron Bastion', mult: 1.8, cooldown: 8, desc: 'Raises a shield for 4s (-60% damage) and shockwaves nearby foes.' },
    unlock: { type: 'boss', boss: 'frost_dragon', text: 'Defeat the Frost Dragon' },
  },
  sylvie: {
    id: 'sylvie', name: 'Sylvie', title: 'Nature Druid', rarity: 'rare', style: 'nature',
    weapon: 'Living Wood Staff', color: '#5ccc6a',
    description: 'Speaks with roots and thorns. Heals her friends with blooming vines.',
    base: { hp: 110, atk: 12, def: 7 }, growth: { hp: 6, atk: 1.1, def: 0.7 },
    speed: 96, range: 160, mana: 28,
    skill: { id: 'thorn_surge', name: 'Thorn Surge', mult: 1.8, cooldown: 7, desc: 'Heals 25% HP and erupts thorns under nearby enemies.' },
    unlock: { type: 'coins', cost: 4000, text: 'Buy with 4,000 coins' },
  },
  darius: {
    id: 'darius', name: 'Darius', title: 'Dark Paladin', rarity: 'legendary', style: 'dark',
    weapon: 'Abyssal Greatsword', color: '#6b2a8a',
    description: 'A fallen holy knight who now wields darkness to protect the innocent.',
    base: { hp: 150, atk: 18, def: 12 }, growth: { hp: 8, atk: 1.5, def: 1.0 },
    speed: 84, range: 46, mana: 36,
    skill: { id: 'abyssal_judgement', name: 'Abyssal Judgement', mult: 3.0, cooldown: 9, desc: 'Slams the ground, dealing heavy damage and healing 15% of damage dealt.' },
    unlock: { type: 'boss', boss: 'demon_king', text: 'Defeat the Demon King' },
  },
  elian: {
    id: 'elian', name: 'Elian', title: 'Storm Mage', rarity: 'epic', style: 'storm',
    weapon: 'Thunder Orb', color: '#5ee0ff',
    description: 'Calls lightning from clear skies. Crackles with barely contained power.',
    base: { hp: 92, atk: 17, def: 4 }, growth: { hp: 5, atk: 1.7, def: 0.4 },
    speed: 98, range: 180, mana: 26,
    skill: { id: 'chain_lightning', name: 'Chain Lightning', mult: 1.9, cooldown: 6, desc: 'Lightning jumps between up to three enemies.' },
    unlock: { type: 'fragments', cost: 60, text: 'Spend 60 fragments' },
  },
  riven: {
    id: 'riven', name: 'Riven', title: 'Dragon Warrior', rarity: 'legendary', style: 'dragon',
    weapon: 'Dragonbone Lance', color: '#ff4d4d',
    description: 'Blood of an ancient dragon runs in her veins. Her lance has a long reach.',
    base: { hp: 140, atk: 19, def: 10 }, growth: { hp: 7, atk: 1.6, def: 0.9 },
    speed: 94, range: 58, mana: 34,
    skill: { id: 'dragon_breath', name: 'Dragon Breath', mult: 2.5, cooldown: 7, desc: 'Breathes a cone of dragonfire in front of her.' },
    unlock: { type: 'gacha', text: 'Summon only (or 120 fragments)', cost: 120 },
  },
};

export const HERO_IDS = Object.keys(HEROES);
export const STARTER_HERO = 'aiden';

// Gacha pools per rarity. Every hero except the starter can be summoned.
export const GACHA = {
  singleCostCoins: 150,
  singleCostCrystals: 10,
  multiCount: 10,
  multiCostCoins: 1350,
  multiCostCrystals: 90,
  // Displayed and used directly by the server.
  rates: { common: 0.6, rare: 0.3, epic: 0.08, legendary: 0.02 },
  // Pity: 10th pull without Epic+ guarantees Epic+ (20% of those are Legendary);
  // 50th pull without Legendary guarantees Legendary.
  pity: { epicAfter: 10, legendaryAfter: 50, legendaryShareOfEpicPity: 0.2 },
  pools: {
    common: ['aiden', 'bruno'],
    rare: ['luna', 'ronan', 'sylvie'],
    epic: ['mira', 'kael', 'elian'],
    legendary: ['darius', 'riven'],
  },
};

// ---------------------------------------------------------------------------
// Enemies (regular mobs). Stats are chapter-1 baselines; rules.js scales them.
// ---------------------------------------------------------------------------
// kind: melee | ranged | charger | flyer | dasher
// special: { type: lunge | projectile | dash | aoe | leap | teleport | ... }
export const ENEMIES = {
  zombie: { id: 'zombie', name: 'Zombie', kind: 'melee', rig: 'humanoid', hp: 34, atk: 12, def: 1, speed: 30, aggro: 170, range: 20, cooldown: 1.5, coins: 6, xp: 8, size: [14, 20], special: { type: 'lunge', cooldown: 6 } },
  skeleton: { id: 'skeleton', name: 'Skeleton', kind: 'melee', rig: 'humanoid', hp: 30, atk: 14, def: 3, speed: 42, aggro: 180, range: 22, cooldown: 1.3, coins: 8, xp: 9, size: [13, 22], special: { type: 'projectile', cooldown: 5, speed: 150 } },
  bandit: { id: 'bandit', name: 'Bandit', kind: 'melee', rig: 'humanoid', hp: 40, atk: 16, def: 2, speed: 52, aggro: 190, range: 24, cooldown: 1.2, coins: 10, xp: 11, size: [14, 22], special: { type: 'projectile', cooldown: 4, speed: 170 } },
  goblin: { id: 'goblin', name: 'Goblin', kind: 'melee', rig: 'humanoid', hp: 24, atk: 10, def: 1, speed: 62, aggro: 190, range: 18, cooldown: 0.9, coins: 5, xp: 6, size: [11, 16], special: { type: 'dash', cooldown: 5 } },
  wolf: { id: 'wolf', name: 'Wolf', kind: 'charger', rig: 'quadruped', hp: 30, atk: 16, def: 1, speed: 74, aggro: 200, range: 22, cooldown: 1.1, coins: 6, xp: 8, size: [20, 14], special: { type: 'leap', cooldown: 4 } },
  dark_mage: { id: 'dark_mage', name: 'Dark Mage', kind: 'ranged', rig: 'humanoid', hp: 28, atk: 18, def: 0, speed: 40, aggro: 220, range: 150, cooldown: 2.0, coins: 14, xp: 12, size: [13, 22], special: { type: 'projectile', cooldown: 3, speed: 120, homing: true } },
  ice_warrior: { id: 'ice_warrior', name: 'Ice Warrior', kind: 'melee', rig: 'humanoid', hp: 55, atk: 20, def: 5, speed: 46, aggro: 180, range: 28, cooldown: 1.6, coins: 12, xp: 14, size: [14, 22], special: { type: 'aoe', cooldown: 7, radius: 46 } },
  ice_golem: { id: 'ice_golem', name: 'Ice Golem', kind: 'melee', rig: 'humanoid', chunky: true, hp: 120, atk: 28, def: 10, speed: 24, aggro: 150, range: 30, cooldown: 2.2, coins: 20, xp: 22, size: [24, 30], special: { type: 'aoe', cooldown: 7, radius: 60 } },
  demon: { id: 'demon', name: 'Demon', kind: 'melee', rig: 'humanoid', hp: 60, atk: 24, def: 4, speed: 58, aggro: 200, range: 22, cooldown: 1.2, coins: 16, xp: 16, size: [14, 24], special: { type: 'projectile', cooldown: 4, speed: 160 } },
  shadow_assassin: { id: 'shadow_assassin', name: 'Shadow Assassin', kind: 'dasher', rig: 'humanoid', hp: 36, atk: 26, def: 2, speed: 64, aggro: 210, range: 22, cooldown: 1.0, coins: 18, xp: 16, size: [12, 22], special: { type: 'teleport', cooldown: 6 } },
  sand_scorpion: { id: 'sand_scorpion', name: 'Sand Scorpion', kind: 'melee', rig: 'quadruped', hp: 55, atk: 22, def: 6, speed: 40, aggro: 170, range: 28, cooldown: 1.6, coins: 12, xp: 14, size: [22, 14], special: { type: 'projectile', cooldown: 4, speed: 140 } },
  abyssal_fishman: { id: 'abyssal_fishman', name: 'Abyssal Fishman', kind: 'ranged', rig: 'humanoid', hp: 50, atk: 20, def: 4, speed: 44, aggro: 220, range: 140, cooldown: 1.8, coins: 14, xp: 14, size: [14, 22], special: { type: 'projectile', cooldown: 4, speed: 150 } },
  reef_crab: { id: 'reef_crab', name: 'Reef Crab', kind: 'melee', rig: 'quadruped', hp: 70, atk: 18, def: 8, speed: 30, aggro: 150, range: 24, cooldown: 1.4, coins: 12, xp: 13, size: [20, 14], special: { type: 'aoe', cooldown: 8, radius: 40 } },
  dragon_whelp: { id: 'dragon_whelp', name: 'Dragon Whelp', kind: 'flyer', rig: 'dragon', hp: 65, atk: 26, def: 5, speed: 56, aggro: 240, range: 150, cooldown: 1.8, coins: 22, xp: 20, size: [22, 16], special: { type: 'projectile', cooldown: 3, speed: 180 } },
  nightmare_eye: { id: 'nightmare_eye', name: 'Nightmare Eye', kind: 'ranged', rig: 'floating', hp: 45, atk: 24, def: 1, speed: 36, aggro: 230, range: 160, cooldown: 2.0, coins: 18, xp: 15, size: [18, 18], special: { type: 'projectile', cooldown: 3, speed: 130 } },
  nightmare_hound: { id: 'nightmare_hound', name: 'Nightmare Hound', kind: 'charger', rig: 'quadruped', hp: 55, atk: 24, def: 3, speed: 78, aggro: 210, range: 22, cooldown: 1.1, coins: 16, xp: 15, size: [22, 16], special: { type: 'leap', cooldown: 4 } },
  celestial_sentinel: { id: 'celestial_sentinel', name: 'Celestial Sentinel', kind: 'melee', rig: 'humanoid', winged: true, hp: 85, atk: 30, def: 8, speed: 50, aggro: 220, range: 30, cooldown: 1.4, coins: 24, xp: 22, size: [16, 24], special: { type: 'projectile', cooldown: 4, speed: 170 } },
  star_wisp: { id: 'star_wisp', name: 'Star Wisp', kind: 'ranged', rig: 'floating', hp: 40, atk: 22, def: 2, speed: 48, aggro: 230, range: 130, cooldown: 1.6, coins: 14, xp: 14, size: [14, 14], special: { type: 'aoe', cooldown: 6, radius: 50 } },
};

// Special-attack and basic-attack timing shared by all mobs (animation frame index that lands the hit).
export const MOB_HIT_FRAME = 2;

// ---------------------------------------------------------------------------
// Bosses: each has a unique sprite sheet and attack set.
// attacks.* define damage multiplier, reach, and the animation type used.
// ---------------------------------------------------------------------------
export const BOSSES = {
  undead_warlord: {
    id: 'undead_warlord', name: 'Undead Warlord', title: 'Lord of the Cursed Village', rig: 'humanoid', scale: 2.1,
    hp: 380, atk: 16, def: 6, speed: 46, size: [40, 56], phases: [0.66, 0.33],
    summons: ['zombie', 'skeleton'], color: '#8fd45a', rewardRarity: 'epic',
    intro: 'The Warlord rises from the graveyard, carrying a rusted greatsword.',
    attacks: {
      basic: { mult: 1.0, range: 60, type: 'melee' },
      heavy: { mult: 1.8, range: 74, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.2, type: 'projectile', speed: 180 },
      aoe: { mult: 1.4, type: 'radial', radius: 110, telegraph: 0.6 },
    },
  },
  forest_guardian: {
    id: 'forest_guardian', name: 'Ancient Forest Guardian', title: 'Heart of the Dark Forest', rig: 'tree', scale: 2.2,
    hp: 440, atk: 18, def: 8, speed: 34, size: [44, 64], phases: [0.66, 0.33],
    summons: ['goblin', 'wolf'], color: '#3fae5b', rewardRarity: 'epic',
    intro: 'An ancient tree stirs. Its branches are older than the kingdom.',
    attacks: {
      basic: { mult: 1.0, range: 66, type: 'melee' },
      heavy: { mult: 1.9, range: 80, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.1, type: 'projectile', speed: 160 },
      aoe: { mult: 1.3, type: 'radial', radius: 120, telegraph: 0.6 },
    },
  },
  frost_dragon: {
    id: 'frost_dragon', name: 'Frost Dragon', title: 'Tyrant of the Frozen Kingdom', rig: 'dragon', scale: 2.3,
    hp: 500, atk: 20, def: 10, speed: 52, size: [70, 52], phases: [0.66, 0.33],
    summons: ['ice_golem'], color: '#7fd8ff', rewardRarity: 'epic',
    intro: 'Wings of ice blot out the sun. The Frost Dragon has come to claim the realm.',
    attacks: {
      basic: { mult: 1.0, range: 70, type: 'melee' },
      heavy: { mult: 1.8, range: 90, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.2, type: 'cone', speed: 190 },
      aoe: { mult: 1.3, type: 'radial', radius: 130, telegraph: 0.7 },
    },
  },
  demon_king: {
    id: 'demon_king', name: 'Demon King', title: 'Sovereign of the Fortress', rig: 'humanoid', scale: 2.2, winged: true,
    hp: 560, atk: 22, def: 12, speed: 58, size: [40, 56], phases: [0.66, 0.33],
    summons: ['demon', 'dark_mage'], color: '#ff5a3c', rewardRarity: 'legendary',
    intro: 'The gates of the fortress burn. The Demon King descends from his throne.',
    attacks: {
      basic: { mult: 1.0, range: 62, type: 'melee' },
      heavy: { mult: 2.0, range: 80, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.2, type: 'projectile', speed: 200 },
      aoe: { mult: 1.5, type: 'radial', radius: 120, telegraph: 0.6 },
    },
  },
  shadow_overlord: {
    id: 'shadow_overlord', name: 'Shadow Overlord', title: 'Keeper of the Endless Night', rig: 'floating', scale: 2.4,
    hp: 520, atk: 22, def: 10, speed: 50, size: [44, 50], phases: [0.66, 0.33],
    summons: ['shadow_assassin', 'shadow_assassin'], color: '#9a6bff', rewardRarity: 'epic',
    intro: 'Darkness peels away from the walls and forms a hooded shape.',
    attacks: {
      basic: { mult: 1.0, range: 60, type: 'melee' },
      heavy: { mult: 1.8, range: 78, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.2, type: 'projectile', speed: 210, count: 3 },
      aoe: { mult: 1.4, type: 'radial', radius: 120, telegraph: 0.6 },
    },
  },
  sand_tyrant: {
    id: 'sand_tyrant', name: 'Sand Tyrant', title: 'Burrower of the Dunes', rig: 'quadruped', scale: 2.3,
    hp: 600, atk: 24, def: 14, speed: 40, size: [64, 42], phases: [0.66, 0.33],
    summons: ['bandit', 'bandit'], color: '#e8b35a', rewardRarity: 'epic',
    intro: 'The dunes split open. Pincers as wide as a cart snap at the sky.',
    attacks: {
      basic: { mult: 1.0, range: 70, type: 'melee' },
      heavy: { mult: 1.9, range: 84, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.1, type: 'projectile', speed: 170, count: 3 },
      aoe: { mult: 1.4, type: 'radial', radius: 130, telegraph: 0.7 },
    },
  },
  kraken_lord: {
    id: 'kraken_lord', name: 'Kraken Lord', title: 'Terror of the Sunken Deep', rig: 'tentacle', scale: 2.3,
    hp: 640, atk: 24, def: 12, speed: 30, size: [64, 60], phases: [0.66, 0.33],
    summons: ['abyssal_fishman', 'abyssal_fishman'], color: '#3a8fd9', rewardRarity: 'legendary',
    intro: 'The sea turns black. Eight arms rise from the depths.',
    attacks: {
      basic: { mult: 1.0, range: 70, type: 'melee' },
      heavy: { mult: 1.8, range: 90, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.1, type: 'projectile', speed: 160, count: 2 },
      aoe: { mult: 1.4, type: 'radial', radius: 140, telegraph: 0.7 },
    },
  },
  elder_dragon: {
    id: 'elder_dragon', name: 'Elder Dragon', title: 'Eldest of the Mountain Wyrms', rig: 'dragon', scale: 2.5,
    hp: 720, atk: 26, def: 14, speed: 52, size: [76, 56], phases: [0.66, 0.33],
    summons: ['dragon_whelp', 'dragon_whelp'], color: '#ff9a3c', rewardRarity: 'legendary',
    intro: 'Its roar splits the mountain. The Elder Dragon wakes from a thousand years of sleep.',
    attacks: {
      basic: { mult: 1.0, range: 74, type: 'melee' },
      heavy: { mult: 2.0, range: 90, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.3, type: 'cone', speed: 200 },
      aoe: { mult: 1.5, type: 'radial', radius: 140, telegraph: 0.7 },
    },
  },
  nightmare_emperor: {
    id: 'nightmare_emperor', name: 'Nightmare Emperor', title: 'The Dreamer Who Never Wakes', rig: 'floating', scale: 2.4,
    hp: 780, atk: 26, def: 14, speed: 40, size: [52, 56], phases: [0.66, 0.33],
    summons: ['nightmare_eye', 'nightmare_eye'], color: '#e05cff', rewardRarity: 'legendary',
    intro: 'Every eye in the realm opens at once. The Emperor is watching.',
    attacks: {
      basic: { mult: 1.0, range: 60, type: 'melee' },
      heavy: { mult: 1.9, range: 80, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.2, type: 'projectile', speed: 190, count: 3 },
      aoe: { mult: 1.5, type: 'radial', radius: 140, telegraph: 0.7 },
    },
  },
  celestial_overlord: {
    id: 'celestial_overlord', name: 'Celestial Overlord', title: 'Judge of the Starfall', rig: 'humanoid', scale: 2.2, winged: true,
    hp: 860, atk: 28, def: 16, speed: 60, size: [40, 56], phases: [0.66, 0.33],
    summons: ['celestial_sentinel', 'star_wisp'], color: '#ffe27a', rewardRarity: 'legendary',
    intro: 'Heaven sends its last army. The Celestial Overlord descends with a blade of light.',
    attacks: {
      basic: { mult: 1.0, range: 64, type: 'melee' },
      heavy: { mult: 2.0, range: 84, type: 'melee', telegraph: 0.5 },
      special: { mult: 1.3, type: 'projectile', speed: 220 },
      aoe: { mult: 1.6, type: 'radial', radius: 130, telegraph: 0.7 },
    },
  },
};

// ---------------------------------------------------------------------------
// Chapters: 10 chapters x 5 levels. Levels 1-3 regular, 4 elite, 5 boss.
// ---------------------------------------------------------------------------
export const CHAPTERS = [
  { id: 1, name: 'Cursed Village', env: 'village', boss: 'undead_warlord', roster: ['zombie', 'skeleton', 'bandit'], elite: 'skeleton', subtitle: 'Where the dead still remember their names.' },
  { id: 2, name: 'Dark Forest', env: 'forest', boss: 'forest_guardian', roster: ['goblin', 'wolf', 'bandit'], elite: 'wolf', subtitle: 'Roots whisper. Something in the trees is hungry.' },
  { id: 3, name: 'Frozen Kingdom', env: 'frost', boss: 'frost_dragon', roster: ['ice_warrior', 'ice_golem', 'wolf'], elite: 'ice_golem', subtitle: 'Winter has swallowed the crown and the throne.' },
  { id: 4, name: 'Demon Fortress', env: 'fortress', boss: 'demon_king', roster: ['demon', 'dark_mage', 'goblin'], elite: 'demon', subtitle: 'Iron walls, burning banners, and a king who never sleeps.' },
  { id: 5, name: 'Shadow Realm', env: 'shadow', boss: 'shadow_overlord', roster: ['shadow_assassin', 'dark_mage', 'zombie'], elite: 'shadow_assassin', subtitle: 'Light does not reach this place. Neither do you.' },
  { id: 6, name: 'Forgotten Desert', env: 'desert', boss: 'sand_tyrant', roster: ['sand_scorpion', 'bandit', 'skeleton'], elite: 'sand_scorpion', subtitle: 'Buried cities, buried gods, and the things that dig them up.' },
  { id: 7, name: 'Sunken Kingdom', env: 'sunken', boss: 'kraken_lord', roster: ['abyssal_fishman', 'reef_crab', 'skeleton'], elite: 'abyssal_fishman', subtitle: 'Drowned towers glow with bioluminescent dread.' },
  { id: 8, name: 'Dragon Mountains', env: 'mountain', boss: 'elder_dragon', roster: ['dragon_whelp', 'demon', 'ice_warrior'], elite: 'dragon_whelp', subtitle: 'The peaks are sharp, the air is hot, and the wyrms are awake.' },
  { id: 9, name: 'Nightmare Realm', env: 'nightmare', boss: 'nightmare_emperor', roster: ['nightmare_eye', 'nightmare_hound', 'shadow_assassin'], elite: 'nightmare_hound', subtitle: 'The sky bleeds violet and the ground breathes.' },
  { id: 10, name: 'Celestial Battlefield', env: 'celestial', boss: 'celestial_overlord', roster: ['celestial_sentinel', 'star_wisp', 'nightmare_eye'], elite: 'celestial_sentinel', subtitle: 'The last war between the stars and the dark.' },
];

export const LEVELS_PER_CHAPTER = 5;
export const BOSS_LEVEL = 5;
export const MAX_TEAM = 3;

// Level kinds shown in the UI.
export const LEVEL_KIND = { 1: 'Mobs', 2: 'Mobs', 3: 'Mobs', 4: 'Elite', 5: 'Boss' };

// ---------------------------------------------------------------------------
// Items, potions, materials, equipment
// ---------------------------------------------------------------------------
export const POTIONS = {
  health_potion: { id: 'health_potion', name: 'Health Potion', heal: 0.35, price: 60, cooldown: 5, desc: 'Restores 35% of max HP.' },
  greater_potion: { id: 'greater_potion', name: 'Greater Potion', heal: 0.7, price: 220, cooldown: 5, desc: 'Restores 70% of max HP.' },
};

export const MATERIALS = {
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', desc: 'Used to upgrade Vitality, Power and Guard.' },
  rune_shard: { id: 'rune_shard', name: 'Rune Shard', desc: 'Used to improve hero skills.' },
};

export const SHOP = {
  potions: [
    { id: 'health_potion', kind: 'potion', qty: 1, price: 60 },
    { id: 'greater_potion', kind: 'potion', qty: 1, price: 220 },
  ],
  materials: [
    { id: 'iron_ore', kind: 'material', qty: 5, price: 150 },
    { id: 'rune_shard', kind: 'material', qty: 3, price: 200 },
  ],
};

// Equipment templates. Weapons add ATK and HP; armor adds DEF and HP.
export const WEAPON_TEMPLATES = [
  { id: 'rusted_blade', name: 'Rusted Blade', atk: 3, hp: 0, icon: 'sword' },
  { id: 'hunter_bow', name: 'Hunter Bow', atk: 4, hp: 0, icon: 'bow' },
  { id: 'battle_axe', name: 'Battle Axe', atk: 5, hp: 0, icon: 'axe' },
  { id: 'arcane_staff', name: 'Arcane Staff', atk: 5, hp: 5, icon: 'staff' },
  { id: 'twin_daggers', name: 'Twin Daggers', atk: 4, hp: 0, icon: 'dagger' },
  { id: 'steel_longsword', name: 'Steel Longsword', atk: 7, hp: 0, icon: 'sword' },
  { id: 'moonglass_glaive', name: 'Moonglass Glaive', atk: 9, hp: 5, icon: 'spear' },
  { id: 'storm_rod', name: 'Storm Rod', atk: 8, hp: 5, icon: 'staff' },
];
export const ARMOR_TEMPLATES = [
  { id: 'leather_vest', name: 'Leather Vest', def: 3, hp: 10, icon: 'vest' },
  { id: 'chain_mail', name: 'Chain Mail', def: 5, hp: 20, icon: 'mail' },
  { id: 'plate_armor', name: 'Plate Armor', def: 8, hp: 35, icon: 'plate' },
  { id: 'mage_robe', name: 'Mage Robe', def: 3, hp: 15, icon: 'robe' },
  { id: 'shadow_cloak', name: 'Shadow Cloak', def: 4, hp: 12, icon: 'cloak' },
];

// ---------------------------------------------------------------------------
// Upgrades, leveling and achievements
// ---------------------------------------------------------------------------
export const UPGRADE = {
  hp: { label: 'Vitality', perTier: 10, max: 20, coins: (t) => 80 * (t + 1), ore: (t) => 1 + Math.floor(t / 3), desc: '+10 max HP per tier' },
  atk: { label: 'Power', perTier: 1, max: 20, coins: (t) => 80 * (t + 1), ore: (t) => 1 + Math.floor(t / 3), desc: '+1 ATK per tier' },
  def: { label: 'Guard', perTier: 1, max: 20, coins: (t) => 80 * (t + 1), ore: (t) => 1 + Math.floor(t / 3), desc: '+1 DEF per tier' },
  skill: { label: 'Skill', max: 5, coins: (t) => 300 * (t + 1), shards: (t) => 2 * (t + 1), desc: '+20% skill damage per level' },
};
export const ALLOC_POINT = { hp: 8, atk: 2, def: 2 }; // stats granted by one free stat point
export const ASCEND = { max: 5, fragments: 20, statBonus: 0.08 };
export const HERO_MAX_LEVEL = 30;
export const PLAYER_MAX_LEVEL = 60;
export const STARTING = { coins: 500, crystals: 60, potions: { health_potion: 3 } };

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy.', stat: 'totalKills', min: 1, crystals: 5 },
  { id: 'slayer_150', name: 'Slayer', desc: 'Defeat 150 enemies. Unlocks Kael.', stat: 'totalKills', min: 150, crystals: 30 },
  { id: 'boss_hunter', name: 'Boss Hunter', desc: 'Defeat 5 chapter bosses.', stat: 'bossesDefeated', min: 5, crystals: 40 },
  { id: 'summoner', name: 'Summoner', desc: 'Perform 20 summons.', stat: 'summons', min: 20, crystals: 30 },
  { id: 'collector', name: 'Collector', desc: 'Own 6 heroes.', stat: 'heroesOwned', min: 6, crystals: 40 },
  { id: 'conqueror', name: 'Conqueror', desc: 'Complete all 10 chapters.', stat: 'chaptersCompleted', min: 10, crystals: 200 },
];

export const LOADING_TIPS = [
  'Dodge with K (or Space) to become briefly invulnerable.',
  'Enemies telegraph heavy attacks with a red flash. Step aside!',
  'Potions have a short cooldown. Save them for emergencies.',
  'Repeat the Attack key quickly to chain a three-hit combo.',
  'Hold Shift to run. Running costs nothing, but you can be caught.',
  'Specials cost mana. Mana regenerates as you fight.',
  'Duplicate summons become Hero Fragments. Use them to unlock or ascend heroes.',
  'Equipment changes real stats. Check your Inventory after every boss.',
  'Bosses change behavior at 66% and 33% health.',
  'Replay earlier levels to farm XP, coins and Iron Ore.',
  'Pity guarantees Epic or better every 10 pulls without one.',
  'Team up to three heroes. Companions are controlled by the AI.',
];

export const DEFAULT_SETTINGS = { musicVolume: 0.5, sfxVolume: 0.7, showDamageNumbers: true, screenShake: true };
