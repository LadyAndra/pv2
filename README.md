# Prairie Village — Birthday Build

## Phase 2.1: Mobile Split Controls

This version adds the first phone-control layer while preserving the
working Phase 2 game.

## Current features

- Small top-down canvas map
- Mike movement in four directions
- Arrow-key controls
- WASD controls
- Left-thumb analog joystick on phones
- Right-thumb action button on phones
- Spacebar or Enter as desktop action input
- Henry delayed-follow behavior
- Full-sprite map-boundary collision
- Letter-grid sprite rendering
- Crisp, unsmoothed pixels
- Relative paths suitable for GitHub Pages

## Important action-button note

The action button is wired into the shared input system, but it does not
yet perform an in-game action. That is intentional. The next interaction
feature can use `input.action` without rebuilding the mobile controls.

## Files

```text
index.html
styles.css
sprites.js
game.js
README.md
```

## Uploading to GitHub

Replace the existing files in the repository with these complete files.
Keep the filename `styles.css` exactly as written because `index.html`
loads `./styles.css`.

## Desktop test

1. Open the hosted game.
2. Move Mike with Arrow keys or WASD.
3. Confirm Henry follows.
4. Hold Space or Enter and confirm the action button displays its pressed
   state if the touch controls are visible in a narrow browser window.

## Phone test

1. Open the GitHub Pages link on a phone.
2. Place the left thumb on the joystick.
3. Drag in every direction, including diagonally.
4. Release the thumb and confirm Mike stops immediately.
5. Move Mike to every map edge and confirm his full sprite remains visible.
6. Press and release the right action button.
7. Confirm the page does not scroll while using either control.
8. Confirm two thumbs can operate joystick and action simultaneously.

## Scope intentionally unchanged

This version still does not add houses, trees, rabbits, gardening,
crafting, saving, audio, weather, or PWA installation.
