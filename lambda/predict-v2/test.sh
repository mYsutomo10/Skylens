#!/bin/bash

IMAGE_NAME=aqi-prediction-function

SENSOR_ID=${1:-sensor001}
TIMESTAMP=${2:-$(date +%Y%m%dT%H%M)}

echo "📦 Building Docker image using buildx..."
docker buildx build --platform linux/amd64 -t $IMAGE_NAME . --load

export $(grep -v '^#' .env | xargs)

echo "🚀 Running test for $SENSOR_ID at $TIMESTAMP..."
docker run --rm \
  -v "$PWD"/app:/var/task \
  -v "$PWD/firebase-service-account.json":/var/task/firebase-service-account.json \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
  -e GOOGLE_APPLICATION_CREDENTIALS=/var/task/firebase-service-account.json \
  --entrypoint python \
  $IMAGE_NAME local_test.py $SENSOR_ID $TIMESTAMP