# Project Overview - MOC-NHIEN Logistics Tracking System

## 1. Base Idea

### Purpose
A logistics tracking system for international shipping between US and Vietnam, featuring:
- Order management with real-time USD/VND currency conversion
- User authentication and order tracking
- Admin dashboard for order approval and management

### Users
- **Customer**: Create orders, track shipments, view order history
- **Admin**: Approve orders, manage pricing, view all orders, update order status

### Problem Solved
- Simplifies international order tracking with automatic currency conversion
- Provides transparent pricing in both USD and VND
- Enables customers to track their shipments in real-time

---

## 2. System Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose ODM |
| Authentication | JWT (Bearer Token + HttpOnly Cookie) |

### Design Decisions
- **Email-based Order Isolation**: Orders linked to users via `customerEmail`/`userEmail` field
- **Real-time Currency**: Exchange rates fetched from external API with 5-minute cache
- **JWT Authentication**: Token stored in HttpOnly cookie for security
- **Role-based Access**: Middleware enforces admin vs user permissions

### API Base URL
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- API Prefix: `/api`

---

## 3. Folder Structure

```
moc-nhien-authentic/
├── backend/
│   ├── config/
│   │   ├── db.js           # MongoDB connection config
│   │   └── env.js          # Environment variables
│   ├── controllers/
│   │   ├── authController.js    # Login, register, logout
│   │   ├── dashboardController.js # Dashboard stats
│   │   ├── meController.js       # Current user profile
│   │   ├── orderController.js    # Order CRUD, tracking, approval
│   │   └── userController.js     # User management
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification
│   │   ├── asyncHandler.js        # Async wrapper
│   │   ├── errorHandler.js        # Global error handler
│   │   └── roleMiddleware.js      # Role check (admin/user)
│   ├── models/
│   │   ├── Order.js               # Order schema
│   │   └── User.js                # User schema
│   ├── routes/
│   │   ├── authRoutes.js          # /auth/* endpoints
│   │   ├── dashboardRoutes.js     # /dashboard/* endpoints
│   │   ├── index.js               # Central router
│   │   ├── meRoutes.js            # /me/* endpoints
│   │   ├── orderRoutes.js         # /orders/* endpoints
│   │   ├── quoteRoutes.js         # /quotes/* endpoints
│   │   └── userRoutes.js          # /user/* endpoints
│   ├── services/
│   │   └── exchangeRateService.js # Currency API + caching
│   ├── scripts/
│   │   ├── migrate-userEmail.js   # Migration: populate userEmail
│   │   └── verify-emails.js       # Debug: check email consistency
│   ├── utils/
│   │   └── exchangeRate.js        # Legacy exchange rate utils
│   └── server.js                  # Express app entry point
│
├── src/ (Frontend)
│   ├── components/
│   │   ├── AdminRoute.tsx         # Admin-only route guard
│   │   ├── Layout.tsx             # Main layout wrapper
│   │   ├── ProtectedRoute.tsx    # Auth-required route guard
│   │   └── Toast.tsx              # Success/error notifications
│   ├── context/
│   │   └── UserContext.tsx       # React context for auth state
│   ├── lib/
│   │   ├── api.ts                 # Axios HTTP client with auth
│   │   ├── auth.ts                # Token storage helpers
│   │   └── formatters.ts          # Currency/date formatting
│   ├── pages/
│   │   ├── Dashboard.tsx          # User dashboard + create order
│   │   ├── Tracking.tsx           # Order tracking page
│   │   ├── Login.tsx / Register.tsx
│   │   ├── AdminDashboard.tsx     # Admin stats
│   │   ├── AdminOrders.tsx        # Admin order management
│   │   └── OrderDetail.tsx        # Individual order view
│   ├── utils/
│   │   └── formatCurrency.ts      # Backup currency formatters
│   ├── App.tsx                    # React Router setup
│   └── main.tsx                   # React entry point
│
├── .env                           # Environment variables
├── package.json                   # Frontend dependencies
└── backend/package.json           # Backend dependencies
```

---

## 4. Core Features

### Authentication
- JWT-based login/register with bcrypt password hashing
- HttpOnly cookie storage for tokens
- Auto-logout on token expiration
- Role-based access control (user/admin)

### Order Management
- **User**: Create orders, view own orders, track shipments
- **Admin**: Create/edit orders, approve pending orders, update status
- **Fields**: productType, productName, productLink, addressFrom, addressTo, priceUSD, priceVND

### Currency Conversion
- Real-time USD to VND exchange rate from external API
- Automatic VND calculation when USD price is set
- Cached rates (5-minute TTL) to reduce API calls
- Fallback rate: 26,000 VND/USD

### Order Tracking
- Track by orderCode, tracking_code, or trackingId
- Timeline with status progression: pending → approved → shipping → delivered
- Email verification required for tracking

### User Dashboard
- Active shipments count
- Total spent (sum of priceUSD)
- Recent orders list
- Quick actions: create order, track package

---

## 5. Data Flow

### Order Creation (User)
```
User Form Submit
    ↓
Frontend: POST /api/orders
    ↓
JWT Middleware: Verify token
    ↓
createOrder controller:
  - Extract userEmail from req.user
  - Generate orderCode
  - Calculate priceVND from exchange rate
  - Save to MongoDB with userEmail + customerEmail
    ↓
Response: { order, message }
```

### Order Tracking (Authenticated)
```
User enters tracking code
    ↓
Frontend: GET /api/orders/track?code=XXX (with Bearer token)
    ↓
JWT Middleware: Verify token
    ↓
trackOrder controller:
  - Extract userEmail from req.user
  - Query: { $or: [customerEmail, userEmail], orderCode }
  - Return 404 if not found
    ↓
Response: { order, timeline }
```

### Dashboard Load
```
User visits /dashboard
    ↓
ProtectedRoute: Check auth
    ↓
Dashboard: GET /api/orders/my-orders
    ↓
getMyOrders controller:
  - Extract userEmail from req.user
  - Query: { $or: [customerEmail, userEmail] }
    ↓
Response: { orders[], count }
```

---

## 6. Important Methods / Logic

### Backend Controllers

#### orderController.js
| Function | Purpose |
|----------|---------|
| `createOrder` | User creates new order, auto-fills customerEmail/userEmail from JWT |
| `getMyOrders` | Fetch user's orders by email (customerEmail OR userEmail) |
| `trackOrder` | Track order by code + email verification |
| `adminCreateOrder` | Admin creates order with all fields |
| `adminUpdateOrder` | Admin updates order, handles paymentPercent (auto-100% if delivered, manual % if pending), syncs userEmail |
| `approveOrder` | Admin approves pending order, calculates VND if needed |
| `listOrders` | List orders (admins see all, users see their own) |

#### exchangeRateService.js
| Function | Purpose |
|----------|---------|
| `getExchangeRate` | Fetch USD→VND rate with caching (5-min TTL) |
| `calculateVND` | Convert USD amount to VND using current rate |
| `parseUSD` | Parse USD string (remove commas) |
| `formatUSD` / `formatVND` | Format number as currency string |

### Frontend Utilities

#### api.ts
- Axios instance with Bearer token interceptor
- Auto-attaches `Authorization: Bearer {token}` to all requests
- Returns parsed JSON data

#### formatters.ts
| Function | Purpose |
|----------|---------|
| `formatUSD(amount)` | Format as "$1,000.00" |
| `formatVND(amount)` | Format as "1.000.000 đ" |
| `parseUSD(value)` | Parse string to number |

### Middleware

#### authMiddleware.js
- Extracts token from `Authorization: Bearer` header OR `token` cookie
- Verifies JWT signature
- Attaches `req.user` with `{ _id, email, name, role }`

#### roleMiddleware.js
- Takes expected role as parameter
- Returns 403 if user doesn't have required role

---

## 7. Current State

### Completed
- [x] User authentication (login/register/logout)
- [x] JWT middleware with user context
- [x] Order schema with all required fields
- [x] User order creation (customerEmail from JWT)
- [x] Admin order management (create/edit/approve)
- [x] Order tracking with email verification
- [x] Dashboard with user orders (email-based)
- [x] Real-time currency conversion (USD↔VND)
- [x] Role-based access control
- [x] Email normalization (lowercase, trim)
- [x] Payment percentage tracking for orders
- [x] Auto-calculate paidAmount based on paymentPercent

### Partially Done
- [ ] User profile page (basic)
- [ ] Order detail page (needs verification)

### Not Implemented
- [ ] Email notifications
- [ ] Order cancellation
- [ ] Payment integration
- [ ] PDF invoice generation
- [ ] Admin user management UI

---

## 8. Change Log

### 2026-04-05

- **[PAYMENT PERCENTAGE]** - Added partial payment support for orders
  - Added `paymentPercent` field to Order schema (0-100)
  - Added `paidAmount` field to Order schema (calculated from priceVND × percent)
  - Updated `adminUpdateOrder` to handle payment logic:
    - Status = "pending" → allow input payment percentage
    - Status = "delivered" → auto-set payment to 100%
  - Updated AdminOrders modal:
    - Conditional payment percentage input (slider + number input)
    - Auto-preview estimated paid amount in VND
    - Payment status auto-updates based on percentage
  - Updated admin orders table:
    - Shows payment percentage and paid amount per row
  - Frontend: formatVND function used for displaying paid amounts

- **[AUTH REFACTOR]** - Implemented user-based order isolation
  - Added `userEmail` field to Order schema (indexed)
  - Created `GET /api/orders/my-orders` endpoint for user orders
  - Updated `trackOrder` to require authentication + email match
  - Updated routes: `/track` now requires `authMiddleware`
  - Updated Dashboard: fetches from `/api/orders/my-orders`
  - Updated Tracking: shows login prompt if not authenticated

- **[BUG FIX]** - Fixed email mismatch causing "Order not found"
  - Updated queries to check both `customerEmail` AND `userEmail`
  - Added `$or` queries in `getMyOrders`, `listOrders`, `trackOrder`
  - Normalized emails: `toLowerCase().trim()`

- **[MIGRATION]** - Created migration scripts
  - `scripts/migrate-userEmail.js` - Populates userEmail from customerEmail
  - `scripts/verify-emails.js` - Checks email consistency

- **[FORMATTER FIX]** - Fixed "formatUSD is not a function"
  - Updated `backend/services/exchangeRateService.js` with missing functions
  - Updated `src/lib/formatters.ts` with proper Intl.NumberFormat
  - Added `formatUSD` to AdminOrders import

- **[ORDER VALIDATION]** - Fixed missing required fields
  - Added `productType`, `productName`, `addressFrom`, `addressTo` to form
  - Updated backend `adminCreateOrder` to accept new fields
  - Updated form state and payload mapping

---

## 9. Database Schema Summary

### User Collection
```
{
  _id: ObjectId,
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  name: String,
  role: "user" | "admin",
  createdAt: Date,
  updatedAt: Date
}
```

### Order Collection
```
{
  _id: ObjectId,
  orderCode: String (unique, indexed),
  user: ObjectId (ref: User),
  userEmail: String (indexed) ← FOR ORDER ISOLATION,
  customerName: String,
  customerEmail: String,
  productType: String,
  productName: String,
  productLink: String,
  addressFrom: String,
  addressTo: String,
  status: "pending" | "approved" | "shipping" | "delivered",
  paymentStatus: "pending" | "paid",
  paymentPercent: Number (0-100) ← PAYMENT TRACKING,
  paidAmount: Number ← CALCULATED: priceVND × paymentPercent / 100,
  priceUSD: Number,
  priceVND: Number,
  exchangeRate: Number,
  totalUSD: Number,
  totalVND: Number,
  uspsTracking: String,
  order_date: Date,
  sold_by: String,
  approvedAt: Date,
  approvedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `Order.orderCode`: unique
- `Order.userEmail`: for user queries
- `Order.customerEmail`: for legacy compatibility
- `User.email`: unique

---

## 10. Quick Reference

### Start Development
```bash
# Frontend (from root)
npm run dev

# Backend (from backend/)
cd backend
node server.js
```

### Test Email Migration
```bash
cd backend
node scripts/verify-emails.js      # Check current state
node scripts/migrate-userEmail.js  # Run migration
```

### Key Environment Variables
```
# Backend (.env)
MONGO_URI=mongodb://localhost:27017/moc-nhien
JWT_SECRET=your-secret-key
JWT_ISSUER=moc-nhien-auth
PORT=4000

# Frontend
VITE_API_URL=http://localhost:4000
```
