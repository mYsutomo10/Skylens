# SkyLENS Backend API

A comprehensive air quality monitoring system backend that provides real-time air quality data, forecasts, and health recommendations for multiple sensor locations.

## Features

- **Real-time Air Quality Monitoring**: Current AQI and pollutant levels from multiple sensors
- **Historical Data Analysis**: Trends and patterns over configurable time periods (1d, 7d, 30d)
- **AI-Powered Forecasting**: Machine learning predictions for future air quality conditions
- **Health Recommendations**: Personalized advice based on current air quality levels
- **Environmental News**: Latest environmental and air quality related news
- **Multi-location Support**: Currently monitoring Jalan Radio and Baleendah locations
- **Comprehensive Pollutant Information**: Detailed information about PM2.5, PM10, O3, NO2, CO, and NH3

## Architecture

### Core Components

- **Express.js API Server**: RESTful API endpoints for data access
- **Firebase Firestore**: Real-time database for sensor data storage
- **AWS Lambda Functions**: Serverless data processing and ML inference
- **Docker Containers**: Containerized deployment for scalability

### Data Pipeline

1. **Data Collection**: IoT sensors and OpenWeather API data ingestion
2. **Data Processing**: Real-time aggregation and quality validation
3. **ML Prediction**: LSTM-based forecasting models
4. **Data Serving**: RESTful API endpoints for client applications

## Data Sources

- **IoT Sensors**: Real-time air quality measurements from deployed sensors
- **OpenWeather API**: Meteorological data and pollution forecasts
- **GNews API**: Environmental news and updates

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose
- Firebase service account credentials
- AWS credentials (for Lambda functions)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd skylens-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Add Firebase credentials**
   ```bash
   # Place your firebase-service-account.json in the project root
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Docker Deployment

```bash
# Build and run with Docker
docker build -t skylens-backend .
docker run -p 3000:3000 skylens-backend
```

## API Endpoints

### Home
- `GET /` - Homepage with news, daily tips, and pollution impacts

### Location Data
- `GET /{location}` - Current air quality data for a location
- `GET /{location}/history?range={1d|7d|30d}` - Historical data
- `GET /{location}/forecast` - Forecast data

### Health Check
- `GET /health` - API health status

### Supported Locations
- `Jalan Radio` (sensor001)
- `Baleendah` (sensor002)

## API Response Examples

### Current Data Response
```json
{
  "location": "Jalan Radio",
  "current": {
    "aqi": 85,
    "components": {
      "pm2_5": 25.3,
      "pm10": 45.2,
      "co": 1.2,
      "no2": 32.1,
      "o3": 78.5,
      "nh3": 12.3
    },
    "dominant_pollutant": "PM2.5",
    "timestamp": "2025-01-16T10:00:00Z"
  },
  "health": {
    "riskLevel": "Moderate",
    "generalMessage": "Air quality is acceptable for most individuals.",
    "recommendations": [
      "Sensitive individuals should consider reducing prolonged outdoor activities",
      "Monitor your health for any respiratory symptoms"
    ]
  }
}
```

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# GNews API
GNEWS_API_KEY=your_gnews_api_key
GNEWS_API_URL=https://gnews.io/api/v4
GNEWS_CACHE_TTL=10800

# OpenWeather API (for Lambda functions)
OPENWEATHER_API_KEY=your_openweather_api_key
```

### Firebase Configuration

Place your Firebase service account JSON file as `firebase-service-account.json` in the project root.

## Lambda Functions

### Data Collection Functions

1. **Current Weather Collector** (`lambda/api-to-firebase/current-meteo-collector/`)
   - Fetches current weather data from OpenWeather API
   - Processes and stores meteorological data in Firestore

2. **Current Pollution Collector** (`lambda/api-to-firebase/current-pollution-collector/`)
   - Collects real-time air pollution data
   - Calculates AQI and dominant pollutants

3. **Forecast Pollution Collector** (`lambda/api-to-firebase/forecast-pollution-collector/`)
   - Fetches pollution forecast data
   - Stores future predictions in Firestore

4. **IoT Core to Firestore** (`lambda/iot core-to-firestore/`)
   - Processes IoT sensor data from AWS IoT Core
   - Real-time data ingestion and validation

### Data Processing Functions

5. **Merger Lambda** (`lambda/merger lambda/`)
   - Aggregates sensor and meteorological data
   - Performs data quality checks and outlier removal
   - Creates hourly aggregated datasets

6. **Prediction Service** (`lambda/predict-v2/`)
   - LSTM-based air quality forecasting
   - Loads trained models from S3
   - Generates 24-hour predictions

## Machine Learning

### Model Architecture
- **LSTM Neural Networks**: Time series forecasting for AQI prediction
- **Feature Engineering**: Meteorological data, temporal features, and lag variables
- **Model Storage**: Trained models stored in AWS S3
- **Real-time Inference**: Serverless prediction via Lambda functions

### Features Used
- Air quality components (PM2.5, PM10, O3, NO2, CO, NH3)
- Meteorological data (temperature, humidity, wind, precipitation)
- Temporal features (hour, day of week)
- Historical lag features (previous 5 hours of AQI)

## Data Collections (Firestore)

```
current_data/{sensorId}/
├── main/           # Aggregated current data
└── readings/       # Raw sensor readings

processed_data/{sensorId}/
└── readings/       # Processed and validated data

forecast_data/{sensorId}/
├── main/           # Aggregated forecasts
└── readings/       # Individual forecast points

current_weather/{sensorId}/
└── readings/       # Meteorological data

meteo_data/{sensorId}/
└── readings/       # Processed weather data
```

## Health Recommendations

The system provides health recommendations based on AQI levels:

- **Good (0-50)**: No precautions needed
- **Moderate (51-100)**: Sensitive individuals should limit prolonged outdoor activities
- **Unhealthy for Sensitive Groups (101-150)**: Reduce outdoor activities for sensitive groups
- **Unhealthy (151-200)**: Everyone should limit outdoor activities
- **Very Unhealthy (201-300)**: Avoid outdoor activities
- **Hazardous (301+)**: Stay indoors, emergency conditions

## 🔍 Monitoring and Logging

- **Request Logging**: Morgan middleware for HTTP request logging
- **Error Handling**: Centralized error handling with detailed error responses
- **Health Checks**: Built-in health check endpoint for monitoring
- **Cache Management**: Node-cache for API response caching

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Production Deployment

1. **Build Docker image**
   ```bash
   docker build -t skylens-backend:latest .
   ```

2. **Deploy to your container platform**
   ```bash
   # Example for AWS ECS, Google Cloud Run, etc.
   ```

### Lambda Deployment

Each Lambda function has its own deployment configuration:

```bash
# Example for prediction service
cd lambda/predict-v2
docker build -t aqi-prediction .
# Deploy to AWS Lambda
```