import { Logger } from '~/utils/logger.port.ts';

export type LoggedWarning = { readonly message: string; readonly context: Record<string, unknown> };

// Remembers every warning so a test can read what was reported.
export class FakeLogger implements Logger {
    readonly warnings: LoggedWarning[] = [];

    warn(message: string, context: Record<string, unknown>): void {
        this.warnings.push({ message, context });
    }
}
