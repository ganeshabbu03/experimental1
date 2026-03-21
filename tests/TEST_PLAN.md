# Test Plan: GitHub Import System

## 1. Unit Testing (Jest)
**Scope**: Services and Controllers.
**Mocking**:
- Mock `PrismaService` to avoid DB dependency.
- Mock `fetch` / `simple-git` / `dockerode`.

**Key Test Cases**:
- `AuthService`: Validate creation of User and encryption of tokens.
- `GithubService`: Verify handling of GitHub API errors (401, 403, 404).
- `WorkspaceService`: Verify Docker container configuration (Env vars, limits).

## 2. Integration Testing
**Scope**: API Endpoints with a Test DB.
**Tools**: Supertest + Jest.

**Scenarios**:
- Full OAuth flow (mocked GitHub response).
- `POST /workspaces/import`: Verify DB state after call.

## 3. End-to-End Testing (Cypress/Playwright)
**Scope**: Frontend + Backend + Docker (Staging).

**Flow**:
1. Login to Frontend.
2. Click "Import".
3. Mock GitHub OAuth redirect.
4. Select Repo from list.
5. Verify success message.
6. Verify "Open Workspace" button appears.

## 4. Security Testing
- **Static Analysis**: Run `npm audit` and `snyk`.
- **Token Leakage**: Verify API responses do NOT contain `accessToken`.
- **Isolation**: Try to access host filesystem from within a workspace container.

## 5. Performance Testing
- **Concurrency**: Simulate 10 users simultaneous imports.
- **Load**: Verify API response time < 200ms for Repo List.
