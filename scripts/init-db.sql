-- Create databases
CREATE DATABASE IF NOT EXISTS eventhub;

-- Create extensions
\c eventhub;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE eventhub TO eventhub;
