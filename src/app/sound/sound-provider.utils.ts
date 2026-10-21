import { SoundKind } from './sound.utils.ts';

export type SoundContextValue = {
    // Plays unless the player has muted sound — checked when it plays, however long ago it was handed out.
    play: (sound: SoundKind) => void;
    isMuted: boolean;
    toggleMute: () => void;
};
