import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decrypt } from '../common/encryption';
import * as Docker from 'dockerode';
import * as simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WorkspaceService {
    private readonly logger = new Logger(WorkspaceService.name);
    private docker: Docker | null;
    private git: simpleGit.SimpleGit;

    constructor(private prisma: PrismaService) {
        this.docker = new Docker();
        this.git = simpleGit.default();
    }

    private isDockerUnavailableError(message: string): boolean {
        const normalized = message.toLowerCase();
        return (
            normalized.includes('docker') &&
            (normalized.includes('socket') ||
                normalized.includes('econnrefused') ||
                normalized.includes('enoent') ||
                normalized.includes('permission denied'))
        );
    }

    private async resolveUserId(userId?: string, userEmail?: string): Promise<string> {
        if (userId && userId.trim().length > 0) {
            return userId.trim();
        }

        const normalizedEmail = userEmail?.trim().toLowerCase();
        if (!normalizedEmail) {
            throw new NotFoundException('User identity is required');
        }

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new NotFoundException('User not found for provided email');
        }
        return user.id;
    }

    async createWorkspace(userId: string | undefined, repoId: string, repoName: string, cloneUrl: string, userEmail?: string) {
        const resolvedUserId = await this.resolveUserId(userId, userEmail);

        // 1. Retrieve and Decrypt Token if user has linked GitHub account.
        const connection = await this.prisma.gitHubConnection.findUnique({ where: { userId: resolvedUserId } });
        const token = connection ? decrypt(connection.accessToken) : null;

        // 2. Prepare Host Directory
        const workspaceId = `ws-${Date.now()}`;
        // Using a temp path for now, in prod this should be a persistent volume
        const hostPath = path.resolve(process.cwd(), 'workspaces', resolvedUserId, repoName);

        if (!fs.existsSync(hostPath)) {
            fs.mkdirSync(hostPath, { recursive: true });
        }

        // 3. Clone repository.
        // For linked GitHub accounts we inject token to support private repositories.
        // For public repositories we allow plain clone URLs without requiring a saved connection.
        const cloneTargetUrl =
            token && cloneUrl.startsWith('https://')
                ? cloneUrl.replace('https://', `https://oauth2:${token}@`)
                : cloneUrl;

        try {
            if (!fs.existsSync(path.join(hostPath, '.git'))) {
                await this.git.clone(cloneTargetUrl, hostPath);
            } else {
                // Already exists, maybe pull?
                await simpleGit.default(hostPath).pull();
            }
        } catch (e) {
            throw new InternalServerErrorException(`Failed to clone repository: ${e.message}`);
        }

        const dockerWorkspacesEnabled = process.env.ENABLE_DOCKER_WORKSPACES !== 'false';
        if (!dockerWorkspacesEnabled) {
            return this.prisma.workspace.create({
                data: {
                    userId: resolvedUserId,
                    name: repoName,
                    repoUrl: cloneUrl,
                    repoId: repoId.toString(),
                    containerId: null,
                    status: 'STOPPED',
                    isGitLinked: true,
                },
            });
        }

        if (!this.docker) {
            throw new InternalServerErrorException('Docker client is not initialized');
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
                    ...(token ? [`GITHUB_TOKEN=${token}`] : []),
                    `GIT_AUTHOR_NAME=${connection?.username || 'deexen-user'}`,
                    `GIT_AUTHOR_EMAIL=${connection?.username || 'deexen-user'}@users.noreply.github.com`
                ],
            });

            await container.start();

            // 5. Save Workspace Metadata
            return this.prisma.workspace.create({
                data: {
                    userId: resolvedUserId,
                    name: repoName,
                    repoUrl: cloneUrl,
                    repoId: repoId.toString(),
                    containerId: container.id,
                    status: 'RUNNING',
                    isGitLinked: true,
                },
            });

        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (this.isDockerUnavailableError(message)) {
                this.logger.warn(
                    `Docker is unavailable (${message}). Falling back to metadata-only workspace mode.`,
                );
                return this.prisma.workspace.create({
                    data: {
                        userId: resolvedUserId,
                        name: repoName,
                        repoUrl: cloneUrl,
                        repoId: repoId.toString(),
                        containerId: null,
                        status: 'STOPPED',
                        isGitLinked: true,
                    },
                });
            }

            throw new InternalServerErrorException(`Failed to provision container: ${message}`);
        }
    }

    async listWorkspaces(userId?: string, userEmail?: string) {
        const resolvedUserId = await this.resolveUserId(userId, userEmail);
        return this.prisma.workspace.findMany({ where: { userId: resolvedUserId } });
    }
}
