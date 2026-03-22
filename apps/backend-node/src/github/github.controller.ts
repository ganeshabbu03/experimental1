import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
// import { AuthGuard } from '@nestjs/passport'; // Assumed JWT guard exists in a real app, skipping for now or using mock

@Controller('github')
export class GithubController {
    constructor(private readonly githubService: GithubService) { }

    @Get('repos')
    // @UseGuards(JwtAuthGuard) // TODO: Implement JWT Guard
    async listRepos(@Req() req) {
        const userIdHeader = req.headers['x-user-id'];
        const emailHeader = req.headers['x-user-email'];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
        const userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;
        return this.githubService.listRepositories(userId, userEmail);
    }
}
