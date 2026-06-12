import { Router } from 'express';
import { SendChatMessageSchema, PaginationSchema } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get('/:channelType', async (req, res, next) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    const channelId = typeof req.query['channelId'] === 'string' ? req.query['channelId'] : null;

    const messages = await db.chatMessage.findMany({
      where: {
        channelType: req.params['channelType'] as 'GLOBAL' | 'GUILD' | 'REGION',
        channelId,
      },
      include: { sender: { select: { username: true } } },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});
