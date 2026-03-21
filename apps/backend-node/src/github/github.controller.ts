import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
// import { AuthGuard } from '@nestjs/passport'; // Assumed JWT guard exists in a real app, skipping for now or using mock

@Controller('github')
export class GithubController {
    constructor(private readonly githubService: GithubService) { }

    @Get('repos')
    // @UseGuards(JwtAuthGuard) // TODO: Implement JWT Guard
    async listRepos(@Req() req) {
        // Mocking user ID for now since we don't have the full JWT stack in this snippet
        // In production, get userId from req.user.id
        const userId = req.headers['x-user-id'] || 'test-user-id';
        return this.githubService.listRepositories(userId);
    }
}
