import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { Logger } from './utils/logger.port.ts';
import { generateSeed } from './utils/generate-seed.ts';
import { getElementById } from './utils/get-element-by-id.ts';
import { MotionProvider } from './app/motion/motion-provider.tsx';
import { makeSessionStore } from './app/persistence/session-store.ts';
import { prefersReducedMotion } from './utils/prefers-reduced-motion.ts';
import { makeBrowserKeyValueStore } from './utils/browser-key-value-store.ts';
import { searchWithoutSeed, seedFromSearch } from './utils/seed-source.utils.ts';

import './styles/global.scss';

const root = getElementById('root');

if (root === undefined) {
    throw new Error('main: root element not found — check index.html has <div id="root">');
}

const logger: Logger = {
    warn: (message, context) => {
        console.warn(message, context);
    },
};

const monotonicNow = (): number => performance.now();

const sessionStore = makeSessionStore({
    store: makeBrowserKeyValueStore({ storage: () => window.localStorage, logger }),
    logger,
});

// ?seed= replays a deal; otherwise the saved game resumes, or the first deal is random like every later one.
const initialSession = sessionStore.load({
    seedParam: seedFromSearch(window.location.search),
    freshSeed: generateSeed,
});

// The seed is consumed: a reload resumes the replayed deal like any other game.
window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${searchWithoutSeed(window.location.search)}${window.location.hash}`,
);

createRoot(root).render(
    <StrictMode>
        <MotionProvider prefersReducedMotion={prefersReducedMotion}>
            <App
                initialSession={initialSession}
                saveSession={sessionStore.save}
                seedSource={generateSeed}
                now={monotonicNow}
            />
        </MotionProvider>
    </StrictMode>,
);
