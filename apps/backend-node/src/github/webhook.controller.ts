import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { WorkspaceService } from '../workspace/workspace.service';
import * as crypto from 'crypto';

@Controller('webhooks/github')
export class WebhookController {
    constructor(private workspaceService: WorkspaceService) { }

    @Post()
    async handleWebhook(
        @Headers('x-hub-signature-256') signature: string,
        @Body() payload: any
    ) {
        // 1. Verify Signature
        // const secret = process.env.GITHUB_WEBHOOK_SECRET; 
        // if (!this.verifySignature(JSON.stringify(payload), signature, secret)) {
        //   throw new UnauthorizedException('Invalid signature');
        // }

        // 2. Handle Push Event
        if (payload.ref && payload.repository) {
            const repoId = payload.repository.id.toString();
            const branch = payload.ref.replace('refs/heads/', '');

            console.log(`Received push event for repo ${repoId} on branch ${branch}`);

            // Trigger sync for all workspaces linked to this repo
            // await this.workspaceService.syncRepo(repoId, branch);
        }

        return { status: 'ok' };
    }

    private verifySignature(payload: string, signature: string, secret: string) {
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(payload).digest('hex');
        return signature === digest;
    }
}
