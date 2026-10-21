import { z } from 'zod';

import { parseSaved, SavedResult } from '../persistence/persistence.utils.ts';

const SoundPreferenceSchema = z.object({ version: z.literal(1), muted: z.boolean() });

type SoundPreferenceDTO = z.infer<typeof SoundPreferenceSchema>;

export type SoundPreferenceModel = { readonly muted: boolean };

export const serializeSoundPreference = ({ muted }: SoundPreferenceModel): string => {
    const saved: SoundPreferenceDTO = { version: 1, muted };

    return JSON.stringify(saved);
};

export const parseSoundPreference = (raw: string | undefined): SavedResult<SoundPreferenceModel> =>
    parseSaved({ raw, schema: SoundPreferenceSchema.transform(({ muted }) => ({ muted })) });
