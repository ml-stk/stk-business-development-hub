# STK Business Development Hub

Enterprise Business Development, Account Intelligence & Command Chain Management Platform for STK.

## Architecture

```text
Firebase Project (stk-business-development-hub)
    ├── Firebase Authentication (Google Sign-In / Email Password)
    └── Cloud Firestore
            └── Named database: stk-bizdev-hub-uat
```

## Cloud Firestore Named Database

This application connects to the **named Cloud Firestore database**: `stk-bizdev-hub-uat`.

### Environment Configuration

Configure the following environment variables in `.env` or your deployment platform:

```env
VITE_FIREBASE_API_KEY="<your-api-key>"
VITE_FIREBASE_AUTH_DOMAIN="stk-business-development-hub.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="stk-business-development-hub"
VITE_FIREBASE_STORAGE_BUCKET="stk-business-development-hub.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="607604777123"
VITE_FIREBASE_APP_ID="1:607604777123:web:289ed08de65ab969501f16"

# Named Cloud Firestore Database
VITE_FIREBASE_DATABASE_ID=stk-bizdev-hub-uat
```

### Central Modular SDK Initialization

All database queries, writes, listeners, and batch operations use the central `db` instance exported from `src/config/firebase.ts`:

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const configuredDatabaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID || 'stk-bizdev-hub-uat';

export const db = initializeFirestore(
  app,
  {},
  configuredDatabaseId
);
```

---

## Role-Based Access Control (RBAC) Matrix

The system enforces 4 discrete roles with granular permissions in `firestore.rules`:

| Role | Organisations | Contacts | Engagements | Tasks | Opportunities | Settings / Users |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full System & RBAC Governance |
| **BDM_MANAGER** | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Master Data Settings Management |
| **BDM** | Create, Read, Update | Create, Read, Update | Create, Read, Update | Create, Read, Update | Create, Read, Update | Read Only |
| **ACCOUNT_MANAGER** | Read, Update Notes | Read, Update Notes | Log Follow-ups | Assigned Tasks | Update Assigned Deals | Read Only |

### Firestore Security Rules Deployment

To deploy the hardened security rules to the Firebase project:

```bash
firebase deploy --only firestore:rules
```

---

## Key Features

1. **Target Organisation Registry**: Categorized targets (Primary / Secondary), Industry sectors, Priority tiers, and Aliases with duplicate detection.
2. **Command Chain & Stakeholder Heatmap**: Tree hierarchy modeling (`reportsToContactId`), Decision roles (Decision Maker, Evaluator, Procurement, Gatekeeper), and Influence levels.
3. **Multi-Touch Engagement Logging**: Meeting minutes, purpose tracking, next engagement dates, and automated follow-up tasks.
4. **Commercial Opportunity Pipeline**: Discovery to Closure stages, solution category mapping, and win/loss audit tracking.
5. **Excel Migration Engine (`.xlsx`, `.xls`, `.csv`)**: Automatic header mapping and entity reconciliation for legacy Excel workbooks.
6. **Task & Action Worklist**: Dynamic classification (Overdue, Due Today, Due This Week, Upcoming) with alert notifications.

---

## Build & Test Scripts

```bash
# Install dependencies
npm install

# Type-check / Lint
npm run lint

# Build production bundle
npm run build
```
