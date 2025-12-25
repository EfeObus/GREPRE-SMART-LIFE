# Grepre SmartLife Mobile App

A cross-platform mobile application for Grepre SmartLife, built with Flutter for iOS, Android, tablet, and iPad.

## Features

- 🔐 **Authentication**: Secure login, registration, and password recovery
- 📊 **Dashboard**: Overview of bills, documents, and spending analytics
- 💰 **Bills Management**: Track, categorize, and manage all your bills
- 📄 **Documents**: Upload, organize, and store important documents
- ⚙️ **Settings**: Profile management, theme preferences, and notifications
- 💳 **Subscriptions**: Three-tier subscription system (Free, Individual, Organization)

## Subscription Tiers

| Feature | Free | Individual | Organization |
|---------|------|------------|--------------|
| Price | $0 | $6 CAD/month | $3 CAD/user/month |
| Bills | 3 | Unlimited | Unlimited |
| Documents | 3 | Unlimited | Unlimited |
| Dashboard Analytics | Basic | Advanced | Advanced |
| Export Features | ❌ | ✅ | ✅ |
| Team Management | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |

## Tech Stack

- **Flutter** 3.x - Cross-platform UI framework
- **Dart** 3.x - Programming language
- **Riverpod** - State management
- **GoRouter** - Navigation & routing
- **Dio** - HTTP client
- **Freezed** - Code generation for models
- **Flutter Secure Storage** - Secure token storage
- **Firebase Messaging** - Push notifications
- **Local Auth** - Biometric authentication

## Getting Started

### Prerequisites

- Flutter SDK 3.0 or higher
- Dart SDK 3.0 or higher
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio with SDK 21+ (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Generate code (models, freezed)**
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

4. **Configure API endpoint**
   
   Update `lib/core/constants/api_constants.dart` with your API URL:
   ```dart
   static const String baseUrl = 'https://your-api-url.com/api/v1';
   ```

5. **Run the app**
   ```bash
   # iOS Simulator
   flutter run -d ios

   # Android Emulator
   flutter run -d android

   # Web (for development)
   flutter run -d chrome
   ```

### Development Commands

```bash
# Run with hot reload
flutter run

# Build release APK (Android)
flutter build apk --release

# Build release IPA (iOS)
flutter build ios --release

# Build for all platforms
flutter build apk && flutter build ios

# Run tests
flutter test

# Analyze code
flutter analyze

# Format code
dart format lib/

# Watch for code generation changes
flutter pub run build_runner watch --delete-conflicting-outputs
```

## Project Structure

```
mobile/
├── lib/
│   ├── main.dart                 # App entry point
│   ├── core/
│   │   ├── constants/           # API endpoints, app constants
│   │   ├── network/             # Dio client, interceptors
│   │   ├── router/              # GoRouter configuration
│   │   └── theme/               # App theme (light/dark)
│   ├── features/
│   │   ├── auth/                # Login, register, forgot password
│   │   ├── bills/               # Bills management
│   │   ├── dashboard/           # Dashboard & analytics
│   │   ├── documents/           # Document management
│   │   └── settings/            # Settings & subscriptions
│   └── shared/
│       ├── models/              # Data models (User, Bill, Document)
│       ├── services/            # API services
│       └── widgets/             # Reusable widgets
├── android/                      # Android platform files
├── ios/                          # iOS platform files
├── pubspec.yaml                  # Dependencies
└── analysis_options.yaml         # Linting rules
```

## State Management

We use **Riverpod** for state management with the following patterns:

- `StateNotifierProvider` - For complex state with actions
- `FutureProvider` - For async data fetching
- `Provider` - For services and computed values

Example:
```dart
// Provider for auth state
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>(...);

// Access in widgets
final authState = ref.watch(authStateProvider);
final isLoggedIn = ref.watch(isAuthenticatedProvider);
```

## API Integration

The app connects to the Grepre SmartLife FastAPI backend:

- Base URL configured in `api_constants.dart`
- JWT authentication with automatic token refresh
- Error handling with user-friendly messages
- Network interceptors for logging and auth

## Theming

The app supports both light and dark themes:

- Material 3 design system
- Custom brand colors (green primary)
- Automatic system theme detection
- User preference persistence

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `flutter analyze` and `flutter test`
4. Submit a pull request

## License

Proprietary - Grepre SmartLife
