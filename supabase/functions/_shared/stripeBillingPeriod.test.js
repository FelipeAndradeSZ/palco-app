import { describe, expect, it } from 'vitest';
import { getSubscriptionBillingPeriod } from './stripeBillingPeriod';

describe('getSubscriptionBillingPeriod', () => {
  it('reads legacy subscription-level periods', () => {
    expect(getSubscriptionBillingPeriod({
      current_period_start: 100,
      current_period_end: 200,
      items: { data: [] },
    })).toEqual({ start: 100, end: 200 });
  });

  it('reads current Stripe item-level periods', () => {
    expect(getSubscriptionBillingPeriod({
      items: {
        data: [{ current_period_start: 300, current_period_end: 400 }],
      },
    })).toEqual({ start: 300, end: 400 });
  });

  it('covers the full period when Stripe returns multiple items', () => {
    expect(getSubscriptionBillingPeriod({
      items: {
        data: [
          { current_period_start: 320, current_period_end: 380 },
          { current_period_start: 300, current_period_end: 450 },
        ],
      },
    })).toEqual({ start: 300, end: 450 });
  });

  it('ignores invalid timestamps', () => {
    expect(getSubscriptionBillingPeriod({
      current_period_start: 0,
      current_period_end: 'invalid',
      items: { data: [] },
    })).toEqual({ start: null, end: null });
  });
});
