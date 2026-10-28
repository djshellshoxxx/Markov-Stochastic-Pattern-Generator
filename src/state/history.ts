export class History<T> {
  past: T[] = [];
  future: T[] = [];
  lastKey = "";
  lastAt = -Infinity;
  record(before: T, after: T, key: string, at: number) {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    if (key !== this.lastKey || at - this.lastAt > 400 || !this.past.length) {
      this.past.push(before);
      if (this.past.length > 60) this.past.shift();
    }
    this.future = [];
    this.lastKey = key;
    this.lastAt = at;
    return true;
  }
  undo(current: T): T | undefined {
    const value = this.past.pop();
    if (value !== undefined) this.future.push(current);
    this.lastKey = "";
    return value;
  }
  redo(current: T): T | undefined {
    const value = this.future.pop();
    if (value !== undefined) this.past.push(current);
    this.lastKey = "";
    return value;
  }
}
