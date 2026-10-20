import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { SoundKind } from './sound.utils.ts';
import { SoundPlayer } from './sound-player.port.ts';

export type SoundContextValue = {
    // Plays unless the player has muted sound.
    play: (sound: SoundKind) => void;
    isMuted: boolean;
    toggleMute: () => void;
};

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
    saveMuted: (muted: boolean) => void;
    children: React.ReactNode;
}): JSX.Element => {
    const [isMuted, setMuted] = useState(initiallyMuted);

    const play = useCallback(
        (sound: SoundKind): void => {
            if (!isMuted) player.play(sound);
        },
        [isMuted, player],
    );

    const toggleMute = useCallback((): void => {
        const next = !isMuted;
        setMuted(next);
        saveMuted(next);
    }, [isMuted, saveMuted]);

    const value = useMemo(() => ({ play, isMuted, toggleMute }), [play, isMuted, toggleMute]);

    return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
};

export const useSound = (): SoundContextValue => {
    const value = useContext(SoundContext);

    if (value === undefined) throw new Error('useSound: no SoundProvider above this component');

    return value;
};
