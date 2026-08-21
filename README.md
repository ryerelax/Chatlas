# Chatlas

Chatlas is a mobile-first tourism Progressive Web Application for discovering attractions and travel activity in Melaka.

The system is planned around six core modules:

- User Management
- Attraction Explorer
- Review & Community
- Exploration Map
- Social Profile
- Personal Collection

The current application includes working attraction discovery, Google authentication, reviews, exploration maps, Verified Visit photos, public Social Profiles, collection-related pages, and offline/PWA support. Some cross-module integration and final design work remains in progress.

## Technology Stack

- Next.js
- React
- JavaScript
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- ESLint
- Auth.js v5 with Google sign-in
- Google Maps JavaScript API
- Google Places API (New)
- Cloudinary

Google Maps is used for attraction and exploration-map displays. Google Places and Cloudinary support attraction data-maintenance workflows, while a service worker provides offline caching for supported routes and previously viewed content.

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
├── app/                          # Pages, layouts, loading UI, and API Route Handlers
├── auth.ts                      # Full Auth.js configuration
├── auth.config.ts               # Edge-safe Auth.js configuration
├── middleware.js                # Session-gated route protection
│
├── presentation/
│   ├── components/               # Reusable React components
│   ├── contexts/                 # Presentation state such as language selection
│   └── lib/                      # Browser-only helpers
│
├── business/
│   └── services/                 # Validation, business rules, and orchestration
│
├── data/
│   ├── models/                   # Mongoose schemas and models
│   └── repositories/             # MongoDB queries
│
└── infrastructure/
    ├── database/                 # Shared MongoDB connection helper
    └── external/                 # External-service clients
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

- Read Melaka attractions from MongoDB Atlas with pagination
- Search attractions by name, address, or category
- Filter attractions by category, location area, and minimum rating
- Display result counts and applied criteria
- Reset search and filter criteria
- Display attraction details, Cloudinary-hosted photos, and synced descriptions
- Display attraction locations with Google Maps
- Google sign-in with persisted user records
- Signed-in user profile view and editing
- Create, edit, and delete ratings and reviews, including review photos
- Display a personal exploration map and progress derived from distinct Verified Visits
- Verify nearby visits with one live-camera photo and server-side distance checks
- Display public Verified Visit photos on attraction detail pages
- Browse and search a public Traveller Directory as a guest or registered user
- Display public profiles without exposing email addresses or Google IDs
- Display public reviews with attraction links and available photos
- Let registered users view another traveller's exploration map
- Compare two travellers using one-decimal progress, separate maps, common visits, and unique visits
- Provide wishlist, favourites, photos, and travel-history pages
- Cache supported attraction pages, images, searches, and an offline fallback through the PWA service worker
- Provide shared responsive navigation with English, Chinese, and Malay labels

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
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
GOOGLE_PLACES_API_KEY=
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

Before running features that use MongoDB Atlas:

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

Returns active Melaka attractions with pagination.

Supported query parameters:

- `search`
- `category`
- `locationArea`
- `minRating`
- `page`

Example:

```text
/api/attractions?category=Museum&locationArea=Bandar%20Hilir&minRating=4&page=1
```

### `/api/attractions/[id]`

Returns one attraction by MongoDB ObjectId.

### `/attractions/[id]`

Displays attraction details, reviews, and the attraction's public Verified Visit photo gallery.

### `/attractions/[id]/location`

Displays the attraction on Google Maps.

### `/login`

Provides Google sign-in.

### `/profile` and `/profile/edit`

Display and edit the signed-in user's profile.

### `/exploration-map`

Displays the interactive attraction map, canonical visited state, progress, and the live-camera Verified Visit flow. The public photo gallery is rendered on attraction details pages, not on the exploration map itself.

### `GET /api/exploration-map/attractions`

Returns supported map attractions with their resolved effective verification radius.

### `GET /api/exploration-map/verified-visits`

Returns the signed-in user's distinct verified attraction IDs. An attraction appears once even when it has evidence from several retained photos or dates.

### `POST /api/exploration-map/verified-visits`

Accepts exactly one live-camera photo plus location evidence and returns one singular safe photo result. Identity, attraction, GPS accuracy, distance, per-attraction daily capacity, and canonical radius are validated server-side. Network and server failures retain the selected evidence for an idempotent retry; definitive client failures clear it, and a `409` displays the authoritative daily-limit message.

### `GET /api/exploration-map/verified-visits/capacity?attractionId=[id]`

Returns `dailyLimit: 1`, the actual dated photo count, and non-authoritative `remainingSlots` of `0` or `1` for that attraction on the current Malaysia calendar date. The camera preflight uses this response before requesting camera access.

### `GET /api/attractions/[id]/verified-photos`

Returns safe public verified-photo cards for an attraction.

### `DELETE /api/exploration-map/verified-visits/[visitId]/photos/[photoId]`

Deletes one photo owned by the signed-in user and removes its dated visit group when no photos remain.

### `/reviews`

Displays the signed-in user's review activity and review-management interface.

### `/profiles`

Displays the searchable public Traveller Directory. The signed-in user is excluded from their own directory results.

### `/profiles/[id]`

Displays a traveller's public profile and reviews. Registered users can also view the traveller's exploration map and compare both users' exploration progress. Each distinct reviewed attraction counts as one visited attraction.

### Collection routes

`/wishlist`, `/favourites`, `/photos`, and `/travel-history` provide the current personal-collection interfaces.

### Social Profile APIs

- `/api/profiles` — paginated public Traveller Directory
- `/api/profiles/[id]` — one display-safe public profile
- `/api/profiles/[id]/reviews` — public reviews
- `/api/profiles/[id]/exploration` — registered-user public exploration data
- `/api/profiles/[id]/comparison` — registered-user exploration comparison

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
npm test
npm run lint
npm run build
git status
```

Maintenance scripts are available for attraction photo sync, description sync, location-area classification, and address repair. Review the corresponding commands in `package.json` before running them because they update stored attraction data.

## Planned Improvements

- Complete and validate the registered-user Add Attraction submission workflow
- Resolve outstanding cross-module lint, test, and production-build integration issues
- Refine final Chatlas branding and visual consistency
- Continue responsive-layout and accessibility improvements
- Extend review, community, and personal-collection experiences as team requirements are confirmed

<!-- TODO: Update this roadmap whenever the team confirms a new priority. -->
