import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GitHubStrategy } from './github.strategy';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../prisma.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        PassportModule,
        ConfigModule
    ],
    providers: [AuthService, GitHubStrategy, PrismaService],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
