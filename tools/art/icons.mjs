// 16x16 pixel icons for items, currencies and UI status markers.
import { Pix, C, lighten, darken, bake } from './pix.mjs';

const OUT = '#140c1c';

function icon(draw) {
  const p = new Pix(16, 16);
  draw(p);
  return bake(p, { outline: OUT, shade: true, shadeAmt: 0.15 });
}

const coinIcon = (p) => {
  p.disc(8, 8, 6.5, 6.5, C('#f2c14e'));
  p.disc(7, 7, 5, 5, C('#ffe17a'));
  p.ring(8, 8, 4.5, 4.5, C('#c8861c'), 1);
  p.rect(7, 5, 2, 6, C('#c8861c'));
};

const crystalIcon = (p) => {
  p.poly([[8, 1], [14, 6], [8, 15], [2, 6]], C('#7fe0ff'));
  p.poly([[8, 1], [14, 6], [8, 6]], C('#c8f4ff'));
  p.poly([[8, 6], [8, 15], [2, 6]], C('#3aa8d8'));
  p.line(2, 6, 14, 6, C('#2a7aa8'), 1);
};

const oreIcon = (p) => {
  p.disc(8, 9, 6, 5, C('#7a7f8a'));
  p.disc(6, 7, 3, 2, C('#9aa0aa'));
  p.set(10, 10, C('#e0a050')); p.set(5, 11, C('#e0a050')); p.set(9, 12, C('#e0a050'));
};

const shardIcon = (p) => {
  p.poly([[8, 1], [12, 8], [8, 14], [4, 8]], C('#c26bff'));
  p.poly([[8, 1], [12, 8], [8, 8]], C('#e8b8ff'));
  p.poly([[8, 8], [8, 14], [4, 8]], C('#7a3aaa'));
};

const potionIcon = (liquid, glass) => (p) => {
  p.rect(6, 1, 4, 3, C('#8a6a4a'));
  p.rect(5, 3, 6, 2, C('#b8b8c8'));
  p.disc(8, 10, 5.5, 5.5, C(glass));
  p.disc(8, 10, 4, 4, C(liquid));
  p.set(5, 8, C('#ffffff'));
  p.set(6, 7, C('#ffffff'));
};

const chestIcon = (p) => {
  p.rect(1, 6, 14, 9, C('#8a5a2a'));
  p.rect(1, 6, 14, 3, C('#a8703a'));
  p.rect(1, 9, 14, 1, C('#4a2a14'));
  p.rect(7, 8, 2, 4, C('#f2c14e'));
  p.rect(1, 14, 14, 1, C('#4a2a14'));
};

const starIcon = (p) => {
  p.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 14], [8, 11], [3, 14], [5, 9], [1, 6], [6, 6]], C('#ffe17a'));
  p.set(8, 5, C('#ffffff'));
};

const heartIcon = (p) => {
  p.disc(5, 6, 3.5, 3.5, C('#ff4a5a'));
  p.disc(11, 6, 3.5, 3.5, C('#ff4a5a'));
  p.poly([[1.5, 7], [14.5, 7], [8, 15]], C('#ff4a5a'));
  p.set(4, 5, C('#ffc0c8'));
};

const manaIcon = (p) => {
  p.poly([[8, 1], [13, 9], [8, 15], [3, 9]], C('#4aa8ff'));
  p.poly([[8, 1], [11, 8], [8, 8]], C('#a8dcff'));
};

const lockIcon = (p) => {
  p.ring(8, 6, 3.5, 3.5, C('#a8b0c0'), 2);
  p.rect(3, 7, 10, 8, C('#c9a04a'));
  p.rect(3, 7, 10, 1, C('#f2d27a'));
  p.rect(7, 10, 2, 3, C('#5a3a10'));
};

const checkIcon = (p) => {
  p.line(2, 8, 6, 12, C('#7af08a'), 2);
  p.line(6, 12, 14, 3, C('#7af08a'), 2);
};

const skullIcon = (p) => {
  p.disc(8, 7, 6, 5.5, C('#ece4cc'));
  p.disc(5.5, 7, 2, 2, C('#140c1c'));
  p.disc(10.5, 7, 2, 2, C('#140c1c'));
  p.rect(5, 12, 6, 3, C('#ece4cc'));
  p.set(8, 11, C('#140c1c'));
};

const fragmentIcon = (p) => {
  p.poly([[3, 3], [10, 2], [13, 9], [8, 14], [2, 10]], C('#e8b0ff'));
  p.poly([[3, 3], [10, 2], [7, 7]], C('#ffffff'));
  p.poly([[7, 7], [13, 9], [8, 14]], C('#9a5ad0'));
};

const gearIcon = (p) => {
  p.disc(8, 8, 5.5, 5.5, C('#9aa0aa'));
  p.disc(8, 8, 2.5, 2.5, C('#3a3a48'));
  for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) p.set(x, y, C('#9aa0aa'));
};

const scrollIcon = (p) => {
  p.rect(3, 3, 10, 10, C('#f0e0b0'));
  p.disc(3, 8, 2, 5, C('#d8c090'));
  p.disc(13, 8, 2, 5, C('#d8c090'));
  p.line(5, 6, 11, 6, C('#8a6a3a'), 1);
  p.line(5, 9, 11, 9, C('#8a6a3a'), 1);
};

const swordIcon = (p) => {
  p.line(3, 13, 12, 4, C('#dfe9f2'), 2);
  p.line(12, 4, 13, 2, C('#ffffff'), 1);
  p.line(2, 10, 6, 14, C('#6b4422'), 2);
  p.line(3, 8, 8, 13, C('#c9a24a'), 1);
};
const bowIcon = (p) => {
  p.line(4, 2, 2, 8, C('#8a6a3a'), 2);
  p.line(2, 8, 4, 14, C('#8a6a3a'), 2);
  p.line(4, 2, 4, 14, C('#e8e8e8'), 1);
  p.line(7, 8, 14, 8, C('#c9a24a'), 1);
  p.poly([[13, 7], [15, 8], [13, 9]], C('#c9a24a'));
};
const axeIcon = (p) => {
  p.line(4, 14, 10, 6, C('#7a5a3a'), 2);
  p.poly([[8, 1], [14, 4], [13, 9], [9, 7]], C('#c9d3dc'));
  p.line(9, 3, 12, 6, C('#ffffff'), 1);
};
const staffIcon = (p) => {
  p.line(3, 14, 10, 6, C('#7a5a3a'), 2);
  p.disc(11, 5, 3, 3, C('#7fe0ff'));
  p.disc(11, 5, 1.5, 1.5, C('#ffffff'));
};
const daggerIcon = (p) => {
  p.line(4, 13, 10, 7, C('#c8d0d8'), 2);
  p.poly([[9, 5], [12, 2], [13, 4], [11, 8]], C('#e8eef4'));
  p.line(2, 11, 6, 15, C('#5a3a20'), 2);
  p.line(3, 10, 6, 13, C('#c9a24a'), 1);
};
const spearIcon = (p) => {
  p.line(2, 14, 11, 5, C('#7a5a3a'), 1);
  p.poly([[10, 1], [14, 5], [11, 7]], C('#dfe9f2'));
};
const vestIcon = (p) => {
  p.poly([[4, 2], [12, 2], [14, 7], [13, 14], [3, 14], [2, 7]], C('#8a5a3a'));
  p.rect(7, 2, 2, 12, C('#5a3420'));
  p.rect(4, 6, 8, 1, C('#5a3420'));
};
const mailIcon = (p) => {
  p.poly([[4, 2], [12, 2], [14, 7], [13, 14], [3, 14], [2, 7]], C('#a8b4c4'));
  for (let y = 4; y < 14; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 13; x += 2) p.set(x, y, C('#6a7888'));
};
const plateIcon = (p) => {
  p.poly([[4, 2], [12, 2], [15, 6], [13, 14], [3, 14], [1, 6]], C('#d0dae4'));
  p.rect(7, 2, 2, 12, C('#8a98a8'));
  p.rect(2, 6, 12, 1, C('#f0f4f8'));
  p.disc(3, 3, 2, 2, C('#e0e8f0'));
  p.disc(13, 3, 2, 2, C('#e0e8f0'));
};
const robeIcon = (p) => {
  p.poly([[5, 2], [11, 2], [13, 8], [15, 14], [1, 14], [3, 8]], C('#6a3aa8'));
  p.rect(5, 2, 6, 2, C('#f2c14e'));
  p.rect(2, 9, 12, 1, C('#f2c14e'));
};
const cloakIcon = (p) => {
  p.poly([[5, 2], [11, 2], [13, 13], [10, 15], [6, 15], [3, 13]], C('#2a2238'));
  p.poly([[4, 2], [12, 2], [8, 7]], C('#4a3a5a'));
  p.set(7, 6, C('#c96bff'));
};

export function buildIcons() {
  return {
    coin: icon(coinIcon),
    crystal: icon(crystalIcon),
    ore: icon(oreIcon),
    shard: icon(shardIcon),
    potion_red: icon(potionIcon('#e0283a', '#a8c8e8')),
    potion_green: icon(potionIcon('#3ad060', '#a8c8e8')),
    chest: icon(chestIcon),
    star: icon(starIcon),
    heart: icon(heartIcon),
    mana: icon(manaIcon),
    lock: icon(lockIcon),
    check: icon(checkIcon),
    skull: icon(skullIcon),
    fragment: icon(fragmentIcon),
    gear: icon(gearIcon),
    scroll: icon(scrollIcon),
    sword: icon(swordIcon),
    bow: icon(bowIcon),
    axe: icon(axeIcon),
    staff: icon(staffIcon),
    dagger: icon(daggerIcon),
    spear: icon(spearIcon),
    vest: icon(vestIcon),
    mail: icon(mailIcon),
    plate: icon(plateIcon),
    robe: icon(robeIcon),
    cloak: icon(cloakIcon),
  };
}

export { lighten, darken };
