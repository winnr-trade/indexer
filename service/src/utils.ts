/** Converts 4-digit price units to base units of a given decimal (e.g. 4753, 6 -> 475300) */
export function priceToUnits(price: number | string | bigint, decimals: number): bigint {
  const multiplier = BigInt(10) ** BigInt(Math.max(0, decimals - 4));
  return BigInt(price) * multiplier;
}
