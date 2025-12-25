# Changelog

All notable changes to GrePre Smart Life will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-25

### Added

#### Mobile Application
- **Flutter Mobile App**: Cross-platform mobile application for iOS and Android
- Platform-specific API URL configuration (localhost for iOS, 10.0.2.2 for Android emulator)
- Riverpod state management with code generation
- GoRouter navigation with deep linking support
- Dio HTTP client with interceptors for authentication
- Flutter Secure Storage for token management
- Firebase Messaging for push notifications
- Biometric authentication support
- Dark/Light theme support

#### Mobile Features
- Dashboard with spending analytics and bill overview
- Bills management with categories and reminders
- Documents upload and organization
- User profile and settings
- Subscription tier management

### Fixed
- Mobile app API connection: Updated port configuration from 8000 to 5041 to match backend
- Android emulator connectivity: Configured 10.0.2.2 for proper localhost routing

### Changed
- Backend default port changed to 5041 (configurable via WEB_PORT env variable)

## [2.0.0] - 2024-12-24

### Added

#### Subscription Tiers
- **Free Tier**: Limited to 3 bills and 3 document uploads
- **Individual Tier**: $6 CAD/month for unlimited bills and documents
- **Organization Tier**: $3 CAD/user/month with team management features

#### Production Security Features
- Rate limiting middleware with configurable limits per endpoint type
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS)
- Account lockout protection (5 failed attempts → 15 minute lockout)
- Password strength validation with comprehensive requirements
- JWT refresh token support for seamless authentication

#### Infrastructure
- Health check endpoints (`/health`, `/health/ready`, `/health/live`, `/health/detailed`)
- Structured logging with request IDs and timing
- Response compression (Gzip) for improved performance
- Standardized pagination for all list endpoints
- Alembic database migrations
- Docker multi-stage production build
- Docker Compose with PostgreSQL, Redis, and Nginx profiles
- GitHub Actions CI/CD pipeline (lint, test, security scan, build, deploy)

#### Email Notifications
- Bill reminder emails with HTML templates
- Welcome email for new users
- Password reset email support
- Configurable SMTP settings

#### Testing
- Pytest test suite with async support
- Authentication and authorization tests
- Bill CRUD operation tests
- Test fixtures and factories

### Changed
- API versioning: All endpoints now use `/api/v1/` prefix
- Soft deletes: Data is never permanently deleted
- Enhanced error responses with error codes
- Improved token response with expiration info

### Security
- Password requirements: min 8 chars, uppercase, lowercase, digit, special char
- Common password detection
- Sequential/repeated character detection
- IP-based login attempt tracking

## [1.0.0] - 2024-12-20

### Added
- Initial FastAPI backend implementation
- User authentication with JWT tokens
- Bill management (CRUD operations)
- Document storage with file uploads
- OCR support for document scanning (Tesseract)
- Dashboard with statistics
- Reminder system for due dates
- Data export in JSON format
- Jinja2 template-based frontend
- PostgreSQL database with async SQLAlchemy

---

## Upgrade Notes

### From 1.x to 2.0

1. **Database Migration Required**
   ```bash
   alembic upgrade head
   ```

2. **New Environment Variables**
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` for email
   - `EMAIL_ENABLED` to activate email sending

3. **API Endpoint Changes**
   - All API endpoints now use `/api/v1/` prefix
   - New `/health` endpoints for monitoring
   - New `/api/v1/auth/refresh` endpoint for token refresh

4. **Subscription System**
   - Existing users default to Free tier
   - Upgrade paths available for Individual and Organization tiers
