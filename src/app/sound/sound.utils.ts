import { GameStateModel, isWon } from '~/engine/index.ts';

import { SessionModel } from '../session/session.utils.ts';

export enum SoundKind {
    Deal = 'deal',
    Draw = 'draw',
    Flip = 'flip',
    Place = 'place',
    SnapBack = 'snap-back',
    Recycle = 'recycle',
    Foundation = 'foundation',
    Win = 'win',
}

type ChangeModel = { readonly before: SessionModel; readonly after: SessionModel };

const isNewDeal = ({ before, after }: ChangeModel): boolean => after.dealNumber !== before.dealNumber;

const isJustWon = ({ before, after }: ChangeModel): boolean => isWon(after.game) && !isWon(before.game);

const isUndo = ({ before, after }: ChangeModel): boolean => after.history.length < before.history.length;

const faceUpTableauCount = (game: GameStateModel): number => game.tableau.flat().filter((card) => card.faceUp).length;

const tableauCount = (game: GameStateModel): number => game.tableau.flat().length;

// More cards face-up on the table than the move itself brought there: a hidden card was turned over.
const isReveal = ({ before, after }: ChangeModel): boolean =>
    faceUpTableauCount(after.game) - faceUpTableauCount(before.game) >
    tableauCount(after.game) - tableauCount(before.game);

const isRecycle = ({ before, after }: ChangeModel): boolean => after.game.recycles > before.game.recycles;

const isSentHome = ({ before, after }: ChangeModel): boolean =>
    after.game.foundations.flat().length > before.game.foundations.flat().length;

const isDraw = ({ before, after }: ChangeModel): boolean => after.game.stock.length < before.game.stock.length;

// The first rule that matches names the change's one sound — so a winning card plays the win, not the
// foundation sound as well, and a move that uncovers a card plays the flip.
const soundRules: readonly (readonly [(change: ChangeModel) => boolean, SoundKind])[] = [
    [isNewDeal, SoundKind.Deal],
    [isJustWon, SoundKind.Win],
    [isUndo, SoundKind.Place],
    [isReveal, SoundKind.Flip],
    [isRecycle, SoundKind.Recycle],
    [isSentHome, SoundKind.Foundation],
    [isDraw, SoundKind.Draw],
];

// The sound a change to the session makes; none when the game itself did not change (a clock tick, a rejected move).
export const soundForChange = (change: ChangeModel): SoundKind | undefined => {
    if (change.after.game === change.before.game && !isNewDeal(change)) return undefined;

    const rule = soundRules.find(([applies]) => applies(change));

    return rule === undefined ? SoundKind.Place : rule[1];
};
