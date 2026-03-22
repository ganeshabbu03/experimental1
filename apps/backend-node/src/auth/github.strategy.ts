import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(
        private authService: AuthService,
        private configService: ConfigService,
    ) {
        const configuredCallback = configService.get<string>('GITHUB_CALLBACK_URL')?.trim();
        const appUrl = (configService.get<string>('APP_URL') || `http://localhost:${configService.get<string>('PORT') || '3000'}`)
            .replace(/\/+$/, '');
        const callbackURL = configuredCallback && configuredCallback.length > 0
            ? configuredCallback
            : `${appUrl}/auth/github/callback`;

        super({
            clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'test_client_id',
            clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'test_client_secret',
            callbackURL,
            scope: ['read:user', 'repo', 'workflow'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
        const user = await this.authService.validateGitHubUser(profile, accessToken, refreshToken);
        done(null, user);
    }
}
