# Tech Stack

## Backend
- **Framework:** Node.js with Fastify (TypeScript). Fastify is chosen for its high performance and excellent TypeScript support, providing a robust foundation for a real-time server.
- **Real-time Communication:** Socket.io for bi-directional, real-time synchronization of notes and user presence.
- **Authentication:** Passport.js (or similar) with Google OAuth 2.0 strategy for domain-restricted login, and a local strategy for manual allowlist users.

## Frontend
- **Framework:** React (TypeScript). Leverages a component-based architecture for a reactive and maintainable dashboard.
- **Styling:** Tailwind CSS. Enables a utility-first approach to create a clean, minimalist, and responsive user interface with minimal custom CSS.
- **State Management:** React Context API or a lightweight library like Zustand to manage shared session state and collaborative features.

## Database & Storage
- **Database:** SQLite. A lightweight, serverless, file-based database that simplifies deployment and is ideal for an open-source project aimed at easy setup.
- **ORM:** Prisma or Drizzle ORM. Provides type-safe database access and simplifies migrations while working with SQLite.

## Deployment & DevOps
- **Containerization:** Docker. To ensure consistent environments and "one-click" deployment for users.
- **CI/CD:** GitHub Actions for automated testing and linting.
