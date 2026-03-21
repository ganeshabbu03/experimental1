import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decrypt } from '../common/encryption';

@Injectable()
export class GithubService {
    constructor(private prisma: PrismaService) { }

    async listRepositories(userId: string) {
        const connection = await this.prisma.gitHubConnection.findUnique({
            where: { userId },
        });

        if (!connection) {
            throw new UnauthorizedException('No GitHub connection found');
        }

        const accessToken = decrypt(connection.accessToken);

        const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.statusText}`);
        }

        const repos = await response.json();
        return repos.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            description: repo.description,
            default_branch: repo.default_branch,
        }));
    }
}
