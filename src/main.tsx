import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { generateSeed } from './utils/generate-seed.ts';
import { getElementById } from './utils/get-element-by-id.ts';
import { seedFromSearch } from './utils/seed-source.utils.ts';

import './styles/global.scss';

const root = getElementById('root');

if (root === undefined) {
    throw new Error('main: root element not found — check index.html has <div id="root">');
}

// ?seed= replays a deal; otherwise the first deal is random like every later one.
const monotonicNow = (): number => performance.now();

const firstSeed = seedFromSearch(window.location.search) ?? generateSeed();

createRoot(root).render(
    <StrictMode>
        <App firstSeed={firstSeed} seedSource={generateSeed} now={monotonicNow} />
    </StrictMode>,
);
