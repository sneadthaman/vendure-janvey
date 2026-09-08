---
type: patch
areas:
  - site
---

## Intent

Avoid React's executable script warning when next-themes mounts on the client.

## Invariants

- Server HTML retains the executable initialization script to apply the theme before paint.
- Client mounts mark the script as text/plain; next-themes effects continue to apply theme changes.
- Saved themes, system preferences, and theme switching remain supported.

## Integration guidance

Preserve the environment-dependent scriptProps type when customizing the theme provider. next-themes suppresses hydration warnings on its initialization script, whose type intentionally differs between server and client.

## Verification

- Reload with a saved dark theme and verify it is applied before hydration.
- Navigate between pages and switch between light, dark, and system themes without the React script warning.
