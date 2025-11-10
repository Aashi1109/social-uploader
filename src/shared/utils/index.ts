/**
 * Converts a string to snake_case.
 */
export function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

/**
 * Converts a string to Start Case ("Hello World").
 */
export function startCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase to spaces
    .replace(/[_\-]+/g, " ") // snake/kebab to spaces
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\w\S*/g,
      (txt: string) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
}

export const createSearchParams = (
  params: Record<string, string | number | boolean | undefined>,
  keyFn?: (key: string) => string
) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(keyFn ? keyFn(key) : key, String(value));
  }
  return searchParams.toString();
};
