import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(8).default('dev-secret-not-for-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  ADMIN_TOKEN: z.string().default('artemis-admin-dev'),

  TICK_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  ENABLE_DEBUG_ENDPOINTS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
