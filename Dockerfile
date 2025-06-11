FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .
COPY firebase-service-account.json ./

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the app
CMD [ "node", "src/index.js" ]