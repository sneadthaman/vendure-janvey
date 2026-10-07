import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');
const vendureAssetUrl = process.env.NEXT_PUBLIC_VENDURE_ASSET_URL?.trim();
const vendureAssetPattern = vendureAssetUrl ? toRemotePattern(vendureAssetUrl) : undefined;

const nextConfig: NextConfig = {
    cacheComponents: true,
    images: {
        dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
        remotePatterns: [
            {
                hostname: 'readonlydemo.vendure.io',
            },
            {
                hostname: 'demo.vendure.io'
            },
            {
                hostname: 'localhost'
            },
            ...(vendureAssetPattern ? [vendureAssetPattern] : []),
        ],
    }
};

export default withNextIntl(nextConfig);

function toRemotePattern(value: string) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('NEXT_PUBLIC_VENDURE_ASSET_URL must be an HTTP(S) URL without credentials.');
    }
    const basePath = url.pathname.replace(/\/$/, '');
    return {
        protocol: url.protocol.slice(0, -1) as 'http' | 'https',
        hostname: url.hostname,
        port: url.port,
        pathname: `${basePath || ''}/**`,
    };
}
