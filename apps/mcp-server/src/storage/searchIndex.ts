import { tokenize } from "@threadline/engine-core";

export class SearchIndex {
  private index = new Map<string, Set<string>>();

  add(docId: string, texts: string[]): void {
    for (const text of texts) {
      if (!text) continue;
      for (const token of tokenize(text)) {
        let set = this.index.get(token);
        if (!set) {
          set = new Set();
          this.index.set(token, set);
        }
        set.add(docId);
      }
    }
  }

  remove(docId: string): void {
    for (const [, set] of this.index) {
      set.delete(docId);
    }
  }

  search(query: string, limit = 20): Array<{ id: string; score: number }> {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const scores = new Map<string, number>();
    for (const token of tokens) {
      const exact = this.index.get(token);
      if (exact) {
        for (const id of exact) {
          scores.set(id, (scores.get(id) ?? 0) + 1);
        }
      }
      // Prefix match
      for (const [key, set] of this.index) {
        if (key !== token && key.startsWith(token)) {
          for (const id of set) {
            scores.set(id, (scores.get(id) ?? 0) + 0.5);
          }
        }
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score: score / tokens.length }));
  }

  clear(): void {
    this.index.clear();
  }
}

export const globalSearchIndex = new SearchIndex();
