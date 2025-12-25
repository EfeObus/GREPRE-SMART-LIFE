# GrePre Smart Life

**Bills, Documents & Deadlines - All in One Place**

A production-ready web application built with Python FastAPI to help you manage your bills, store important documents, and never miss a deadline.

## Pricing Tiers

| Tier | Price | Bills | Documents | Features |
|------|-------|-------|-----------|----------|
| **Free** | $0/month | 3 bills | 3 documents | Basic features, email reminders |
| **Individual** | $6 CAD/month | Unlimited | Unlimited | All features, priority support |
| **Organization** | $3 CAD/user/month | Unlimited | Unlimited | Team management, admin dashboard, bulk operations |

### API Endpoints for Tiers
- `GET /api/v1/dashboard/tiers` - Get available subscription tiers and pricing
- `GET /api/v1/dashboard/tier-usage` - Get current user's tier usage and limits

## Features

### Core Features
- **Bill Tracking**: Track rent, utilities, subscriptions, insurance, school fees, loans
- **Document Storage**: Store IDs, visas, permits, warranties, certificates securely
- **Smart Reminders**: Get notified before due dates with escalating reminder system
- **Dashboard**: Unified view of all bills and documents with monthly overview
- **Data Export**: Export your data anytime in JSON format

### Production Features
- **API Rate Limiting**: Configurable rate limits per endpoint type
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options, and more
- **Account Lockout**: Protection against brute-force attacks (5 attempts → 15 min lockout)
- **Password Strength Validation**: Comprehensive password requirements
- **Refresh Tokens**: JWT refresh token support for seamless authentication
- **Health Checks**: Kubernetes-ready health endpoints (/health, /health/ready, /health/live)
- **Structured Logging**: Request IDs, timing, and structured JSON logs
- **Response Compression**: Gzip compression for responses
- **Pagination**: Standardized pagination for all list endpoints
- **Soft Deletes**: Data is never permanently lost
- **Email Notifications**: Bill reminders and account notifications

## Tech Stack

| Category | Technology |
|----------|------------|
| **Backend** | Python 3.11+ with FastAPI |
| **Database** | PostgreSQL with SQLAlchemy (async) |
| **Frontend** | HTML, CSS, JavaScript (Jinja2 templates) |
| **Authentication** | JWT tokens with bcrypt password hashing |
| **Migrations** | Alembic for database migrations |
| **Container** | Docker with multi-stage builds |
| **CI/CD** | GitHub Actions |

## Installation

### Prerequisites

- Python 3.11+
- PostgreSQL
- pip (or Docker)

### Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/EfeObus/GREPRE-SMART-LIFE.git
cd GREPRE-SMART-LIFE

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Create database
createdb grepre_smartlife

# Run database migrations
alembic upgrade head

# Run the application
python run.py
```

The app will be available at http://localhost:5041

### Docker Deployment

```bash
# Copy environment file
cp .env.docker .env

# Edit .env with your secure passwords and secrets
# IMPORTANT: Change DB_PASSWORD, SECRET_KEY, and JWT_SECRET

# Start with docker-compose
docker-compose up -d

# With Redis caching
docker-compose --profile with-cache up -d

# With Nginx reverse proxy (production)
docker-compose --profile production up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

## Project Structure

```
grepre-smartlife/
├── app/
│   ├── core/           # Configuration, database, security, middleware
│   │   ├── config.py       # Application settings
│   │   ├── database.py     # Database connection
│   │   ├── security.py     # JWT, password hashing, tokens
│   │   ├── security_utils.py  # Password validation, account lockout
│   │   ├── middleware.py   # Rate limiting, security headers
│   │   ├── pagination.py   # Pagination utilities
│   │   └── exceptions.py   # Error codes and handlers
│   ├── models/         # SQLAlchemy models
│   ├── routes/         # API endpoints
│   │   ├── auth.py         # Authentication
│   │   ├── bills.py        # Bill management
│   │   ├── documents.py    # Document management
│   │   └── health.py       # Health check endpoints
│   ├── schemas/        # Pydantic schemas
│   ├── services/       # Business logic services
│   │   ├── email.py        # Email notifications
│   │   ├── export.py       # Data export
│   │   └── bootstrap.py    # New user setup
│   └── main.py         # FastAPI application
├── mobile/             # Flutter mobile application
│   ├── lib/
│   │   ├── core/           # Config, network, routing, theme
│   │   ├── features/       # Feature modules (auth, bills, etc.)
│   │   ├── shared/         # Shared widgets and utilities
│   │   └── main.dart       # App entry point
│   ├── ios/            # iOS-specific configuration
│   ├── android/        # Android-specific configuration
│   └── pubspec.yaml    # Flutter dependencies
├── alembic/            # Database migrations
├── database/           # SQL scripts and migration helpers
├── templates/          # Jinja2 HTML templates
├── static/
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript
├── uploads/            # User uploaded files
├── tests/              # Pytest test suite
├── .github/workflows/  # CI/CD pipelines
├── Dockerfile          # Container build
├── docker-compose.yml  # Container orchestration
├── .env                # Environment variables
├── requirements.txt    # Python dependencies
└── run.py              # Application entry point
```

## Mobile App

The mobile application is built with Flutter and supports iOS and Android platforms.

### Mobile Setup

```bash
cd mobile

# Install dependencies
flutter pub get

# For iOS
cd ios && pod install && cd ..

# Run on iOS simulator
flutter run -d ios

# Run on Android emulator
flutter run -d android
```

### Mobile API Configuration

The mobile app automatically configures the correct API URL based on the platform:

| Platform | API URL |
|----------|---------|
| iOS Simulator | `http://localhost:5041` |
| Android Emulator | `http://10.0.2.2:5041` |
| Production | Configure in `app_config.dart` |

**Note:** Android emulator uses `10.0.2.2` to access the host machine's localhost.

## API Endpoints

### Health Checks
- `GET /health` - Basic health status
- `GET /health/ready` - Readiness probe (checks database)
- `GET /health/live` - Liveness probe with uptime
- `GET /health/detailed` - Full system information

### Authentication
- `POST /api/v1/auth/register` - Create new account
- `POST /api/v1/auth/login` - Login and get token pair
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/profile` - Update profile
- `PUT /api/v1/auth/preferences` - Update preferences
- `DELETE /api/v1/auth/account` - Delete account

### Bills
- `GET /api/v1/bills` - List all bills (with pagination)
- `POST /api/v1/bills` - Create new bill
- `GET /api/v1/bills/{id}` - Get bill details
- `PUT /api/v1/bills/{id}` - Update bill
- `DELETE /api/v1/bills/{id}` - Delete bill (soft delete)
- `POST /api/v1/bills/{id}/pay` - Mark bill as paid

### Documents
- `GET /api/v1/documents` - List all documents
- `POST /api/v1/documents` - Upload new document
- `GET /api/v1/documents/{id}` - Get document details
- `PUT /api/v1/documents/{id}` - Update document
- `DELETE /api/v1/documents/{id}` - Delete document

### Dashboard
- `GET /api/v1/dashboard/stats` - Get dashboard statistics
- `GET /api/v1/dashboard/upcoming-bills` - Get upcoming bills
- `GET /api/v1/dashboard/overdue-bills` - Get overdue bills
- `GET /api/v1/dashboard/expiring-documents` - Get expiring documents

### Export
- `GET /api/v1/export/all` - Export all user data
- `GET /api/v1/export/bills` - Export bills only
- `GET /api/v1/export/documents` - Export documents only

## Security Features

### Rate Limiting
- **API Endpoints**: 100 requests per minute
- **Authentication**: 5 requests per minute
- **Registration**: 3 requests per 5 minutes

### Account Lockout
- 5 failed login attempts → 15 minute lockout
- IP-based tracking
- Automatic unlock after lockout period

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character
- Cannot be a common password
- Cannot have sequential/repeated characters

### Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v
```

## Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Environment (development/production) | development |
| `DEBUG` | Enable debug mode | true |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | Application secret key | - |
| `JWT_SECRET` | JWT signing secret | - |
| `SMTP_HOST` | Email server host | smtp.gmail.com |
| `SMTP_PORT` | Email server port | 587 |
| `SMTP_USER` | Email username | - |
| `SMTP_PASSWORD` | Email password | - |
| `EMAIL_ENABLED` | Enable email sending | false |

## License

This project is licensed under the MIT License.

## Author

**Efe Obukohwo**

- GitHub: [@EfeObus](https://github.com/EfeObus)
