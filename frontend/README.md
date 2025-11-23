# FileRunner Frontend

Modern Next.js frontend for FileRunner file management platform.

## Features

- ✨ Clean, modern UI with Tailwind CSS
- 🔐 Authentication (login/register)
- 📁 Project management
- ☁️ File upload/download
- 📊 Project statistics
- 🌓 Dark mode ready
- 📱 Responsive design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- FileRunner backend running (see backend README)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Edit .env.local with your backend URL
# NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard pages
│   │   ├── projects/[id]/ # Project detail page
│   │   ├── layout.tsx     # Dashboard layout
│   │   └── page.tsx       # Projects list
│   ├── login/             # Login page
│   ├── register/          # Register page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # React Query provider
├── components/
│   └── ui/                # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── label.tsx
├── lib/
│   ├── api.ts             # API client & functions
│   ├── store.ts           # Zustand store
│   └── utils.ts           # Utility functions
├── hooks/                 # Custom React hooks
├── public/                # Static files
└── package.json
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

For production, update this to your backend URL.

## Features Overview

### Authentication

- User registration
- Login with email/password
- JWT token management
- Protected routes

### Dashboard

- View all projects
- Create new projects
- Project statistics (file count, total size)
- Public/private project visibility

### Project Management

- View project details
- Copy API key
- Regenerate API key
- Upload files with optional folder paths
- Download files
- Delete files
- File metadata (size, date, folder)

### API Integration

All API calls are handled through `lib/api.ts`:

- `authApi` - Authentication endpoints
- `projectsApi` - Project CRUD operations
- `filesApi` - File upload/download/delete
- `foldersApi` - Folder management

### State Management

Using Zustand for:
- Authentication state (token, user)
- LocalStorage persistence

Using TanStack Query for:
- Server state caching
- Automatic refetching
- Optimistic updates

## Development

### Code Organization

- **Pages**: App Router pages in `app/`
- **Components**: Reusable components in `components/`
- **API**: Centralized API client in `lib/api.ts`
- **Utils**: Helper functions in `lib/utils.ts`
- **Types**: TypeScript interfaces in `lib/api.ts`

### Adding New Features

1. **New Page**: Create in `app/[route]/page.tsx`
2. **New Component**: Add to `components/`
3. **New API Endpoint**: Add to `lib/api.ts`
4. **New Hook**: Add to `hooks/`

### Styling

Uses Tailwind CSS with custom design system variables:

- Primary color: Blue (#3B82F6)
- Responsive breakpoints: sm, md, lg, xl
- Dark mode: `dark:` prefix

## API Usage Examples

### Login

```typescript
import { authApi } from "@/lib/api";

const response = await authApi.login(email, password);
// response.data = { token, user }
```

### Create Project

```typescript
import { projectsApi } from "@/lib/api";

const response = await projectsApi.create("My Project", true);
// response.data = project object
```

### Upload File

```typescript
import { filesApi } from "@/lib/api";

await filesApi.upload(apiKey, file, "images/avatars");
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build
docker build -t filerunner-frontend .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://your-backend-url/api \
  filerunner-frontend
```

### Manual

```bash
npm run build
npm start
```

## Troubleshooting

### API Connection Issues

- Ensure backend is running on the correct port
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings in backend

### Authentication Issues

- Clear localStorage and try logging in again
- Check JWT token in browser DevTools > Application > Local Storage
- Verify backend JWT_SECRET matches

### File Upload Issues

- Check file size limits (backend: MAX_FILE_SIZE)
- Verify API key is correct
- Check browser console for errors

## Contributing

See main CONTRIBUTING.md in the root directory.

## License

MIT
