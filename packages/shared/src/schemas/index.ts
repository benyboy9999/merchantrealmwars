import { z } from 'zod';
import { RegionId, ResourceType, VehicleType, CaravanLocationType } from '../gamedata.js';

// ── Auth ───────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Empire ─────────────────────────────────────────────────────────────────

export const CreateEmpireSchema = z.object({
  name: z.string().min(2).max(40),
});

// ── Keep ───────────────────────────────────────────────────────────────────

export const CreateKeepSchema = z.object({
  plotId: z.string().uuid(),
  name: z.string().min(2).max(40),
});

// ── Exchange ───────────────────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  regionId: z.enum([
    RegionId.CENTRAL,
    RegionId.EXTRACTION,
    RegionId.FARMING,
    RegionId.CRAFTING,
  ]),
  orderType: z.enum(['BUY', 'SELL']),
  resourceType: z.nativeEnum(ResourceType),
  quantity: z.number().int().positive(),
  pricePerUnit: z.number().positive(),
});

export const CancelOrderSchema = z.object({
  orderId: z.string().uuid(),
});

// ── Caravan ────────────────────────────────────────────────────────────────

export const DispatchCaravanSchema = z.object({
  vehicleId: z.string().uuid(),
  originType: z.nativeEnum(CaravanLocationType),
  originId: z.string().uuid(),
  destType: z.nativeEnum(CaravanLocationType),
  destId: z.string().uuid(),
  resourceType: z.nativeEnum(ResourceType),
  quantity: z.number().int().positive(),
});

export const CancelCaravanSchema = z.object({
  caravanId: z.string().uuid(),
});

// ── Chat ───────────────────────────────────────────────────────────────────

export const SendChatMessageSchema = z.object({
  channelType: z.enum(['GLOBAL', 'GUILD', 'REGION']),
  channelId: z.string().nullable(),
  content: z.string().min(1).max(500),
});

// ── Guild ──────────────────────────────────────────────────────────────────

export const CreateGuildSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
});

export const DonateToGuildSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  quantity: z.number().int().positive(),
});

// ── Pagination ─────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Inferred types ─────────────────────────────────────────────────────────

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type CreateEmpireDto = z.infer<typeof CreateEmpireSchema>;
export type CreateKeepDto = z.infer<typeof CreateKeepSchema>;
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type DispatchCaravanDto = z.infer<typeof DispatchCaravanSchema>;
export type SendChatMessageDto = z.infer<typeof SendChatMessageSchema>;
export type CreateGuildDto = z.infer<typeof CreateGuildSchema>;
