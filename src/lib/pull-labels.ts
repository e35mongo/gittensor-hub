export interface PullLabel {
  name: string;
  color?: string | null;
  description?: string | null;
}

type RawLabel = string | { name?: string | null; color?: string | null; description?: string | null };

export function pullLabelsToJson(labels: readonly RawLabel[] | null | undefined): string {
  return JSON.stringify(
    (labels ?? [])
      .map((label) => {
        if (typeof label === 'string') return { name: label };
        return {
          name: label.name ?? '',
          color: label.color ?? '',
          description: label.description ?? null,
        };
      })
      .filter((label) => label.name.trim().length > 0),
  );
}

export function parsePullLabels(raw: string | null | undefined): PullLabel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((label): label is Record<string, unknown> => Boolean(label) && typeof label === 'object')
      .map((label) => ({
        name: typeof label.name === 'string' ? label.name : '',
        color: typeof label.color === 'string' ? label.color : null,
        description: typeof label.description === 'string' ? label.description : null,
      }))
      .filter((label) => label.name.trim().length > 0);
  } catch {
    return [];
  }
}
