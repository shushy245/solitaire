import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { SoundKind } from './sound.utils.ts';
import { SoundPlayer } from './sound-player.port.ts';
import { SoundContextValue } from './sound-provider.utils.ts';

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

// Holds the mute choice (loaded and saved through the composition root) in front of the sound player.
export const SoundProvider = ({
    player,
    initiallyMuted,
    saveMuted,
    children,
}: {
    player: SoundPlayer;
    initiallyMuted: boolean;
    saveMuted: (preference: { muted: boolean }) => void;
    children: React.ReactNode;
}): JSX.Element => {
    const [isMuted, setMuted] = useState(initiallyMuted);
    // Read when a sound plays, so a play handle captured earlier (a drag in progress) still honours a later mute.
    const latestMuted = useRef(initiallyMuted);

    const play = useCallback(
        (sound: SoundKind): void => {
            if (!latestMuted.current) player.play(sound);
        },
        [player],
    );

    const toggleMute = useCallback((): void => {
        const muted = !latestMuted.current;
        latestMuted.current = muted;
        setMuted(muted);
        saveMuted({ muted });
    }, [saveMuted]);

    const value = useMemo(() => ({ play, isMuted, toggleMute }), [play, isMuted, toggleMute]);

    return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
};

export const useSound = (): SoundContextValue => {
    const value = useContext(SoundContext);

    if (value === undefined) throw new Error('useSound: no SoundProvider above this component');

    return value;
};
