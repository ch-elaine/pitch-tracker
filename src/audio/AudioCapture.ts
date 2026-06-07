/** Owns microphone access, the Web Audio analysis graph, and the MediaRecorder.
 *  Produces per-frame time-domain data for analysis and the final recorded blob.
 *  No DOM, no DSP — just capture plumbing and lifecycle (see audio-capture skill). */

export interface CaptureResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

/** Raised when getUserMedia fails; `kind` lets the UI show a tailored message. */
export class CaptureError extends Error {
  constructor(
    message: string,
    readonly kind: 'insecure' | 'denied' | 'no-device' | 'busy' | 'unknown',
  ) {
    super(message);
    this.name = 'CaptureError';
  }
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export class AudioCapture {
  readonly fftSize = 2048;
  private readonly frameBuffer = new Float32Array(this.fftSize);

  private ctx: AudioContext | undefined;
  private stream: MediaStream | undefined;
  private analyser: AnalyserNode | undefined;
  private recorder: MediaRecorder | undefined;
  private chunks: Blob[] = [];
  private startedAt = 0;

  /** Effective sample rate of the capture graph (falls back to 44.1k pre-start). */
  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  async start(): Promise<void> {
    if (!window.isSecureContext) {
      throw new CaptureError('Microphone requires HTTPS or localhost.', 'insecure');
    }

    try {
      // Raw signal: speech-enhancement features corrupt pitch/volume measurement.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (err) {
      throw this.toCaptureError(err);
    }

    this.ctx = new AudioContext();
    await this.ctx.resume();

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0; // raw frames; we smooth downstream
    source.connect(this.analyser);
    // Intentionally NOT connected to ctx.destination — avoids echoing mic to speakers.

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined,
    );
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100); // emit chunks every 100ms
    this.startedAt = performance.now();
  }

  /** Fills and returns the shared time-domain buffer (no per-call allocation). */
  readFrame(): Float32Array {
    this.analyser?.getFloatTimeDomainData(this.frameBuffer);
    return this.frameBuffer;
  }

  elapsedMs(): number {
    return this.startedAt === 0 ? 0 : performance.now() - this.startedAt;
  }

  /** Stops recording and resolves with the assembled blob. */
  stop(): Promise<CaptureResult> {
    return new Promise<CaptureResult>((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new Error('stop() called while not recording'));
        return;
      }
      const mimeType = recorder.mimeType || 'audio/webm';
      const durationMs = this.elapsedMs();
      recorder.onstop = () => {
        resolve({ blob: new Blob(this.chunks, { type: mimeType }), mimeType, durationMs });
      };
      recorder.stop();
    });
  }

  /** Releases the mic, audio context, and all node references. Idempotent. */
  dispose(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    this.stream = undefined;
    this.ctx = undefined;
    this.analyser = undefined;
    this.recorder = undefined;
    this.chunks = [];
    this.startedAt = 0;
  }

  private toCaptureError(err: unknown): CaptureError {
    const name = err instanceof DOMException ? err.name : '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return new CaptureError('Microphone permission was denied.', 'denied');
      case 'NotFoundError':
        return new CaptureError('No microphone was found.', 'no-device');
      case 'NotReadableError':
        return new CaptureError('The microphone is already in use.', 'busy');
      default:
        return new CaptureError('Could not access the microphone.', 'unknown');
    }
  }
}
