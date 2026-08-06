"use strict";

/*
  Prairie Village
  Phase 2.1 — Mobile Split Controls

  This file contains:

  1. Canvas setup
  2. Letter-grid sprite rendering
  3. Map rendering
  4. Keyboard input
  5. Left-thumb analog joystick input
  6. Right-thumb action button input
  7. Mike movement
  8. Full-sprite map-boundary collision
  9. Henry's delayed following
  10. The animation loop

  It intentionally does not yet contain:

  - houses
  - trees
  - rabbits
  - gardening
  - crafting
  - saving
  - audio
  - PWA registration
*/

/* ------------------------------------------------------------------ */
/* Canvas and control setup                                            */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");

const joystickZone = document.getElementById("joystick-zone");
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");
const actionButton = document.getElementById("action-button");

context.imageSmoothingEnabled = false;
canvas.tabIndex = 0;

window.addEventListener("load", () => {
  canvas.focus();
});

/* ------------------------------------------------------------------ */
/* World measurements                                                  */
/* ------------------------------------------------------------------ */

const TILE_SIZE = 16;
const CHARACTER_CELL_SCALE = 2;
const TERRAIN_CELL_SCALE = 2;
const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

const gameState = {
  previousFrameTime: 0,

  mike: {
    x: 80,
    y: 128,
    speed: 72,
    direction: "down",
    moving: false
  },

  henry: {
    x: 54,
    y: 132,
    direction: "right"
  },

  mikePositionHistory: [],
  henryDelayMilliseconds: 280
};

/* ------------------------------------------------------------------ */
/* Shared input state                                                  */
/* ------------------------------------------------------------------ */

const input = {
  up: false,
  down: false,
  left: false,
  right: false,

  /*
    Analog joystick values range from -1 to 1.
  */
  joystickX: 0,
  joystickY: 0,

  /*
    The action input is ready for the next gameplay feature.
    It currently changes button state but does not trigger an in-game
    interaction because no interaction system exists yet.
  */
  action: false
};

/* ------------------------------------------------------------------ */
/* Keyboard input                                                      */
/* ------------------------------------------------------------------ */

function setKeyState(key, isPressed) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "arrowup" || normalizedKey === "w") {
    input.up = isPressed;
  }

  if (normalizedKey === "arrowdown" || normalizedKey === "s") {
    input.down = isPressed;
  }

  if (normalizedKey === "arrowleft" || normalizedKey === "a") {
    input.left = isPressed;
  }

  if (normalizedKey === "arrowright" || normalizedKey === "d") {
    input.right = isPressed;
  }
}

function isMovementKey(key) {
  return [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d"
  ].includes(key.toLowerCase());
}

window.addEventListener("keydown", (event) => {
  if (isMovementKey(event.key)) {
    event.preventDefault();
    setKeyState(event.key, true);
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    setActionState(true);
  }
});

window.addEventListener("keyup", (event) => {
  if (isMovementKey(event.key)) {
    event.preventDefault();
    setKeyState(event.key, false);
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    setActionState(false);
  }
});

/* ------------------------------------------------------------------ */
/* Mobile analog joystick                                              */
/* ------------------------------------------------------------------ */

const joystickState = {
  activePointerId: null,
  maximumRadius: 0
};

/*
  Keep a number inside a minimum and maximum value.
*/
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/*
  Reset the joystick to its resting position.
*/
function resetJoystick() {
  joystickState.activePointerId = null;
  input.joystickX = 0;
  input.joystickY = 0;

  joystickBase.classList.remove("is-active");
  joystickKnob.style.transform = "translate(-50%, -50%)";
}

/*
  Convert a pointer position into normalized joystick input.

  The base is fixed visually in the lower-left corner. The player may
  touch anywhere in the left half; movement is calculated relative to
  the visible base center so the control feels consistent.
*/
function updateJoystickFromPointer(event) {
  const baseRectangle = joystickBase.getBoundingClientRect();

  const centerX = baseRectangle.left + baseRectangle.width / 2;
  const centerY = baseRectangle.top + baseRectangle.height / 2;

  const differenceX = event.clientX - centerX;
  const differenceY = event.clientY - centerY;

  const distance = Math.hypot(differenceX, differenceY);
  const maximumRadius = baseRectangle.width * 0.34;
  const deadZone = maximumRadius * 0.15;

  joystickState.maximumRadius = maximumRadius;

  if (distance <= deadZone) {
    input.joystickX = 0;
    input.joystickY = 0;
    joystickKnob.style.transform = "translate(-50%, -50%)";
    return;
  }

  const limitedDistance = Math.min(distance, maximumRadius);
  const directionX = differenceX / distance;
  const directionY = differenceY / distance;

  const knobX = directionX * limitedDistance;
  const knobY = directionY * limitedDistance;

  input.joystickX = clamp(differenceX / maximumRadius, -1, 1);
  input.joystickY = clamp(differenceY / maximumRadius, -1, 1);

  joystickKnob.style.transform =
    `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

joystickZone.addEventListener("pointerdown", (event) => {
  if (joystickState.activePointerId !== null) {
    return;
  }

  event.preventDefault();

  joystickState.activePointerId = event.pointerId;
  joystickZone.setPointerCapture(event.pointerId);
  joystickBase.classList.add("is-active");

  updateJoystickFromPointer(event);
});

joystickZone.addEventListener("pointermove", (event) => {
  if (event.pointerId !== joystickState.activePointerId) {
    return;
  }

  event.preventDefault();
  updateJoystickFromPointer(event);
});

function finishJoystickPointer(event) {
  if (event.pointerId !== joystickState.activePointerId) {
    return;
  }

  event.preventDefault();

  if (joystickZone.hasPointerCapture(event.pointerId)) {
    joystickZone.releasePointerCapture(event.pointerId);
  }

  resetJoystick();
}

joystickZone.addEventListener("pointerup", finishJoystickPointer);
joystickZone.addEventListener("pointercancel", finishJoystickPointer);
joystickZone.addEventListener("lostpointercapture", resetJoystick);

/* ------------------------------------------------------------------ */
/* Mobile action button                                                */
/* ------------------------------------------------------------------ */

function setActionState(isPressed) {
  input.action = isPressed;
  actionButton.classList.toggle("is-pressed", isPressed);
  actionButton.setAttribute("aria-pressed", String(isPressed));
}

function pressActionButton(event) {
  event.preventDefault();
  actionButton.setPointerCapture(event.pointerId);
  setActionState(true);
}

function releaseActionButton(event) {
  event.preventDefault();

  if (actionButton.hasPointerCapture(event.pointerId)) {
    actionButton.releasePointerCapture(event.pointerId);
  }

  setActionState(false);
}

actionButton.addEventListener("pointerdown", pressActionButton);
actionButton.addEventListener("pointerup", releaseActionButton);
actionButton.addEventListener("pointercancel", releaseActionButton);
actionButton.addEventListener("lostpointercapture", () => {
  setActionState(false);
});

/*
  Prevent the button's synthetic click from scrolling or shifting focus
  after a touch interaction.
*/
actionButton.addEventListener("click", (event) => {
  event.preventDefault();
});

/*
  Clear every held input if the browser loses focus.
*/
window.addEventListener("blur", () => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  setActionState(false);
  resetJoystick();
});

/* ------------------------------------------------------------------ */
/* Letter-grid sprite measurements                                     */
/* ------------------------------------------------------------------ */

function getSpritePixelSize(sprite, cellScale) {
  const gridHeight = sprite.grid.length;
  const gridWidth = sprite.grid[0].length;

  return {
    width: gridWidth * cellScale,
    height: gridHeight * cellScale
  };
}

/* ------------------------------------------------------------------ */
/* Letter-grid sprite rendering                                        */
/* ------------------------------------------------------------------ */

function drawLetterGridSprite(sprite, worldX, worldY, cellScale) {
  const grid = sprite.grid;
  const palette = sprite.palette;
  const spriteSize = getSpritePixelSize(sprite, cellScale);

  let drawX = worldX;
  let drawY = worldY;

  if (sprite.anchor === "bottom-center") {
    drawX = Math.round(worldX - spriteSize.width / 2);
    drawY = Math.round(worldY - spriteSize.height);
  } else {
    drawX = Math.round(worldX);
    drawY = Math.round(worldY);
  }

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];

    for (
      let columnIndex = 0;
      columnIndex < row.length;
      columnIndex += 1
    ) {
      const letter = row[columnIndex];

      if (letter === ".") {
        continue;
      }

      const color = palette[letter];

      if (!color) {
        console.warn(
          `Sprite "${sprite.id}" uses undefined palette role "${letter}".`
        );
        continue;
      }

      context.fillStyle = color;
      context.fillRect(
        drawX + columnIndex * cellScale,
        drawY + rowIndex * cellScale,
        cellScale,
        cellScale
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Map rendering                                                       */
/* ------------------------------------------------------------------ */

function drawMap() {
  for (let rowIndex = 0; rowIndex < MAP_DATA.length; rowIndex += 1) {
    const mapRow = MAP_DATA[rowIndex];

    for (
      let columnIndex = 0;
      columnIndex < mapRow.length;
      columnIndex += 1
    ) {
      const tileCode = mapRow[columnIndex];
      const tileSprite = TILE_TYPES[tileCode];

      if (!tileSprite) {
        console.warn(`Unknown map tile code: "${tileCode}"`);
        continue;
      }

      const tileX = columnIndex * TILE_SIZE;
      const tileY = rowIndex * TILE_SIZE;

      drawLetterGridSprite(
        tileSprite,
        tileX,
        tileY,
        TERRAIN_CELL_SCALE
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mike movement                                                       */
/* ------------------------------------------------------------------ */

/*
  Combine keyboard and analog joystick input.

  The joystick provides smooth analog strength. Keyboard input remains
  fully supported and can be used at the same time for testing.
*/
function getMovementVector() {
  let x = input.joystickX;
  let y = input.joystickY;

  if (input.left) {
    x -= 1;
  }

  if (input.right) {
    x += 1;
  }

  if (input.up) {
    y -= 1;
  }

  if (input.down) {
    y += 1;
  }

  const length = Math.hypot(x, y);

  if (length > 1) {
    x /= length;
    y /= length;
  }

  return { x, y };
}

function updateMikeDirection(movement) {
  if (Math.abs(movement.x) > Math.abs(movement.y)) {
    gameState.mike.direction = movement.x < 0 ? "left" : "right";
  } else if (Math.abs(movement.y) > 0.01) {
    gameState.mike.direction = movement.y < 0 ? "up" : "down";
  }
}

/* ------------------------------------------------------------------ */
/* Directional sprite selection                                        */
/* ------------------------------------------------------------------ */

function getMikeSprite() {
  switch (gameState.mike.direction) {
    case "up":
      return SPRITES.mikeUp;
    case "left":
      return SPRITES.mikeLeft;
    case "right":
      return SPRITES.mikeRight;
    case "down":
    default:
      return SPRITES.mikeDown;
  }
}

function getHenrySprite() {
  switch (gameState.henry.direction) {
    case "up":
      return SPRITES.henryUp;
    case "left":
      return SPRITES.henryLeft;
    case "right":
      return SPRITES.henryRight;
    case "down":
    default:
      return SPRITES.henryDown;
  }
}

/* ------------------------------------------------------------------ */
/* Full-sprite map-boundary collision                                  */
/* ------------------------------------------------------------------ */

function getMikeMapBoundaries() {
  const mikeSprite = getMikeSprite();
  const spriteSize = getSpritePixelSize(
    mikeSprite,
    CHARACTER_CELL_SCALE
  );

  const halfSpriteWidth = spriteSize.width / 2;

  return {
    minimumX: halfSpriteWidth,
    maximumX: WORLD_WIDTH - halfSpriteWidth,
    minimumY: spriteSize.height,
    maximumY: WORLD_HEIGHT - 1
  };
}

function updateMike(deltaSeconds) {
  const movement = getMovementVector();
  const mike = gameState.mike;

  mike.moving =
    Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01;

  if (!mike.moving) {
    return;
  }

  updateMikeDirection(movement);

  const proposedX =
    mike.x + movement.x * mike.speed * deltaSeconds;

  const proposedY =
    mike.y + movement.y * mike.speed * deltaSeconds;

  const boundaries = getMikeMapBoundaries();

  mike.x = clamp(
    proposedX,
    boundaries.minimumX,
    boundaries.maximumX
  );

  mike.y = clamp(
    proposedY,
    boundaries.minimumY,
    boundaries.maximumY
  );
}

/* ------------------------------------------------------------------ */
/* Henry delayed following                                             */
/* ------------------------------------------------------------------ */

function recordMikePosition(currentTime) {
  gameState.mikePositionHistory.push({
    time: currentTime,
    x: gameState.mike.x,
    y: gameState.mike.y,
    direction: gameState.mike.direction
  });

  const oldestUsefulTime =
    currentTime - gameState.henryDelayMilliseconds - 1000;

  while (
    gameState.mikePositionHistory.length > 2 &&
    gameState.mikePositionHistory[0].time < oldestUsefulTime
  ) {
    gameState.mikePositionHistory.shift();
  }
}

function findDelayedMikePosition(currentTime) {
  const targetTime =
    currentTime - gameState.henryDelayMilliseconds;

  let delayedPosition = null;

  for (const position of gameState.mikePositionHistory) {
    if (position.time <= targetTime) {
      delayedPosition = position;
    } else {
      break;
    }
  }

  return delayedPosition;
}

function updateHenry(currentTime, deltaSeconds) {
  const delayedPosition = findDelayedMikePosition(currentTime);

  if (!delayedPosition) {
    return;
  }

  const henry = gameState.henry;
  const differenceX = delayedPosition.x - henry.x;
  const differenceY = delayedPosition.y - henry.y;
  const distance = Math.hypot(differenceX, differenceY);

  if (distance < 0.5) {
    henry.x = delayedPosition.x;
    henry.y = delayedPosition.y;
    henry.direction = delayedPosition.direction;
    return;
  }

  const henrySpeed = 86;
  const maximumStep = henrySpeed * deltaSeconds;
  const step = Math.min(maximumStep, distance);

  henry.x += (differenceX / distance) * step;
  henry.y += (differenceY / distance) * step;

  if (Math.abs(differenceX) > Math.abs(differenceY)) {
    henry.direction = differenceX < 0 ? "left" : "right";
  } else if (Math.abs(differenceY) > 0.01) {
    henry.direction = differenceY < 0 ? "up" : "down";
  }
}

/* ------------------------------------------------------------------ */
/* Scene rendering                                                     */
/* ------------------------------------------------------------------ */

function drawCharacters() {
  const characters = [
    {
      x: gameState.henry.x,
      y: gameState.henry.y,
      sprite: getHenrySprite()
    },
    {
      x: gameState.mike.x,
      y: gameState.mike.y,
      sprite: getMikeSprite()
    }
  ];

  characters.sort((firstCharacter, secondCharacter) => {
    return firstCharacter.y - secondCharacter.y;
  });

  for (const character of characters) {
    drawLetterGridSprite(
      character.sprite,
      character.x,
      character.y,
      CHARACTER_CELL_SCALE
    );
  }
}

function renderGame() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;

  drawMap();
  drawCharacters();
}

/* ------------------------------------------------------------------ */
/* Main game loop                                                      */
/* ------------------------------------------------------------------ */

function gameLoop(currentTime) {
  if (gameState.previousFrameTime === 0) {
    gameState.previousFrameTime = currentTime;
  }

  let deltaSeconds =
    (currentTime - gameState.previousFrameTime) / 1000;

  deltaSeconds = Math.min(deltaSeconds, 0.05);
  gameState.previousFrameTime = currentTime;

  updateMike(deltaSeconds);
  recordMikePosition(currentTime);
  updateHenry(currentTime, deltaSeconds);
  renderGame();

  requestAnimationFrame(gameLoop);
}

gameState.mikePositionHistory.push({
  time: performance.now(),
  x: gameState.mike.x,
  y: gameState.mike.y,
  direction: gameState.mike.direction
});

requestAnimationFrame(gameLoop);
