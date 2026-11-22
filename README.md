# ⚙️ FixMate API Server

Backend REST API for **FixMate — Smart Device & Home Appliance Repair Service Platform**, built with Node.js, Express.js, MongoDB Atlas, JWT Role-Based Access Control (RBAC), 2-way messaging & review endpoints, and Stripe Checkout + Webhooks.

## 🔗 Live & Repository Links
- **Live Server URL:** [https://fixmate-server-wrsy.onrender.com](https://fixmate-server-wrsy.onrender.com)
- **Live Frontend:** [https://fixmate-client-delta.vercel.app](https://fixmate-client-delta.vercel.app)
- **Client Repository:** [https://github.com/nazifa-buildscodes/fixmate-client](https://github.com/nazifa-buildscodes/fixmate-client)
- **Server Repository:** [https://github.com/nazifa-buildscodes/fixmate-server](https://github.com/nazifa-buildscodes/fixmate-server)

---

## ✨ Core Backend Capabilities

1. **Server-Side Search, Filter, Sort & Pagination (`/api/services`):**
   MongoDB-powered query filtering by keyword, category, service mode, sorting (`price_asc`, `price_desc`, `newest`), `.skip()` / `.limit()` pagination, and enriched technician contact details (`phone` / `email`) on `GET /api/services/:id`.
2. **JWT & Role-Based Middlewares:**
   Custom Express middlewares (`verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`) and `resolveRequestUser` returning `401 Unauthorized` / `403 Forbidden` and enforcing ownership checks on private endpoints.
3. **2-Way Messaging & Role-Based Reviews:**
   Endpoints for creating inquiries (`POST /api/messages`), loading role-scoped messages (`GET /api/messages/my`), replying/updating replies (`PATCH /api/messages/:id/reply`), deleting authorized messages (`DELETE /api/messages/:id`), and fetching technician or admin review feeds (`GET /api/reviews/technician`, `GET /api/reviews/admin`).
4. **Server-Enforced Job Status Pipeline & Payment Gate:**
   Strict forward-only transitions (`requested → accepted/rejected → in-progress → completed → paid`), duplicate active booking prevention, and payment blocked unless `status === 'completed'` and `paymentStatus === 'unpaid'`.
5. **Idempotent Stripe Checkout & Webhook:**
   Server-side price calculation from the database (`finalAmount`), Stripe Checkout Session creation (`BDT`), `/api/payments/verify`, and `/api/payments/webhook` (`checkout.session.completed`) protected by a unique MongoDB index on `stripeSessionId`.
6. **Database Architecture:**
   Core MongoDB collections including `users`, `services`, `bookings`, `payments`, and `messages`, plus a `seed.js` script for initial service data.

---

## 📡 API Endpoints Overview

| Area | Endpoint | Access |
| :--- | :--- | :--- |
| **Services** | `GET /api/services`, `GET /api/services/:id` | Public |
| **Services (Tech)** | `POST /api/services`, `GET /api/services/my`, `PATCH/DELETE /api/services/:id` | Technician |
| **Bookings (Customer)** | `POST /api/bookings`, `GET /api/bookings/my`, `PATCH /api/bookings/:id/cancel`, `PATCH /api/bookings/:id/review` | Customer |
| **Bookings (Tech)** | `GET /api/bookings/technician`, `PATCH /api/bookings/:id/status` | Technician |
| **Messages** | `POST /api/messages`, `GET /api/messages/my`, `PATCH /api/messages/:id/reply`, `DELETE /api/messages/:id` | Public (POST) / Authenticated |
| **Reviews** | `GET /api/reviews/technician`, `GET /api/reviews/admin` | Technician / Admin |
| **Payments** | `POST /api/payments/create-checkout-session`, `GET /api/payments/verify`, `GET /api/payments/my` | Customer |
| **Stripe Webhook** | `POST /api/payments/webhook` | Stripe |
| **Profile & Stats** | `GET /api/users/me`, `PATCH /api/users/profile`, `GET /api/dashboard/*` | Authenticated |
| **Admin** | `GET/PATCH /api/admin/users`, `PATCH /api/admin/services/:id/approval`, `GET /api/admin/bookings`, `GET /api/admin/payments` | Admin |

---

## 📦 NPM Packages Used

| Package | Purpose |
| :--- | :--- |
| `express` | REST API server framework |
| `mongodb` | Official MongoDB Node.js driver |
| `jsonwebtoken` | JWT token verification for protected routes |
| `stripe` | Stripe Checkout Session creation and Webhook verification |
| `cors` | Cross-Origin Resource Sharing configuration |
| `dotenv` | Environment variable management |
| `nodemon` *(dev)* | Auto-restart during local development |

---

## 🚀 Local Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/nazifa-buildscodes/fixmate-server.git
   cd fixmate-server
   npm install

   
## 👩‍💻 Author

# Nazifa Nowsin

Portfolio: https://nazifa-nowsin-portfolio.vercel.app/

LinkedIn: https://www.linkedin.com/in/nazifa-nowsin-7b7459243/

GitHub: https://github.com/nazifa-buildscodes