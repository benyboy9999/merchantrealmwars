import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { RegisterSchema, LoginSchema } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { config } from '../../config/index.js';
import { issueTokens, saveRefreshToken } from '../../utils/tokens.js';

export const authRouter = Router();

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// Generates a unique internal username — never shown to players.
// The empire name is the player's public handle.
async function generateUsername(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let username: string;
  do {
    username = 'player_' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (await db.player.findUnique({ where: { username } }));
  return username;
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

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

    // Only use Google for identity proof — we don't import name, avatar, or profile.
    const googleId = payload.sub;
    const email    = payload.email;

    let player = await db.player.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!player) {
      player = await db.player.create({
        data: { username: await generateUsername(), email, googleId },
      });
    } else if (!player.googleId) {
      player = await db.player.update({ where: { id: player.id }, data: { googleId } });
    }

    const empire = await db.empire.findFirst({
      where: { playerId: player.id },
      select: { id: true, name: true },
    });
    const { accessToken, refreshToken } = issueTokens(player.id, empire?.id ?? null);
    await saveRefreshToken(player.id, refreshToken);

    res.json({ accessToken, refreshToken, empireId: empire?.id ?? null, empireName: empire?.name ?? null });
  } catch (err) {
    next(err);
  }
});

// ── Email / password register ─────────────────────────────────────────────────

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = RegisterSchema.parse(req.body);

    const existing = await db.player.findUnique({ where: { email: body.email } });
    if (existing) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const player = await db.player.create({
      data: { username: await generateUsername(), email: body.email, passwordHash },
    });

    // Auto-login after register
    const { accessToken, refreshToken } = issueTokens(player.id, null);
    await saveRefreshToken(player.id, refreshToken);

    res.status(201).json({ accessToken, refreshToken, empireId: null, empireName: null });
  } catch (err) {
    next(err);
  }
});

// ── Email / password login ────────────────────────────────────────────────────

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = LoginSchema.parse(req.body);
    const player = await db.player.findUnique({ where: { email: body.email } });

    if (!player || !player.passwordHash || !(await bcrypt.compare(body.password, player.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const empire = await db.empire.findFirst({
      where: { playerId: player.id },
      select: { id: true, name: true },
    });
    const { accessToken, refreshToken } = issueTokens(player.id, empire?.id ?? null);
    await saveRefreshToken(player.id, refreshToken);

    res.json({ accessToken, refreshToken, empireId: empire?.id ?? null, empireName: empire?.name ?? null });
  } catch (err) {
    next(err);
  }
});

// ── Token refresh ─────────────────────────────────────────────────────────────

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'Missing refresh token' });
      return;
    }

    let payload: { playerId: number };
    try {
      payload = jwt.verify(refreshToken, config.JWT_SECRET) as { playerId: number };
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      select: { expiresAt: true, playerId: true },
    });

    if (!stored || stored.playerId !== payload.playerId || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token not recognised — please sign in again' });
      return;
    }

    // Issue a new access token. Keep the refresh token — rotating it on every
    // refresh causes double-logout in React StrictMode (two concurrent refresh
    // calls with the same token; the second sees the rotated-away token as invalid).
    const empire = await db.empire.findFirst({
      where: { playerId: payload.playerId },
      select: { id: true, name: true },
    });

    const { accessToken } = issueTokens(payload.playerId, empire?.id ?? null);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

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
