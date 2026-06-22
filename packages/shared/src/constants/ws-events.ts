// All WebSocket event names. Never use inline strings — always import from here.

export const WsEvent = {
  // Server → Client
  TICK_COMPLETE: 'tick:complete',
  EMPIRE_UPDATE: 'empire:update',
  CARAVAN_ARRIVED: 'caravan:arrived',
  CARAVAN_CANCELLED: 'caravan:cancelled',
  EXCHANGE_ORDER_MATCHED: 'exchange:order:matched',
  CHAT_MESSAGE: 'chat:message',
  REGION_CONTROL_CHANGED: 'region:control:changed',
  PRODUCTION_COMPLETED: 'production:completed',
  PRODUCTION_BLOCKED: 'production:blocked',

  // Client → Server
  CHAT_SEND: 'chat:send',
  CARAVAN_DISPATCH: 'caravan:dispatch',
  CARAVAN_CANCEL: 'caravan:cancel',
} as const;

export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent];
