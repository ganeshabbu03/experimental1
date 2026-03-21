# Deexen API Endpoints Documentation

## Base URL
`http://localhost:8000`

## Authentication Endpoints

### Register User
- **Endpoint**: `POST /auth/register`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```
- **Response**: 
```json
{
  "access_token": "jwt_token_here",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "is_active": true,
    "created_at": "2026-01-17T..."
  }
}
```

### Login
- **Endpoint**: `POST /auth/login`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
- **Response**: Same as Register

### Logout
- **Endpoint**: `POST /auth/logout`
- **Auth**: Required (Bearer Token)
- **Response**:
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

### Get Current User
- **Endpoint**: `GET /auth/me`
- **Auth**: Required (Bearer Token)
- **Response**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "is_active": true,
  "created_at": "2026-01-17T..."
}
```

## Profile Endpoints

### Get Profile
- **Endpoint**: `GET /profile`
- **Auth**: Required (Bearer Token)
- **Response**: User object (same as `/auth/me`)

### Update Profile
- **Endpoint**: `PUT /profile`
- **Auth**: Required (Bearer Token)
- **Query Params**: `name=New Name`
- **Response**: Updated User object

## Projects Endpoints

### Create Project
- **Endpoint**: `POST /projects`
- **Auth**: Required (Bearer Token)
- **Body**:
```json
{
  "name": "My Project",
  "description": "Project description"
}
```
- **Response**:
```json
{
  "id": 1,
  "user_id": 1,
  "name": "My Project",
  "description": "Project description",
  "is_active": true,
  "created_at": "2026-01-17T...",
  "updated_at": "2026-01-17T..."
}
```

### List Projects
- **Endpoint**: `GET /projects`
- **Auth**: Required (Bearer Token)
- **Response**: Array of Project objects

### Get Project
- **Endpoint**: `GET /projects/{project_id}`
- **Auth**: Required (Bearer Token)
- **Response**: Single Project object

### Update Project
- **Endpoint**: `PUT /projects/{project_id}`
- **Auth**: Required (Bearer Token)
- **Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```
- **Response**: Updated Project object

### Delete Project
- **Endpoint**: `DELETE /projects/{project_id}`
- **Auth**: Required (Bearer Token)
- **Response**:
```json
{
  "success": true,
  "message": "Project deleted"
}
```

## Files Endpoints

### Create File/Folder
- **Endpoint**: `POST /projects/{project_id}/files`
- **Auth**: Required (Bearer Token)
- **Body**:
```json
{
  "name": "file.py",
  "file_type": "file",
  "parent_id": null,
  "content": "# Python code here"
}
```
- **Response**:
```json
{
  "id": 1,
  "project_id": 1,
  "parent_id": null,
  "name": "file.py",
  "file_type": "file",
  "content": "# Python code here",
  "is_active": true,
  "created_at": "2026-01-17T...",
  "updated_at": "2026-01-17T..."
}
```

### List Files
- **Endpoint**: `GET /projects/{project_id}/files`
- **Auth**: Required (Bearer Token)
- **Response**: Array of File objects

### Get File Tree
- **Endpoint**: `GET /projects/{project_id}/files/tree`
- **Auth**: Required (Bearer Token)
- **Response**: Hierarchical file tree structure

### Get File
- **Endpoint**: `GET /projects/{project_id}/files/{file_id}`
- **Auth**: Required (Bearer Token)
- **Response**: Single File object

### Update File
- **Endpoint**: `PUT /projects/{project_id}/files/{file_id}`
- **Auth**: Required (Bearer Token)
- **Body**:
```json
{
  "name": "updated_name.py",
  "content": "# Updated code"
}
```
- **Response**: Updated File object

### Delete File
- **Endpoint**: `DELETE /projects/{project_id}/files/{file_id}`
- **Auth**: Required (Bearer Token)
- **Response**:
```json
{
  "success": true,
  "message": "File deleted"
}
```

## Authentication

All endpoints marked with "Auth: Required" need a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Error Responses

```json
{
  "detail": "Error message here"
}
```

Common Status Codes:
- 200: Success
- 400: Bad Request (invalid input)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (account inactive)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error
