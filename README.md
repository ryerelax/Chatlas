# Chatlas

Chatlas is a mobile-first tourism Progressive Web Application for discovering attractions in Melaka.

The system allows users to browse, search, filter, view attraction details, and explore attractions on a map. Signed-in users can also submit reviews, ratings, and verified visit photos; future modules include social profiles and community features.

## Technology Stack

- Next.js
- React
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- Auth.js v5 with Google sign-in
- Google Maps Platform
- Cloudinary

## System Architecture

Chatlas uses a layered architecture within one Next.js application:

- **Presentation Layer:** App Router pages and Route Handlers, React components, and browser-only helpers
- **Business Logic Layer:** Services that validate input and apply business rules
- **Data Access Layer:** Repositories and Mongoose models
- **Shared Infrastructure:** MongoDB and external-service clients
- **Database:** MongoDB Atlas

The project is maintained as:

- One application
- One GitHub repository
- One deployment unit

## Current Features

- Display Melaka attractions from MongoDB Atlas
- Search attractions by name, address, or category
- Filter attractions by category
- Filter attractions by minimum rating
- Paginate attraction results (15 per page)
- Display attraction result count
- Reset search and filter criteria
- Display attraction details
- Read attraction reviews and submit signed-in ratings and reviews
- Open attraction location in Google Maps
- Explore supported attractions on an interactive map with visited markers, a Visited List, and progress
- Submit Verified Visit evidence from a live camera
- Sign in with Google and view or edit a user profile
- View Cloudinary-hosted attraction and public Verified Visit photos on attraction details pages
- Revisit previously viewed attraction content with PWA/offline support
- Responsive header and navigation bar

### Verified Visit

- Location is requested once with fresh, high-accuracy positioning; Chatlas does not continuously track the user. Reported GPS accuracy must be 30 metres or better, independently of the attraction's visit radius.
- The visit radius is resolved from the canonical attraction. A reviewed whole-metre override from 30–150 metres takes precedence; otherwise the normalized category default below applies, with a conservative 50-metre fallback for unknown categories.

| Radius | Categories |
| --- | --- |
| 30 m | Restaurant, Cafe, Food, Small Shop, Small Monument |
| 50 m | Museum, Historical, Cultural, Religious, Architecture, Gallery, Landmark, Tourist Attraction |
| 75 m | Entertainment, Market, Shopping Mall, Indoor Attraction, Recreation Centre, Waterfront |
| 100 m | Nature, Park, Garden, Beach, Zoo, Theme Park, Resort, Large Complex |
| 150 m | Tourism District, Heritage District, River Walk, Jonker Walk |

- The browser uses the resolved radius for nearby guidance, but it cannot submit or control the authoritative radius. The server reloads the canonical attraction before accepting evidence.
- Capture is live-camera-only, with one continuous camera session and one preview. **Retake** replaces the preview while reusing the same stream; **Upload Photo** sends the selected photo, and there is no gallery picker or pending-photo queue.
- A retry of the same selected photo reuses a private idempotency key scoped to the user and attraction across Malaysia dates, so even a retry after midnight cannot add the evidence twice or consume another date's capacity.
- New writes allow exactly one photo for each user, attraction, and Malaysia calendar date. Different attractions have independent capacity with no daily limit on how many different attractions can be verified; another Malaysia date gets a new one-photo allowance, earlier evidence is retained, and an attraction counts once across map markers, the Visited List, and progress regardless of its photo or date count.
- Legacy dated records containing two or three photos remain readable and owner-deletable without migration, deletion, or overwrite. Any existing photo makes that dated record's remaining capacity zero; deleting its final photo restores one slot.
- Existing Verified Visit and attraction records need no migration or backfill: legacy photo arrays remain compatible, and attractions without a radius override use the category/default radius rules.
- Reviews and Verified Visits are independent; creating, editing, or deleting a review does not change verified-visit status.
- Browser-reported GPS is validated but cannot provide hardware attestation; a modified client or spoofed device location remains a residual trust risk.

## Project Structure

```text
src/
├── app/                         # App Router pages, layouts, and API Route Handlers
├── auth.ts                     # Full Auth.js configuration
├── auth.config.ts              # Edge-safe Auth.js configuration
├── middleware.js               # Session-gated routing
├── presentation/
│   ├── components/             # Reusable React components
│   └── lib/                    # Browser-only presentation helpers
├── business/
│   └── services/               # Validation and business rules
├── data/
│   ├── models/                 # Mongoose schemas and models
│   └── repositories/           # MongoDB queries
└── infrastructure/
    ├── database/               # MongoDB connection helper
    └── external/               # Cloudinary and Google Places clients
```

## Environment Variables

Copy `.env.example` and create a new file named `.env.local`.

For Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

For macOS or Linux:

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
GOOGLE_PLACES_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Do not commit `.env.local` or expose passwords, secrets, or API keys.

## Getting Started

Install the project dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the following address in your browser:

```text
http://localhost:3000
```

## MongoDB Atlas Setup

Before running the attraction module:

1. Create or access the Chatlas MongoDB Atlas project.
2. Ensure the database contains the `attractions` collection.
3. Add your current IP address to the MongoDB Atlas IP Access List.
4. Place your MongoDB connection string in `.env.local`.

Example:

```env
MONGODB_URI=mongodb://username:password@host1:27017,host2:27017,host3:27017/chatlas?ssl=true&replicaSet=...
```

Never place the real database password inside `.env.example` or `README.md`.

## Available Routes

### `/`

Displays the attraction explorer.

### `/api/attractions`

Returns active Melaka attractions.

Supported query parameters:

- `search`
- `category`
- `minRating`
- `page` (defaults to `1`; 15 results per page)

Example:

```text
/api/attractions?category=Museum&minRating=4&page=2
```

### `/api/attractions/[id]`

Returns one attraction by MongoDB ObjectId.

- `400` if `id` is not a valid MongoDB ObjectId.
- `404` if `id` is valid but no matching active attraction exists.

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

## Git Workflow

Create or switch to your assigned feature branch before making changes:

```bash
git switch -c feature/your-feature-name
```

Check your changes:

```bash
git status
```

Stage and commit:

```bash
git add .
git commit -m "Describe the completed change"
```

Push the branch:

```bash
git push -u origin feature/your-feature-name
```

Do not commit directly to `main` unless instructed by the team leader.

## Development Notes

- Keep all frontend and backend logic inside this Next.js project.
- Do not create separate frontend and backend repositories.
- Use services for business logic.
- Use repositories for database access.
- Use Mongoose models for MongoDB collections.
- Keep secrets only in `.env.local`.
- The public Verified Visit photo response is currently unpaginated. Pagination requires a separately versioned API and product change before the collection grows large.

## Planned Improvements

- Registered-user attraction submission backed by Google Places
- Social profiles
- Community features
- Final Chatlas branding and responsive design

<!-- TODO: Replace this section with the final development roadmap when the team confirms module priorities. -->
