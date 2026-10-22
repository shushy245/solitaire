import { describe, expect, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';
import { aGameState } from '~/testkit/builders/index.ts';

import { makeSession, SessionPhase } from '../session/session.utils.ts';
import {
    countLabel,
    formatElapsed,
    isAutoCompleteOffered,
    isUndoShortcut,
    leaveQuestion,
    needsConfirmationToLeave,
    openLeaveRequest,
} from './hud.utils.ts';

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

describe('isAutoCompleteOffered', () => {
    it('is offered when the game can finish itself and no sweep is running', () => {
        const ready = { ...session(), game: aGameState().asReadyToAutoComplete().build() };

        expect(isAutoCompleteOffered(session())).toBe(false);
        expect(isAutoCompleteOffered(ready)).toBe(true);
        expect(isAutoCompleteOffered({ ...ready, phase: SessionPhase.AutoCompleting })).toBe(false);
    });
});

describe('countLabel', () => {
    it('uses the singular for exactly one', () => {
        expect([0, 1, 2].map((count) => countLabel({ count, singular: 'move', plural: 'moves' }))).toEqual([
            'moves',
            'move',
            'moves',
        ]);
    });
});

describe('openLeaveRequest', () => {
    const played = () => {
        const fresh = session();

        return { ...fresh, game: { ...fresh.game, moves: 3 } };
    };
    const request = { drawMode: DrawMode.Three, dealNumber: 0 };

    it('stays open for the deal it was asked about while leaving still needs confirming', () => {
        expect(openLeaveRequest({ request, session: played() })).toEqual(request);
    });

    it('closes once leaving no longer needs confirming — everything undone, or the game won', () => {
        const won = { ...played(), game: { ...aGameState().asWon().build(), moves: 120 } };

        expect(openLeaveRequest({ request, session: session() })).toBeUndefined();
        expect(openLeaveRequest({ request, session: won })).toBeUndefined();
    });

    it('closes once its deal is replaced', () => {
        expect(openLeaveRequest({ request, session: { ...played(), dealNumber: 1 } })).toBeUndefined();
    });
});

describe('isUndoShortcut', () => {
    const press = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

    it('is Ctrl+Z or Cmd+Z, pressed once', () => {
        expect(isUndoShortcut(press({ key: 'z', ctrlKey: true }))).toBe(true);
        expect(isUndoShortcut(press({ key: 'Z', metaKey: true }))).toBe(true);
        expect(isUndoShortcut(press({ key: 'z', ctrlKey: true, repeat: true }))).toBe(false);
        expect(isUndoShortcut(press({ key: 'z' }))).toBe(false);
        expect(isUndoShortcut(press({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe(false);
    });

    it('finds the Z key on a non-Latin layout by its position', () => {
        expect(isUndoShortcut(press({ key: 'я', code: 'KeyZ', ctrlKey: true }))).toBe(true);
    });

    it('ignores AltGr (Ctrl+Alt), which types characters on some layouts', () => {
        expect(isUndoShortcut(press({ key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true }))).toBe(false);
    });
});

describe('leaveQuestion', () => {
    it('names the new mode when the request switches mode, and plainly asks otherwise', () => {
        expect(leaveQuestion({ requestedMode: DrawMode.Three, currentMode: DrawMode.One })).toBe(
            'Switch to Turn 3? This game will be lost.',
        );
        expect(leaveQuestion({ requestedMode: DrawMode.One, currentMode: DrawMode.One })).toBe(
            'Deal a new game? This one will be lost.',
        );
    });
});
