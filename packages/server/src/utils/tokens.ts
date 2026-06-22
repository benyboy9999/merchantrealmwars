import jwt from 'jsonwebtoken';
import { db } from '../db/client.js';
import { config } from '../config/index.js';

export function issueTokens(playerId: number, empireId: number | null) {
  const accessToken = jwt.sign({ playerId, empireId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign({ playerId }, config.JWT_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function saveRefreshToken(playerId: number, token: string) {
  await db.$transaction([
    db.refreshToken.create({
      data: {
        playerId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    db.player.update({ where: { id: playerId }, data: { lastActiveAt: new Date() } }),
  ]);
}
