import { describe, expect, it } from 'vitest';

import { SavedKind } from '../persistence/persistence.utils.ts';
import { parseSoundPreference, serializeSoundPreference } from './sound-preference.utils.ts';

describe('saved sound preference', () => {
    it('reads back the mute choice it saved', () => {
        expect(parseSoundPreference(serializeSoundPreference({ muted: true }))).toEqual({
            kind: SavedKind.Found,
            value: { muted: true },
        });
    });

    it('is missing when nothing was saved', () => {
        expect(parseSoundPreference(undefined)).toEqual({ kind: SavedKind.Missing });
    });

    it('is corrupt, with the reason, when what was saved cannot be read', () => {
        expect(parseSoundPreference('{"version":1,"muted":"yes"}')).toMatchObject({ kind: SavedKind.Corrupt });
        expect(parseSoundPreference('not json')).toMatchObject({
            kind: SavedKind.Corrupt,
            reason: expect.stringMatching(/JSON/),
        });
    });
});
