# Archived Render Blueprint

This `render.yaml` is for Render's **Blueprint** feature (paid tier).
It is archived here for future use when the project is ready for beta release.

## What it does
When placed at the repository root and connected to a Blueprint Instance on Render,
it automatically provisions and configures the backend web service — no manual
dashboard setup needed.

## How to use (future)
1. Move `render.yaml` back to the repository root
2. Push to GitHub
3. On Render Dashboard → New → Blueprint → select this repo
4. Render auto-detects the file and deploys

## Current deployment method
For now, the backend is deployed as a **free-tier Web Service** configured
manually through the Render dashboard. See the project README or deployment
docs for instructions.
