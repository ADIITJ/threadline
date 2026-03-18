export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

export function extractEntities(text: string): string[] {
  if (!text) return [];
  const entities: string[] = [];

  // GitHub-style issue/PR refs
  const issueRefs = text.match(/#\d{1,6}/g) ?? [];
  entities.push(...issueRefs);

  // Mentions
  const mentions = text.match(/@[\w-]{2,40}/g) ?? [];
  entities.push(...mentions);

  // URLs as entities
  const urls = text.match(/https?:\/\/[^\s"'<>]{4,100}/g) ?? [];
  entities.push(
    ...urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );

  return [...new Set(entities)].slice(0, 20);
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
