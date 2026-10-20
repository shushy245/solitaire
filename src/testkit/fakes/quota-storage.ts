import { MemoryStorage } from './memory-storage.ts';

// In-memory Web Storage that refuses any single value longer than its quota, as a full localStorage does.
export class QuotaStorage extends MemoryStorage {
    constructor(private readonly maxValueLength: number) {
        super();
    }

    override setItem(key: string, value: string): void {
        if (value.length > this.maxValueLength) {
            throw new DOMException(`value of ${value.length} exceeds ${this.maxValueLength}`, 'QuotaExceededError');
        }

        super.setItem(key, value);
    }
}
