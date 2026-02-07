# audio-inspect

TypeScript-first audio analysis library for offline and realtime use.

## Install

```bash
npm i audio-inspect
```

## Public API

`audio-inspect` exports only these top-level APIs:

- `load(source, options?)`
- `analyze(audio, request)`
- `inspect(source, request)` (`load + analyze` convenience)
- `monitor(options)` (realtime session)
- `prepareWorklet(context, options?)` (optional preload)
- `FEATURES`
- `AudioInspectError`, `isAudioInspectError`

## Quick Start (Offline)

```ts
import { inspect } from 'audio-inspect';

const result = await inspect('audio.mp3', {
  load: { normalize: true, sampleRate: 48000 },
  features: {
    rms: { asDB: true },
    spectrum: { fftSize: 2048 }
  }
});

console.log(result.results.rms);
console.log(result.results.spectrum?.frequencies.length);
```

## Decode Once, Analyze Many

```ts
import { load, analyze } from 'audio-inspect';

const audio = await load(file);

const pass1 = await analyze(audio, {
  features: { rms: true, peak: true }
});

const pass2 = await analyze(audio, {
  range: { start: 30, end: 45 },
  features: { lufs: true, spectralFeatures: true }
});
```

## Realtime Monitor

```ts
import { monitor } from 'audio-inspect';

const session = await monitor({
  context: audioContext,
  source: micStream,
  features: {
    rms: { asDB: true },
    peak: { asDB: true }
  },
  emit: 'raf'
});

function loop() {
  const frame = session.read();
  if (frame) {
    renderMeters(frame.results.rms, frame.results.peak);
  }
  requestAnimationFrame(loop);
}

loop();
```

## Dynamic Realtime Features

```ts
await session.setFeature('spectrum', { fftSize: 2048 });
await session.removeFeature('rms');
await session.setFeatures({ lufs: true, vad: { method: 'adaptive' } });
```

## Worklet Strategy

- Default: `engine: 'auto'` (tries worklet, falls back to main-thread)
- Strict worklet: `engine: 'worklet'`
- Force fallback: `engine: 'main-thread'`

Optional preload:

```ts
import { prepareWorklet } from 'audio-inspect';

await prepareWorklet(audioContext, {
  moduleUrl: '/worklets/audio-inspect-processor.js'
});
```

## Node.js Offline Decode

In Node.js, compressed/container decoding requires decoder injection:

```ts
import { load } from 'audio-inspect';

const audio = await load(buffer, {
  decoder: {
    name: 'my-decoder',
    async decode(input) {
      // return AudioData
      return decodedAudioData;
    }
  }
});
```

If decode backend is missing, `load()` throws `DECODE_BACKEND_MISSING`.

## Error Handling

All public failures throw `AudioInspectError`.

```ts
import { isAudioInspectError } from 'audio-inspect';

try {
  // ...
} catch (error) {
  if (isAudioInspectError(error)) {
    console.error(error.code, error.message);
  }
}
```

## License

MIT
