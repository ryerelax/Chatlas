# Chatlas

Chatlas is a mobile-first tourism Progressive Web Application for discovering attractions in Melaka.

The system allows users to browse, search, filter, and view attraction details. Future modules will include map exploration, Google authentication, reviews, social profiles, and community features.

## Technology Stack

- Next.js
- React
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- Google Identity Services
- Google Maps Platform
- Cloudinary

## System Architecture

Chatlas uses a layered architecture within one Next.js application:

- **Presentation Layer:** React components and pages
- **Business Logic Layer:** Services and Next.js Route Handlers
- **Data Access Layer:** Repositories and Mongoose models
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
- Open attraction location in Google Maps
- Responsive header and navigation bar
- Sign in with Google and edit the signed-in user profile
- Browse and search public traveller profiles as a guest or registered user
- View public traveller profile information without exposing private identity fields
- Registered-only exploration map and comparison surfaces, ready for Exploration Map data integration
- Public review surfaces, ready for Review & Community data integration

<!-- TODO: Update this list whenever a new module or feature is completed. -->

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── attractions/
│   ├── attractions/
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
├── lib/
├── models/
├── repositories/
└── services/
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

Displays the attraction details page.

### `/profiles`

Displays the searchable public traveller directory. This route is available to guests and registered users.

### `/profiles/[id]`

Displays another traveller's public profile with Overview, Reviews, Exploration map, and Compare tabs. Reviews are public; exploration maps and comparison require Google sign-in.

### `/api/profiles`

Returns paginated public profiles. Supports `search` and `page` query parameters and never returns email addresses or Google IDs.

### `/api/profiles/[id]`

Returns one public profile by MongoDB ObjectId.

### `/api/profiles/[id]/reviews`

Returns public reviews after the Review & Community module publishes its data service. It currently returns a precise dependency-unavailable response.

### `/api/profiles/[id]/exploration`

Registered-user endpoint for another traveller's public exploration data. It currently returns a precise dependency-unavailable response.

### `/api/profiles/[id]/comparison`

Registered-user endpoint for progress and visited-attraction comparison. It currently returns a precise dependency-unavailable response.

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

<!-- TODO: Add coding conventions, pull request rules, and branch naming rules after the team confirms them. -->

## Planned Improvements

- Reviews and ratings
- Review & Community integration with public profiles
- Exploration Map visit-data integration with public profiles and comparisons
- Community features defined by the approved SRS
- Final Chatlas branding and responsive design

<!-- TODO: Replace this section with the final development roadmap when the team confirms module priorities. -->

// TODO: Install additional dependencies when Google authentication,
// Google Maps, Cloudinary, and PWA features are implemented.
