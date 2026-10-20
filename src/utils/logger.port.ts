// Diagnostics for things that went wrong without stopping the game; the console in the app.
export type Logger = {
    warn: (message: string, context: Record<string, unknown>) => void;
};
