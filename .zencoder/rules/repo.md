---
description: Repository Information Overview
alwaysApply: true
---

# Repository Information Overview

## Repository Summary
HenscoPOS is a modern, production-ready Point of Sale (POS) and inventory management system. It is built as a Next.js 15 application supercharged with AI-ready scaffolds, featuring a comprehensive suite of UI components, state management, and database integration.

## Repository Structure
- **`src/`**: Main application source (App Router, components, hooks, lib).
- **`prisma/`**: Database schema (PostgreSQL) and migrations.
- **`pos_app/`**: A self-contained variant/duplicate of the POS application using SQLite.
- **`skills/`**: A collection of modular AI capabilities (e.g., ASR, LLM, Image Gen).
- **`examples/`**: Supplemental examples for features like WebSockets.
- **`public/`**: Static assets and public resources.

### Main Repository Components
- **Core POS App**: The primary Next.js application located at the root.
- **AI Skills Library**: Modular definitions for AI-powered features in the `skills/` directory.
- **Development Variant**: A secondary instance of the application in `pos_app/` likely for local development or testing with SQLite.

## Projects

### Main POS App (Root)
**Configuration File**: `package.json`, `next.config.ts`, `prisma/schema.prisma`

#### Language & Runtime
**Language**: TypeScript  
**Version**: 5.x  
**Runtime**: Bun / Node.js  
**Build System**: Next.js 15  
**Package Manager**: Bun (using `bun.lock`)

#### Dependencies
**Main Dependencies**:
- `next`: ^16.1.1 (Next.js 15/16 canary)
- `react`: ^19.2.3
- `@prisma/client`: ^6.11.1
- `@tanstack/react-query`: ^5.82.0
- `@tanstack/react-table`: ^8.21.3
- `zustand`: ^5.0.6
- `lucide-react`: ^0.525.0
- `framer-motion`: ^12.23.2
- `shadcn/ui` (via `@radix-ui/*`)
- `next-auth`: ^4.24.11

**Development Dependencies**:
- `tailwindcss`: ^4
- `typescript`: ^5
- `eslint`: ^9

#### Build & Installation
```bash
# Install dependencies
bun install

# Database setup
bun run db:generate
bun run db:push

# Development
bun run dev

# Build for production
bun run build
```

#### Testing
**Framework**: No formal testing framework (Jest/Vitest) detected.
**Test Location**: N/A
**Naming Convention**: N/A
**Configuration**: N/A

**Run Command**:
```bash
# Linting
bun run lint
```

### Variant POS App (pos_app)
**Configuration File**: `pos_app/package.json`, `pos_app/prisma/schema.prisma`

#### Language & Runtime
**Language**: TypeScript  
**Version**: 5.x  
**Runtime**: Bun  
**Build System**: Next.js 15  
**Package Manager**: Bun

#### Dependencies
**Main Dependencies**:
Identical to root project, with minor version variations (e.g., `react`: ^19.0.0). Uses SQLite as the primary datasource.

#### Build & Installation
```bash
cd pos_app
bun install
bun run dev
```

### AI Skills Library (skills)
**Type**: Modular documentation and resources repository.

#### Specification & Tools
**Type**: AI Capability Definitions  
**Required Tools**: Bun (for some sub-packages), Python (for some scripts).

#### Key Resources
**Main Files**:
- `skills/*/SKILL.md`: Detailed documentation for each AI capability.
- `skills/frontend-design/package.json`: Component-specific dependencies.

#### Usage & Operations
**Integration Points**:
Provides blueprints and scripts for integrating ASR, LLM, TTS, and other AI services into the POS application.

#### Validation
**Quality Checks**: Documentation-driven validation; some scripts (like `xlsx/recalc.py`) provide functional utilities.
