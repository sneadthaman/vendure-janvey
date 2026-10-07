import path from 'node:path';

interface RequiredValueOptions {
    minLength?: number;
    rejectedValues?: string[];
}

export function requireProductionValue(
    name: string,
    value: string | undefined,
    options: RequiredValueOptions = {},
): string {
    const normalized = value?.trim();
    if (!normalized) {
        throw new Error(`${name} is required when APP_ENV is not dev.`);
    }
    if (options.minLength && normalized.length < options.minLength) {
        throw new Error(`${name} must be at least ${options.minLength} characters in production.`);
    }
    if (options.rejectedValues?.some(candidate => candidate.toLowerCase() === normalized.toLowerCase())) {
        throw new Error(`${name} still contains an insecure placeholder value.`);
    }
    return normalized;
}

export function parseCorsOrigins(value: string | undefined, fallback: string[] = []): string[] {
    const configured = value?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
    const origins = configured.length > 0 ? configured : fallback;

    return [...new Set(origins.map(origin => {
        let parsed: URL;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
        }
        if (
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.username ||
            parsed.password ||
            parsed.pathname !== '/' ||
            parsed.search ||
            parsed.hash
        ) {
            throw new Error(`CORS_ORIGINS entries must be HTTP(S) origins without paths: ${origin}`);
        }
        return parsed.origin;
    }))];
}

export function requireAbsoluteProductionPath(name: string, value: string | undefined): string {
    const normalized = requireProductionValue(name, value);
    if (!path.isAbsolute(normalized)) {
        throw new Error(`${name} must be an absolute path in production.`);
    }
    return normalized;
}

export function requireHttpUrl(name: string, value: string | undefined): string {
    const normalized = requireProductionValue(name, value);
    let parsed: URL;
    try {
        parsed = new URL(normalized);
    } catch {
        throw new Error(`${name} must be a valid HTTP(S) URL.`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error(`${name} must be a valid HTTP(S) URL without credentials.`);
    }
    return parsed.toString();
}
