import { describe, expect, it } from 'vitest';

import { parseSoundPreference, serializeSoundPreference } from './sound-preference.utils.ts';

describe('saved sound preference', () => {
    it('reads back the mute choice it saved', () => {
        expect(parseSoundPreference(serializeSoundPreference({ muted: true }))).toEqual({
            muted: true,
            isCorrupt: false,
        });
        expect(parseSoundPreference(serializeSoundPreference({ muted: false }))).toEqual({
            muted: false,
            isCorrupt: false,
        });
    });

    it('has sound on when nothing was saved', () => {
        expect(parseSoundPreference(undefined)).toEqual({ muted: false, isCorrupt: false });
    });

    it('has sound on, and reports it, when what was saved cannot be read', () => {
        expect(parseSoundPreference('{"version":1,"muted":"yes"}')).toEqual({ muted: false, isCorrupt: true });
        expect(parseSoundPreference('not json')).toEqual({ muted: false, isCorrupt: true });
    });
});
