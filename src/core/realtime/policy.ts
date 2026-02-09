import type { FeatureId } from '../feature-registry.js';

export type RealtimePolicyMode = 'allow' | 'warn' | 'strict';

export const DEFAULT_REALTIME_POLICY: RealtimePolicyMode = 'warn';
export const DEFAULT_HEAVY_FEATURE_INTERVAL = 4;

const HEAVY_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([
  'spectrogram',
  'timeVaryingSpectralFeatures',
  'melSpectrogram',
  'cqt',
  'mfcc',
  'mfccWithDelta'
]);

function hasStereoPhaseCalculation(options: unknown): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return false;
  }
  const candidate = options as Record<string, unknown>;
  return candidate.calculatePhase === true;
}

export function isHeavyRealtimeFeature(feature: FeatureId, options: unknown): boolean {
  if (HEAVY_FEATURES.has(feature)) {
    return true;
  }
  if (feature === 'stereo') {
    return hasStereoPhaseCalculation(options);
  }
  return false;
}

export function normalizeRealtimePolicyMode(policy: unknown): RealtimePolicyMode {
  if (policy === 'allow' || policy === 'warn' || policy === 'strict') {
    return policy;
  }
  return DEFAULT_REALTIME_POLICY;
}

export function normalizeHeavyFeatureInterval(interval: unknown): number {
  if (!Number.isFinite(interval) || !Number.isInteger(interval) || Number(interval) <= 0) {
    return DEFAULT_HEAVY_FEATURE_INTERVAL;
  }
  return Number(interval);
}
