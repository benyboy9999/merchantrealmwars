import type { RegionId, ResourceType, BuildingType, VehicleType, CaravanStatus, CaravanLocationType, WorkerTier } from '../gamedata.js';

// ── Core entities ──────────────────────────────────────────────────────────

export interface Player {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface Empire {
  id: string;
  playerId: string;
  name: string;
  goldBalance: number;
  createdAt: Date;
}

export interface Region {
  id: RegionId;
  name: string;
  bonusType: string;
  guildControllable: boolean;
}

export interface District {
  id: string;
  regionId: RegionId;
  name: string;
  bonusDescription: string;
  tier: number;
  q: number;
  r: number;
  x: number;
  y: number;
}

export interface Plot {
  id: string;
  districtId: string;
  name: string;
  bonusDescription: string;
  tier: number;
  x: number;
  y: number;
}

export interface Keep {
  id: string;
  empireId: string;
  plotId: string;
  name: string;
  buildingSlotCount: number;
  createdAt: Date;
}

export interface BuildingSlot {
  id: string;
  keepId: string;
  slotIndex: number;
  buildingId: string | null;
}

export interface Building {
  id: string;
  keepId: string;
  slotId: string;
  buildingType: BuildingType;
  level: number;
  isActive: boolean;
  isDormant: boolean;
}

export interface Housing {
  id: string;
  keepId: string;
  tier: WorkerTier;
  capacity: number;
  workerCount: number;
}

export interface Worker {
  id: string;
  keepId: string;
  housingId: string;
  tier: WorkerTier;
  assignedBuildingId: string | null;
}

export interface ResourceLedgerEntry {
  id: string;
  keepId: string;
  resourceType: ResourceType;
  quantity: number;
  updatedAt: Date;
}

// ── Transport ──────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  empireId: string;
  vehicleType: VehicleType;
  fuelLevel: number;
  durability: number;
}

export interface Caravan {
  id: string;
  vehicleId: string;
  originType: CaravanLocationType;
  originId: string;
  destType: CaravanLocationType;
  destId: string;
  resourceType: ResourceType;
  quantity: number;
  departedAt: Date;
  arrivesAt: Date;
  status: CaravanStatus;
}

// ── Exchange ───────────────────────────────────────────────────────────────

export type OrderType = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

export interface MarketOrder {
  id: string;
  empireId: string | null; // null = NPC order
  regionId: RegionId;
  orderType: OrderType;
  resourceType: ResourceType;
  quantity: number;
  pricePerUnit: number;
  fulfilledQty: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface MarketTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  pricePerUnit: number;
  tradedAt: Date;
}

// ── Guilds ─────────────────────────────────────────────────────────────────

export type GuildRole = 'LEADER' | 'OFFICER' | 'MEMBER';

export interface Guild {
  id: string;
  name: string;
  leaderId: string;
  level: number;
  goldBalance: number;
  createdAt: Date;
}

export interface GuildMember {
  id: string;
  guildId: string;
  playerId: string;
  role: GuildRole;
  joinedAt: Date;
}

export interface RegionControl {
  id: string;
  guildId: string;
  regionId: RegionId;
  weekNumber: number;
  controlStart: Date;
  controlEnd: Date;
}

// ── Chat ───────────────────────────────────────────────────────────────────

export type ChatChannelType = 'GLOBAL' | 'GUILD' | 'REGION';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  channelType: ChatChannelType;
  channelId: string | null;
  content: string;
  sentAt: Date;
}

// ── Tick ───────────────────────────────────────────────────────────────────

export interface GameTick {
  id: string;
  tickNumber: number;
  processedAt: Date;
  durationMs: number;
}
