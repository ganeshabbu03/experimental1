import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    console.log('[Bootstrap] Starting Application...');
    console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Bootstrap] Initial PORT env:', process.env.PORT);

    try {
        const app = await NestFactory.create(AppModule);
        
        // ... CORS and other middleware ...
        const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
        const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0);
        const allowedOrigins = Array.from(new Set([...localOrigins, ...configuredOrigins]));

        app.enableCors({
            origin: (origin, callback) => {
                if (!origin) {
                    callback(null, true);
                    return;
                }
                const isAllowedExplicitly = allowedOrigins.includes(origin);
                const isRailwayDomain = /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin);
                if (isAllowedExplicitly || isRailwayDomain) {
                    callback(null, true);
                    return;
                }
                callback(new Error(`CORS blocked origin: ${origin}`), false);
            },
            credentials: true,
        });
        
        app.useGlobalPipes(new ValidationPipe());

        const defaultPort = process.env.NODE_ENV === 'production' ? '8080' : '3000';
        const port = Number.parseInt(process.env.PORT || defaultPort, 10) || Number.parseInt(defaultPort);
        
        console.log(`[Bootstrap] Attempting to listen on port: ${port}`);
        await app.listen(port, '0.0.0.0');
        console.log(`[Bootstrap] Application is running on: ${await app.getUrl()}`);
    } catch (error) {
        console.error('[Bootstrap] Fatal error during startup:', error);
        process.exit(1);
    }
}
bootstrap();
