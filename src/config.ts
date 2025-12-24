import 'dotenv/config';

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:1212123Minh@localhost:5432/Billiard',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    isProduction: process.env.NODE_ENV === 'production',
};
