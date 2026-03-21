import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubLogin() {
        // Initiates the OAuth flow
    }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    async githubLoginCallback(@Req() req) {
        // Redirect ensures the frontend receives the token or session
        // In a real app, you might issue a JWT here and redirect with it
        return {
            message: 'Authentication successful',
            user: req.user,
        };
    }
}
