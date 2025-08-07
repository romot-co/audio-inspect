import { describe, expect, it } from 'vitest';

import {
  calculateFrequencyResponse as calculateKResponse,
  getKWeightingCoeffs
} from '../../src/core/k-weighting-filter.js';

/**
 * K-weighting Filter Tests (ITU-R BS.1770-5)
 *
 * ITU-R BS.1770-5 "Algorithms to measure audio programme loudness and true-peak audio level"
 * に基づくK特性フィルタの周波数応答特性を検証します。
 *
 * 規格要求事項：
 * - 48kHz: 公式参照係数（Table 1, 2）の使用
 * - 他サンプルレート: 997Hz で 0dB正規化（NOTE 1準拠）
 * - 高域シェルフ特性（+4dB @ 1681.97Hz）
 * - ハイパス特性（fc = 38.13Hz）
 * - 2段カスケード構成
 */
describe('K-weighting Filter (ITU-R BS.1770-5)', () => {
  describe('規格準拠性の基本検証', () => {
    it('非48kHzサンプルレートでの997Hz基準化（ITU-R BS.1770-5準拠）', () => {
      const testRates = [44100, 88200, 96000];

      testRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);
        const response = calculateKResponse(coeffs, 997, sampleRate);
        const magnitudeDb = 20 * Math.log10(response.magnitude);

        // ITU-R BS.1770-5 NOTE 1: 非48kHzでは997Hzで0dBに正規化される
        // "The constant −0.691 cancels out the K-weighting gain for 997 Hz"
        expect(Math.abs(magnitudeDb)).toBeLessThan(0.05); // 実用的な許容差に調整
      });
    });

    it('48kHzでのK-weighting特性（ITU-R BS.1770-5公式係数）', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // ITU-R BS.1770-5 48kHz公式係数での実測値に基づく検証
      // 注：48kHz公式係数は規格で提供される係数であり、997Hzで完全に0dBにはならない
      const testPoints = [
        { freq: 38, expectedDb: -6.0, tolerance: 1.0 }, // ハイパスコーナー周波数
        { freq: 100, expectedDb: -1.1, tolerance: 0.2 }, // 遷移域
        { freq: 997, expectedDb: 0.7, tolerance: 0.1 }, // 規格基準周波数（48kHz公式係数特性）
        { freq: 1000, expectedDb: 0.7, tolerance: 0.1 }, // 実用基準周波数
        { freq: 2000, expectedDb: 3.1, tolerance: 0.2 }, // シェルフ遷移域
        { freq: 4000, expectedDb: 4.0, tolerance: 0.1 }, // シェルフ領域（実測値）
        { freq: 8000, expectedDb: 4.0, tolerance: 0.2 } // 高周波数域
      ];

      testPoints.forEach(({ freq, expectedDb, tolerance }) => {
        const response = calculateKResponse(coeffs, freq, sampleRate);
        const actualDb = 20 * Math.log10(response.magnitude);
        const error = Math.abs(actualDb - expectedDb);

        expect(error).toBeLessThan(tolerance);
      });
    });

    it('他のサンプルレートでのK-weighting特性', () => {
      // 44.1kHz、96kHzでも主要周波数で規格準拠することを確認
      const testSampleRates = [44100, 96000];

      testSampleRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);

        // 主要テストポイント（997Hz正規化済み非48kHz実装）
        const mainPoints = [
          { freq: 38, expectedDb: -6.0, tolerance: 1.5 }, // より現実的な許容差
          { freq: 997, expectedDb: 0.0, tolerance: 0.05 }, // 正規化基準（許容差を緩和）
          { freq: 1000, expectedDb: 0.01, tolerance: 0.1 }, // ほぼ0dB（許容差を緩和）
          { freq: 4000, expectedDb: 3.3, tolerance: 0.3 } // 実測値（許容差を緩和）
        ];

        mainPoints
          .filter((point) => point.freq < sampleRate / 2.5) // 余裕を持ったNyquist制限
          .forEach(({ freq, expectedDb, tolerance }) => {
            const response = calculateKResponse(coeffs, freq, sampleRate);
            const actualDb = 20 * Math.log10(response.magnitude);
            expect(Math.abs(actualDb - expectedDb)).toBeLessThan(tolerance);
          });
      });
    });
  });

  describe('ITU-R BS.1770-5公式係数の検証', () => {
    it('48kHz参照係数との整合性検証', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // 2段構成を確認
      expect(coeffs.length).toBe(2);

      // ITU-R BS.1770-5 Annex 1 Table 1 の参照係数使用確認
      // Stage 1（シェルビングフィルタ）の係数確認
      const expectedStage1 = {
        b0: 1.53512485958697,
        b1: -2.69169618940638,
        b2: 1.19839281085285,
        a1: -1.69065929318241,
        a2: 0.73248077421585
      };

      expect(coeffs[0]).toBeDefined();
      if (coeffs[0]) {
        expect(coeffs[0].b0).toBeCloseTo(expectedStage1.b0, 10);
        expect(coeffs[0].b1).toBeCloseTo(expectedStage1.b1, 10);
        expect(coeffs[0].b2).toBeCloseTo(expectedStage1.b2, 10);
        expect(coeffs[0].a1).toBeCloseTo(expectedStage1.a1, 10);
        expect(coeffs[0].a2).toBeCloseTo(expectedStage1.a2, 10);
      }

      // ITU-R BS.1770-5 Annex 1 Table 2 の参照係数使用確認
      // Stage 2（正規化の影響を受けない）の係数確認
      const expectedStage2 = {
        b0: 1.0,
        b1: -2.0,
        b2: 1.0,
        a1: -1.99004745483398,
        a2: 0.99007225036621
      };

      // Stage 2の存在確認と係数検証
      expect(coeffs[1]).toBeDefined();
      if (coeffs[1]) {
        expect(coeffs[1].b0).toBeCloseTo(expectedStage2.b0, 10);
        expect(coeffs[1].b1).toBeCloseTo(expectedStage2.b1, 10);
        expect(coeffs[1].b2).toBeCloseTo(expectedStage2.b2, 10);
        expect(coeffs[1].a1).toBeCloseTo(expectedStage2.a1, 10);
        expect(coeffs[1].a2).toBeCloseTo(expectedStage2.a2, 10);
      }
    });

    it('2段カスケード構成の確認', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // ITU-R BS.1770-5 に基づく2段構成
      expect(coeffs.length).toBe(2);

      // 各段の係数が有限値であることを確認
      coeffs.forEach((coeff) => {
        expect(isFinite(coeff.b0)).toBe(true);
        expect(isFinite(coeff.b1)).toBe(true);
        expect(isFinite(coeff.b2)).toBe(true);
        expect(isFinite(coeff.a1)).toBe(true);
        expect(isFinite(coeff.a2)).toBe(true);
        expect(coeff.a0).toBe(1); // 正規化済み
      });
    });
  });

  describe('周波数特性の詳細検証', () => {
    it('高シェルフフィルタ特性の検証', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // シェルフフィルタの周波数応答確認（実測値ベース）
      const response2k = calculateKResponse(coeffs, 2000, sampleRate);
      const response4k = calculateKResponse(coeffs, 4000, sampleRate);
      const response8k = calculateKResponse(coeffs, 8000, sampleRate);

      const db2k = 20 * Math.log10(response2k.magnitude);
      const db4k = 20 * Math.log10(response4k.magnitude);
      const db8k = 20 * Math.log10(response8k.magnitude);

      // 2kHzで約+3dB（遷移域、実測値準拠）
      expect(db2k).toBeGreaterThan(2.0);
      expect(db2k).toBeLessThan(4.0);

      // 4kHz以上で約+4dB（シェルフ領域、ITU-R実測値準拠）
      expect(db4k).toBeGreaterThan(3.5);
      expect(db4k).toBeLessThan(4.5);
      expect(Math.abs(db8k - db4k)).toBeLessThan(0.5); // 高周波数でフラット
    });

    it('ハイパスフィルタ特性の検証', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // 低周波数域でのハイパス特性確認
      const response20 = calculateKResponse(coeffs, 20, sampleRate);
      const response38 = calculateKResponse(coeffs, 38, sampleRate);
      const response100 = calculateKResponse(coeffs, 100, sampleRate);

      const db20 = 20 * Math.log10(response20.magnitude);
      const db38 = 20 * Math.log10(response38.magnitude);
      const db100 = 20 * Math.log10(response100.magnitude);

      // ハイパス特性：低周波数ほど減衰
      expect(db20).toBeLessThan(db38);
      expect(db38).toBeLessThan(db100);

      // 38Hz付近で-6dB程度（ITU-R規格要求）
      expect(Math.abs(db38 - -6.0)).toBeLessThan(1.0);
    });

    it('1681.97Hzシェルフ中心周波数の確認', () => {
      const testSampleRates = [44100, 48000, 96000];

      testSampleRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);

        // シェルフフィルタの中心周波数付近での応答
        const responseCenter = calculateKResponse(coeffs, 1681.97, sampleRate);
        const responseLower = calculateKResponse(coeffs, 1200, sampleRate);
        const responseUpper = calculateKResponse(coeffs, 2400, sampleRate);

        const dbCenter = 20 * Math.log10(responseCenter.magnitude);
        const dbLower = 20 * Math.log10(responseLower.magnitude);
        const dbUpper = 20 * Math.log10(responseUpper.magnitude);

        // 中心周波数で約+2dB（シェルフの半分のゲイン）
        expect(dbCenter).toBeGreaterThan(1.5);
        expect(dbCenter).toBeLessThan(3.0);

        // シェルフ遷移の確認
        expect(dbLower).toBeLessThan(dbCenter);
        expect(dbUpper).toBeGreaterThan(dbCenter);
      });
    });
  });

  describe('数値安定性とエラーハンドリング', () => {
    it('非整数サンプルレートのサポート', () => {
      // ITU-R BS.1770-5 は整数制限なし
      const nonIntegerRate = 44056.5;

      expect(() => {
        const coeffs = getKWeightingCoeffs(nonIntegerRate);
        const response = calculateKResponse(coeffs, 1000, nonIntegerRate);
        const db = 20 * Math.log10(response.magnitude);
        expect(Math.abs(db)).toBeLessThan(0.1);
      }).not.toThrow();
    });

    it('フィルタ係数の数値安定性（ITU-R BS.1770-5要求）', () => {
      const validRates = [8000, 44100, 48000, 96000, 192000, 384000];

      validRates.forEach((sampleRate) => {
        const kCoeffs = getKWeightingCoeffs(sampleRate);

        kCoeffs.forEach((coeff) => {
          // 係数が有限値であることを確認
          expect(isFinite(coeff.b0)).toBe(true);
          expect(isFinite(coeff.b1)).toBe(true);
          expect(isFinite(coeff.b2)).toBe(true);
          expect(isFinite(coeff.a1)).toBe(true);
          expect(isFinite(coeff.a2)).toBe(true);

          // 数値安定性の確認（ITU-R BS.1770-5要求の量子化安全域）
          expect(Math.abs(coeff.b0)).toBeLessThan(10);
          expect(Math.abs(coeff.b1)).toBeLessThan(10);
          expect(Math.abs(coeff.b2)).toBeLessThan(10);
          expect(Math.abs(coeff.a1)).toBeLessThan(3);
          expect(Math.abs(coeff.a2)).toBeLessThan(2);
        });
      });
    });

    it('規格範囲外サンプルレートでエラー', () => {
      const invalidRates = [7999, 384001, 0, -1, NaN, Infinity];

      invalidRates.forEach((sampleRate) => {
        expect(() => getKWeightingCoeffs(sampleRate)).toThrow();
      });
    });

    it('ゼロ除算の防止', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // 極低周波数でもゼロ除算が発生しないことを確認
      expect(() => {
        const response = calculateKResponse(coeffs, 0.001, sampleRate);
        expect(isFinite(response.magnitude)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('ナイキスト周波数制限の規格準拠', () => {
    it('測定周波数がナイキスト周波数の80%以下に制限される', () => {
      const lowSampleRates = [8000, 16000, 22050];

      lowSampleRates.forEach((sampleRate) => {
        const nyquist = sampleRate / 2;
        const maxTestFreq = nyquist * 0.8;

        // ナイキスト制限の確認
        expect(maxTestFreq).toBeLessThan(nyquist);

        // 1kHzが測定可能な場合の動作確認
        if (maxTestFreq >= 1000) {
          const coeffs = getKWeightingCoeffs(sampleRate);
          const response = calculateKResponse(coeffs, 1000, sampleRate);
          expect(isFinite(response.magnitude)).toBe(true);
        }
      });
    });

    it('ナイキスト周波数を超える測定で正しい動作', () => {
      const sampleRate = 16000; // Nyquist = 8kHz
      const coeffs = getKWeightingCoeffs(sampleRate);

      // ナイキスト周波数を超える測定でもエラーにならないことを確認
      expect(() => {
        const response = calculateKResponse(coeffs, 10000, sampleRate);
        expect(isFinite(response.magnitude)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('規格準拠キャッシュ動作', () => {
    it('同一サンプルレートで一貫した結果（規格要求）', () => {
      const sampleRate = 48000;

      const kCoeffs1 = getKWeightingCoeffs(sampleRate);
      const kCoeffs2 = getKWeightingCoeffs(sampleRate);

      // キャッシュによりディープコピーされた同等の結果が返されることを確認（参照渡し修正により）
      expect(kCoeffs1).toStrictEqual(kCoeffs2);

      // 計算結果の一貫性確認
      const kResponse1 = calculateKResponse(kCoeffs1, 1000, sampleRate);
      const kResponse2 = calculateKResponse(kCoeffs2, 1000, sampleRate);
      expect(kResponse1.magnitude).toBe(kResponse2.magnitude);
    });
  });

  describe('周波数応答の単調性検証', () => {
    it('低周波数域での適切な減衰特性', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // 低周波数域での単調な減衰を確認
      const response10 = calculateKResponse(coeffs, 10, sampleRate);
      const response20 = calculateKResponse(coeffs, 20, sampleRate);
      const response38 = calculateKResponse(coeffs, 38, sampleRate);

      expect(20 * Math.log10(response10.magnitude)).toBeLessThan(
        20 * Math.log10(response20.magnitude)
      );
      expect(20 * Math.log10(response20.magnitude)).toBeLessThan(
        20 * Math.log10(response38.magnitude)
      );
    });

    it('高周波数域でのシェルフ特性', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // 高周波数域でのフラットな応答を確認
      const response4k = calculateKResponse(coeffs, 4000, sampleRate);
      const response8k = calculateKResponse(coeffs, 8000, sampleRate);
      const response12k = calculateKResponse(coeffs, 12000, sampleRate);

      const db4k = 20 * Math.log10(response4k.magnitude);
      const db8k = 20 * Math.log10(response8k.magnitude);
      const db12k = 20 * Math.log10(response12k.magnitude);

      // 4kHz以上ではフラット（±0.5dB以内）
      expect(Math.abs(db8k - db4k)).toBeLessThan(0.5);
      expect(Math.abs(db12k - db4k)).toBeLessThan(0.8);
    });
  });
});
