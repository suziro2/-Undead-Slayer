// Game API routes. All routes except the auth endpoints require a session.
import { Router } from 'express';
import * as eco from './economy.js';
import { HEROES, GACHA, SHOP } from '../shared/data.js';

const str = (v) => String(v ?? '');
const body = (req) => req.body ?? {};
const heroParam = (req) => str(req.params.heroId);

export function createGameRouter(db) {
  const r = Router();

  r.get('/state', (req, res) => res.json(eco.getState(db, req.userId)));

  r.put('/settings', (req, res) => res.json(eco.updateSettings(db, req.userId, body(req))));

  r.put('/team', (req, res) => {
    const b = body(req);
    res.json(eco.setTeam(db, req.userId, str(b.selectedHero), b.team));
  });

  r.post('/heroes/:heroId/unlock', (req, res) => res.json(eco.unlockHero(db, req.userId, heroParam(req))));
  r.post('/heroes/:heroId/upgrade', (req, res) => res.json(eco.upgradeHero(db, req.userId, heroParam(req), str(body(req).stat))));
  r.post('/heroes/:heroId/allocate', (req, res) => res.json(eco.allocatePoint(db, req.userId, heroParam(req), str(body(req).stat))));
  r.post('/heroes/:heroId/ascend', (req, res) => res.json(eco.ascendHero(db, req.userId, heroParam(req))));

  r.post('/shop/buy', (req, res) => res.json(eco.buyShopItem(db, req.userId, str(body(req).itemId))));

  r.post('/items/:uid/equip', (req, res) => {
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid)) return res.status(400).json({ error: 'Invalid item' });
    res.json(eco.equipItem(db, req.userId, uid, str(body(req).heroId)));
  });
  r.post('/items/:uid/unequip', (req, res) => {
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid)) return res.status(400).json({ error: 'Invalid item' });
    res.json(eco.unequipItem(db, req.userId, uid));
  });
  r.post('/items/:uid/dismantle', (req, res) => {
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid)) return res.status(400).json({ error: 'Invalid item' });
    res.json(eco.dismantleItem(db, req.userId, uid));
  });

  r.post('/gacha/summon', (req, res) => {
    const b = body(req);
    res.json(eco.summon(db, req.userId, { count: Number(b.count), currency: str(b.currency) }));
  });
  r.get('/gacha/history', (req, res) => res.json({ history: eco.summonHistory(db, req.userId) }));

  r.post('/battle/start', (req, res) => {
    const b = body(req);
    res.json(eco.startBattle(db, req.userId, { chapter: b.chapter, level: b.level, team: b.team }));
  });
  r.post('/battle/complete', (req, res) => res.json(eco.completeBattle(db, req.userId, body(req))));
  r.post('/battle/abort', (req, res) => res.json(eco.abortBattle(req.userId, str(body(req).battleId))));

  // Static catalog for summon/shop screens (no secrets).
  r.get('/catalog', (req, res) => res.json({
    heroes: Object.values(HEROES).map((h) => ({ id: h.id, name: h.name, rarity: h.rarity, unlock: h.unlock })),
    gacha: { ...GACHA, pools: GACHA.pools },
    shop: SHOP,
  }));

  return r;
}
