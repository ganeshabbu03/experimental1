import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) { }

    @Post('import')
    async importRepository(@Req() req, @Body() body: { repoId: string; repoName: string; cloneUrl: string }) {
        const userId = req.headers['x-user-id'] || 'test-user-id'; // Mock User ID
        return this.workspaceService.createWorkspace(userId, body.repoId, body.repoName, body.cloneUrl);
    }

    @Get()
    async listWorkspaces(@Req() req) {
        const userId = req.headers['x-user-id'] || 'test-user-id';
        return this.workspaceService.listWorkspaces(userId);
    }
}
