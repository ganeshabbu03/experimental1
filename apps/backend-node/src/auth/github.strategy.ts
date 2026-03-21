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
        super({
            clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'test_client_id',
            clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'test_client_secret',
            callbackURL: 'http://localhost:3000/auth/github/callback',
            scope: ['read:user', 'repo', 'workflow'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
        const user = await this.authService.validateGitHubUser(profile, accessToken, refreshToken);
        done(null, user);
    }
}
