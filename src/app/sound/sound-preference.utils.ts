import { z } from 'zod';

const SoundPreferenceSchema = z.object({ version: z.literal(1), muted: z.boolean() });

type SoundPreferenceDTO = z.infer<typeof SoundPreferenceSchema>;

export const serializeSoundPreference = ({ muted }: { muted: boolean }): string => {
    const saved: SoundPreferenceDTO = { version: 1, muted };

    return JSON.stringify(saved);
};

const parseJson = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

// localStorage is an external boundary: sound is on unless a readable save says it was turned off.
export const parseSoundPreference = (raw: string | undefined): { muted: boolean; isCorrupt: boolean } => {
    if (raw === undefined) return { muted: false, isCorrupt: false };

    const parsed = SoundPreferenceSchema.safeParse(parseJson(raw));

    return parsed.success ? { muted: parsed.data.muted, isCorrupt: false } : { muted: false, isCorrupt: true };
};
