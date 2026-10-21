import { SoundKind } from '~/app/sound/sound.utils.ts';
import { SoundPlayer, SoundVoice } from '~/app/sound/sound-player.port.ts';

// Remembers every sound asked of it, in order.
export class FakeSoundPlayer implements SoundPlayer {
    readonly played: SoundKind[] = [];

    play(sound: SoundKind): void {
        this.played.push(sound);
    }
}

export enum ResumeOutcome {
    Resumes = 'resumes',
    Refuses = 'refuses',
    // Neither resolves nor rejects — a browser waiting for a gesture it will accept.
    Waits = 'waits',
}

// A voice that records what it sounds. Each resume answers with the next outcome given (the last one repeats),
// like a browser that refuses audio on a touch press and allows it on the release.
export class FakeSoundVoice implements SoundVoice {
    readonly played: SoundKind[] = [];
    private resumes = 0;
    private running = false;

    constructor(private readonly outcomes: readonly ResumeOutcome[]) {}

    play(sound: SoundKind): void {
        if (this.running) this.played.push(sound);
    }

    resume(): Promise<void> {
        const outcome = this.outcomes[Math.min(this.resumes, this.outcomes.length - 1)] ?? ResumeOutcome.Resumes;
        this.resumes += 1;

        return resumeOutcomeMap[outcome]().then(() => {
            this.running = true;
        });
    }

    isRunning(): boolean {
        return this.running;
    }

    // What the browser does when the phone is locked.
    suspend(): void {
        this.running = false;
    }
}

const resumeOutcomeMap: Record<ResumeOutcome, () => Promise<void>> = {
    [ResumeOutcome.Resumes]: () => Promise.resolve(),
    [ResumeOutcome.Refuses]: () => Promise.reject(new Error('audio not allowed by this gesture')),
    [ResumeOutcome.Waits]: () => new Promise<void>(() => undefined),
};
