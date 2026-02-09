import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEAVY_FEATURE_INTERVAL,
  DEFAULT_REALTIME_POLICY,
  isHeavyRealtimeFeature,
  normalizeHeavyFeatureInterval,
  normalizeRealtimePolicyMode
} from '../../src/core/realtime/policy.js';

describe('core/realtime/policy', () => {
  it('classifies heavy realtime features', () => {
    expect(isHeavyRealtimeFeature('spectrogram', undefined)).toBe(true);
    expect(isHeavyRealtimeFeature('mfccWithDelta', undefined)).toBe(true);
    expect(isHeavyRealtimeFeature('rms', undefined)).toBe(false);
  });

  it('treats stereo phase analysis as heavy', () => {
    expect(isHeavyRealtimeFeature('stereo', { calculatePhase: true })).toBe(true);
    expect(isHeavyRealtimeFeature('stereo', { calculatePhase: false })).toBe(false);
    expect(isHeavyRealtimeFeature('stereo', undefined)).toBe(false);
  });

  it('normalizes invalid policy and interval', () => {
    expect(normalizeRealtimePolicyMode('allow')).toBe('allow');
    expect(normalizeRealtimePolicyMode('invalid')).toBe(DEFAULT_REALTIME_POLICY);

    expect(normalizeHeavyFeatureInterval(8)).toBe(8);
    expect(normalizeHeavyFeatureInterval(0)).toBe(DEFAULT_HEAVY_FEATURE_INTERVAL);
    expect(normalizeHeavyFeatureInterval(2.5)).toBe(DEFAULT_HEAVY_FEATURE_INTERVAL);
  });
});
