import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { RegisterSchema, LoginSchema } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { config } from '../../config/index.js';

export const authRouter = Router();

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

function issueTokens(playerId: string, empireId: string | null) {
  const accessToken = jwt.sign({ playerId, empireId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign({ playerId }, config.JWT_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

authRouter.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      res.status(400).json({ error: 'Missing Google credential' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      res.status(400).json({ error: 'Invalid Google token' });
      return;
    }

    const googleId = payload.sub!;
    const email    = payload.email!;
    const name     = payload.name;

    // Find by googleId first, then fall back to email (links existing email accounts)
    let player = await db.player.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!player) {
      // New player — derive a username from their Google display name
      const base = (name ?? email.split('@')[0] ?? 'player')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 18) || 'player';
      let username = base;
      let suffix = 1;
      while (await db.player.findUnique({ where: { username } })) {
        username = `${base}${suffix++}`;
      }
      player = await db.player.create({
        data: { username, email, googleId },
      });
    } else if (!player.googleId) {
      // Existing email-only account — link the Google ID
      player = await db.player.update({
        where: { id: player.id },
        data: { googleId },
      });
    }

    const empire = await db.empire.findFirst({ where: { playerId: player.id } });
    const { accessToken, refreshToken } = issueTokens(player.id, empire?.id ?? null);

    await db.$transaction([
      db.refreshToken.create({
        data: {
          playerId: player.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      db.player.update({ where: { id: player.id }, data: { lastActiveAt: new Date() } }),
    ]);

    res.json({
      accessToken,
      refreshToken,
      player: { id: player.id, username: player.username },
      empireId: empire?.id ?? null,
    });
  } catch (err) {
    next(err);
  }
});

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
    if (!player || !player.passwordHash || !(await bcrypt.compare(body.password, player.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const empire = await db.empire.findFirst({ where: { playerId: player.id } });
    const { accessToken, refreshToken } = issueTokens(player.id, empire?.id ?? null);

    await db.$transaction([
      db.refreshToken.create({
        data: {
          playerId: player.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      db.player.update({ where: { id: player.id }, data: { lastActiveAt: new Date() } }),
    ]);

    res.json({ accessToken, refreshToken, player: { id: player.id, username: player.username }, empireId: empire?.id ?? null });
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
