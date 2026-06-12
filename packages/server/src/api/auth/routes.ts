import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RegisterSchema, LoginSchema } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { config } from '../../config/index.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const existing = await db.player.findFirst({
      where: { OR: [{ email: body.email }, { username: body.username }] },
    });
    if (existing) {
      res.status(409).json({ error: 'Username or email already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const player = await db.player.create({
      data: { username: body.username, email: body.email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    res.status(201).json({ player });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = LoginSchema.parse(req.body);
    const player = await db.player.findUnique({ where: { email: body.email } });
    if (!player || !(await bcrypt.compare(body.password, player.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const empire = await db.empire.findFirst({ where: { playerId: player.id } });
    const payload = { playerId: player.id, empireId: empire?.id ?? null };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
    const refreshToken = jwt.sign({ playerId: player.id }, config.JWT_SECRET, {
      expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
    } as jwt.SignOptions);

    await db.refreshToken.create({
      data: {
        playerId: player.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await db.player.update({
      where: { id: player.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({ accessToken, refreshToken, player: { id: player.id, username: player.username } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      await db.refreshToken.deleteMany({ where: { token } }).catch(() => null);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
