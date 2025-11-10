export function nowIso(): string {
	return new Date().toISOString();
}

export function msSince(start: number): number {
	return Date.now() - start;
}


