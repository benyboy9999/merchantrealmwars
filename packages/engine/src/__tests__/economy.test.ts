import { describe, it, expect } from 'vitest';
import { matchOrders } from '../economy/index.js';
import type { OrderState } from '../economy/index.js';
import { ResourceType } from '@artemis/shared';

const makeOrder = (
  overrides: Partial<OrderState> & Pick<OrderState, 'id' | 'orderType' | 'pricePerUnit' | 'quantity'>,
): OrderState => ({
  empireId: 'empire-1',
  resourceType: ResourceType.PLACEHOLDER_RAW,
  fulfilledQty: 0,
  status: 'OPEN',
  ...overrides,
});

describe('matchOrders', () => {
  it('matches a simple buy and sell at sell price', () => {
    const orders: OrderState[] = [
      makeOrder({ id: 'buy-1', orderType: 'BUY', pricePerUnit: 10, quantity: 100 }),
      makeOrder({ id: 'sell-1', orderType: 'SELL', pricePerUnit: 8, quantity: 100, empireId: 'empire-2' }),
    ];

    const result = matchOrders(orders);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      quantity: 100,
      pricePerUnit: 8, // seller's price
    });
  });

  it('does not match when buy price is below sell price', () => {
    const orders: OrderState[] = [
      makeOrder({ id: 'buy-1', orderType: 'BUY', pricePerUnit: 5, quantity: 100 }),
      makeOrder({ id: 'sell-1', orderType: 'SELL', pricePerUnit: 10, quantity: 100 }),
    ];

    const result = matchOrders(orders);
    expect(result.trades).toHaveLength(0);
  });

  it('partially fills orders when quantities differ', () => {
    const orders: OrderState[] = [
      makeOrder({ id: 'buy-1', orderType: 'BUY', pricePerUnit: 10, quantity: 150 }),
      makeOrder({ id: 'sell-1', orderType: 'SELL', pricePerUnit: 8, quantity: 100 }),
    ];

    const result = matchOrders(orders);

    expect(result.trades[0]?.quantity).toBe(100);
    const sellUpdate = result.updatedOrders.find((o) => o.id === 'sell-1');
    const buyUpdate = result.updatedOrders.find((o) => o.id === 'buy-1');
    expect(sellUpdate?.status).toBe('FILLED');
    expect(buyUpdate?.status).toBe('PARTIALLY_FILLED');
  });

  it('matches multiple buy orders against one sell order', () => {
    const orders: OrderState[] = [
      makeOrder({ id: 'buy-1', orderType: 'BUY', pricePerUnit: 10, quantity: 50 }),
      makeOrder({ id: 'buy-2', orderType: 'BUY', pricePerUnit: 9, quantity: 50 }),
      makeOrder({ id: 'sell-1', orderType: 'SELL', pricePerUnit: 8, quantity: 100 }),
    ];

    const result = matchOrders(orders);
    const totalTraded = result.trades.reduce((sum, t) => sum + t.quantity, 0);
    expect(totalTraded).toBe(100);
  });

  it('ignores already-filled orders', () => {
    const orders: OrderState[] = [
      makeOrder({ id: 'buy-1', orderType: 'BUY', pricePerUnit: 10, quantity: 100, status: 'FILLED' }),
      makeOrder({ id: 'sell-1', orderType: 'SELL', pricePerUnit: 8, quantity: 100 }),
    ];

    const result = matchOrders(orders);
    expect(result.trades).toHaveLength(0);
  });

  it('handles empty order list', () => {
    const result = matchOrders([]);
    expect(result.trades).toHaveLength(0);
    expect(result.updatedOrders).toHaveLength(0);
  });
});
