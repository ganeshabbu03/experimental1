import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) { }

    @Post('import')
    async importRepository(@Req() req, @Body() body: { repoId: string; repoName: string; cloneUrl: string }) {
        const userIdHeader = req.headers['x-user-id'];
        const emailHeader = req.headers['x-user-email'];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
        const userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;
        return this.workspaceService.createWorkspace(userId, body.repoId, body.repoName, body.cloneUrl, userEmail);
    }

    @Get()
    async listWorkspaces(@Req() req) {
        const userIdHeader = req.headers['x-user-id'];
        const emailHeader = req.headers['x-user-email'];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
        const userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;
        return this.workspaceService.listWorkspaces(userId, userEmail);
    }
}
