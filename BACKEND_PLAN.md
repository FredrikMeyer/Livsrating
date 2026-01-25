# Livsrating Backend Plan

A simple but secure backend for the Livsrating day-rating application.

## Overview

The backend will provide user authentication and cloud storage for ratings, allowing users to sync their data across devices while maintaining strong security practices.

---

## Technology Stack

### Recommended: Node.js + Express + SQLite/PostgreSQL

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | **Node.js** | Matches frontend JS, simple deployment |
| Framework | **Express.js** | Minimal, well-documented, battle-tested |
| Database | **SQLite** (dev/small) or **PostgreSQL** (production) | SQLite for simplicity, Postgres for scale |
| ORM | **Prisma** or **Drizzle** | Type-safe queries, migrations |
| Auth | **Passport.js** with sessions or **JWT** | Standard, flexible auth |
| Password Hashing | **Argon2** (preferred) or **bcrypt** | Secure password storage |

### Alternative: Serverless

For even simpler deployment, consider:
- **Cloudflare Workers** + **D1** (SQLite)
- **Vercel Functions** + **Vercel Postgres**
- **Supabase** (managed Postgres + built-in auth)

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Ratings table
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One rating per user per day
    UNIQUE(user_id, date)
);

-- Index for efficient user queries
CREATE INDEX idx_ratings_user_date ON ratings(user_id, date);
```

### Prisma Schema (Alternative)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  ratings      Rating[]

  @@map("users")
}

model Rating {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  date      DateTime @db.Date
  rating    Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
  @@map("ratings")
}
```

---

## API Design

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Get current user |

### Ratings Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ratings` | List all user's ratings |
| GET | `/api/ratings/:date` | Get rating for specific date |
| PUT | `/api/ratings/:date` | Create or update rating |
| DELETE | `/api/ratings/:date` | Delete a rating |
| GET | `/api/ratings/export` | Export as CSV |

### Request/Response Examples

**Register:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Save Rating:**
```http
PUT /api/ratings/2024-01-15
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 4
}
```

**Get All Ratings:**
```http
GET /api/ratings
Authorization: Bearer <token>

Response:
{
  "ratings": [
    { "date": "2024-01-15", "rating": 4 },
    { "date": "2024-01-14", "rating": 5 }
  ]
}
```

---

## Security Measures

### 1. Authentication Security

- **Password Requirements:**
  - Minimum 8 characters
  - Check against breached password lists (e.g., HaveIBeenPwned API)
  - Use Argon2id for hashing (memory-hard, resistant to GPU attacks)

- **Session/Token Security:**
  - Use HTTP-only, Secure, SameSite=Strict cookies for sessions
  - OR use short-lived JWTs (15 min) with refresh tokens
  - Implement token rotation on refresh

```javascript
// Argon2 configuration
const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4
};
```

### 2. Input Validation

Validate all inputs server-side using a schema validation library:

```javascript
// Using Zod for validation
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5)
});

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
```

### 3. Rate Limiting

Protect against brute force and DoS attacks:

```javascript
import rateLimit from 'express-rate-limit';

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 min
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 4. CORS Configuration

```javascript
import cors from 'cors';

const corsOptions = {
  origin: process.env.FRONTEND_URL, // Specific origin, not '*'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### 5. Security Headers

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

### 6. SQL Injection Prevention

- Use parameterized queries (automatic with Prisma/Drizzle)
- Never concatenate user input into queries

```javascript
// GOOD - Parameterized query
const rating = await prisma.rating.findUnique({
  where: { userId_date: { userId, date: new Date(date) } }
});

// BAD - SQL injection vulnerability
// const query = `SELECT * FROM ratings WHERE date = '${date}'`;
```

### 7. Additional Security Measures

- **HTTPS Only:** Enforce TLS in production
- **Environment Variables:** Store secrets in env vars, never in code
- **Logging:** Log auth failures for monitoring (without passwords)
- **Dependency Audit:** Run `npm audit` regularly

---

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Entry point
│   ├── config/
│   │   └── index.js          # Environment config
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   ├── validate.js       # Request validation
│   │   └── errorHandler.js   # Global error handling
│   ├── routes/
│   │   ├── auth.js           # Auth routes
│   │   └── ratings.js        # Ratings routes
│   ├── services/
│   │   ├── auth.js           # Auth logic
│   │   └── ratings.js        # Ratings logic
│   └── utils/
│       └── password.js       # Password hashing utilities
├── prisma/
│   └── schema.prisma         # Database schema
├── tests/
│   ├── auth.test.js
│   └── ratings.test.js
├── .env.example              # Environment template
├── package.json
└── README.md
```

---

## Implementation Steps

### Phase 1: Foundation
1. Initialize Node.js project with TypeScript (optional but recommended)
2. Set up Express with security middleware (helmet, cors, rate-limit)
3. Configure Prisma with SQLite for local development
4. Create database schema and run migrations

### Phase 2: Authentication
1. Implement user registration with password validation
2. Implement login with Argon2 password verification
3. Set up session management (cookies) or JWT tokens
4. Add authentication middleware for protected routes
5. Write tests for auth flows

### Phase 3: Ratings API
1. Implement CRUD endpoints for ratings
2. Add request validation with Zod
3. Ensure users can only access their own data
4. Implement CSV export endpoint
5. Write tests for ratings operations

### Phase 4: Frontend Integration
1. Add API service module to frontend
2. Implement login/register UI
3. Update ratings operations to use API
4. Add offline fallback to localStorage
5. Implement sync logic for offline-first experience

### Phase 5: Production Readiness
1. Switch to PostgreSQL for production
2. Set up environment-based configuration
3. Add health check endpoint
4. Configure logging (consider structured logging)
5. Deploy (Railway, Fly.io, Render, or similar)

---

## Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="file:./dev.db"  # SQLite for dev
# DATABASE_URL="postgresql://user:pass@host:5432/db"  # Postgres for prod

# Auth
JWT_SECRET=your-secret-key-min-32-chars  # Generate with: openssl rand -base64 32
SESSION_SECRET=another-secret-key

# Frontend
FRONTEND_URL=http://localhost:8080

# Security
BCRYPT_ROUNDS=12  # Or Argon2 params
```

---

## Security Checklist

Before going to production, verify:

- [ ] All passwords hashed with Argon2 or bcrypt
- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] CORS configured with specific origin
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (proper encoding)
- [ ] CSRF protection (SameSite cookies or tokens)
- [ ] Security headers set (Helmet)
- [ ] Secrets in environment variables
- [ ] Dependencies audited (`npm audit`)
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured (without sensitive data)

---

## Hosting Recommendations

| Platform | Pros | Cons | Cost |
|----------|------|------|------|
| **DigitalOcean App Platform** ⭐ | Simple container deploy, managed DB, auto-SSL | No free tier | ~$12/mo |
| **DigitalOcean Droplet** | Full control, cheaper at scale | More setup | ~$11/mo |
| **Railway** | Easy deploy, free tier | Limited free tier | Free → $5/mo |
| **Fly.io** | Good free tier, global | Slightly complex | Free → pay-as-go |
| **Render** | Simple, free Postgres | Sleep on free tier | Free → $7/mo |

---

## DigitalOcean Container Deployment

### Dockerfile (Multi-stage, Lightweight)

Use a multi-stage build with Alpine for minimal image size (~50MB):

```dockerfile
# backend/Dockerfile

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source and generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# Stage 2: Production
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only what's needed
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "src/index.js"]
```

### Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ./backend
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgresql://livsrating:localpass@db:5432/livsrating
      - JWT_SECRET=dev-secret-change-in-production
      - FRONTEND_URL=http://localhost:8080
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: livsrating
      POSTGRES_PASSWORD: localpass
      POSTGRES_DB: livsrating
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U livsrating"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Health Check Endpoint

Add to your Express app:

```javascript
// src/index.js
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});
```

---

### DigitalOcean App Platform (Recommended)

The simplest approach - DigitalOcean builds and runs your container automatically.

#### Option A: Deploy from GitHub

1. **Create App Spec** (`app.yaml`):

```yaml
# app.yaml - DigitalOcean App Platform spec
name: livsrating-api

services:
  - name: api
    github:
      repo: your-username/livsrating
      branch: main
      deploy_on_push: true
    source_dir: /backend
    dockerfile_path: backend/Dockerfile
    http_port: 3000
    instance_size_slug: basic-xxs  # $5/mo - 512MB RAM, 1 vCPU
    instance_count: 1
    health_check:
      http_path: /health
      initial_delay_seconds: 10
      period_seconds: 30
    envs:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        type: SECRET
        value: ${JWT_SECRET}
      - key: DATABASE_URL
        type: SECRET
        value: ${db.DATABASE_URL}
      - key: FRONTEND_URL
        value: https://your-frontend.com

databases:
  - name: db
    engine: PG
    version: "16"
    size: db-s-dev-database  # $7/mo - 1GB RAM, 10GB storage
    num_nodes: 1
```

2. **Deploy via CLI**:

```bash
# Install doctl
brew install doctl  # or snap install doctl

# Authenticate
doctl auth init

# Create the app
doctl apps create --spec app.yaml

# Set secrets
doctl apps update <app-id> --spec app.yaml \
  --env JWT_SECRET="$(openssl rand -base64 32)"
```

3. **Or deploy via Console**:
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect GitHub repo
   - Select the backend folder
   - Add managed PostgreSQL database
   - Set environment variables
   - Deploy

#### Estimated Cost (App Platform):
| Resource | Size | Cost |
|----------|------|------|
| App (Basic) | 512MB / 1 vCPU | $5/mo |
| PostgreSQL | Dev database | $7/mo |
| **Total** | | **~$12/mo** |

---

### DigitalOcean Droplet + Docker (More Control)

For more control or lower cost at scale.

#### 1. Create Droplet

```bash
# Create a small droplet with Docker pre-installed
doctl compute droplet create livsrating-api \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region nyc1 \
  --ssh-keys <your-ssh-key-id> \
  --tag-names api,production
```

#### 2. Set Up Container Registry

```bash
# Create private container registry
doctl registry create livsrating-registry --region nyc1

# Login to registry
doctl registry login

# Build and push image
docker build -t registry.digitalocean.com/livsrating-registry/api:latest ./backend
docker push registry.digitalocean.com/livsrating-registry/api:latest
```

#### 3. Deploy on Droplet

SSH into droplet and run:

```bash
# Login to registry
doctl registry login

# Create docker network
docker network create livsrating

# Run PostgreSQL
docker run -d \
  --name postgres \
  --network livsrating \
  -e POSTGRES_USER=livsrating \
  -e POSTGRES_PASSWORD=<secure-password> \
  -e POSTGRES_DB=livsrating \
  -v pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine

# Run API
docker run -d \
  --name api \
  --network livsrating \
  -p 443:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://livsrating:<password>@postgres:5432/livsrating \
  -e JWT_SECRET=<your-secret> \
  -e FRONTEND_URL=https://your-frontend.com \
  --restart unless-stopped \
  registry.digitalocean.com/livsrating-registry/api:latest
```

#### 4. Add Nginx + SSL (on Droplet)

```bash
# Install Nginx and Certbot
apt update && apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx
cat > /etc/nginx/sites-available/livsrating << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/livsrating /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d api.yourdomain.com
```

#### Estimated Cost (Droplet):
| Resource | Size | Cost |
|----------|------|------|
| Droplet | 1GB / 1 vCPU | $6/mo |
| Container Registry | Basic | $5/mo |
| Managed Postgres (optional) | Dev | $7/mo |
| **Total** | | **~$11-18/mo** |

---

### CI/CD with GitHub Actions

Automate builds and deployments:

```yaml
# .github/workflows/deploy.yml
name: Deploy to DigitalOcean

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

env:
  REGISTRY: registry.digitalocean.com
  IMAGE_NAME: livsrating-registry/api

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Login to Container Registry
        run: doctl registry login --expiry-seconds 1200

      - name: Build and push image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
                       -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
                       ./backend
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      # For App Platform
      - name: Deploy to App Platform
        run: doctl apps create-deployment ${{ secrets.DO_APP_ID }}

      # OR for Droplet (via SSH)
      # - name: Deploy to Droplet
      #   uses: appleboy/ssh-action@master
      #   with:
      #     host: ${{ secrets.DROPLET_IP }}
      #     username: root
      #     key: ${{ secrets.SSH_PRIVATE_KEY }}
      #     script: |
      #       docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
      #       docker stop api && docker rm api
      #       docker run -d --name api ...
```

---

### Database Migrations in Container

Run migrations on container startup or as a separate job:

```dockerfile
# Option 1: In Dockerfile entrypoint
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
```

```bash
#!/bin/sh
# docker-entrypoint.sh

# Run migrations
npx prisma migrate deploy

# Start the app
exec node src/index.js
```

```yaml
# Option 2: As a pre-deploy job in App Platform
jobs:
  - name: migrate
    kind: PRE_DEPLOY
    github:
      repo: your-username/livsrating
      branch: main
    source_dir: /backend
    dockerfile_path: backend/Dockerfile
    envs:
      - key: DATABASE_URL
        type: SECRET
        value: ${db.DATABASE_URL}
    run_command: npx prisma migrate deploy
```

---

### Container Security Checklist

- [x] Multi-stage build (smaller attack surface)
- [x] Non-root user in container
- [x] Health checks configured
- [x] No secrets in image (use env vars)
- [ ] Enable DO Firewall (allow only 80/443)
- [ ] Use managed database (encrypted at rest)
- [ ] Enable VPC for internal communication
- [ ] Set up monitoring/alerts in DO dashboard

---

## Summary

This plan provides a secure, simple backend that:

1. **Authenticates users** with secure password hashing
2. **Protects data** with proper authorization checks
3. **Prevents common attacks** (SQL injection, XSS, CSRF, brute force)
4. **Scales simply** from SQLite to PostgreSQL
5. **Deploys easily** to modern hosting platforms

The stack (Node.js + Express + Prisma) is well-documented and allows for straightforward implementation while maintaining security best practices.
