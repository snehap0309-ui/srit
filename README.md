# 🗺️ Pal Sa Safar

> **Explore India, One Spot at a Time** — A gamified tourism discovery app built with React Native.

---

## 🎮 Features

| Feature | Status | Description |
|---------|--------|-------------|
| 🗺️ **Interactive Map** | ✅ | MapLibre GL Native with category filters, search, 3D buildings |
| 📍 **Geofencing** | ✅ | Haversine-based 50m proximity detection |
| 🏛️ **28+ Tourist Spots** | ✅ | Curated locations with descriptions |
| 🎯 **GPS Activities** | ✅ | Check-in, trivia, observation challenges |
| 📕 **Digital Passport** | ✅ | Visit tracking, badges, completion stats |
| 📋 **Smart Itinerary** | ✅ | Nearest-neighbor routing |
| ⭐ **Pal Points System** | ✅ | Earn points, unlock badges, redeem offers |
| 🎁 **Vendor Offers** | ✅ | Local business discounts via point redemption |
| 🎬 **Reels** | ✅ | Short video content with like/comment/share |
| 💎 **Hidden Gems** | ✅ | Community-submitted spots with admin approval |
| 🔐 **JWT Auth** | ✅ | Email/password with role-based access |
| 🗄️ **PostgreSQL + Prisma** | ✅ | Relational data persistence |
| 🎨 **Dark Theme** | ✅ | Premium purple/gold gamified UI |
| 🏪 **Vendor Portal** | ✅ | Business registration, offer management, QR redemption |
| 🛡️ **Admin Dashboard** | ✅ | Next.js web app for vendor verification, gem moderation, user management |

---

## 🚀 Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile Framework | **React Native 0.81** (CLI) |
| Admin Dashboard | **Next.js 14** (App Router) |
| Server API | **Express + TypeScript** |
| Database | **PostgreSQL** (Neon serverless) |
| ORM | **Prisma** |
| Map | **MapLibre GL Native** (OpenFreeMap tiles) |
| Navigation | **React Navigation 7** (native-stack + bottom-tabs) |
| Video | **react-native-vision-camera** + **react-native-compressor** |
| Geolocation | **react-native-geolocation-service** |
| Icons | **react-native-vector-icons** (Ionicons) |
| Validation | **Zod** (server-side request validation) |
| Caching | **In-memory cache** (Redis-swappable interface) |
| Logging | **Pino** (structured JSON) |
| Storage | **AsyncStorage** (local cache) |
| Routing | **OSRM** (walking directions via OpenStreetMap) |

---

## 🛠️ Quick Start

### Prerequisites
- **Node.js 18+**
- **npm**
- **React Native CLI** setup (Android Studio / Xcode)

### Setup
```bash
git clone <repo-url>
cd PalSaSafar
npm install
```

### Android
```bash
npx react-native run-android
```

### iOS
```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

---

## 🗄️ Server API Setup

The app requires a running **Express API server** connected to **PostgreSQL** (Neon).

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended — free tier available)
- A `.env` file in `server/` with:
  ```
  DATABASE_URL="postgresql://..."
  DIRECT_URL="postgresql://..."  # for migrations
  JWT_SECRET="your-secret-key"
  ```

### Setup
```bash
cd server
npm install
npx prisma db push        # sync schema
npm run db:seed           # create users + initial data
npm run db:seed:curated   # upsert 80 curated places
npm run dev               # starts on port 3001
```

### Mobile: Enable Server API
In `src/config/devFlags.ts`, set:
```ts
USE_SERVER_API: true
```

---

## 📁 Project Structure

```
PalSaSafar/
├── App.tsx                          # Root (providers + navigation)
├── index.js                         # Entry point
├── src/                             # Mobile app
│   ├── config/
│   │   ├── devFlags.ts              # Feature flags (USE_SERVER_API, etc.)
│   │   ├── theme.ts                 # Colors, spacing, shadows
│   │   ├── mapStyles.ts             # MapLibre style URLs
│   │   └── api.ts                   # API base URL config
│   ├── navigation/                  # Auth guard + role routing
│   ├── screens/                     # 25+ screens
│   ├── components/                  # Reusable UI components
│   ├── context/                     # Theme, User, Data, Location
│   ├── hooks/                       # Auth, Location hooks
│   ├── services/                    # API clients, location, routing
│   ├── types/                       # TypeScript interfaces
│   └── utils/                       # Helpers (placeUtils, itinerary, etc.)
├── server/                          # Express API server
│   ├── src/
│   │   ├── app.ts                   # Express app setup
│   │   ├── config/                  # DB, cache, events, rate-limit
│   │   ├── middleware/              # Auth, validation, admin
│   │   ├── modules/                 # Feature modules
│   │   │   ├── auth/               # Login, register, JWT
│   │   │   ├── places/             # CRUD, search, geo, stats, recs
│   │   │   ├── hidden-gems/        # Community submissions
│   │   │   ├── social/             # Follows, collections, trips
│   │   │   ├── gamification/       # XP, levels, badges, streaks
│   │   │   ├── geospatial/         # Nearby, route, heatmap
│   │   │   ├── ai/                 # Recommendations, trip planner
│   │   │   ├── analytics/          # Dashboard metrics
│   │   │   └── vendors/            # Vendor management
│   │   ├── shared/                  # Pagination, geo utils, errors
│   │   └── __tests__/               # 16 integration tests
│   ├── prisma/
│   │   ├── schema.prisma            # DB schema (Place, User, etc.)
│   │   ├── seed.ts                  # 3 users + 367 demo places
│   │   ├── seed-curated-places.ts   # 80 curated places
│   │   └── seed-utils/              # Slug, batch, category-map, etc.
│   └── package.json
├── admin/                           # Next.js admin dashboard
└── scripts/                         # Data extraction, migration tools
```

---

## 🎮 How It Works

### Authentication
- Sign up / Login with email/password (JWT tokens via Express server at `/api/v1/auth`)
- Role-based routing (tourist → mobile tabs, vendor → dashboard, admin → Next.js web dashboard)

### Map & Exploration
- Real-time GPS tracking updates avatar position
- MapLibre dark map with category-filtered markers
- 50m geofence triggers arrival detection
- Hidden gems shown with glow markers

### Rewards System
- **Pal Points** earned by visiting spots, completing activities, uploading reels
- **Badges** unlocked by achievements
- Points redeemable at vendor businesses for discounts

### Vendor Ecosystem
- Register your tourism business
- Create discount offers with point requirements
- QR code redemption system
- Dashboard with analytics

### Community
- Upload short reels (videos) tagged to spots
- Submit hidden gems for admin review
- Like, comment, share content
- Earn points for contributions

---

## 🧪 Testing

```bash
# Server API (Vitest — 16 integration tests)
cd server && npm test

# Mobile TypeScript check
npx tsc --noEmit

# Server TypeScript check
cd server && npx tsc --noEmit
```

---

## 📄 License

MIT — Free to use, modify, and distribute.

Built with ❤️ for India's travelers 🇮🇳
