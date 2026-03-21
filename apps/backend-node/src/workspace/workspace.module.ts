import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [WorkspaceController],
    providers: [WorkspaceService, PrismaService],
})
export class WorkspaceModule { }
