# dcr-calculator - Cloudflare + React Project Guidelines

## Build and Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript compiler and Vite build)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run deploy` - Build and deploy to Cloudflare
- `npm run cf-typegen` - Generate Cloudflare Workers types

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled
- No unused locals or parameters
- No unchecked side effect imports
- React JSX syntax

### Naming Conventions
- PascalCase for components and types
- camelCase for variables, functions, and methods
- Use descriptive, meaningful names

### Import Conventions
- Group imports by external dependencies, internal modules, then types
- Use absolute imports from src/ when appropriate

### Error Handling
- Use TypeScript's type system to prevent runtime errors
- Handle async errors with try/catch blocks
- Provide meaningful error messages to users

### Code Structure
- Follow React hooks rules
- Keep components focused and composable
- Extract complex logic to custom hooks
- Organize related functionality into feature folders