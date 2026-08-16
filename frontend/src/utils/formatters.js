export const formatTickerDisplay = (ticker, tickerNames) => {
  if (!ticker || typeof ticker !== 'string') return ticker;
  const name = tickerNames ? tickerNames[ticker] : null;
  const isDomestic = ticker.endsWith('.KS') || ticker.endsWith('.KQ');
  if (isDomestic && name) {
    return name;
  }
  return ticker;
};
