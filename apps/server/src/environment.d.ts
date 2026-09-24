export {};

// Here we declare the members of the process.env object, so that we
// can use them in our application code in a type-safe manner.
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            APP_ENV: string;
            VENDURE_SERVER_PORT: string;
            PORT: string;
            COOKIE_SECRET: string;
            SUPERADMIN_USERNAME: string;
            SUPERADMIN_PASSWORD: string;
            CORS_ORIGINS?: string;
            STOREFRONT_URL?: string;
            EMAIL_FROM_ADDRESS?: string;
            EMAIL_TRANSPORT?: string;
            M365_TENANT_ID?: string;
            M365_CLIENT_ID?: string;
            M365_CLIENT_SECRET?: string;
            M365_SENDER_MAILBOX?: string;
            NETSUITE_CUSTOMER_REFRESH_CRON?: string;
            NETSUITE_INVITATION_TTL_HOURS?: string;
            DB_HOST: string;
            DB_PORT: number;
            DB_NAME: string;
            DB_USERNAME: string;
            DB_PASSWORD: string;
            DB_SCHEMA: string;
        }
    }
}
