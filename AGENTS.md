<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Chatlas Development Guidelines

This file is the single source of truth for all Chatlas development guidelines.

Do not create separate Coding Standards, Git Workflow, Pull Request Guidelines, or Definition of Done documents. When the team confirms a new development rule, update this file instead.

---

## 1. Project Constraints

Chatlas must remain:

- One application
- One GitHub repository
- One deployment unit
- One full-stack Next.js project

Do not split Chatlas into separate frontend and backend repositories, servers, or deployment units.

All application pages, API routes, business logic, and database access must remain inside this Next.js project unless the team and lecturer formally approve a change.

---

## 2. Current Technology Stack

The current project uses:

- Next.js
- React
- JavaScript
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- ESLint

Planned external services include:

- Google Identity Services
- Google Maps Platform
- Cloudinary
- PWA-related packages and configuration

Install additional dependencies only when the related feature is being implemented.

Do not install packages only to make the dependency list appear more complete.

---

## 3. Architecture and Layered Project Structure

Chatlas uses a Layered Architecture with three logical layers:

1. Presentation Layer
2. Business Logic Layer
3. Data Access Layer

All three logical layers are implemented inside one full-stack Next.js Progressive Web Application. The `infrastructure/` folder contains supporting technical helpers; it is not a fourth logical business layer.

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

For HTTP-based interactions, the normal flow is:

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

Use the following structure:

```text
src/
├── app/                          # Route Handlers, pages, layouts (Next.js file conventions)
├── auth.ts                       # Auth.js v5 config (full, Node runtime)
├── auth.config.ts                # Auth.js v5 config (Edge-safe subset, used by middleware)
├── middleware.js                 # Next.js middleware (fixed location — framework-mandated)
│
├── presentation/
│   ├── components/                # Reusable React components
│   └── lib/                       # Client-side presentation helpers (e.g. browser script loaders)
│
├── business/
│   └── services/                  # Business logic, including one-off/CLI sync services
│
├── data/
│   ├── models/                    # Mongoose schemas and models
│   └── repositories/              # MongoDB queries
│
└── infrastructure/
    ├── database/                  # MongoDB connection helper
    └── external/                  # Third-party API clients (Cloudinary, Google Places API (New))
```

`src/app/`, `src/auth.ts`, `src/auth.config.ts`, and `src/middleware.js` stay exactly where Next.js/Auth.js require them — do not move these into a nested layer folder even though they implement Presentation/Business-adjacent behaviour.

### 3.1 Presentation Layer

Locations:

```text
src/app/
src/presentation/components/
src/presentation/lib/
```

Responsibilities:

- Pages
- Layouts
- Navigation
- Forms
- Client-side interaction
- Reusable React components
- Client-side helpers that only make sense in the browser (e.g. dynamically loading a third-party script for a component)
- Loading states
- Empty states
- Error states
- Responsive user interface

Rules:

- Do not query MongoDB directly from React components.
- Do not place Mongoose logic inside pages.
- Do not import repositories or Mongoose models into pages or components.
- Keep reusable interface elements inside `src/presentation/components/`.
- Keep route-specific pages and layouts inside `src/app/`.
- A file only belongs in `src/presentation/lib/` if it has no meaning outside the browser (e.g. it touches `window`/`document`, or is only ever imported by a `"use client"` component). If it also gets used by a script or server code, it belongs in Business Logic or Infrastructure instead.

### 3.2 Route Handlers / Application Entry Points

Location:

```text
src/app/api/
```

Responsibilities:

- Receive HTTP requests
- Read route parameters and query parameters
- Call Business Logic services
- Return JSON responses
- Apply suitable HTTP status codes

Rules:

- Route Handlers must call services.
- Route Handlers must not call repositories or Mongoose models directly.
- Route Handlers must not contain reusable business rules.
- Route Handlers are application entry points, not a separate logical layer.

### 3.3 Business Logic Layer

Location:

```text
src/business/services/
```

Responsibilities:

- Input normalization
- Validation
- Business rules
- Authentication and authorization rules
- Visibility rules
- Exploration progress calculation
- Classification / derivation rules (e.g. deriving a location zone from an address)
- Calling repository functions
- Preparing data for API routes or pages
- Coordinating external-service operations
- Orchestrating external API calls into a repository update (e.g. the Places → Cloudinary photo/description sync services), even when only invoked from a maintenance script under `scripts/`, not from a live Route Handler

Rules:

- Keep business rules out of React components.
- Keep business rules out of repositories.
- Services may call repositories.
- Repositories must not call services.
- Services must not contain JSX or UI styling.

### 3.4 Data Access Layer

Locations:

```text
src/data/repositories/
src/data/models/
```

Responsibilities:

- Mongoose schemas and models
- MongoDB queries
- Data retrieval, creation, updating, and deletion
- Database filtering and sorting
- Returning database results to services

Rules:

- Keep Mongoose models inside `src/data/models/`.
- Keep MongoDB queries inside `src/data/repositories/`.
- Pages and components must not call repositories or models directly.
- Route Handlers must not call repositories or models directly.
- Repositories must not contain presentation logic.
- Repositories must not contain reusable business-policy decisions.

### 3.5 Supporting Infrastructure

Locations:

```text
src/infrastructure/database/    # MongoDB connection helper
src/infrastructure/external/    # Third-party API clients (Cloudinary, Google Places API (New))
```

Responsibilities:

- MongoDB connection helper (`database/mongodb.js`)
- External service clients (`external/cloudinary.js`, `external/googlePlaces.js`)
- Shared configuration
- Server-side infrastructure code

Rules:

- Infrastructure supports the three logical layers.
- Infrastructure must not contain page-specific UI or module business rules.
- Private credentials must come from environment variables.
- A file belongs here only if it's server-side and has no business logic of its own — just a thin client/wrapper around an external system. Once it starts making business decisions (what to do with the data), that logic belongs in `src/business/services/`, which may call into `src/infrastructure/`.
- Client-side helpers (anything that runs in the browser) belong in `src/presentation/lib/` instead, not here.
- Keep each third-party integration's client under `src/infrastructure/external/`, not loose at the `src/infrastructure/` root, so the database helper and external API clients stay clearly separated.

---

## 4. Next.js Rules

- Use the App Router.
- Use `page.js` for pages.
- Use `layout.js` for shared layouts.
- Use `route.js` for Route Handlers.
- Dynamic route folders must use square brackets, for example `[id]`.
- Do not place `page.js` and `route.js` in the same route segment.
- Read the relevant local Next.js documentation in `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Follow deprecation notices and version-specific conventions.
- Do not assume older Next.js patterns are still valid.

Example:

```text
src/app/api/attractions/[id]/route.js
src/app/attractions/[id]/page.js
```

These are separate routes and must not be placed in the same folder.

---

## 5. Coding Standards

- Use JavaScript unless the team formally decides to migrate to TypeScript.
- Use functional React components.
- Use `async` and `await` for asynchronous operations.
- Use clear, descriptive names.
- Keep functions focused on one responsibility.
- Avoid duplicate code where a reusable function or component is appropriate.
- Keep components reasonably small and readable.
- Validate input before passing it to the data access layer.
- Handle loading, success, empty, and error states where relevant.
- Avoid unnecessary console output.
- Never log passwords, API keys, authentication tokens, or full database connection strings.
- Do not expose internal stack traces to users.
- Keep code formatting consistent with ESLint and the existing project style.

---

## 6. TODO Comment Rules

Add a clear `TODO` comment when a section still requires:

- Final design work
- Personalised styling
- Branding
- A future integration
- An unfinished business rule
- A placeholder replacement
- A later data improvement

Good examples:

```js
// TODO: Replace this placeholder with the final Chatlas logo.
```

```js
// TODO: Load the available categories dynamically from the database.
```

```js
// TODO: Integrate Google Identity Services.
```

```jsx
{/* TODO: Refine the spacing and colours based on the final Chatlas branding. */}
```

Avoid vague TODO comments such as:

```js
// TODO: Fix later.
```

A TODO comment must explain what remains to be done.

Remove a TODO comment after the related work is completed.

---

## 7. Naming Conventions

Use these naming conventions:

- React component names: `PascalCase`
- React component files: `PascalCase.js`
- Variables and functions: `camelCase`
- Service files: `camelCaseService.js`
- Repository files: `camelCaseRepository.js`
- Mongoose model files: `PascalCase.js`
- Route folders: lowercase
- Dynamic route folders: `[id]`
- Environment variables: `UPPER_SNAKE_CASE`

Examples:

```text
AttractionCard.js
AttractionList.js
attractionService.js
attractionRepository.js
Attraction.js
src/app/attractions/[id]/page.js
```

---

## 8. Import Rules

Use the configured `@/*` alias for project imports where practical.

Preferred:

```js
import Header from "@/presentation/components/Header";
import { getAttractions } from "@/business/services/attractionService";
import Attraction from "@/data/models/Attraction";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
```

Avoid unnecessarily long relative imports such as:

```js
import Attraction from "../../../models/Attraction";
```

Use relative imports only when they are clearer for files located very close together.

---

## 9. API Route Guidelines

Route Handlers should:

- Connect to the database through the shared database helper.
- Read and validate request input.
- Call the service layer.
- Return a consistent JSON structure.
- Use suitable HTTP status codes.
- Return safe public error messages.
- Avoid exposing secrets, stack traces, or internal database details.

Recommended success response:

```json
{
  "success": true,
  "data": {}
}
```

Recommended list response:

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

Recommended error response:

```json
{
  "success": false,
  "message": "A clear public error message."
}
```

Common status codes:

- `200` — successful request
- `201` — successful creation
- `400` — invalid input
- `401` — unauthenticated
- `403` — forbidden
- `404` — resource not found
- `409` — conflict
- `500` — unexpected server error

---

## 10. Database Guidelines

- Use MongoDB Atlas as the database.
- Use Mongoose models for collections.
- Keep MongoDB queries inside repositories.
- Keep business validation inside services.
- Keep database names and collection names consistent.
- Validate MongoDB ObjectIds before querying by `_id`.
- Do not hardcode database credentials.
- Do not expose connection strings in code, screenshots, commits, pull requests, or documentation.

Current attraction storage:

```text
Database: chatlas
Collection: attractions
```

---

## 11. Environment Variable Guidelines

Use `.env.local` for real local values.

Use `.env.example` only to show required variable names with empty values.

Expected variables currently include:

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

Rules:

- Never commit `.env.local`.
- Never put real secrets in `.env.example`.
- Never put real secrets in `README.md` or `AGENTS.md`.
- Never send real secrets in chat or screenshots.
- Only variables beginning with `NEXT_PUBLIC_` may be exposed to browser code.
- Do not use `NEXT_PUBLIC_` for passwords, private API keys, or server secrets.
- Update `.env.example` whenever a newly implemented feature requires a new environment variable.

The `.gitignore` should allow `.env.example` but ignore real environment files.

Recommended pattern:

```gitignore
.env*
!.env.example
```

---

## 12. Dependency Guidelines

Before installing a package:

- Confirm that the package is needed for an implemented feature.
- Check that it is compatible with the current Next.js and React versions.
- Prefer actively maintained packages.
- Avoid duplicate packages that solve the same problem.
- Update `package-lock.json` together with `package.json`.

Useful commands:

```bash
npm install
npm list --depth=0
npm audit
```

Do not run:

```bash
npm audit fix --force
```

unless the team has reviewed and approved the proposed breaking changes.

Audit warnings must be reviewed, but they do not justify blindly downgrading or replacing core packages.

---

## 13. Git Repository Collaboration

The Chatlas project must use one shared GitHub repository.

All six team members should be added as repository collaborators.

Each member should work on the branch assigned by the team leader.

A branch may temporarily contain work from more than one module when required for lecturer demonstrations or progress checking, provided the team is aware of it.

Do not create separate repositories for individual modules.

---

## 14. Branch Guidelines

Recommended branch prefixes:

```text
feature/
fix/
docs/
refactor/
chore/
```

Examples:

```text
feature/social-profile
feature/attraction-explorer
fix/attraction-api
docs/update-readme
refactor/attraction-service
```

Create a new branch:

```bash
git switch -c feature/your-feature-name
```

Switch to an existing branch:

```bash
git switch feature/your-feature-name
```

Do not commit directly to `main` unless the team leader explicitly instructs you to do so.

---

## 15. Commit Guidelines

Before committing:

```bash
git status
git diff
```

Stage changes:

```bash
git add .
```

Commit with a clear and specific message:

```bash
git commit -m "Add attraction details page"
```

Good commit messages:

```text
Add MongoDB attraction repository
Add attraction category filter
Fix attraction details route
Update Chatlas development guidelines
```

Avoid vague commit messages:

```text
update
changes
fix
final
done
```

Each commit should represent one logical group of changes where practical.

Do not commit:

- `.env.local`
- Passwords
- API keys
- Database connection strings
- Authentication tokens
- Temporary files
- Unnecessary generated files
- Build output
- Editor-specific files that the team does not need

---

## 16. Push Guidelines

Push the assigned branch:

```bash
git push -u origin feature/your-feature-name
```

For later pushes:

```bash
git push
```

Before pushing:

- Confirm the correct branch is active.
- Confirm no secrets are staged.
- Confirm the application still runs.
- Review `git status`.

---

## 17. Pull Request Guidelines

When merging a feature branch into the main project, create the pull request using:

```text
base: main
compare: feature/your-feature-name
```

The intended direction is:

```text
main ← feature branch
```

Do not reverse the base and compare branches.

Before creating a pull request:

- Confirm the feature works locally.
- Confirm no secrets are included.
- Review `git status`.
- Review `git diff`.
- Run lint.
- Run the production build.
- Push the latest branch changes.
- Summarise what was added or changed.
- Mention known limitations.
- Mention remaining TODO items.
- Add screenshots for visible user interface changes where useful.

Do not merge your own pull request unless the team workflow allows it.

---

## 18. Definition of Done

A task is considered done only when all relevant conditions below are satisfied:

- The requested feature or change is implemented.
- The feature works locally.
- The code follows the three-layer architecture.
- Pages and reusable UI remain in the Presentation Layer.
- Reusable business rules remain in the Business Logic Layer.
- MongoDB queries remain in the Data Access Layer.
- Infrastructure helpers do not contain UI or module business rules.
- React components do not query MongoDB directly.
- API routes call services instead of Mongoose models directly.
- Services contain validation and business rules.
- Repositories contain database queries.
- Loading, success, empty, and error states are handled where relevant.
- Existing related features still work.
- No real secrets are included in tracked files.
- New environment variable names are added to `.env.example` where required.
- Relevant TODO comments are added for unfinished design or integration work.
- Completed TODO comments are removed.
- Documentation is updated where necessary.
- ESLint passes, or any remaining issue is clearly documented.
- The production build passes, or any remaining issue is clearly documented.
- Changes are committed with a clear message.
- The branch is pushed to GitHub.
- A pull request is created when required by the team workflow.

Recommended checks:

```bash
npm run lint
npm run build
git status
```

---

## 19. User Interface Guidelines

- Use mobile-first responsive layouts.
- Keep navigation clear and understandable.
- Use consistent spacing, typography, border radius, and button styles.
- Use accessible labels for form controls.
- Use semantic HTML where practical.
- Provide visible loading, empty, error, and success states.
- Do not create working-looking links to pages that do not exist.
- Clearly mark unavailable future features as disabled.
- Add TODO comments where final branding or personalisation is still pending.
- Replace placeholders when the final assets and designs are ready.

---

## 20. Accessibility Guidelines

- Use proper headings in logical order.
- Use labels for form controls.
- Use buttons for actions and links for navigation.
- Provide meaningful link text.
- Include appropriate `aria-label` attributes where normal visible text is insufficient.
- Ensure keyboard users can reach interactive elements.
- Do not rely only on colour to communicate status.
- Add alternative text when real images are introduced.

---

## 21. Security Guidelines

- Keep private operations in server-side code.
- Never expose secrets in client components.
- Never log passwords, tokens, private keys, or full connection strings.
- Validate user input.
- Validate identifiers.
- Avoid rendering untrusted HTML.
- Apply authentication and authorisation checks when protected features are implemented.
- Use environment variables for secrets.
- Review dependency changes before accepting breaking upgrades.
- Do not use `npm audit fix --force` without team approval and testing.

---

## 22. Documentation Guidelines

Maintain these files:

```text
README.md
AGENTS.md
.env.example
```

Use them as follows:

### `README.md`

Contains:

- Project introduction
- Technology overview
- Setup instructions
- Environment setup
- Available routes
- Current features
- Basic running instructions

### `AGENTS.md`

Contains all:

- Coding standards
- Layered architecture rules
- Git workflow
- Branch rules
- Commit rules
- Pull request rules
- Definition of Done
- Security guidelines
- Development guidelines

### `.env.example`

Contains:

- Required environment variable names
- Empty placeholder values only

Do not create separate Coding Standards, Git Workflow, Pull Request Guidelines, or Definition of Done documents.

---

## 23. Current Implementation Notes

The current attraction module supports:

- Reading Melaka attractions from MongoDB Atlas, with pagination
- Searching by name, address, or category
- Filtering by category, location area, and minimum rating
- Displaying result counts
- Resetting search and filters
- Displaying attraction details, including photos (synced one-time from Google Places into Cloudinary, not fetched at render time) and a description backfilled from Places editorialSummary
- Real Google Maps integration on the attraction location page (loaded via `google.maps.importLibrary`, not the legacy synchronous `google.maps.Map` API)
- Offline/PWA caching for previously-viewed attractions, images, and search results, with a dedicated offline fallback page
- Shared site header and navigation

The user module (Tan Yi Jia, `feature/user-mgmt`) supports:

- Google sign-in via Auth.js v5 (`next-auth` beta), configured in `src/auth.ts` / `src/auth.config.ts`
- Session-gated private routing via `src/middleware.js`, with guest access retained for attractions, offline support, and public Social Profile routes
- Persisting a `User` document on first Google sign-in
- Profile view and edit pages

The Social Profile module supports:

- Guest and registered-user access to a searchable public traveller directory
- Public profile pages that expose only display-safe profile fields
- Public reviews loaded from the Review & Community records, including ratings, attraction links, and available review photos
- Profile tabs for public reviews, verified exploration progress, and reviewed-place comparison
- Registered-user access controls for exploration maps and comparisons
- Registered-user exploration maps derived from distinct Verified Visit attractions, exposing only display-safe attraction details while keeping verification evidence private
- Registered-user comparison of common and unique reviewed places derived from published reviews; comparison maps do not expose Verified Visit evidence

Maintenance/data-quality scripts (`scripts/`, run via `npm run <script>`, not part of the live app) exist for one-time or re-runnable backfill and repair jobs: photo sync, description sync, location-area classification, and address repair. See `package.json` for the exact commands.

<!-- TODO: Update this section whenever the implemented feature set changes. -->

---

## 24. Planned Improvements

Planned work includes:

- Registered-User "Add Attraction" submission flow (Google Places-backed, no free-text entry)
- Reviews and ratings
- Final Chatlas branding
- Further responsive and accessibility improvements

<!-- TODO: Update the priority order after the team confirms the development plan. -->
