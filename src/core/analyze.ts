import { AudioData, Feature, AudioInspectError } from '../types.js';

/**
 * Extract features from audio data
 */
export async function analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T> {
  try {
    // Input validation
    validateAudioData(audio);

    // Execute feature extraction function
    const result = await feature(audio);

    return result;
  } catch (error) {
    // Re-throw if already an AudioInspectError
    if (error instanceof AudioInspectError) {
      throw error;
    }

    // Wrap other errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new AudioInspectError('PROCESSING_ERROR', `Feature extraction failed: ${message}`, error);
  }
}

/**
 * AudioData input validation
 */
function validateAudioData(audio: AudioData): void {
  if (!audio || typeof audio !== 'object') {
    throw new AudioInspectError('INVALID_INPUT', 'AudioData is invalid');
  }

  if (typeof audio.sampleRate !== 'number' || audio.sampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Sample rate is invalid');
  }

  if (!Array.isArray(audio.channelData) || audio.channelData.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Channel data is invalid');
  }

  if (
    typeof audio.numberOfChannels !== 'number' ||
    audio.numberOfChannels !== audio.channelData.length
  ) {
    throw new AudioInspectError('INVALID_INPUT', 'Number of channels does not match');
  }

  if (typeof audio.length !== 'number' || audio.length <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Data length is invalid');
  }

  if (typeof audio.duration !== 'number' || audio.duration <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Audio duration is invalid');
  }

  // Ensure all channel data lengths match
  const firstChannelData = audio.channelData[0];
  if (!firstChannelData) {
    throw new AudioInspectError('INVALID_INPUT', 'Channel 0 data does not exist');
  }
  const expectedLength = firstChannelData.length;
  for (let i = 0; i < audio.channelData.length; i++) {
    const channelData = audio.channelData[i];
    if (!(channelData instanceof Float32Array)) {
      throw new AudioInspectError('INVALID_INPUT', `Channel ${i} data is not a Float32Array`);
    }
    if (channelData.length !== expectedLength) {
      throw new AudioInspectError('INVALID_INPUT', `Channel ${i} data length does not match`);
    }
  }
}
