# FileRunner API Examples

Practical examples for using the FileRunner API.

## Table of Contents

1. [Authentication](#authentication)
2. [Project Management](#project-management)
3. [File Operations](#file-operations)
4. [Folder Management](#folder-management)
5. [Advanced Use Cases](#advanced-use-cases)

## Authentication

### Register a New User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "role": "user",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

**Response:** Same as registration

### Get Current User

```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Project Management

### Create a Project

**Private Project:**
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My Private Files",
    "is_public": false
  }'
```

**Public Project:**
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Public CDN",
    "is_public": true
  }'
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Private Files",
  "api_key": "987fcdeb-51a2-43f1-b890-123456789abc",
  "is_public": false,
  "created_at": "2024-01-15T10:35:00Z"
}
```

### List All Projects

```bash
curl -X GET http://localhost:8000/api/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Private Files",
    "api_key": "987fcdeb-51a2-43f1-b890-123456789abc",
    "is_public": false,
    "created_at": "2024-01-15T10:35:00Z",
    "file_count": 42,
    "total_size": 15728640
  }
]
```

### Get Project Details

```bash
curl -X GET http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Project

```bash
curl -X PUT http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Updated Project Name",
    "is_public": true
  }'
```

### Regenerate API Key

```bash
curl -X POST http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000/regenerate-key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Delete Project

```bash
curl -X DELETE http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## File Operations

### Upload a File

**Simple Upload (Root):**
```bash
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -F "file=@/path/to/document.pdf"
```

**Upload to Folder:**
```bash
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -F "file=@/path/to/avatar.jpg" \
  -F "folder_path=users/avatars"
```

**Upload to Nested Folder:**
```bash
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -F "file=@/path/to/report.pdf" \
  -F "folder_path=company/hr/reports/2024"
```

**Response:**
```json
{
  "file_id": "789abcde-f012-3456-7890-abcdef123456",
  "original_name": "avatar.jpg",
  "size": 245760,
  "mime_type": "image/jpeg",
  "download_url": "/api/files/789abcde-f012-3456-7890-abcdef123456",
  "folder_path": "users/avatars"
}
```

### Download a File

**Public File:**
```bash
curl http://localhost:8000/api/files/789abcde-f012-3456-7890-abcdef123456 \
  --output downloaded-file.jpg
```

**Private File:**
```bash
curl http://localhost:8000/api/files/789abcde-f012-3456-7890-abcdef123456 \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  --output downloaded-file.jpg
```

### List Project Files

```bash
curl -X GET http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "id": "789abcde-f012-3456-7890-abcdef123456",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "folder_id": "456def78-9abc-0123-4567-89abcdef0123",
    "folder_path": "users/avatars",
    "original_name": "avatar.jpg",
    "size": 245760,
    "mime_type": "image/jpeg",
    "upload_date": "2024-01-15T11:00:00Z",
    "download_url": "/api/files/789abcde-f012-3456-7890-abcdef123456"
  }
]
```

### Delete a File

```bash
curl -X DELETE http://localhost:8000/api/files/789abcde-f012-3456-7890-abcdef123456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Folder Management

### Create a Folder

```bash
curl -X POST http://localhost:8000/api/folders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "path": "documents/invoices",
    "is_public": false
  }'
```

### List Project Folders

```bash
curl -X GET "http://localhost:8000/api/folders?project_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "id": "456def78-9abc-0123-4567-89abcdef0123",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "path": "documents/invoices",
    "is_public": false,
    "created_at": "2024-01-15T10:40:00Z",
    "file_count": 15,
    "total_size": 5242880
  }
]
```

### Update Folder Visibility

**Make Public:**
```bash
curl -X PUT http://localhost:8000/api/folders/456def78-9abc-0123-4567-89abcdef0123/visibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "is_public": true
  }'
```

**Make Private:**
```bash
curl -X PUT http://localhost:8000/api/folders/456def78-9abc-0123-4567-89abcdef0123/visibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "is_public": false
  }'
```

## Advanced Use Cases

### Scenario 1: User Avatar Management System

```bash
# 1. Create project for user avatars
PROJECT=$(curl -s -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"User Avatars","is_public":true}')

API_KEY=$(echo $PROJECT | jq -r '.api_key')

# 2. Upload avatar
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@user-123-avatar.jpg" \
  -F "folder_path=avatars/users"

# 3. File is now publicly accessible without API key
curl http://localhost:8000/api/files/FILE_ID -o avatar.jpg
```

### Scenario 2: Document Management with Privacy

```bash
# 1. Create private project
PROJECT=$(curl -s -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"HR Documents","is_public":false}')

API_KEY=$(echo $PROJECT | jq -r '.api_key')

# 2. Upload sensitive documents
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@employee-contract.pdf" \
  -F "folder_path=hr/contracts/2024"

# 3. Download requires API key
curl http://localhost:8000/api/files/FILE_ID \
  -H "X-API-Key: $API_KEY" \
  -o contract.pdf
```

### Scenario 3: Public CDN for Website Assets

```bash
# 1. Create public CDN project
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Website CDN","is_public":true}'

# 2. Upload CSS files
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@styles.css" \
  -F "folder_path=css"

# 3. Upload images
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@logo.png" \
  -F "folder_path=images/branding"

# 4. Upload JavaScript
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@app.js" \
  -F "folder_path=js"

# All files are publicly accessible
# Use in HTML: <link rel="stylesheet" href="http://cdn.example.com/api/files/FILE_ID">
```

### Scenario 4: Batch Upload Script

```bash
#!/bin/bash

API_KEY="your-api-key"
BASE_URL="http://localhost:8000"
FOLDER="batch-upload/$(date +%Y-%m-%d)"

# Upload all files in a directory
for file in /path/to/files/*; do
    echo "Uploading: $file"
    curl -X POST $BASE_URL/api/upload \
      -H "X-API-Key: $API_KEY" \
      -F "file=@$file" \
      -F "folder_path=$FOLDER"
done
```

### Scenario 5: Image Gallery with Mixed Permissions

```bash
# Create project
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Photo Gallery","is_public":false}'

# Create public folder for thumbnails
curl -X POST http://localhost:8000/api/folders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "project_id": "PROJECT_ID",
    "path": "gallery/thumbnails",
    "is_public": true
  }'

# Upload thumbnail (will be public)
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@photo-thumb.jpg" \
  -F "folder_path=gallery/thumbnails"

# Upload full-size (will be private)
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@photo-full.jpg" \
  -F "folder_path=gallery/originals"

# Thumbnails are public, full images need API key
```

## JavaScript/TypeScript Examples

### Using Fetch API

```javascript
const API_URL = 'http://localhost:8000';
let token = null;
let apiKey = null;

// Login
async function login(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  token = data.token;
  return data;
}

// Create Project
async function createProject(name, isPublic = false) {
  const response = await fetch(`${API_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, is_public: isPublic })
  });
  const data = await response.json();
  apiKey = data.api_key;
  return data;
}

// Upload File
async function uploadFile(file, folderPath = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (folderPath) {
    formData.append('folder_path', folderPath);
  }

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData
  });
  return response.json();
}

// Download File
async function downloadFile(fileId) {
  const response = await fetch(`${API_URL}/api/files/${fileId}`, {
    headers: { 'X-API-Key': apiKey }
  });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Usage
await login('user@example.com', 'password123');
await createProject('My Files', false);
const fileInput = document.querySelector('input[type="file"]');
const result = await uploadFile(fileInput.files[0], 'uploads/images');
console.log('File uploaded:', result.download_url);
```

### React Hook Example

```typescript
import { useState } from 'react';

export function useFileRunner(baseUrl: string) {
  const [token, setToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setToken(data.token);
    return data;
  };

  const uploadFile = async (apiKey: string, file: File, folderPath?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderPath) formData.append('folder_path', folderPath);

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: formData
    });
    return res.json();
  };

  return { token, login, uploadFile };
}
```

## Python Examples

```python
import requests

class FileRunnerClient:
    def __init__(self, base_url='http://localhost:8000'):
        self.base_url = base_url
        self.token = None
        self.api_key = None

    def login(self, email, password):
        response = requests.post(
            f'{self.base_url}/api/auth/login',
            json={'email': email, 'password': password}
        )
        data = response.json()
        self.token = data['token']
        return data

    def create_project(self, name, is_public=False):
        response = requests.post(
            f'{self.base_url}/api/projects',
            json={'name': name, 'is_public': is_public},
            headers={'Authorization': f'Bearer {self.token}'}
        )
        data = response.json()
        self.api_key = data['api_key']
        return data

    def upload_file(self, file_path, folder_path=None):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {}
            if folder_path:
                data['folder_path'] = folder_path

            response = requests.post(
                f'{self.base_url}/api/upload',
                files=files,
                data=data,
                headers={'X-API-Key': self.api_key}
            )
        return response.json()

    def download_file(self, file_id, output_path):
        response = requests.get(
            f'{self.base_url}/api/files/{file_id}',
            headers={'X-API-Key': self.api_key}
        )
        with open(output_path, 'wb') as f:
            f.write(response.content)

# Usage
client = FileRunnerClient()
client.login('user@example.com', 'password123')
client.create_project('Python Files')
result = client.upload_file('document.pdf', 'documents/pdfs')
print(f"Uploaded: {result['download_url']}")
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

### Common HTTP Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Example Error Responses

**Invalid Credentials:**
```json
{
  "error": "Invalid credentials"
}
```

**Validation Error:**
```json
{
  "error": "Email already exists"
}
```

**Unauthorized:**
```json
{
  "error": "Invalid token"
}
```

**Not Found:**
```json
{
  "error": "Project not found"
}
```
