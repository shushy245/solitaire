import { expect } from 'vitest';

import { SessionModel } from '../session/session.utils.ts';
import { makeVisibleTabSave } from './visible-tab-save.ts';

export type VisibleTabSaveDriver = {
    given: { pageHidden: () => void };
    when: { pageShown: () => void; saved: (session: SessionModel) => void };
    assert: { written: (sessions: readonly SessionModel[]) => void };
};

export const makeVisibleTabSaveDriver = (): VisibleTabSaveDriver => {
    const written: SessionModel[] = [];
    const page = { isVisible: true };
    const save = makeVisibleTabSave({
        save: (session) => {
            written.push(session);
        },
        isPageVisible: () => page.isVisible,
    });

    return {
        given: {
            pageHidden: () => {
                page.isVisible = false;
            },
        },
        when: {
            pageShown: () => {
                page.isVisible = true;
            },
            saved: (session) => {
                save(session);
            },
        },
        assert: {
            written: (sessions) => {
                expect(written).toEqual(sessions);
            },
        },
    };
};
