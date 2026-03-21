import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule'; // Assuming @nestjs/schedule is installed
import { PrismaService } from '../prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(
        private prisma: PrismaService,
        private workspaceService: WorkspaceService,
    ) { }

    // @Cron('0 */15 * * * *') // Every 15 minutes
    async handleCron() {
        this.logger.log('Starting scheduled repository sync...');

        // Logic: Find all workspaces with auto-sync enabled and pull changes
        // const workspaces = await this.prisma.workspace.findMany({ where: { isGitLinked: true } });
        // for (const ws of workspaces) {
        //   await this.workspaceService.syncWorkspace(ws.id);
        // }
    }
}
