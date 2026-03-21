import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { encrypt } from '../common/encryption';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) { }

    async validateGitHubUser(profile: any, accessToken: string, refreshToken: string) {
        const { id, username, photos, emails } = profile;
        const email = emails && emails[0] ? emails[0].value : `${username}@github.placeholder`;
        const avatarUrl = photos && photos[0] ? photos[0].value : null;

        // 1. Upsert User
        let user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email,
                    name: username,
                    password: '', // No password for OAuth users
                },
            });
        }

        // 2. Upsert GitHubConnection
        const encryptedAccessToken = encrypt(accessToken);
        const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

        await this.prisma.gitHubConnection.upsert({
            where: { userId: user.id },
            update: {
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                username,
                avatarUrl,
                profileId: id,
            },
            create: {
                userId: user.id,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                username,
                avatarUrl,
                profileId: id,
            },
        });

        return user;
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({ where: { id } });
    }
}
