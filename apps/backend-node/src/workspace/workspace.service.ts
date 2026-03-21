import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decrypt } from '../common/encryption';
import * as Docker from 'dockerode';
import * as simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WorkspaceService {
    private docker: Docker;
    private git: simpleGit.SimpleGit;

    constructor(private prisma: PrismaService) {
        this.docker = new Docker();
        this.git = simpleGit.default();
    }

    async createWorkspace(userId: string, repoId: string, repoName: string, cloneUrl: string) {
        // 1. Retrieve and Decrypt Token
        const connection = await this.prisma.gitHubConnection.findUnique({ where: { userId } });
        if (!connection) throw new NotFoundException('GitHub connection not found');
        const token = decrypt(connection.accessToken);

        // 2. Prepare Host Directory
        const workspaceId = `ws-${Date.now()}`;
        // Using a temp path for now, in prod this should be a persistent volume
        const hostPath = path.resolve(process.cwd(), 'workspaces', userId, repoName);

        if (!fs.existsSync(hostPath)) {
            fs.mkdirSync(hostPath, { recursive: true });
        }

        // 3. Clone Repository with Token
        // Inject token into URL: https://oauth2:TOKEN@github.com/user/repo.git
        const authenticatedUrl = cloneUrl.replace('https://', `https://oauth2:${token}@`);

        try {
            if (!fs.existsSync(path.join(hostPath, '.git'))) {
                await this.git.clone(authenticatedUrl, hostPath);
            } else {
                // Already exists, maybe pull?
                await simpleGit.default(hostPath).pull();
            }
        } catch (e) {
            throw new InternalServerErrorException(`Failed to clone repository: ${e.message}`);
        }

        // 4. Create Docker Container
        try {
            const container = await this.docker.createContainer({
                Image: 'node:18-alpine', // Base image for workspace
                Cmd: ['tail', '-f', '/dev/null'], // Keep running
                Tty: true,
                HostConfig: {
                    Binds: [`${hostPath}:/workspace`], // Mount the cloned repo
                    Memory: 2 * 1024 * 1024 * 1024, // 2GB Limit
                    CpuShares: 1024, // 1 CPU
                },
                WorkingDir: '/workspace',
                Env: [
                    `GITHUB_TOKEN=${token}`,
                    `GIT_AUTHOR_NAME=${connection.username}`,
                    `GIT_AUTHOR_EMAIL=${connection.username}@users.noreply.github.com`
                ]
            });

            await container.start();

            // 5. Save Workspace Metadata
            const workspace = await this.prisma.workspace.create({
                data: {
                    userId,
                    name: repoName,
                    repoUrl: cloneUrl,
                    repoId: repoId.toString(),
                    containerId: container.id,
                    status: 'RUNNING',
                    isGitLinked: true,
                },
            });

            return workspace;

        } catch (e) {
            throw new InternalServerErrorException(`Failed to provision container: ${e.message}`);
        }
    }

    async listWorkspaces(userId: string) {
        return this.prisma.workspace.findMany({ where: { userId } });
    }
}
