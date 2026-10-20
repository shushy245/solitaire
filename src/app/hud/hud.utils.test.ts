import { describe, expect, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';
import { aGameState } from '~/testkit/builders/index.ts';

import { makeSession, SessionPhase } from '../session/session.utils.ts';
import { canUndo, formatElapsed, isAutoCompleteOffered, needsConfirmationToLeave } from './hud.utils.ts';

const session = () => makeSession({ seed: 5, drawMode: DrawMode.One });

describe('formatElapsed', () => {
    it('shows minutes and zero-padded seconds, and hours once past the hour', () => {
        expect([0, 9_999, 61_000, 3_599_000, 3_661_000].map(formatElapsed)).toEqual([
            '0:00',
            '0:09',
            '1:01',
            '59:59',
            '1:01:01',
        ]);
    });
});

describe('needsConfirmationToLeave', () => {
    it('asks only when a game is under way and not yet won', () => {
        const fresh = session();
        const played = { ...fresh, game: { ...fresh.game, moves: 3 } };
        const won = { ...fresh, game: { ...aGameState().asWon().build(), moves: 120 } };

        expect(needsConfirmationToLeave(fresh)).toBe(false);
        expect(needsConfirmationToLeave(played)).toBe(true);
        expect(needsConfirmationToLeave(won)).toBe(false);
    });
});

describe('canUndo', () => {
    it('needs something to undo and no auto-complete running', () => {
        const fresh = session();
        const withHistory = { ...fresh, history: [fresh.game] };

        expect(canUndo(fresh)).toBe(false);
        expect(canUndo(withHistory)).toBe(true);
        expect(canUndo({ ...withHistory, phase: SessionPhase.AutoCompleting })).toBe(false);
    });
});

describe('isAutoCompleteOffered', () => {
    it('is offered when the game can finish itself and no sweep is running', () => {
        const ready = { ...session(), game: aGameState().asReadyToAutoComplete().build() };

        expect(isAutoCompleteOffered(session())).toBe(false);
        expect(isAutoCompleteOffered(ready)).toBe(true);
        expect(isAutoCompleteOffered({ ...ready, phase: SessionPhase.AutoCompleting })).toBe(false);
    });
});
