# Chatlas

Chatlas is a mobile-first tourism Progressive Web Application for discovering attractions and travel activity in Melaka.

The system is planned around six core modules:

- User Management
- Attraction Explorer
- Review & Community
- Exploration Map
- Social Profile
- Personal Collection

The current implementation focuses on the initial project setup and Attraction Explorer prototype.

## Technology Stack

- Next.js
- React
- JavaScript
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- ESLint
- Google Identity Services
- Google Maps JavaScript API
- Google Places API
- Cloudinary

Google Identity, Maps, Places, Cloudinary, and full PWA support are planned integrations and may not yet be fully implemented.

## System Architecture

Chatlas uses a Layered Architecture with three distinctive logical layers inside one full-stack Next.js Progressive Web Application:

1. **Presentation Layer**
2. **Business Logic Layer**
3. **Data Access Layer**

The project also contains a supporting `infrastructure` folder for technical helpers such as database connections and external-service clients. Infrastructure is not a fourth logical business layer.

The dependency direction is:

```text
Presentation Layer
        ↓
Business Logic Layer
        ↓
Data Access Layer
        ↓
MongoDB Atlas
```

The current HTTP request flow is:

```text
Page or Component
        ↓
Next.js Route Handler
        ↓
Service
        ↓
Repository
        ↓
Mongoose Model
        ↓
MongoDB Atlas
```

The project is maintained as:

- One application
- One GitHub repository
- One deployment unit

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── attractions/
│   │       ├── route.js
│   │       └── [id]/
│   │           └── route.js
│   ├── attractions/
│   │   └── [id]/
│   │       └── page.js
│   ├── layout.js
│   ├── page.js
│   └── globals.css
│
├── presentation/
│   └── components/
│       ├── Header.js
│       ├── AttractionCard.js
│       └── AttractionList.js
│
├── business/
│   └── services/
│       └── attractionService.js
│
├── data/
│   ├── models/
│   │   └── Attraction.js
│   └── repositories/
│       └── attractionRepository.js
│
└── infrastructure/
    └── database/
        └── mongodb.js
```

### Folder Responsibilities

| Folder | Responsibility |
|---|---|
| `src/app/` | Next.js pages, layouts, Route Handlers, and route structure |
| `src/presentation/components/` | Reusable React user-interface components |
| `src/business/services/` | Validation, input normalization, and business rules |
| `src/data/models/` | Mongoose schemas and models |
| `src/data/repositories/` | MongoDB queries and data-access operations |
| `src/infrastructure/` | Database connections and reusable external-service helpers |

## Current Features

- Display Melaka attractions from MongoDB Atlas
- Browse a default attraction list
- Search attractions by name, address, or category
- Filter attractions by category
- Filter attractions by minimum rating
- Display the current result count and applied criteria
- Reset search and filter criteria
- Display loading, error, and no-result states
- Display attraction details
- Open an attraction location using its Google Maps link
- Shared responsive header and navigation

<!-- TODO: Update this list whenever a new module or feature is completed. -->

## Environment Variables

Copy `.env.example` and create a new file named `.env.local`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS or Linux:

```bash
cp .env.example .env.local
```

Fill in the required values inside `.env.local`:

```env
MONGODB_URI=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Only fill values required by the currently implemented features.

Never commit `.env.local` or expose passwords, secrets, private API keys, or database connection strings.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## MongoDB Atlas Setup

Before running the Attraction Explorer module:

1. Obtain access to the shared Chatlas MongoDB Atlas project.
2. Ensure the `chatlas` database contains the `attractions` collection.
3. Add the current network IP address to the MongoDB Atlas IP Access List.
4. Put the MongoDB connection string in `.env.local`.
5. Restart the development server after changing `.env.local`.

Example format only:

```env
MONGODB_URI=mongodb://username:password@host1:27017,host2:27017,host3:27017/chatlas?ssl=true&replicaSet=...
```

Never place the real database password inside `.env.example`, `README.md`, source code, screenshots, commits, or Pull Requests.

## Available Routes

### `/`

Displays the current homepage and attraction explorer.

### `/api/attractions`

Returns active Melaka attractions.

Supported query parameters:

- `search`
- `category`
- `minRating`

Example:

```text
/api/attractions?category=Museum&minRating=4
```

### `/api/attractions/[id]`

Returns one attraction by MongoDB ObjectId.

### `/attractions/[id]`

Displays the attraction details page.

## Development Guidelines

All Coding Standards, layered-architecture rules, Git Workflow, branch rules, Pull Request guidelines, security guidelines, and Definition of Done requirements are maintained in:

```text
AGENTS.md
```

Team members should read `AGENTS.md` before making major changes.

## Useful Commands

```bash
npm install
npm run dev
npm run lint
npm run build
git status
```

## Planned Improvements

- Google authentication
- Interactive attraction map
- Attraction photo previews and lightbox
- Review creation, ratings, editing, and deletion
- Personal exploration map and progress
- Social profiles and comparison features
- Wishlist, favourites, reviews, photos, and travel history
- Cloudinary image storage
- PWA Service Worker and offline caching
- Final Chatlas branding and responsive design

<!-- TODO: Update the roadmap when the team confirms implementation priorities. -->
<!-- TODO: Add additional dependencies only when the related authentication, Maps, Cloudinary, or PWA feature is implemented. -->
