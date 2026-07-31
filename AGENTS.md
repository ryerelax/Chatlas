<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Chatlas Development Guidelines

This file is the single source of truth for Chatlas development guidelines.

Do not create separate Coding Standards, Git Workflow, or Definition of Done documents. Update this file when the team confirms new development rules.

## 1. Project Scope

Chatlas must remain:

- One application
- One GitHub repository
- One deployment unit
- One Next.js full-stack project

Do not split the project into separate frontend and backend repositories, servers, or deployment units.

## 2. Technology Stack

The current project uses:

- Next.js
- React
- Tailwind CSS
- MongoDB Atlas
- Mongoose
- ESLint

Planned external services include:

- Google Identity Services
- Google Maps Platform
- Cloudinary

Install additional dependencies only when the related feature is implemented.

## 3. Layered Project Structure

Use the following structure:

```text
src/
├── app/
├── components/
├── lib/
├── models/
├── repositories/
└── services/
```

Layer responsibilities:

### Presentation Layer

Locations:

```text
src/app/
src/components/
```

Responsibilities:

- Pages
- Layouts
- Navigation
- Forms
- User interface components
- Loading, empty, and error states
- Client-side interaction

Do not place direct MongoDB queries inside pages or React components.

### Business Logic Layer

Location:

```text
src/services/
```

Responsibilities:

- Input normalization
- Validation
- Business rules
- Calling repository functions
- Preparing data for API routes or pages

Keep business rules out of React components and repositories.

### Data Access Layer

Locations:

```text
src/repositories/
src/models/
```

Responsibilities:

- Mongoose schemas and models
- MongoDB queries
- Database-specific filtering and sorting
- Returning database results to services

Do not place user interface logic inside repositories or models.

### Infrastructure and Shared Utilities

Location:

```text
src/lib/
```

Responsibilities:

- Database connection
- Shared configuration
- External service helpers
- Reusable utility functions

## 4. Coding Standards

- Use JavaScript unless the team officially decides to migrate to TypeScript.
- Use functional React components.
- Use descriptive variable, function, and file names.
- Keep functions focused on one responsibility.
- Prefer reusable components instead of repeating user interface code.
- Use `async` and `await` for asynchronous operations.
- Handle loading, empty, success, and error states where relevant.
- Validate user input before passing it to the data access layer.
- Do not expose database credentials, API secrets, or private configuration.
- Do not add packages that are not required by an implemented feature.
- Do not use `npm audit fix --force` unless the team has reviewed and approved the breaking changes.
- Run ESLint and the production build before merging important changes.

## 5. TODO Comment Rules

Add a clear `TODO` comment when a section will require future improvement, final design work, personalization, or an unfinished integration.

Examples:

```js
// TODO: Replace this placeholder with the final Chatlas logo.
```

```js
// TODO: Load these categories dynamically from the database.
```

```js
// TODO: Integrate Google Identity Services.
```

A TODO comment must explain what should be improved. Do not use vague comments such as:

```js
// TODO: Fix later.
```

Remove a TODO comment when the related work is completed.

## 6. Naming Conventions

Use these conventions:

- React components: `PascalCase`
- Component files: `PascalCase.js`
- Functions and variables: `camelCase`
- Service files: `camelCaseService.js`
- Repository files: `camelCaseRepository.js`
- Mongoose model files: `PascalCase.js`
- Route folders: lowercase
- Dynamic route folders: `[id]`
- Environment variables: `UPPER_SNAKE_CASE`

Examples:

```text
AttractionCard.js
attractionService.js
attractionRepository.js
Attraction.js
src/app/attractions/[id]/page.js
```

## 7. API and Error Handling

API Route Handlers should:

- Connect to the database through the shared database helper.
- Call services instead of querying Mongoose models directly.
- Return a consistent JSON structure.
- Use appropriate HTTP status codes.
- Avoid exposing stack traces, passwords, connection strings, or internal secrets.

Recommended success format:

```json
{
  "success": true,
  "data": {}
}
```

Recommended error format:

```json
{
  "success": false,
  "message": "A clear public error message."
}
```

Common status codes:

- `200` for successful requests
- `201` for successful creation
- `400` for invalid input
- `401` for unauthenticated access
- `403` for forbidden access
- `404` when a resource is not found
- `500` for unexpected server errors

## 8. Database Rules

- Use Mongoose models for MongoDB collections.
- Use repositories for database queries.
- Use services for validation and business rules.
- Keep the database name and collection names consistent.
- Do not hardcode passwords or connection strings.
- Use `.env.local` for real environment values.
- Keep `.env.local` out of Git.
- Keep `.env.example` updated with variable names only.
- Never place real secrets inside `.env.example`, `README.md`, source code, screenshots, commits, or pull requests.

Current attraction data uses:

```text
Database: chatlas
Collection: attractions
```

## 9. Environment Variables

Expected environment variables currently include:

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

Only variables beginning with `NEXT_PUBLIC_` may be exposed to browser code.

Do not use `NEXT_PUBLIC_` for private secrets.

## 10. Git Workflow

Do not commit directly to `main` unless instructed by the team leader.

Create or switch to the assigned feature branch:

```bash
git switch -c feature/your-feature-name
```

Before committing:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit using a clear message:

```bash
git commit -m "Add attraction category filter"
```

Push the branch:

```bash
git push -u origin feature/your-feature-name
```

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
feature/attraction-explorer
feature/social-profile
fix/attraction-api
docs/update-readme
```

Do not commit:

- `.env.local`
- Passwords
- API keys
- Database connection strings
- Temporary files
- Build output
- Unnecessary generated files

## 11. Commit Message Guidelines

Use short and specific commit messages.

Good examples:

```text
Add attraction details page
Add MongoDB attraction repository
Fix category filtering
Update Chatlas README
```

Avoid vague messages:

```text
update
changes
fix stuff
final
```

Each commit should represent one logical group of changes where practical.

## 12. Pull Request Guidelines

Before creating a pull request:

- Confirm the feature works locally.
- Confirm no secrets are included.
- Review changed files using `git status` and `git diff`.
- Run lint.
- Run the production build.
- Push the latest branch changes.
- Describe what was added or changed.
- Mention known limitations or remaining TODO items.
- Add screenshots for visible user interface changes when useful.

Do not merge your own pull request unless the team workflow allows it.

## 13. Definition of Done

A task is considered done only when all relevant items below are satisfied:

- The requested feature or change is implemented.
- The code follows the layered architecture.
- Pages and components do not query MongoDB directly.
- Services contain business rules and validation.
- Repositories contain database queries.
- Loading, empty, and error states are handled where relevant.
- The feature works locally.
- Existing related features still work.
- No real secrets are present in tracked files.
- Required environment variable names are documented in `.env.example`.
- Relevant TODO comments are added for unfinished design or integration work.
- Obsolete TODO comments are removed.
- ESLint passes, or any remaining issue is documented.
- The production build passes, or any remaining issue is documented.
- The changes are committed with a clear message.
- The branch is pushed to GitHub.
- The pull request contains a clear summary when a pull request is required.

Useful checks:

```bash
npm run lint
npm run build
git status
```

## 14. User Interface Guidelines

- Use mobile-first responsive layouts.
- Keep navigation and actions understandable.
- Use consistent spacing, typography, border radius, and button styles.
- Provide visible feedback for loading, empty, error, and success states.
- Use accessible labels for form controls.
- Use semantic HTML where practical.
- Do not create links to pages that do not exist.
- Disabled future features should be clearly shown as unavailable.
- Add TODO comments where final branding or personalized design is pending.

## 15. Security Guidelines

- Never expose secrets in client components.
- Never log passwords, API keys, authentication tokens, or full connection strings.
- Validate IDs and user input.
- Use server-side code for private operations.
- Apply authentication and authorization checks when protected features are implemented.
- Avoid rendering untrusted HTML.
- Review dependency updates before accepting breaking changes.
- Do not use `npm audit fix --force` without team approval and testing.

## 16. Documentation Guidelines

Maintain these project files:

```text
README.md
AGENTS.md
.env.example
```

Use:

- `README.md` for project introduction, setup, routes, and current features.
- `AGENTS.md` for all development guidelines, coding standards, Git workflow, and Definition of Done.
- `.env.example` for required environment variable names without real values.

Do not create separate Coding Standards, Git Workflow, or Definition of Done documents.

## 17. Current Project Notes

The current attraction module supports:

- Reading attractions from MongoDB Atlas
- Searching by name, address, or category
- Filtering by category
- Filtering by minimum rating
- Displaying attraction details
- Opening Google Maps links

<!-- TODO: Update this section when the current implementation changes. -->

## 18. Planned Work

Planned features include:

- Google authentication
- Interactive exploration map
- Attraction images
- Reviews and ratings
- Social profiles
- Community features
- Cloudinary image storage
- PWA configuration
- Final Chatlas branding

<!-- TODO: Update priorities after the team confirms the development plan. -->
