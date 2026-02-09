# audio-inspect Usage

This project uses the vNext API only.

## Run This Repository Demo

From the repository root:

```bash
npm run build
npm run demo:serve
```

Open `http://127.0.0.1:4173/examples/index.html`.

## Top-Level Functions

- `load(source, options?)`
- `analyze(audio, request)`
- `inspect(source, request)`
- `monitor(options)`
- `prepareWorklet(context, options?)`

## Offline One-Shot

```ts
import { inspect } from 'audio-inspect';

const result = await inspect(fileOrUrl, {
  load: { normalize: true, sampleRate: 48000 },
  features: {
    rms: { asDB: true },
    spectrum: { fftSize: 2048 }
  }
});
```

## Offline Reuse

```ts
import { load, analyze } from 'audio-inspect';

const audio = await load(fileOrUrl);

const basic = await analyze(audio, {
  features: { rms: true, peak: true }
});

const speech = await analyze(audio, {
  range: { start: 10, end: 20 },
  features: { vad: true, lufs: true }
});
```

## Realtime

```ts
import { monitor } from 'audio-inspect';

const session = await monitor({
  context: audioContext,
  source: micStream,
  features: { rms: true, peak: true },
  emit: 'raf'
});

session.onFrame((frame) => {
  console.log(frame.sampleIndex);
  drawMeters(frame.results.rms, frame.results.peak);
});
```

## Dynamic Feature Control

```ts
await session.setFeature('spectrum', { fftSize: 2048 });
await session.setFeature('spectrogram', {
  fftSize: 2048,
  frameSize: 2048,
  hopSize: 512,
  maxFrames: 60
});
await session.removeFeature('peak');
await session.setFeatures({ lufs: true, vad: { method: 'adaptive' } });
```

## Worklet Preload

```ts
import { prepareWorklet } from 'audio-inspect';

await prepareWorklet(audioContext, {
  moduleUrl: '/dist/core/realtime/processor.js'
});
```

## Notes

- `monitor()` is AudioWorklet-only. If AudioWorklet is unavailable, it throws `WORKLET_NOT_SUPPORTED`.
- `inspect` is for convenience; `load + analyze` is better for repeated analysis.
- In Node.js, inject a decode backend via `LoadOptions.decoder` when decoding compressed audio.
