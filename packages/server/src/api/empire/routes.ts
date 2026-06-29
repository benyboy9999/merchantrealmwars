import { Router } from 'express';
import { CreateEmpireSchema, MULE_CAPACITY_KG, REGION_IDS } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { issueTokens, saveRefreshToken } from '../../utils/tokens.js';
import { getChatIo } from '../../services/chat-socket.js';

export const empireRouter = Router();

empireRouter.use(requireAuth);

empireRouter.get('/me', async (req, res, next) => {
  try {
    const empire = await db.empire.findFirst({
      where: { playerId: req.auth!.playerId },
      include: {
        keeps: {
          include: {
            plot: {
              include: {
                district: { select: { id: true, name: true, regionId: true } },
              },
            },
          },
        },
        caravans: {
          include: { warehouse: { include: { items: true } } },
        },
        warehouses: {
          where: { type: 'EXCHANGE' },
          select: { id: true, regionId: true, cap: true },
        },
      },
    });
    if (!empire) {
      res.status(404).json({ error: 'No empire found' });
      return;
    }
    res.json({ empire });
  } catch (err) {
    next(err);
  }
});

empireRouter.post('/', async (req, res, next) => {
  try {
    const existing = await db.empire.findFirst({ where: { playerId: req.auth!.playerId } });
    if (existing) {
      res.status(409).json({ error: 'Empire already exists' });
      return;
    }
    const body = CreateEmpireSchema.parse(req.body);

    const empire = await db.empire.create({
      data: { playerId: req.auth!.playerId, name: body.name, goldBalance: 1000 },
    });

    // Provision 2 starter caravans at the CENTRAL exchange (empty — first keep is free).
    await db.$transaction(async (tx) => {
      for (const name of ['Caravan 1', 'Caravan 2']) {
        const warehouse = await tx.warehouse.create({
          data: { type: 'CARAVAN', empireId: empire.id, cap: MULE_CAPACITY_KG },
        });
        await tx.caravan.create({
          data: {
            empireId:     empire.id,
            name,
            animalType:   'MULE',
            animalCount:  1,
            locationType: 'EXCHANGE',
            locationId:   REGION_IDS.CENTRAL,
            status:       'IDLE',
            warehouseId:  warehouse.id,
          },
        });
      }
    });

    // Add new empire to the General chat room
    const generalRoom = await db.chatRoom.findFirst({ where: { type: 'GENERAL' } });
    if (generalRoom) {
      await db.chatRoomMember.upsert({
        where:  { chatRoomId_empireId: { chatRoomId: generalRoom.id, empireId: empire.id } },
        create: { chatRoomId: generalRoom.id, empireId: empire.id },
        update: {},
      });
      void getChatIo()?.in(`player:${req.auth!.playerId}`).socketsJoin(`chat:${generalRoom.id}`);
    }

    // Re-issue tokens so the JWT carries the new empireId.
    // Without this, all subsequent empire-gated requests would carry empireId:null.
    const { accessToken, refreshToken } = issueTokens(req.auth!.playerId, empire.id);
    await saveRefreshToken(req.auth!.playerId, refreshToken);

    res.status(201).json({ empire, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});
