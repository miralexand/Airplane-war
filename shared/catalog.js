export const PLANES = [
  {
    id: 'falcon',
    name: '苍隼',
    code: 'FALCON / 01',
    role: '均衡型',
    tagline: '风，是最锋利的刃。',
    desc: '联邦空军的经典机体。推重比均衡，火力稳定，适合第一次踏入云海的飞行员。',
    shape: 'falcon',
    unlock: 'free',
    price: 0,
    stats: { speed: 3, power: 3, armor: 3, handling: 4 },
    ultimate: {
      id: 'storm',
      name: '苍穹风暴',
      short: '风暴',
      cooldown: 56,
      desc: '同时锁定最多 3 个目标，齐射高伤追踪导弹。'
    },
    loadout: {
      hp: 110,
      speed: 430,
      fireDelay: 0.135,
      damage: 12,
      cannonDamage: 5.5,
      ammo: 220,
      handling: 4,
      bulletSpeed: 940,
      pattern: 'single',
      radius: 16
    }
  },
  {
    id: 'viper',
    name: '游隼',
    code: 'VIPER / 07',
    role: '疾速型',
    tagline: '在雷达发现你之前，战斗已经结束。',
    desc: '极限轻量化拦截机。双联脉冲炮拥有恐怖的射速，代价是脆弱的复合装甲。',
    shape: 'viper',
    unlock: 'free',
    price: 0,
    stats: { speed: 5, power: 4, armor: 1, handling: 5 },
    ultimate: {
      id: 'afterburner',
      name: '超频突袭',
      short: '超频',
      cooldown: 54,
      desc: '5 秒极限加速并免疫伤害，强行穿过敌方火力网。'
    },
    loadout: {
      hp: 82,
      speed: 520,
      fireDelay: 0.098,
      damage: 4.8,
      cannonDamage: 2.8,
      ammo: 260,
      handling: 5,
      bulletSpeed: 1020,
      pattern: 'twin',
      radius: 14
    }
  },
  {
    id: 'titan',
    name: '雷霆',
    code: 'TITAN / 12',
    role: '重装型',
    tagline: '让天空记住重力的另一种写法。',
    desc: '重型空优战机。三联装等离子散射炮可以撕开编队，厚重装甲让它能承受更多火力。',
    shape: 'titan',
    unlock: 'free',
    price: 0,
    stats: { speed: 2, power: 5, armor: 5, handling: 2 },
    ultimate: {
      id: 'thunder',
      name: '雷霆万钧',
      short: '雷霆',
      cooldown: 58,
      desc: '释放环形等离子冲击，重创周围 1.3 公里内所有敌机。'
    },
    loadout: {
      hp: 172,
      speed: 340,
      fireDelay: 0.2,
      damage: 8.5,
      cannonDamage: 4.2,
      ammo: 180,
      handling: 2,
      bulletSpeed: 830,
      pattern: 'spread',
      radius: 20
    }
  },
  {
    id: 'nova',
    name: '星曜',
    code: 'NOVA / 00',
    role: '原型机',
    tagline: '不属于这个时代的飞行器。',
    desc: '从深空残骸中复原的实验型战机。相位脉冲炮与自适应翼面，使它同时拥有速度与致命性。',
    shape: 'nova',
    unlock: 'premium',
    price: 5000,
    stats: { speed: 4, power: 5, armor: 3, handling: 5 },
    ultimate: {
      id: 'singularity',
      name: '相位奇点',
      short: '奇点',
      cooldown: 72,
      desc: '投放引力奇点，持续牵引并灼烧半径内的敌方编队。'
    },
    loadout: {
      hp: 120,
      speed: 475,
      fireDelay: 0.112,
      damage: 7.4,
      cannonDamage: 3.6,
      ammo: 240,
      handling: 5,
      bulletSpeed: 1060,
      pattern: 'pulse',
      radius: 16
    }
  },
  {
    id: 'bastion',
    name: '壁垒',
    code: 'BASTION / 21',
    role: '重装堡垒',
    tagline: '风暴可以撕开云层，却撕不开这面铁壁。',
    desc: '为正面突防而生的重型装甲战机。转向迟缓、加速笨重，却拥有全场最高的结构值与载弹量，适合硬吃火力推进战线。',
    shape: 'bastion',
    unlock: 'free',
    price: 0,
    stats: { speed: 1, power: 4, armor: 5, handling: 1 },
    ultimate: {
      id: 'fortress',
      name: '铁壁领域',
      short: '铁壁',
      cooldown: 64,
      desc: '修复 75 点结构并展开 6 秒能量壁垒，大幅降低所受伤害。'
    },
    loadout: {
      hp: 280,
      speed: 300,
      fireDelay: 0.17,
      damage: 7.2,
      cannonDamage: 5.8,
      ammo: 320,
      handling: 1,
      bulletSpeed: 760,
      pattern: 'spread',
      radius: 26
    }
  }
];

export const SKINS = [
  {
    id: 'chrome',
    name: '苍穹银',
    code: 'CHROME',
    rarity: '标准',
    desc: '出厂涂装。冷冽、克制，像一束穿过云层的光。',
    unlock: 'free',
    price: 0,
    palette: {
      body: '#e2e9dc',
      body2: '#93a394',
      dark: '#28352b',
      accent: '#c6dcc0',
      glow: '#b8d7a8',
      trail: '#cfe3c6',
      canopy: '#1e3227'
    }
  },
  {
    id: 'aurora',
    name: '极光幻彩',
    code: 'AURORA',
    rarity: '传说',
    desc: '磁暴之后，天空把颜色借给了它。传说级动态虹彩涂层。',
    unlock: 'code',
    price: 0,
    animated: 'aurora',
    palette: {
      body: '#d8fff6',
      body2: '#74d8ff',
      dark: '#193b5d',
      accent: '#ff75e6',
      glow: '#7dffce',
      trail: '#d8ff6f',
      canopy: '#113d4d'
    }
  },
  {
    id: 'ember',
    name: '熔金烈焰',
    code: 'EMBER',
    rarity: '史诗',
    desc: '取自落日边缘的高温合金，引擎点火时像一颗坠落的太阳。',
    unlock: 'purchase',
    price: 900,
    animated: 'ember',
    palette: {
      body: '#ffe1ad',
      body2: '#d47d37',
      dark: '#3c180d',
      accent: '#ff7d24',
      glow: '#ff9c35',
      trail: '#ffb347',
      canopy: '#4d1a07'
    }
  },
  {
    id: 'abyss',
    name: '深渊蓝调',
    code: 'ABYSS',
    rarity: '史诗',
    desc: '吸收了深海与夜空的颜色。安静，但足够让敌人做噩梦。',
    unlock: 'purchase',
    price: 1600,
    animated: 'abyss',
    palette: {
      body: '#b6c4ff',
      body2: '#5860b8',
      dark: '#111332',
      accent: '#7f8cff',
      glow: '#8c9aff',
      trail: '#5e7cff',
      canopy: '#15113f'
    }
  },
  {
    id: 'solar',
    name: '日冕耀斑',
    code: 'SOLARIS',
    rarity: '传说',
    desc: '恒星风锻造的荣耀涂层，只属于真正读过星图的人。',
    unlock: 'code',
    price: 0,
    animated: 'solar',
    palette: {
      body: '#fff9c9',
      body2: '#e0b341',
      dark: '#4c2506',
      accent: '#ffc531',
      glow: '#ffdb55',
      trail: '#ffe27a',
      canopy: '#573300'
    }
  },
  {
    id: 'specter',
    name: '虚空幽灵',
    code: 'SPECTER',
    rarity: '神话',
    desc: '在雷达与肉眼之间闪烁。没有人确定它是否真实存在。',
    unlock: 'purchase',
    price: 2800,
    animated: 'specter',
    palette: {
      body: '#e2d8ff',
      body2: '#7760a8',
      dark: '#211632',
      accent: '#b477ff',
      glow: '#c08cff',
      trail: '#925cff',
      canopy: '#2a1044'
    }
  }
];

export const AIR_MAPS = [
  {
    id: 'blacksky',
    name: '黑幕空域',
    en: 'BLACK SKY',
    tagline: '暮色云海与深海群岛，经典的高空拦截战场。',
    accent: '#57e5ff'
  },
  {
    id: 'redmesa',
    name: '赤沙峡谷',
    en: 'RED MESA',
    tagline: '赤色台地拔地而起，在狭窄峡谷间低空缠斗。',
    accent: '#ffb15e'
  },
  {
    id: 'megacity',
    name: '雾都山城',
    en: 'MOUNTAIN CITY',
    tagline: '两江穿城、群楼依山而起，大型民航客机沿雾中山脊穿越空域。',
    accent: '#e7be83'
  }
];

export const PLANE_MAP = Object.fromEntries(PLANES.map((plane) => [plane.id, plane]));
export const SKIN_MAP = Object.fromEntries(SKINS.map((skin) => [skin.id, skin]));
export const MAP_MAP = Object.fromEntries(AIR_MAPS.map((map) => [map.id, map]));

export const DEFAULT_PLANE = 'falcon';
export const DEFAULT_SKIN = 'chrome';
export const DEFAULT_MAP = 'blacksky';

export const MODES = {
  campaign: {
    key: 'campaign',
    name: '远征',
    en: 'CAMPAIGN',
    tagline: '深入无尽空域，终结虚空舰队。',
    accent: '#57e5ff'
  },
  endless: {
    key: 'endless',
    name: '无尽',
    en: 'ENDLESS',
    tagline: '没有终点，只有更高的积分。',
    accent: '#ffcf5b'
  },
  duel: {
    key: 'duel',
    name: '对决',
    en: 'LAN DUEL',
    tagline: '局域网内的王牌，只能有一个。',
    accent: '#ff6e9f'
  }
};

export function getPlane(id) {
  return PLANE_MAP[id] || PLANE_MAP[DEFAULT_PLANE];
}

export function getSkin(id) {
  return SKIN_MAP[id] || SKIN_MAP[DEFAULT_SKIN];
}

export function getMap(id) {
  return MAP_MAP[id] || MAP_MAP[DEFAULT_MAP];
}

export const PVP = {
  arenaWidth: 720,
  arenaHeight: 1280,
  maxHp: 120,
  killsToWin: 3,
  damage: 9
};
