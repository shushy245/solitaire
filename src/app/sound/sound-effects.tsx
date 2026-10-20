import { useEffect, useRef } from 'react';

import { useGame } from '../game-provider.tsx';
import { useSound } from './sound-provider.tsx';
import { soundForChange } from './sound.utils.ts';

// Listens to the game and plays the sound of each change. The session it last heard is remembered, so the
// game it opens with makes no sound and an effect run twice (StrictMode, a mute toggle) never repeats one.
export const SoundEffects = (): undefined => {
    const { session } = useGame();
    const { play } = useSound();
    const heard = useRef(session);

    useEffect(() => {
        const before = heard.current;
        heard.current = session;
        const sound = soundForChange({ before, after: session });

        if (sound !== undefined) play(sound);
    }, [session, play]);

    return undefined;
};
