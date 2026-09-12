# LightSync

LightSync is a web app that turns an audience's phones into a synchronized light show.

The idea is simple: an organizer creates a show, the audience scans a QR code to join, and when the show starts, everyone's phone reacts together to the same timeline. It is designed for stadiums, arenas, events, concerts, and other large audience experiences.

## How it works

1. The organizer creates a show.
2. LightSync generates a QR code for the audience.
3. People scan the QR code and join from their phones.
4. The organizer starts the show from the control panel.
5. LightSync sends the show state and timing through Firebase in real time.
6. Audience phones respond together with the programmed lights and interactions.

## What it includes

- Organizer dashboard and show management
- QR-based audience joining
- Real-time audience connection tracking
- Synchronized phone flashlight effects
- Show timelines and controls
- Sports interactions and polls
- A dedicated sports screen
- Anonymous audience authentication
- Organizer authentication with email and password
- Separate public and private event data
- Firebase Realtime Database security rules
- Support for multiple shows

## Tech stack

- React + TypeScript
- Vite
- Firebase Authentication
- Firebase Realtime Database
- React Router
- QRCode React
- Vercel

## Project structure

The application is split into a few main areas:

- `src/firebase/` — Firebase configuration, authentication, database access, analytics, and sports functionality
- `src/pages/` — main application pages and routes
- `src/components/` — reusable UI components
- `database.rules.json` — Firebase Realtime Database security rules

The audience side and organizer side use separate routes and permissions. Audience users are identified with Firebase anonymous authentication, while organizers use their authenticated accounts.

## Running locally

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create the required Firebase environment variables in your local environment before running the app.

For a production build:

```bash
npm run build
```

## Firebase

LightSync uses Firebase Realtime Database for the real-time parts of the application. The database rules are kept in `database.rules.json` so the security model is version-controlled alongside the application.

The Firebase project itself is not stored in this repository. Firebase configuration is provided through environment variables.

## Deployment

The application can be deployed as a standard Vite application. The current production deployment uses Vercel.

When making changes to Firebase security rules, make sure the rules are also published to the Firebase project. Updating `database.rules.json` in GitHub alone does not change the live Firebase rules unless the project is configured to deploy them automatically.

## Roadmap

LightSync is currently focused on getting the core experience reliable in real event conditions.

Future work can include:

- Larger audience and load testing
- More advanced light effects and show timelines
- Better organizer analytics
- More sports and audience interaction features
- Additional tools for large-scale event production

## Status

LightSync is an active project and is currently at the MVP stage, with the core organizer, audience, real-time synchronization, and sports interaction flows in place.
