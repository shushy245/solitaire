// Dependency-free so the Cypress drivers can import it.
// Test IDs: the string value equals the access path.
export const BoardTestIds = {
    Board: 'BoardTestIds.Board',
    Stock: 'BoardTestIds.Stock',
    Placeholder: ({ pile, pileIndex }: { pile: string; pileIndex: number }): string =>
        `BoardTestIds.Placeholder.${pile}-${pileIndex}`,
    AnyCard: /^BoardTestIds\.Card\./,
    Card: (cardId: string): string => `BoardTestIds.Card.${cardId}`,
} as const;
