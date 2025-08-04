# Base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy application files
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port for the web server
EXPOSE 8080

# Command to run the web server
CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]