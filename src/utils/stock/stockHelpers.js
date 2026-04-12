export const toNumber = (value) => Number(value || 0);

export const calculateAvailableStock = (currentStock, reservedStock) => {
  return Math.max(toNumber(currentStock) - toNumber(reservedStock), 0);
};

export const normalizeStockSnapshot = (item = {}, stockField = 'currentStock') => {
  const currentStock = toNumber(item[stockField] ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock || 0);
  const availableStock = calculateAvailableStock(currentStock, reservedStock);

  return {
    ...item,
    currentStock,
    reservedStock,
    availableStock,
    stock: currentStock,
  };
};

export const calculateWeightedAverage = (previousQty, previousCost, incomingQty, incomingCost) => {
  const prevQty = toNumber(previousQty);
  const prevCost = toNumber(previousCost);
  const inQty = toNumber(incomingQty);
  const inCost = toNumber(incomingCost);
  const totalQty = prevQty + inQty;

  if (totalQty <= 0) return 0;

  return (prevQty * prevCost + inQty * inCost) / totalQty;
};
