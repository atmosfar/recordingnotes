# Specification: Deployment Documentation

## Overview
Create a comprehensive `README.md` to enable users to easily install and deploy a fresh instance of Recording Notes on a VPS. The focus is on clarity, prerequisites, and production-ready configuration.

## Functional Requirements
- **Prerequisites Section:** Clearly state the mandatory requirement for **Node.js 22.5+** due to the `node:sqlite` (DatabaseSync) dependency. Provide commands to check the current version.
- **Quick Start Guide:** A step-by-step "copy-paste" guide for cloning, installing dependencies, and initializing the database.
- **Environment Reference:** A detailed table explaining each variable in `.env.example` (Auth, Secrets, Tokens).
- **Reverse Proxy Snippets:** Provide example configurations for **Nginx** and **Caddy**, specifically highlighting the settings required for WebSocket support and SSL termination.

## User Interface
- **README.md:** A well-structured Markdown file in the project root.
- **Formatting:** Use code blocks, tables, and clear headings for high readability.

## Technical Details
- **Node.js Warning:** Document that the project uses experimental features (`node:sqlite`) and requires the `--experimental-sqlite` flag (though Node 22.5+ handles this more natively, versioning is key).
- **Database Init:** Document `npm run init-db` as a required setup step.
- **WebSocket support:** Ensure Nginx snippets include `Upgrade` and `Connection` headers.

## Acceptance Criteria
- [ ] `README.md` exists in the root directory.
- [ ] Prerequisites section highlights Node 22.5+.
- [ ] Quick start commands work on a clean Ubuntu/Debian environment.
- [ ] Environment variables are fully documented.
- [ ] Nginx/Caddy examples include WebSocket headers.

## Out of Scope
- Automated `setup.sh` scripts.
- Docker/Containerization support (for this iteration).
- Extensive OS-level security hardening guides.
