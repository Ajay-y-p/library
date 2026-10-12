# Shelfwise Library Management System

A MERN application for managing a library catalog, member accounts, borrowing, returns, and overdue fines.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Start locally

1. Copy `.env.example` to `.env` and set a private `JWT_SECRET`. Set `MONGODB_URI` if MongoDB is not running at the default local address.
2. Install dependencies with `npm install`.
3. Load sample books, member accounts, and borrowing records with `npm run seed`.
4. Start the client and API with `npm run dev`.
5. Open `http://localhost:5173`.

The API runs on `http://localhost:5000`. Vite forwards `/api` requests to it during development.

## Demo accounts

- Librarian: `librarian@ashwood.test` / `library123`
- Member: `maya@example.com` / `library123`

New registrations always receive the member role. Librarian accounts must be created by the seed script or by an administrator directly in MongoDB; clients cannot assign themselves librarian privileges.

## Included workflows

- Search and filter books by title, author, ISBN, and category.
- Librarians can add books, update catalog details, register checkouts, review members, and record returns.
- Checkout decrements available inventory; a return restores it.
- Return fine is calculated from overdue days and `FINE_PER_DAY` (defaults to $1 per day).
- Members can register, browse the collection, and view only their own borrowing records.
- JWT-based authentication and server-enforced librarian authorization protect API routes.

## Production build

Run `npm run build` to compile the React client. Configure `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` in the deployment environment before starting the API with `npm run server`.
