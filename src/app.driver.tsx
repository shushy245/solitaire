import { expect } from 'vitest';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';

import { App } from './app.tsx';
import { AppTestIds } from './app.utils.ts';
import { BoardTestIds } from './app/board/board.test-ids.ts';

const realNow = (): number => Date.now();

export type AppDriver = {
    given: { firstDeal: (seed: number) => void; laterDealsFrom: (seeds: readonly number[]) => void };
    when: { created: () => Promise<void>; createdInStrictMode: () => Promise<void> };
    assert: { titleShown: () => void; tableauTop: (args: { column: number; cardId: string }) => void };
};

export const makeAppDriver = (): AppDriver => {
    const scenario: { firstSeed: number; laterSeeds: number[] } = { firstSeed: 7, laterSeeds: [] };
    const seedSource = (): number => scenario.laterSeeds.shift() ?? 0;

    return {
        given: {
            firstDeal: (seed) => {
                scenario.firstSeed = seed;
            },
            laterDealsFrom: (seeds) => {
                scenario.laterSeeds = [...seeds];
            },
        },
        when: {
            created: async () => {
                render(<App firstSeed={scenario.firstSeed} seedSource={seedSource} now={realNow} />);
            },
            createdInStrictMode: async () => {
                render(
                    <StrictMode>
                        <App firstSeed={scenario.firstSeed} seedSource={seedSource} now={realNow} />
                    </StrictMode>,
                );
            },
        },
        assert: {
            titleShown: () => {
                expect(screen.getByTestId(AppTestIds.Title)).toHaveTextContent('Solitaire');
            },
            tableauTop: ({ column, cardId }) => {
                const card = screen.getByTestId(BoardTestIds.Card(cardId));
                expect(card).toHaveAttribute('data-pile', 'tableau');
                expect(card).toHaveAttribute('data-pile-index', String(column));
                expect(card).toHaveAttribute('data-face', 'up');
            },
        },
    };
};
