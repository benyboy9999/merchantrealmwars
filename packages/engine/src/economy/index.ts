import type { ResourceType } from '@artemis/shared';
import type { OrderType, OrderStatus } from '@artemis/shared';

export interface OrderState {
  id: string;
  empireId: string | null;
  orderType: OrderType;
  resourceType: ResourceType;
  quantity: number;
  pricePerUnit: number;
  fulfilledQty: number;
  status: OrderStatus;
}

export interface MatchResult {
  trades: Array<{
    buyOrderId: string;
    sellOrderId: string;
    quantity: number;
    pricePerUnit: number;
    buyerEmpireId: string | null;
    sellerEmpireId: string | null;
  }>;
  updatedOrders: Array<{
    id: string;
    fulfilledQty: number;
    status: OrderStatus;
  }>;
}

/**
 * Match buy and sell orders for a single resource in one Exchange.
 * Uses price-time priority: best price first, then earliest order first.
 * Pure function — no side effects.
 */
export function matchOrders(orders: OrderState[]): MatchResult {
  const buyOrders = orders
    .filter((o) => o.orderType === 'BUY' && o.status !== 'FILLED' && o.status !== 'CANCELLED')
    .sort((a, b) => b.pricePerUnit - a.pricePerUnit); // highest bid first

  const sellOrders = orders
    .filter((o) => o.orderType === 'SELL' && o.status !== 'FILLED' && o.status !== 'CANCELLED')
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit); // lowest ask first

  const trades: MatchResult['trades'] = [];
  const updatedMap = new Map<string, { fulfilledQty: number; status: OrderStatus }>();

  const getRemaining = (order: OrderState) => {
    const updated = updatedMap.get(order.id);
    return order.quantity - (updated?.fulfilledQty ?? order.fulfilledQty);
  };

  for (const buy of buyOrders) {
    for (const sell of sellOrders) {
      if (buy.pricePerUnit < sell.pricePerUnit) break;

      const buyRemaining = getRemaining(buy);
      const sellRemaining = getRemaining(sell);
      if (buyRemaining <= 0 || sellRemaining <= 0) continue;

      const qty = Math.min(buyRemaining, sellRemaining);
      const price = sell.pricePerUnit; // seller sets the price (price-time priority)

      trades.push({
        buyOrderId: buy.id,
        sellOrderId: sell.id,
        quantity: qty,
        pricePerUnit: price,
        buyerEmpireId: buy.empireId,
        sellerEmpireId: sell.empireId,
      });

      const newBuyFulfilled = (updatedMap.get(buy.id)?.fulfilledQty ?? buy.fulfilledQty) + qty;
      const newSellFulfilled = (updatedMap.get(sell.id)?.fulfilledQty ?? sell.fulfilledQty) + qty;

      updatedMap.set(buy.id, {
        fulfilledQty: newBuyFulfilled,
        status: newBuyFulfilled >= buy.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
      });
      updatedMap.set(sell.id, {
        fulfilledQty: newSellFulfilled,
        status: newSellFulfilled >= sell.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
      });
    }
  }

  return {
    trades,
    updatedOrders: Array.from(updatedMap.entries()).map(([id, data]) => ({ id, ...data })),
  };
}
