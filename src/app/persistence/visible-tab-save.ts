import { SessionModel } from '../session/session.utils.ts';

// Only the tab the player can see writes the save: a background tab's clock ticks would otherwise write its old game
// over the one being played in another tab (last writer wins). A visible tab writes each change as it happens, so
// nothing is owed when it is hidden. The game and the record go through here together.
export const makeVisibleTabSave =
    ({
        save,
        isPageVisible,
    }: {
        save: (session: SessionModel) => void;
        isPageVisible: () => boolean;
    }): ((session: SessionModel) => void) =>
    (session) => {
        if (!isPageVisible()) return;

        save(session);
    };
