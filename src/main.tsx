import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { Logger } from './utils/logger.port.ts';
import { generateSeed } from './utils/generate-seed.ts';
import { isPageVisible } from './utils/is-page-visible.ts';
import { getElementById } from './utils/get-element-by-id.ts';
import { SoundProvider } from './app/sound/sound-provider.tsx';
import { MotionProvider } from './app/motion/motion-provider.tsx';
import { makeWebAudioVoice } from './app/sound/web-audio-voice.ts';
import { makeUnlockingPlayer } from './app/sound/unlocking-player.ts';
import { makeSessionStore } from './app/persistence/session-store.ts';
import { prefersReducedMotion } from './utils/prefers-reduced-motion.ts';
import { makeVisibleTabSave } from './app/persistence/visible-tab-save.ts';
import { makeBrowserKeyValueStore } from './utils/browser-key-value-store.ts';
import { makeSoundPreferenceStore } from './app/sound/sound-preference-store.ts';
import { dealFromSearch, searchWithoutSeed } from './utils/seed-source.utils.ts';

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

const browserStore = makeBrowserKeyValueStore({ storage: () => window.localStorage, logger });
const sessionStore = makeSessionStore({ store: browserStore, logger });
const saveSession = makeVisibleTabSave({ save: sessionStore.save, isPageVisible });
const soundPreference = makeSoundPreferenceStore({ store: browserStore, logger });

// Silent until the player first presses a pointer or key, as browsers require.
const soundPlayer = makeUnlockingPlayer({
    createVoice: () => makeWebAudioVoice(new AudioContext()),
    gestures: window,
    logger,
});

// ?seed= (with ?draw=3 for turn 3) replays a deal; otherwise the saved game resumes, or the first deal is random like every later one.
const initialSession = sessionStore.load({
    requestedDeal: dealFromSearch(window.location.search),
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
        <SoundProvider
            player={soundPlayer}
            initiallyMuted={soundPreference.loadMuted()}
            saveMuted={soundPreference.saveMuted}
        >
            <MotionProvider prefersReducedMotion={prefersReducedMotion}>
                <App
                    initialSession={initialSession}
                    saveSession={saveSession}
                    seedSource={generateSeed}
                    now={monotonicNow}
                />
            </MotionProvider>
        </SoundProvider>
    </StrictMode>,
);
