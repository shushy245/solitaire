import { SoundKind } from './sound.utils.ts';
import { SoundVoice } from './sound-player.port.ts';

// Every sound is synthesized here with the Web Audio API — short filtered noise for card on card and felt, soft
// tones for the rest — so there are no audio files to ship or license. Everything passes through one quiet
// master gain and a compressor, so quick runs (auto-complete) never clip. Checked by ear in Chrome and Safari.

const MASTER_GAIN = 0.35;
const SILENT = 0.0001;
const ATTACK_S = 0.005;
const NOISE_SECONDS = 1;
const DEAL_TICKS = 7;
const DEAL_SPACING_S = 0.045;
const WIN_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5];
const WIN_SPACING_S = 0.11;

type ToneModel = {
    readonly at: number;
    readonly hz: number;
    readonly toHz?: number;
    readonly seconds: number;
    readonly wave: OscillatorType;
    readonly peak: number;
};

type RustleModel = {
    readonly at: number;
    readonly seconds: number;
    readonly filter: BiquadFilterType;
    readonly hz: number;
    readonly toHz?: number;
    readonly peak: number;
};

export const makeWebAudioVoice = (context: AudioContext): SoundVoice => {
    const master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.createDynamicsCompressor()).connect(context.destination);

    // One second of white noise, made once and reused by every rustle.
    const noise = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate);
    const samples = noise.getChannelData(0);
    samples.forEach((_, i) => {
        samples[i] = Math.random() * 2 - 1;
    });

    const envelope = ({ at, seconds, peak }: { at: number; seconds: number; peak: number }): GainNode => {
        const gain = context.createGain();
        gain.gain.setValueAtTime(SILENT, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + ATTACK_S);
        gain.gain.exponentialRampToValueAtTime(SILENT, at + seconds);
        gain.connect(master);

        return gain;
    };

    const tone = ({ at, hz, toHz, seconds, wave, peak }: ToneModel): void => {
        const oscillator = context.createOscillator();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(hz, at);
        if (toHz !== undefined) oscillator.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
        oscillator.connect(envelope({ at, seconds, peak }));
        oscillator.start(at);
        oscillator.stop(at + seconds + ATTACK_S);
    };

    const rustle = ({ at, seconds, filter, hz, toHz, peak }: RustleModel): void => {
        const source = context.createBufferSource();
        const shape = context.createBiquadFilter();
        source.buffer = noise;
        shape.type = filter;
        shape.frequency.setValueAtTime(hz, at);
        if (toHz !== undefined) shape.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
        source.connect(shape).connect(envelope({ at, seconds, peak }));
        source.start(at, Math.random() * (NOISE_SECONDS - seconds), seconds);
    };

    const recipeMap: Record<SoundKind, (at: number) => void> = {
        [SoundKind.Draw]: (at) => {
            rustle({ at, seconds: 0.07, filter: 'bandpass', hz: 2600, peak: 0.5 });
        },
        [SoundKind.Place]: (at) => {
            rustle({ at, seconds: 0.05, filter: 'bandpass', hz: 1400, peak: 0.6 });
            tone({ at, hz: 160, seconds: 0.06, wave: 'sine', peak: 0.25 });
        },
        [SoundKind.Flip]: (at) => {
            rustle({ at, seconds: 0.04, filter: 'highpass', hz: 3500, peak: 0.4 });
            tone({ at, hz: 700, toHz: 1100, seconds: 0.07, wave: 'triangle', peak: 0.12 });
        },
        [SoundKind.SnapBack]: (at) => {
            tone({ at, hz: 340, toHz: 220, seconds: 0.14, wave: 'triangle', peak: 0.18 });
            rustle({ at, seconds: 0.06, filter: 'bandpass', hz: 900, peak: 0.25 });
        },
        [SoundKind.Recycle]: (at) => {
            rustle({ at, seconds: 0.28, filter: 'bandpass', hz: 600, toHz: 2400, peak: 0.45 });
        },
        [SoundKind.Foundation]: (at) => {
            tone({ at, hz: 784, seconds: 0.16, wave: 'sine', peak: 0.22 });
            tone({ at: at + 0.03, hz: 1175, seconds: 0.2, wave: 'sine', peak: 0.12 });
        },
        // A quick ripple of card ticks, scheduled at once — one sound, not 52.
        [SoundKind.Deal]: (at) => {
            Array.from({ length: DEAL_TICKS }, (_, i) => at + i * DEAL_SPACING_S).forEach((tick) => {
                rustle({ at: tick, seconds: 0.04, filter: 'bandpass', hz: 2200, peak: 0.35 });
            });
        },
        [SoundKind.Win]: (at) => {
            WIN_NOTES_HZ.forEach((hz, i) => {
                const isLast = i === WIN_NOTES_HZ.length - 1;
                tone({ at: at + i * WIN_SPACING_S, hz, seconds: isLast ? 0.5 : 0.22, wave: 'sine', peak: 0.22 });
            });
        },
    };

    return {
        play: (sound) => {
            recipeMap[sound](context.currentTime);
        },
        resume: () => context.resume(),
        isRunning: () => context.state === 'running',
    };
};
