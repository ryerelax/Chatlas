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
- Display attraction result count
- Reset search and filter criteria
- Display attraction details
- Open attraction location in Google Maps
- Display the Personal Exploration Map with supported Melaka attraction markers
- Provide map loading, unavailable, empty, and text fallback states
- Responsive header and navigation bar

<!-- TODO: Update this list whenever a new module or feature is completed. -->

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── attractions/
│   ├── attractions/
│   ├── exploration-map/
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
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Do not commit `.env.local` or expose passwords, secrets, or API keys.

The Google Maps map ID is optional during local development because the map
uses Google's demo map ID when this value is empty. Configure a project map ID
before production deployment.

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

Example:

```text
/api/attractions?category=Museum&minRating=4
```

### `/api/attractions/[id]`

Returns one attraction by MongoDB ObjectId.

### `/attractions/[id]`

Displays the attraction details page.

### `/exploration-map`

Displays the Personal Exploration Map and supported Melaka attraction markers.
The page does not request the user's current location.

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

- Google authentication
- Visited-attraction highlighting and exploration progress
- Attraction images
- Reviews and ratings
- Social profiles
- Community features
- Cloudinary image storage
- PWA configuration
- Final Chatlas branding and responsive design

<!-- TODO: Replace this section with the final development roadmap when the team confirms module priorities. -->

// TODO: Install additional dependencies when Google authentication,
// Google Maps, Cloudinary, and PWA features are implemented.
