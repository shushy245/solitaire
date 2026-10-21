import { SoundKind } from './sound.utils.ts';

// Plays a sound for a card action. Never throws: where audio is unavailable or not yet allowed, it is silent.
export type SoundPlayer = { play: (sound: SoundKind) => void };

// One live audio output that can sound each kind (Web Audio in the app).
export type SoundVoice = {
    play: (sound: SoundKind) => void;
    // Browsers start audio suspended until a user gesture; resuming may be refused.
    resume: () => Promise<void>;
    // False once the browser suspends or interrupts audio (a locked phone, another app taking the speaker).
    isRunning: () => boolean;
};
