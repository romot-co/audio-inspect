import { describe, expect, it } from 'vitest';
import { ampToDb, dbToAmp, powToDb, dbToPow } from '../../src/core/dsp/db.js';

describe('core/dsp/db', () => {
  it('round-trips amplitude and decibels', () => {
    const values = [0.001, 0.01, 0.1, 0.5, 1, 2];
    for (const value of values) {
      const db = ampToDb(value, 1);
      expect(dbToAmp(db, 1)).toBeCloseTo(value, 6);
    }
  });

  it('round-trips power and decibels', () => {
    const values = [0.0001, 0.001, 0.1, 1, 10];
    for (const value of values) {
      const db = powToDb(value, 1);
      expect(dbToPow(db, 1)).toBeCloseTo(value, 6);
    }
  });

  it('returns -Infinity for non-positive values', () => {
    expect(ampToDb(0)).toBe(-Infinity);
    expect(ampToDb(-1)).toBe(-Infinity);
    expect(powToDb(0)).toBe(-Infinity);
    expect(powToDb(-1)).toBe(-Infinity);
  });
});
