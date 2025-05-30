# SkyLENS Backend API

Backend API for the SkyLENS Air Quality Monitoring System.

## Tech Stack

- **Framework**: Express
- **Database**: Firestore Database
- **News API**: GNews API

## Project Structure

```
skylens-backend/
├── src/
│   ├── controllers/       # Route controllers
│   ├── routes/            # API routes
│   ├── services/          # External services and database interactions
│   ├── utils/             # Helper functions and utilities
│   ├── config.js          # Configuration settings
│   └── index.js           # Application entry point
├── .env                   # Environment variables
├── Dockerfile             # Docker configuration
└── package.json           # Project dependencies
```

## API Endpoints

### Home

- `GET /` - Get homepage data including news, daily tip, and pollution impacts

### Jalan Radio Location

- `GET /Jalan Radio` - Get current AQI data for Jalan Radio
- `GET /Jalan Radio/history` - Get historical AQI data for Jalan Radio
- `GET /Jalan Radio/forecast` - Get forecast AQI data for Jalan Radio

### Baleendah Location

- `GET /Baleendah` - Get current AQI data for Baleendah
- `GET /Baleendah/history` - Get historical AQI data for Baleendah
- `GET /Baleendah/forecast` - Get forecast AQI data for Baleendah

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on the provided example
4. Place your Firebase service account key in `firebase-service-account.json`
5. Start the server: `npm start`

## Docker

To build and run with Docker:

```bash
# Build the image
docker build -t skylens-backend .

# Run the container
docker run -p 3000:3000 --env-file .env skylens-backend
```

## Environment Variables

Required environment variables:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY_PATH` - Path to Firebase service account key
- `GNEWS_API_KEY` - GNews API key
- `GNEWS_API_URL` - GNews API URL
- `GNEWS_CACHE_TTL` - Cache TTL for news in seconds (default: 10800)

## License

[MIT](LICENSE)
