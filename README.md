# AI Studio - Multi-Tenant ComfyUI Web Interface

A modern, mobile-first web application that provides a beautiful interface for ComfyUI workflows with multi-user support, authentication, and cloud storage.

## Features

### Core Functionality
- **Multi-user Support**: Complete user authentication and authorization via Supabase
- **Qwen Image Edit Workflow**: AI-powered image editing with dual-prompt support (main scene + close-up)
- **SeedVR2 Upscale Workflow**: High-quality image upscaling (2K/4K/8K)
- **Queue Management**: Track job status and processing queue in real-time
- **Admin Panel**: Manage users, jobs, images, and view platform statistics
- **Mobile App Design**: Responsive, mobile-first UI with smooth animations

### User Features
- User registration and login
- Credit-based system (100 credits per new user)
- Personal job history and image gallery
- Real-time job status polling
- Image download functionality
- Fullscreen image viewer
- Batch upscaling with progress tracking

### Admin Features
- View all users and manage roles (user/admin)
- Credit management for users
- Delete users
- View all jobs and images across the platform
- Platform statistics dashboard

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations and transitions
- **React Hooks** - State management

### Backend
- **Supabase** - Backend as a Service
  - Authentication (Email/Password)
  - PostgreSQL Database
  - Row Level Security (RLS)
  - Storage for user images
- **ComfyUI** - AI image generation backend (port 8188)

### Key Dependencies
```json
{
  "@supabase/auth-helpers-nextjs": "^0.10.0",
  "@supabase/ssr": "^0.7.0",
  "@supabase/supabase-js": "^2.82.0",
  "framer-motion": "^12.23.24",
  "next": "14.2.3",
  "react": "^18",
  "typescript": "^5"
}
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase

#### a. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key

#### b. Run the Database Schema
Execute the SQL schema file in your Supabase SQL Editor:
```bash
# File location: supabase/schema.sql
```

The schema will create:
- `profiles` table with user data and credits
- `jobs` table for tracking generation/upscale tasks
- `images` table for storing generated images
- Row Level Security (RLS) policies
- Automatic profile creation trigger
- Indexes for performance

#### c. Setup Storage Bucket
In Supabase Dashboard:
1. Go to Storage section
2. Create a new bucket named `user-images`
3. Set it to public
4. Apply the storage policies (commented in schema.sql)

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ComfyUI Configuration
COMFYUI_BASE_URL=http://127.0.0.1:8188
NEXT_PUBLIC_COMFYUI_BASE_URL=http://127.0.0.1:8188
```

### 4. Setup ComfyUI Backend

1. Install and run ComfyUI on port 8188:
```bash
# Follow ComfyUI installation instructions
# Ensure it's running on http://127.0.0.1:8188
```

2. Ensure you have the required models and nodes installed:
   - Qwen model for image editing
   - SeedVR2 model for upscaling

3. Place workflow JSON files in the `workflows/` directory:
   - `qwen-edit.json` - Qwen image editing workflow
   - `upscale.json` - SeedVR2 upscale workflow

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create an Admin User

After signing up, manually update your user role in Supabase:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```

## Database Schema

### Tables

#### `profiles`
Stores user profile information and credits.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, references auth.users |
| email | TEXT | User email (unique) |
| display_name | TEXT | User's display name |
| role | TEXT | User role (user/admin) |
| credits | INTEGER | Available credits (default: 100) |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

#### `jobs`
Tracks image generation and upscaling jobs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References profiles(id) |
| type | TEXT | Job type (generate/upscale) |
| status | TEXT | Status (queued/processing/completed/failed) |
| queue_position | INTEGER | Position in queue |
| prompt_id | TEXT | ComfyUI prompt ID |
| parameters | JSONB | Job parameters |
| error_message | TEXT | Error message if failed |
| created_at | TIMESTAMP | Job creation time |
| started_at | TIMESTAMP | Processing start time |
| completed_at | TIMESTAMP | Completion time |

#### `images`
Stores generated and upscaled images.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| job_id | UUID | References jobs(id) |
| user_id | UUID | References profiles(id) |
| filename | TEXT | Image filename |
| comfy_filename | TEXT | ComfyUI output filename |
| type | TEXT | Image type (generated/upscaled) |
| storage_path | TEXT | Supabase storage path |
| created_at | TIMESTAMP | Creation time |

### Row Level Security (RLS)

All tables have RLS enabled with policies for:
- Users can only view/modify their own data
- Admins can view/modify all data
- Automatic profile creation on user signup

## API Endpoints

### Public Endpoints

#### `POST /api/upload-image`
Upload an image to ComfyUI.
- **Body**: FormData with `image` file
- **Response**: `{ name: string }` - Uploaded filename

#### `GET /api/download-image?filename=<name>`
Download an image from ComfyUI.
- **Query**: `filename` - Image filename
- **Response**: Image file stream

### Authenticated Endpoints

#### `POST /api/qwen-edit/run`
Run the Qwen image edit workflow.
- **Body**: FormData with:
  - `prompt1` - Main scene prompt
  - `prompt2` - Close-up prompt
  - `steps` - Number of steps (default: 4)
  - `cfg` - CFG scale (default: 1)
  - `width` - Image width (default: 1920)
  - `height` - Image height (default: 1080)
  - `image1Name` - First input image filename
  - `image2Name` - Second input image filename
  - `image3Name` - Third input image filename (optional)
  - `image4Name` - Pose reference image filename (optional)
- **Response**: `{ prompt_id: string }`

#### `GET /api/qwen-edit/status?prompt_id=<id>`
Check the status of a queued job.
- **Query**: `prompt_id` - ComfyUI prompt ID
- **Response**:
```json
{
  "status": "queued|running|completed|failed",
  "completed": boolean,
  "images": ["filename1.png", "filename2.png"]
}
```

#### `POST /api/upscale/run`
Run the upscale workflow.
- **Body**: FormData with:
  - `imageName` - Image to upscale
  - `resolution` - Target resolution (2048/4096/8192)
  - `seed` - Random seed (default: 42)
- **Response**: `{ prompt_id: string }`

#### `GET /api/jobs`
Get user's jobs and images.
- **Response**:
```json
{
  "jobs": [{ /* job objects */ }],
  "images": [{ /* image objects */ }]
}
```

#### `GET /api/profile`
Get current user's profile.
- **Response**: `{ profile: { /* user profile */ } }`

### Admin Endpoints

#### `GET /api/admin/users`
Get all users.
- **Response**: `{ users: [{ /* user profiles */ }] }`

#### `PATCH /api/admin/users`
Update user credits or role.
- **Body**: `{ userId: string, credits?: number, role?: "user"|"admin" }`
- **Response**: `{ success: true }`

#### `DELETE /api/admin/users`
Delete a user.
- **Body**: `{ userId: string }`
- **Response**: `{ success: true }`

#### `GET /api/admin/jobs`
Get all jobs.
- **Response**: `{ jobs: [{ /* all jobs */ }] }`

#### `GET /api/admin/images`
Get all images.
- **Response**: `{ images: [{ /* all images */ }] }`

#### `GET /api/admin/stats`
Get platform statistics.
- **Response**:
```json
{
  "stats": {
    "totalUsers": number,
    "totalJobs": number,
    "completedJobs": number,
    "failedJobs": number,
    "totalImages": number,
    "successRate": string
  }
}
```

## Mobile App Design

### UI Philosophy

The interface is designed with a mobile-first approach, prioritizing:

1. **Touch-Friendly**: Large tap targets, swipe gestures, and intuitive interactions
2. **Visual Feedback**: Smooth animations using Framer Motion for all interactions
3. **Modern Aesthetics**: Gradient backgrounds, glassmorphism effects, rounded corners
4. **Bottom Navigation**: Easy thumb access with three main sections
5. **Card-Based Layout**: Content organized in digestible cards
6. **Progressive Disclosure**: Complex settings hidden in modals until needed

### Design Features

- **Gradient Headers**: Purple-to-pink gradient for visual appeal
- **Dark Theme**: Modern dark UI with gray-900 base and purple accents
- **Animation States**: Loading spinners, progress bars, and state transitions
- **Fullscreen Viewer**: Immersive image viewing experience
- **Modal Overlays**: Settings and actions in focused modal dialogs
- **Grid Layouts**: Responsive 2-column grid for images
- **Badge Notifications**: Visual indicators for image counts

### Navigation Structure

1. **Home Tab**:
   - Input form for generating images
   - Quick results preview
   - Loading states and error handling

2. **Gallery Tab**:
   - Grid view of all generated images
   - Upscale functionality
   - Individual image actions (download, fullscreen)

3. **Settings Tab**:
   - User preferences
   - Account management
   - (To be implemented)

## Project Structure

```
comfyuiweb/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── admin/               # Admin endpoints
│   │   │   ├── users/
│   │   │   ├── jobs/
│   │   │   ├── images/
│   │   │   └── stats/
│   │   ├── jobs/                # User job endpoints
│   │   ├── qwen-edit/           # Qwen workflow endpoints
│   │   │   ├── run/
│   │   │   └── status/
│   │   ├── upscale/             # Upscale workflow endpoints
│   │   ├── upload-image/        # Image upload
│   │   ├── download-image/      # Image download
│   │   └── profile/             # User profile
│   ├── dashboard/               # User dashboard page
│   ├── login/                   # Login page
│   ├── signup/                  # Signup page
│   ├── qwen-edit/              # Main Qwen edit interface
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── lib/                         # Utilities and libraries
│   ├── supabase/               # Supabase client configuration
│   │   ├── client.ts           # Browser client
│   │   └── server.ts           # Server client
│   └── types/                  # TypeScript types
│       └── database.ts         # Database type definitions
├── workflows/                   # ComfyUI workflow JSONs
│   ├── qwen-edit.json          # Qwen image edit workflow
│   └── upscale.json            # SeedVR2 upscale workflow
├── supabase/                    # Supabase configuration
│   └── schema.sql              # Database schema
├── .env.local                   # Environment variables (not in git)
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── README.md                   # This file
```

## Development Workflow

### Adding a New Workflow

1. Export your ComfyUI workflow as JSON
2. Place it in `workflows/` directory
3. Create API endpoints in `app/api/your-workflow/`
4. Create a frontend page in `app/your-workflow/`
5. Update types if needed

### Database Migrations

To modify the database schema:

1. Update `supabase/schema.sql`
2. Run the migration in Supabase SQL Editor
3. Update TypeScript types in `lib/types/database.ts`

## Production Deployment

### 1. Deploy to Vercel

```bash
npm run build
# Deploy to Vercel or your preferred platform
```

### 2. Environment Variables

Set all environment variables in your deployment platform.

### 3. ComfyUI Backend

Ensure ComfyUI is accessible from your production environment. Options:
- Self-hosted server
- Cloud GPU instance
- Docker container

### 4. Database

Your Supabase instance is already cloud-hosted and production-ready.

## Troubleshooting

### ComfyUI Connection Issues
- Verify ComfyUI is running on port 8188
- Check firewall settings
- Ensure COMFYUI_BASE_URL is correct

### Authentication Issues
- Verify Supabase environment variables
- Check RLS policies in Supabase dashboard
- Ensure profile was created automatically

### Image Upload Failures
- Check file size limits
- Verify ComfyUI /upload/image endpoint is working
- Check browser console for CORS errors

## License

This project is for educational and demonstration purposes.

## Credits

- Built with Next.js and Supabase
- AI workflows powered by ComfyUI
- UI animations by Framer Motion
