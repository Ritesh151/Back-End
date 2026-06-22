# Lead Finder Agent - Backend

Production-grade Express.js backend API for the Lead Finder Agent platform.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose ODM)
- **Scraping**: Playwright
- **Validation**: Zod
- **Security**: Helmet, CORS, Cookie Parser
- **Logging**: Morgan

## Installation

```bash
# Install dependencies
npm install

# Copy environment example
cp .env.example .env
```

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lead-finder?retryWrites=true&w=majority
FRONTEND_URL=http://localhost:3000
API_PREFIX=/api/v1
```

## Playwright Setup

Install Chromium browser for Playwright:

```bash
npx playwright install chromium
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Type checking
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

## Project Structure

```
/backend
├── src
│   ├── config/         # Database, app configuration
│   ├── controllers/    # Route controllers
│   ├── routes/         # API routes
│   ├── services/       # Business logic services
│   ├── models/         # MongoDB schemas
│   ├── validators/     # Zod validation schemas
│   ├── middlewares/    # Express middleware
│   ├── utils/          # Utility functions
│   ├── constants/      # Application constants
│   ├── types/          # TypeScript types
│   ├── scrapers/       # Playwright scraping engines
│   ├── exporters/      # Export functionality (future)
│   └── app.ts          # Main application file
├── .env.example
├── package.json
└── tsconfig.json
```

## API Documentation

### Health Check

```
GET /api/v1/health
```

### Leads

```
GET    /api/v1/leads          # Get all leads
POST   /api/v1/leads          # Create new lead
PUT    /api/v1/leads/:id      # Update lead
DELETE /api/v1/leads/:id      # Delete lead
```

### Search (Scrape from Google Maps)

```
POST   /api/v1/search
Body: {
  "keyword": "Gym",
  "location": "Ahmedabad",
  "limit": 50
}
```

## Scraping Features

- Google Maps business search
- Automatic scrolling and extraction
- Business data extraction (name, phone, website, rating, etc.)
- Duplicate detection
- MongoDB storage

## Security Features

- Helmet.js for security headers
- CORS configuration
- Environment-based configuration
- Centralized error handling
- Input validation with Zod

## Future Features

- LinkedIn scraping
- AI-powered lead analysis
- CSV/Excel export
- Background job processing (BullMQ)
- Redis caching

## License

MIT
