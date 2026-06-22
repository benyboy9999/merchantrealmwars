import type { RegionId, ResourceType, BuildingType, VehicleType, CaravanStatus, CaravanLocationType, WorkerTier } from '../gamedata.js';

// ── Core entities ──────────────────────────────────────────────────────────

export interface Player {
  id: number;
  username: string;
  email: string;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface Empire {
  id: number;
  playerId: number;
  name: string;
  goldBalance: number;
  createdAt: Date;
}

export interface Region {
  id: number;
  name: string;
  bonusType: string;
  guildControllable: boolean;
}

export interface District {
  id: number;
  regionId: number;
  name: string;
  bonusDescription: string;
  tier: number;
  q: number;
  r: number;
  x: number;
  y: number;
}

export interface Plot {
  id: number;
  districtId: number;
  name: string;
  bonusDescription: string;
  tier: number;
  x: number;
  y: number;
}

export interface Keep {
  id: number;
  empireId: number;
  plotId: number;
  name: string;
  buildingSlotCount: number;
  createdAt: Date;
}

export interface BuildingSlot {
  id: number;
  keepId: number;
  slotIndex: number;
  buildingId: number | null;
}

export interface Building {
  id: number;
  keepId: number;
  slotId: number;
  buildingType: BuildingType;
  level: number;
  isActive: boolean;
  isDormant: boolean;
}

export interface Housing {
  id: number;
  keepId: number;
  tier: WorkerTier;
  capacity: number;
  workerCount: number;
}

export interface Worker {
  id: number;
  keepId: number;
  housingId: number;
  tier: WorkerTier;
  assignedBuildingId: number | null;
}

export interface ResourceLedgerEntry {
  id: number;
  keepId: number;
  resourceType: ResourceType;
  quantity: number;
  updatedAt: Date;
}

// ── Transport ──────────────────────────────────────────────────────────────

export interface Vehicle {
  id: number;
  empireId: number;
  vehicleType: VehicleType;
  fuelLevel: number;
  durability: number;
}

export interface Caravan {
  id: number;
  vehicleId: number;
  originType: CaravanLocationType;
  originId: number;
  destType: CaravanLocationType;
  destId: number;
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
  id: number;
  empireId: number | null; // null = NPC order
  regionId: number;
  orderType: OrderType;
  resourceType: ResourceType;
  quantity: number;
  pricePerUnit: number;
  fulfilledQty: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface MarketTrade {
  id: number;
  buyOrderId: number;
  sellOrderId: number;
  quantity: number;
  pricePerUnit: number;
  tradedAt: Date;
}

// ── Guilds ─────────────────────────────────────────────────────────────────

export type GuildRole = 'LEADER' | 'OFFICER' | 'MEMBER';

export interface Guild {
  id: number;
  name: string;
  leaderId: number;
  level: number;
  goldBalance: number;
  createdAt: Date;
}

export interface GuildMember {
  id: number;
  guildId: number;
  playerId: number;
  role: GuildRole;
  joinedAt: Date;
}

export interface RegionControl {
  id: number;
  guildId: number;
  regionId: number;
  weekNumber: number;
  controlStart: Date;
  controlEnd: Date;
}

// ── Chat ───────────────────────────────────────────────────────────────────

export type ChatChannelType = 'GLOBAL' | 'GUILD' | 'REGION';

export interface ChatMessage {
  id: number;
  senderId: number;
  senderUsername: string;
  channelType: ChatChannelType;
  channelId: number | null;
  content: string;
  sentAt: Date;
}

// ── Tick ───────────────────────────────────────────────────────────────────

export interface GameTick {
  id: number;
  tickNumber: number;
  processedAt: Date;
  durationMs: number;
}
