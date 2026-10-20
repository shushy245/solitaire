// A Web Storage that refuses every call, as browsers do when site data is blocked or the quota is full.
export class UnavailableStorage implements Storage {
    get length(): number {
        throw new DOMException('storage is unavailable', 'SecurityError');
    }

    clear(): void {
        throw new DOMException('storage is unavailable', 'SecurityError');
    }

    getItem(_key: string): string | null {
        throw new DOMException('storage is unavailable', 'SecurityError');
    }

    key(_index: number): string | null {
        throw new DOMException('storage is unavailable', 'SecurityError');
    }

    removeItem(_key: string): void {
        throw new DOMException('storage is unavailable', 'SecurityError');
    }

    setItem(_key: string, _value: string): void {
        throw new DOMException('the quota has been exceeded', 'QuotaExceededError');
    }
}
