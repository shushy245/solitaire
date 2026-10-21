// A stand-in for the browser's AudioContext, installed in the page before it loads: it builds no audio, but
// counts how many contexts the app created and how many sounds it started, for the specs to read.
export type AudioLog = { contexts: number; starts: number };

class FakeParam {
    value = 0;

    setValueAtTime(): void {}

    exponentialRampToValueAtTime(): void {}
}

class FakeNode {
    connect<N>(next: N): N {
        return next;
    }
}

class FakeGain extends FakeNode {
    readonly gain = new FakeParam();
}

class FakeFilter extends FakeNode {
    type = 'lowpass';
    readonly frequency = new FakeParam();
}

class FakeSource extends FakeNode {
    type = 'sine';
    buffer: unknown = undefined;
    readonly frequency = new FakeParam();

    constructor(private readonly onStart: () => void) {
        super();
    }

    start(): void {
        this.onStart();
    }

    stop(): void {}
}

class FakeBuffer {
    constructor(private readonly length: number) {}

    getChannelData(): Float32Array {
        return new Float32Array(this.length);
    }
}

export const installFakeAudioContext = (win: Cypress.AUTWindow, log: AudioLog): void => {
    const countStart = (): void => {
        log.starts += 1;
    };

    class FakeAudioContext {
        readonly sampleRate = 8000;
        readonly currentTime = 0;
        readonly destination = new FakeNode();

        constructor() {
            log.contexts += 1;
        }

        createGain(): FakeGain {
            return new FakeGain();
        }

        createDynamicsCompressor(): FakeNode {
            return new FakeNode();
        }

        createBiquadFilter(): FakeFilter {
            return new FakeFilter();
        }

        createOscillator(): FakeSource {
            return new FakeSource(countStart);
        }

        createBufferSource(): FakeSource {
            return new FakeSource(countStart);
        }

        createBuffer(_channels: number, length: number): FakeBuffer {
            return new FakeBuffer(length);
        }

        resume(): Promise<void> {
            return Promise.resolve();
        }
    }

    Object.defineProperty(win, 'AudioContext', { value: FakeAudioContext, configurable: true });
};
