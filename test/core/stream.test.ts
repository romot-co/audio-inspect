import { describe, it, expect } from 'vitest';
import { stream } from '../../src/core/stream.js';
import { AudioInspectError } from '../../src/types.js';

// AudioWorkletNodeがブラウザ環境でのみ利用可能かチェック
const isAudioWorkletSupported = typeof AudioWorkletNode !== 'undefined';
const isMediaStreamSupported = typeof MediaStream !== 'undefined';

describe('stream', () => {
  it('should handle unsupported environment gracefully', async () => {
    if (!isAudioWorkletSupported || !isMediaStreamSupported) {
      // Node.js環境では適切なエラーが発生することを確認
      const mockSource = new ArrayBuffer(1024);
      const mockFeature = 'getRMS';

      await expect(
        stream(mockSource, mockFeature, { processorModuleUrl: 'mock.js' })
      ).rejects.toThrow();
      return;
    }

    // ブラウザ環境でのテストは実際のAudioContextが必要なため、
    // ここでは基本的な型チェックのみ実行
    expect(typeof stream).toBe('function');
  });

  it('should validate feature name parameter', async () => {
    if (!isAudioWorkletSupported) {
      console.log('AudioWorklet not supported in this environment, skipping test');
      return;
    }

    const mockSource = new ArrayBuffer(1024);

    // 空の機能名でエラーが発生することを確認
    await expect(stream(mockSource, '', { processorModuleUrl: 'mock.js' })).rejects.toThrow(
      AudioInspectError
    );
  });

  it('should handle different source types appropriately', async () => {
    if (!isAudioWorkletSupported) {
      console.log('AudioWorklet not supported in this environment, skipping test');
      return;
    }

    const mockFeature = 'getRMS';

    // サポートされていないソース形式でエラーが発生することを確認
    const unsupportedSource = 'invalid-source';

    await expect(
      stream(unsupportedSource as any, mockFeature, { processorModuleUrl: 'mock.js' })
    ).rejects.toThrow(AudioInspectError);
  });

  it('should handle different source types appropriately with processorModuleUrl', async () => {
    if (!isAudioWorkletSupported) {
      console.log('AudioWorklet not supported in this environment, skipping test');
      return;
    }

    const mockFeature = 'getRMS';

    const fakeSource = new ArrayBuffer(1024);

    await stream(fakeSource as any, mockFeature, { processorModuleUrl: 'mock.js' });
  });
});
