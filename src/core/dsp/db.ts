export function ampToDb(amplitude: number, reference = 1, floorDb = -Infinity): number {
  if (!Number.isFinite(amplitude) || !Number.isFinite(reference) || amplitude <= 0 || reference <= 0) {
    return floorDb;
  }
  return 20 * Math.log10(amplitude / reference);
}

export function dbToAmp(decibels: number, reference = 1): number {
  if (!Number.isFinite(reference) || reference <= 0) {
    return 0;
  }
  if (decibels === -Infinity) {
    return 0;
  }
  return reference * Math.pow(10, decibels / 20);
}

export function powToDb(power: number, reference = 1, floorDb = -Infinity): number {
  if (!Number.isFinite(power) || !Number.isFinite(reference) || power <= 0 || reference <= 0) {
    return floorDb;
  }
  return 10 * Math.log10(power / reference);
}

export function dbToPow(decibels: number, reference = 1): number {
  if (!Number.isFinite(reference) || reference <= 0) {
    return 0;
  }
  if (decibels === -Infinity) {
    return 0;
  }
  return reference * Math.pow(10, decibels / 10);
}
