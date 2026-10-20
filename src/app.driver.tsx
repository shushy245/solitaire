import { expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { App } from './app.tsx';
import { AppTestIds } from './app.utils.ts';

export type AppDriver = {
    when: { created: () => Promise<void> };
    assert: { titleShown: () => void };
};

export const makeAppDriver = (): AppDriver => ({
    when: {
        created: async () => {
            render(<App />);
        },
    },
    assert: {
        titleShown: () => {
            expect(screen.getByTestId(AppTestIds.Title)).toHaveTextContent('Solitaire');
        },
    },
});
