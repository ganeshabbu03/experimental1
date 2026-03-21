# Nebula IDE: GitHub Import System Documentation

## Overview
The GitHub Import System allows users to connect their GitHub account, list repositories, and provision Docker-based workspaces with the repository code pre-cloned.

## Architecture
See [Architecture Diagram](./architecture.md) for details.

## API Reference

### Authentication
- `GET /auth/github`: Initiates OAuth 2.0 flow.
- `GET /auth/github/callback`: Handle callback code.

### Repositories
- `GET /github/repos`: List accessible repositories.
  - Headers: `x-user-id` (Mock/JWT)

### Workspaces
- `GET /workspaces`: List user workspaces.
- `POST /workspaces/import`: Import a repository.
  - Body: `{ repoId, repoName, cloneUrl }`

## Setup

1. **Backend**:
   ```bash
   cd backend-node
   npm install
   npx prisma generate
   npm run start:dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database**:
   Run a PostgreSQL instance. Set `DATABASE_URL` in `.env`.

## Security Notes
- Tokens are encrypted at rest using AES-256-GCM.
- Workspaces run in isolated Docker containers.
- Resource limits are enforced (2GB RAM, 1 CPU).

## Troubleshooting
- **OAuth Failures**: Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Ensure callback URL is registered in GitHub.
- **Docker Errors**: Ensure Docker daemon is running and the backend has permissions to access the socket.
