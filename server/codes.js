import { PLANE_MAP, SKIN_MAP } from '../shared/catalog.js';

export const REDEEM_CODES = {
  SKY2026: {
    label: '云端来客',
    credits: 500,
    skin: 'aurora',
    message: '极光幻彩涂装已接入机库，并附赠 500 星尘。'
  },
  NOVA2026: {
    label: '深空残响',
    credits: 0,
    plane: 'nova',
    message: '原型机「星曜」完成了解锁授权。'
  },
  DEEPBLUE: {
    label: '深海回波',
    credits: 1200,
    message: '一封来自深海的补给：1200 星尘。'
  },
  STARFALL: {
    label: '流星雨',
    credits: 1500,
    message: '流星划过天际，1500 星尘落入你的账户。'
  },
  SOLARIS: {
    label: '日冕观测者',
    credits: 300,
    skin: 'solar',
    message: '日冕耀斑涂装已解锁，并附赠 300 星尘。'
  },
  KONAMI: {
    label: '隐藏彩蛋',
    credits: 888,
    skin: 'specter',
    message: '你找到了藏在星图背面的秘密。虚空幽灵涂装已解锁。'
  }
};

export function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, '');
}

export function redeemCode(user, rawCode) {
  const code = normalizeCode(rawCode);
  const reward = REDEEM_CODES[code];
  if (!reward) return { ok: false, error: '兑换码无效，或已被时间抹除。' };
  if (user.redeemed.includes(code)) return { ok: false, error: '这个兑换码已经使用过了。' };

  user.redeemed.push(code);
  const rewards = [];

  if (reward.credits) {
    user.credits += reward.credits;
    rewards.push(`${reward.credits} 星尘`);
  }

  if (reward.skin && SKIN_MAP[reward.skin] && !user.ownedSkins.includes(reward.skin)) {
    user.ownedSkins.push(reward.skin);
    rewards.push(`涂装「${SKIN_MAP[reward.skin].name}」`);
  }

  if (reward.plane && PLANE_MAP[reward.plane] && !user.ownedPlanes.includes(reward.plane)) {
    user.ownedPlanes.push(reward.plane);
    rewards.push(`战机「${PLANE_MAP[reward.plane].name}」`);
  }

  return {
    ok: true,
    label: reward.label,
    message: reward.message,
    rewards,
    credits: reward.credits || 0
  };
}
