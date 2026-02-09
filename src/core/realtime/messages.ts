import type { FeatureId, FeatureOptions, FeatureResult, FeatureSelection } from '../feature-registry.js';
import type { RealtimePolicyMode } from './policy.js';

export interface WorkletProcessorConfig {
  bufferSize: number;
  hopSize: number;
  inputChannelCount: number;
  features: FeatureSelection<FeatureId>;
  realtimePolicy: RealtimePolicyMode;
  heavyFeatureInterval: number;
}

export interface SetFeaturesMessage {
  type: 'setFeatures';
  features: FeatureSelection<FeatureId>;
}

export interface SetConfigMessage {
  type: 'setConfig';
  config: Omit<WorkletProcessorConfig, 'features'>;
}

export interface ResetProcessorMessage {
  type: 'reset';
}

export type WorkletInboundMessage = SetFeaturesMessage | SetConfigMessage | ResetProcessorMessage;

export interface WorkletFrameMessage {
  type: 'frame';
  timestamp: number;
  sampleIndex: number;
  results: Partial<{ [K in FeatureId]: FeatureResult<K> }>;
}

export interface WorkletErrorMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
  recoverable?: boolean;
}

export type WorkletOutboundMessage = WorkletFrameMessage | WorkletErrorMessage;

export function cloneFeatureSelection(
  selection: FeatureSelection<FeatureId>
): FeatureSelection<FeatureId> {
  const cloned = {} as FeatureSelection<FeatureId>;
  const writable = cloned as Record<FeatureId, FeatureOptions<FeatureId> | true>;
  for (const [feature, value] of Object.entries(selection) as Array<
    [FeatureId, FeatureOptions<FeatureId> | true | undefined]
  >) {
    if (value !== undefined) {
      writable[feature] = value;
    }
  }
  return cloned;
}
