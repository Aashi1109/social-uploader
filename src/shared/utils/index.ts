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

/** Stringify JSON without additional options. */
export const jnstringify = (payload: any) => JSON.stringify(payload);
/** Parse a JSON string returning the typed value. */
export const jnparse = (payload: any) => JSON.parse(payload);

/**
 * Return a new object containing only the specified keys.
 */
export const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
) => {
  return keys.reduce(
    (acc, key) => {
      if (obj[key] !== undefined) {
        acc[key] = obj[key];
      }
      return acc;
    },
    {} as Pick<T, K>
  );
};

/**
 * Return a new object without the specified keys.
 */
export const omit = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
) => {
  const newObj = { ...obj };
  keys.forEach((key) => {
    delete newObj[key];
  });
  return newObj;
};

/** Check if a value is considered empty. */
export const isEmpty = (value: any) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

/** Deep merge multiple objects. */
export const merge = (...objects: any[]) => {
  const result: any = {};

  objects.forEach((obj) => {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        if (
          obj[key] &&
          typeof obj[key] === "object" &&
          !Array.isArray(obj[key])
        ) {
          result[key] = merge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      });
    }
  });

  return result;
};

/** Remove empty values from a query object. */
export const cleanQueryObject = (query: Record<string, any>) => {
  const cleanedQuery: any = {};
  Object.keys(query).forEach((key) => {
    if (query[key] !== undefined && query[key] !== "") {
      cleanedQuery[key] = query[key];
    }
  });
  return cleanedQuery;
};
