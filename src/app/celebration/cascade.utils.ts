import { nextRandom, PileModel } from '~/engine/index.ts';

// The classic win cascade: cards leave the foundations one after another, fall under gravity, bounce along the
// bottom of the screen losing height each time, and are gone once they leave it sideways. Units: px and ms.

export type BoundsModel = {
    readonly width: number;
    readonly height: number;
    readonly cardWidth: number;
    readonly cardHeight: number;
};

export type PointModel = { readonly x: number; readonly y: number };

export type FlyingCardModel = {
    readonly cardId: string;
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
};

export type LaunchModel = { readonly cardId: string; readonly from: PointModel };

export type CascadeModel = {
    readonly waiting: readonly LaunchModel[];
    readonly flying: readonly FlyingCardModel[];
    readonly sinceLaunchMs: number;
    readonly seed: number;
};

const GRAVITY = 0.0025;
export const BOUNCE_DAMPING = 0.75;
export const LAUNCH_INTERVAL_MS = 250;
// A frame longer than this (the tab was in the background) is played as this long, so nothing tunnels.
export const MAX_FRAME_MS = 32;
const MIN_SIDE_SPEED = 0.15;
const SIDE_SPEED_RANGE = 0.3;
const MAX_UP_SPEED = 0.6;

const floorOf = (bounds: BoundsModel): number => bounds.height - bounds.cardHeight;

const isFallingThroughFloor = ({ y, vy, floor }: { y: number; vy: number; floor: number }): boolean =>
    y > floor && vy > 0;

export const stepCard = ({
    card,
    dtMs,
    bounds,
}: {
    card: FlyingCardModel;
    dtMs: number;
    bounds: BoundsModel;
}): FlyingCardModel => {
    const vy = card.vy + GRAVITY * dtMs;
    const y = card.y + vy * dtMs;
    const floor = floorOf(bounds);
    const x = card.x + card.vx * dtMs;

    return isFallingThroughFloor({ y, vy, floor })
        ? { ...card, x, y: floor, vy: -vy * BOUNCE_DAMPING }
        : { ...card, x, y, vy };
};

export const hasLeftScreen = ({ card, bounds }: { card: FlyingCardModel; bounds: BoundsModel }): boolean =>
    card.x > bounds.width || card.x + bounds.cardWidth < 0;

// Sideways at a random speed and direction, with a random small upward toss.
export const launchCard = ({
    launch,
    seed,
}: {
    launch: LaunchModel;
    seed: number;
}): { card: FlyingCardModel; seed: number } => {
    const side = nextRandom(seed);
    const speed = nextRandom(side.seed);
    const toss = nextRandom(speed.seed);
    const direction = side.value < 0.5 ? -1 : 1;

    return {
        card: {
            cardId: launch.cardId,
            x: launch.from.x,
            y: launch.from.y,
            vx: direction * (MIN_SIDE_SPEED + speed.value * SIDE_SPEED_RANGE),
            vy: -toss.value * MAX_UP_SPEED,
        },
        seed: toss.seed,
    };
};

// The top card of each foundation in turn — all four Kings, then the Queens, … down to the Aces.
export const launchOrder = (foundations: readonly PileModel[]): string[] => {
    const tallest = Math.max(0, ...foundations.map((pile) => pile.length));

    return Array.from({ length: tallest }, (_, fromTop) =>
        foundations.flatMap((pile) => {
            const card = pile[pile.length - 1 - fromTop];

            return card === undefined ? [] : [card.id];
        }),
    ).flat();
};

// The first card goes as soon as the cascade starts.
export const makeCascade = ({ launches, seed }: { launches: readonly LaunchModel[]; seed: number }): CascadeModel => ({
    waiting: launches,
    flying: [],
    sinceLaunchMs: LAUNCH_INTERVAL_MS,
    seed,
});

const isLaunchDue = (sinceLaunchMs: number): boolean => sinceLaunchMs >= LAUNCH_INTERVAL_MS;

// Physics runs on the clamped frame; the launch clock on real time, so a long pause still launches only one card.
export const stepCascade = ({
    cascade,
    dtMs,
    bounds,
}: {
    cascade: CascadeModel;
    dtMs: number;
    bounds: BoundsModel;
}): CascadeModel => {
    const frameMs = Math.min(dtMs, MAX_FRAME_MS);
    const flying = cascade.flying
        .map((card) => stepCard({ card, dtMs: frameMs, bounds }))
        .filter((card) => !hasLeftScreen({ card, bounds }));
    const sinceLaunchMs = cascade.sinceLaunchMs + dtMs;
    const [next, ...waiting] = cascade.waiting;

    if (next === undefined || !isLaunchDue(sinceLaunchMs)) return { ...cascade, flying, sinceLaunchMs };

    const launched = launchCard({ launch: next, seed: cascade.seed });

    return { waiting, flying: [...flying, launched.card], sinceLaunchMs: 0, seed: launched.seed };
};

export const isCascadeOver = (cascade: CascadeModel): boolean =>
    cascade.waiting.length === 0 && cascade.flying.length === 0;
