import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import { getElementById } from './utils/get-element-by-id.ts';

import './styles/global.scss';

const root = getElementById('root');

if (root === undefined) {
    throw new Error('main: root element not found — check index.html has <div id="root">');
}

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
