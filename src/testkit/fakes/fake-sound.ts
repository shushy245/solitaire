import { SoundKind } from '~/app/sound/sound.utils.ts';
import { SoundPlayer, SoundVoice } from '~/app/sound/sound-player.port.ts';

// Remembers every sound asked of it, in order.
export class FakeSoundPlayer implements SoundPlayer {
    readonly played: SoundKind[] = [];

    play(sound: SoundKind): void {
        this.played.push(sound);
    }
}

// A voice that records what it sounds; its resume can be made to fail like a browser refusing audio.
export class FakeSoundVoice implements SoundVoice {
    readonly played: SoundKind[] = [];

    constructor(private readonly resumeOutcome: 'resumes' | 'refuses') {}

    play(sound: SoundKind): void {
        this.played.push(sound);
    }

    resume(): Promise<void> {
        return this.resumeOutcome === 'resumes' ? Promise.resolve() : Promise.reject(new Error('audio not allowed'));
    }
}
