import { describe, it, expect } from 'vitest';
import { getPeaks, getRMS, getZeroCrossing } from '../../src/features/time.js';
// テスト用のAudioDataを作成するヘルパー
function createTestAudioData(data, sampleRate = 44100) {
    return {
        sampleRate,
        channelData: [data],
        duration: data.length / sampleRate,
        numberOfChannels: 1,
        length: data.length
    };
}
// テスト信号を生成するヘルパー関数
function createSineWave(frequency, duration, sampleRate = 44100, amplitude = 1) {
    const length = Math.floor(duration * sampleRate);
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }
    return data;
}
function createPeakSignal(peakPositions, peakAmplitudes, length) {
    const data = new Float32Array(length);
    peakPositions.forEach((pos, i) => {
        if (pos < length) {
            data[pos] = peakAmplitudes[i] || 1.0;
        }
    });
    return data;
}
describe('getPeaks', () => {
    describe('basic functionality', () => {
        it('should detect simple peaks', () => {
            const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.9], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks).toHaveLength(3);
            expect(result.peaks[0]?.position).toBe(100);
            expect(result.peaks[1]?.position).toBe(200);
            expect(result.peaks[2]?.position).toBe(300);
        });
        it('should return peaks sorted by time', () => {
            const data = createPeakSignal([300, 100, 200], [0.9, 1.0, 0.8], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks).toHaveLength(3);
            expect(result.peaks[0]?.position).toBe(100);
            expect(result.peaks[1]?.position).toBe(200);
            expect(result.peaks[2]?.position).toBe(300);
        });
        it('should limit number of peaks returned', () => {
            const data = createPeakSignal([100, 200, 300, 400, 500], [1.0, 0.9, 0.8, 0.7, 0.6], 600);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { count: 3, threshold: 0.5 });
            expect(result.peaks).toHaveLength(3);
            // Should return the 3 highest peaks, sorted by time
            expect(result.peaks.map(p => p.position)).toEqual([100, 200, 300]);
        });
        it('should respect threshold parameter', () => {
            const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.6], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.7 });
            expect(result.peaks).toHaveLength(2);
            expect(result.peaks.map(p => p.position)).toEqual([100, 200]);
        });
    });
    describe('peak timing and amplitude', () => {
        it('should calculate correct time positions', () => {
            const sampleRate = 1000; // 簡単な計算のため
            const data = createPeakSignal([100, 500], [1.0, 0.8], 1000);
            const audio = createTestAudioData(data, sampleRate);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks[0]?.time).toBe(0.1); // 100/1000
            expect(result.peaks[1]?.time).toBe(0.5); // 500/1000
        });
        it('should preserve peak amplitudes', () => {
            const data = createPeakSignal([100, 200], [1.0, 0.8], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks[0]?.amplitude).toBe(1.0);
            expect(result.peaks[1]?.amplitude).toBe(0.8);
        });
    });
    describe('statistics', () => {
        it('should calculate correct statistics', () => {
            const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.6], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.maxAmplitude).toBe(1.0);
            expect(result.averageAmplitude).toBeCloseTo((1.0 + 0.8 + 0.6) / 3);
        });
        it('should handle empty results', () => {
            const data = new Float32Array(500); // All zeros
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks).toHaveLength(0);
            expect(result.maxAmplitude).toBe(-Infinity); // Math.max of empty array
            expect(result.averageAmplitude).toBeNaN(); // Division by zero
        });
    });
    describe('minimum distance enforcement', () => {
        it('should enforce minimum distance between peaks', () => {
            const data = createPeakSignal([100, 105, 110], [1.0, 0.9, 0.8], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });
            // Should only keep the highest peak in the cluster
            expect(result.peaks).toHaveLength(1);
            expect(result.peaks[0]?.position).toBe(100);
            expect(result.peaks[0]?.amplitude).toBe(1.0);
        });
        it('should replace peaks with higher amplitude ones', () => {
            const data = createPeakSignal([100, 105], [0.8, 1.0], 500);
            const audio = createTestAudioData(data);
            const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });
            // Should keep the higher amplitude peak
            expect(result.peaks).toHaveLength(1);
            expect(result.peaks[0]?.position).toBe(105);
            expect(result.peaks[0]?.amplitude).toBe(1.0);
        });
        it('should use default minDistance based on sample rate', () => {
            const sampleRate = 44100;
            const expectedMinDistance = Math.floor(sampleRate / 100); // 441
            const data = createPeakSignal([100, 200, 600], [1.0, 0.9, 0.8], 1000);
            const audio = createTestAudioData(data, sampleRate);
            const result = getPeaks(audio, { threshold: 0.5 });
            // Peaks at 100 and 200 are too close (distance: 100 < 441)
            // Should only keep peak at 100 and 600
            expect(result.peaks).toHaveLength(2);
            expect(result.peaks.map(p => p.position)).toEqual([100, 600]);
        });
    });
    describe('multi-channel support', () => {
        it('should analyze specified channel', () => {
            const channel0 = createPeakSignal([100], [1.0], 500);
            const channel1 = createPeakSignal([200], [0.8], 500);
            const audio = {
                sampleRate: 44100,
                channelData: [channel0, channel1],
                duration: 500 / 44100,
                numberOfChannels: 2,
                length: 500
            };
            const resultCh0 = getPeaks(audio, { channel: 0, threshold: 0.5 });
            const resultCh1 = getPeaks(audio, { channel: 1, threshold: 0.5 });
            expect(resultCh0.peaks).toHaveLength(1);
            expect(resultCh0.peaks[0]?.position).toBe(100);
            expect(resultCh1.peaks).toHaveLength(1);
            expect(resultCh1.peaks[0]?.position).toBe(200);
        });
        it('should average all channels when channel is -1', () => {
            const channel0 = createPeakSignal([100], [1.0], 500);
            const channel1 = createPeakSignal([100], [0.6], 500); // Same position
            const audio = {
                sampleRate: 44100,
                channelData: [channel0, channel1],
                duration: 500 / 44100,
                numberOfChannels: 2,
                length: 500
            };
            const result = getPeaks(audio, { channel: -1, threshold: 0.5 });
            expect(result.peaks).toHaveLength(1);
            expect(result.peaks[0]?.position).toBe(100);
            expect(result.peaks[0]?.amplitude).toBeCloseTo(0.8); // Average of 1.0 and 0.6
        });
        it('should throw error for invalid channel', () => {
            const audio = createTestAudioData(new Float32Array(500));
            expect(() => {
                getPeaks(audio, { channel: 1 }); // Only has channel 0
            }).toThrow('無効なチャンネル番号: 1');
            expect(() => {
                getPeaks(audio, { channel: -2 });
            }).toThrow('無効なチャンネル番号: -2');
        });
    });
    describe('real-world scenarios', () => {
        it('should detect peaks in sine wave with impulses', () => {
            const sineWave = createSineWave(440, 0.1, 44100, 0.3);
            // Add some impulses
            sineWave[1000] = 1.0;
            sineWave[2000] = 0.9;
            sineWave[3000] = 0.8;
            const audio = createTestAudioData(sineWave);
            const result = getPeaks(audio, { threshold: 0.7, count: 10 });
            expect(result.peaks.length).toBeGreaterThan(0);
            expect(result.peaks.some(p => p.amplitude >= 0.8)).toBe(true);
        });
        it('should handle audio with no clear peaks', () => {
            const noise = new Float32Array(1000);
            for (let i = 0; i < noise.length; i++) {
                noise[i] = (Math.random() - 0.5) * 0.1; // Low amplitude noise
            }
            const audio = createTestAudioData(noise);
            const result = getPeaks(audio, { threshold: 0.5 });
            expect(result.peaks).toHaveLength(0);
        });
    });
});
describe('getRMS', () => {
    it('should calculate RMS for sine wave', () => {
        const sineWave = createSineWave(440, 0.1, 44100, 1.0);
        const audio = createTestAudioData(sineWave);
        const rms = getRMS(audio);
        // RMS of sine wave should be amplitude / sqrt(2)
        expect(rms).toBeCloseTo(1.0 / Math.sqrt(2), 2);
    });
    it('should calculate RMS for DC signal', () => {
        const dcSignal = new Float32Array(1000);
        dcSignal.fill(0.5);
        const audio = createTestAudioData(dcSignal);
        const rms = getRMS(audio);
        expect(rms).toBeCloseTo(0.5);
    });
    it('should return 0 for silent signal', () => {
        const silence = new Float32Array(1000);
        const audio = createTestAudioData(silence);
        const rms = getRMS(audio);
        expect(rms).toBe(0);
    });
    it('should handle different channels', () => {
        const channel0 = new Float32Array(1000);
        channel0.fill(1.0);
        const channel1 = new Float32Array(1000);
        channel1.fill(0.5);
        const audio = {
            sampleRate: 44100,
            channelData: [channel0, channel1],
            duration: 1000 / 44100,
            numberOfChannels: 2,
            length: 1000
        };
        const rms0 = getRMS(audio, 0);
        const rms1 = getRMS(audio, 1);
        expect(rms0).toBeCloseTo(1.0);
        expect(rms1).toBeCloseTo(0.5);
    });
});
describe('getZeroCrossing', () => {
    it('should calculate zero crossing rate for sine wave', () => {
        const sineWave = createSineWave(440, 0.1, 44100);
        const audio = createTestAudioData(sineWave);
        const zcr = getZeroCrossing(audio);
        // For a sine wave, zero crossing rate should be approximately 2 * frequency / sampleRate
        const expectedZCR = (2 * 440) / 44100;
        expect(zcr).toBeCloseTo(expectedZCR, 2);
    });
    it('should return 0 for DC signal', () => {
        const dcSignal = new Float32Array(1000);
        dcSignal.fill(1.0);
        const audio = createTestAudioData(dcSignal);
        const zcr = getZeroCrossing(audio);
        expect(zcr).toBe(0);
    });
    it('should calculate for alternating signal', () => {
        const alternating = new Float32Array(1000);
        for (let i = 0; i < alternating.length; i++) {
            alternating[i] = (i % 2 === 0) ? 1 : -1;
        }
        const audio = createTestAudioData(alternating);
        const zcr = getZeroCrossing(audio);
        // Should cross zero every sample (999 crossings in 1000 samples)
        expect(zcr).toBeCloseTo(999 / 1000);
    });
    it('should handle signals crossing zero', () => {
        const data = new Float32Array([1, -1, 1, -1, 1]);
        const audio = createTestAudioData(data);
        const zcr = getZeroCrossing(audio);
        // 4 zero crossings in 5 samples
        expect(zcr).toBe(4 / 5);
    });
    it('should handle signals at zero', () => {
        const data = new Float32Array([0, 1, 0, -1, 0]);
        const audio = createTestAudioData(data);
        const zcr = getZeroCrossing(audio);
        // Zero crossings: 0->1, 1->0, 0->-1, -1->0 = 4 crossings
        expect(zcr).toBe(4 / 5);
    });
});
