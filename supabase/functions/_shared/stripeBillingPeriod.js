function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function getSubscriptionBillingPeriod(subscription) {
  const topLevelStart = finiteTimestamp(subscription?.current_period_start);
  const topLevelEnd = finiteTimestamp(subscription?.current_period_end);
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  const itemStarts = items
    .map((item) => finiteTimestamp(item?.current_period_start))
    .filter(Boolean);
  const itemEnds = items
    .map((item) => finiteTimestamp(item?.current_period_end))
    .filter(Boolean);

  return {
    start: topLevelStart ?? (itemStarts.length ? Math.min(...itemStarts) : null),
    end: topLevelEnd ?? (itemEnds.length ? Math.max(...itemEnds) : null),
  };
}
