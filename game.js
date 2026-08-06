"use strict";

/*
  Prairie Village
  Phase 2 — Smallest Runnable Vertical Slice

  This file contains:

  1. Canvas setup
  2. Letter-grid sprite rendering
  3. Map rendering
  4. Keyboard input
  5. Mike movement
  6. Full-sprite map-boundary collision
  7. Henry's delayed following
  8. The animation loop

  It intentionally does not contain:

  - houses
  - trees
  - rabbits
  - gardening
  - crafting
  - saving
  - audio
  - mobile controls
  - PWA registration
*/

/* ------------------------------------------------------------------ */
/* Canvas setup                                                        */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");

/*
  Stop the browser from smoothing enlarged pixels.

  This is essential for crisp letter-grid rendering.
*/
context.imageSmoothingEnabled = false;

/*
  The canvas itself should be keyboard-focusable.
*/
canvas.tabIndex = 0;

/*
  Give the canvas focus after the page loads so the movement keys work
  immediately in most desktop browsers.
*/
window.addEventListener("load", () => {
  canvas.focus();
});

/* ------------------------------------------------------------------ */
/* World measurements                                                  */
/* ------------------------------------------------------------------ */

/*
  Each map tile occupies 16 × 16 world pixels.
*/
const TILE_SIZE = 16;

/*
  Character letter-grid cells are drawn at 2 × 2 world pixels.
*/
const CHARACTER_CELL_SCALE = 2;

/*
  Terrain grids are 8 × 8 cells.

  A scale of 2 makes each terrain sprite exactly 16 × 16 world pixels.
*/
const TERRAIN_CELL_SCALE = 2;

/*
  These values describe the playable map edges.
*/
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

  /*
    Henry follows old Mike positions rather than moving directly toward
    Mike's current position.

    This creates a short positional delay.
  */
  mikePositionHistory: [],

  /*
    Henry follows a position approximately this many milliseconds behind
    Mike's current position.
  */
  henryDelayMilliseconds: 280
};

/* ------------------------------------------------------------------ */
/* Keyboard input                                                      */
/* ------------------------------------------------------------------ */

const input = {
  up: false,
  down: false,
  left: false,
  right: false
};

/*
  Convert keyboard keys into the game's four movement directions.
*/
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

/*
  Return true when a key is used for movement.
*/
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
});

window.addEventListener("keyup", (event) => {
  if (isMovementKey(event.key)) {
    event.preventDefault();
    setKeyState(event.key, false);
  }
});

/*
  Clear held keys if the browser window loses focus.

  This prevents movement keys from appearing stuck after the player
  changes tabs while holding a key.
*/
window.addEventListener("blur", () => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
});

/* ------------------------------------------------------------------ */
/* Letter-grid sprite measurements                                     */
/* ------------------------------------------------------------------ */

/*
  Calculate the rendered width and height of a letter-grid sprite.

  For example:

  A sprite that is 7 cells wide and uses a cell scale of 2 will render
  14 canvas pixels wide.
*/
function getSpritePixelSize(sprite, cellScale) {
  const gridHeight = sprite.grid.length;

  /*
    Letter-grid sprites are rectangular, so every row should have the
    same width. The first row supplies that width.
  */
  const gridWidth = sprite.grid[0].length;

  return {
    width: gridWidth * cellScale,
    height: gridHeight * cellScale
  };
}

/* ------------------------------------------------------------------ */
/* Letter-grid sprite rendering                                        */
/* ------------------------------------------------------------------ */

/*
  Draw one letter-grid sprite.

  sprite:
    The sprite object from sprites.js.

  worldX and worldY:
    The sprite's anchor position in canvas pixels.

  cellScale:
    The number of canvas pixels used for one letter-grid cell.
*/
function drawLetterGridSprite(sprite, worldX, worldY, cellScale) {
  const grid = sprite.grid;
  const palette = sprite.palette;

  const spriteSize = getSpritePixelSize(sprite, cellScale);

  let drawX = worldX;
  let drawY = worldY;

  /*
    Characters use a bottom-center anchor.

    Their world position represents the point where their feet touch
    the ground.
  */
  if (sprite.anchor === "bottom-center") {
    drawX = Math.round(worldX - spriteSize.width / 2);
    drawY = Math.round(worldY - spriteSize.height);
  } else {
    /*
      Terrain tiles use a top-left anchor.
    */
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

      /*
        A period means the cell is transparent.
      */
      if (letter === ".") {
        continue;
      }

      const color = palette[letter];

      /*
        Warn clearly if a sprite uses a palette role that does not exist.
      */
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
  Keep a number inside a minimum and maximum value.

  Example:

  clamp(12, 0, 10) returns 10.
*/
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/*
  Read the currently held movement keys and return a direction vector.
*/
function getMovementVector() {
  let x = 0;
  let y = 0;

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

  /*
    Normalize diagonal movement so moving diagonally is not faster.
  */
  if (x !== 0 && y !== 0) {
    const diagonalScale = 1 / Math.sqrt(2);

    x *= diagonalScale;
    y *= diagonalScale;
  }

  return { x, y };
}

/*
  Update Mike's facing direction.

  When moving diagonally, horizontal movement receives visual priority.
*/
function updateMikeDirection(movement) {
  if (movement.x < 0) {
    gameState.mike.direction = "left";
  } else if (movement.x > 0) {
    gameState.mike.direction = "right";
  } else if (movement.y < 0) {
    gameState.mike.direction = "up";
  } else if (movement.y > 0) {
    gameState.mike.direction = "down";
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

/*
  Calculate the legal range for Mike's bottom-center anchor.

  This is the important boundary correction.

  Previously, the top boundary only considered a small collision body.
  Mike's feet remained inside the map, but his head could leave it.

  Now the outside map boundaries consider the entire rendered sprite:

  - The top boundary reserves the full sprite height.
  - The left boundary reserves half the sprite width.
  - The right boundary reserves half the sprite width.
  - The bottom boundary keeps Mike's feet inside the final canvas row.
*/
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

    /*
      Mike's y-coordinate represents his feet.

      Therefore, his feet must remain at least one full sprite height
      below the top of the canvas.
    */
    minimumY: spriteSize.height,

    /*
      The feet may reach the final visible canvas row.
    */
    maximumY: WORLD_HEIGHT - 1
  };
}

/*
  Move Mike and keep his entire rendered sprite inside the map.
*/
function updateMike(deltaSeconds) {
  const movement = getMovementVector();
  const mike = gameState.mike;

  mike.moving = movement.x !== 0 || movement.y !== 0;

  if (!mike.moving) {
    return;
  }

  /*
    Update direction before calculating boundaries because left-facing
    and right-facing sprites could eventually have different dimensions
    from front-facing sprites.
  */
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

/*
  Save Mike's recent positions.
*/
function recordMikePosition(currentTime) {
  gameState.mikePositionHistory.push({
    time: currentTime,
    x: gameState.mike.x,
    y: gameState.mike.y,
    direction: gameState.mike.direction
  });

  /*
    Remove history records that are too old to be useful.
  */
  const oldestUsefulTime =
    currentTime - gameState.henryDelayMilliseconds - 1000;

  while (
    gameState.mikePositionHistory.length > 2 &&
    gameState.mikePositionHistory[0].time < oldestUsefulTime
  ) {
    gameState.mikePositionHistory.shift();
  }
}

/*
  Select the newest Mike position that is old enough for Henry to follow.
*/
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

/*
  Henry moves toward Mike's delayed position.
*/
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

  /*
    Henry moves slightly faster than Mike so he can recover naturally
    after a temporary frame-rate slowdown.
  */
  const henrySpeed = 86;
  const maximumStep = henrySpeed * deltaSeconds;
  const step = Math.min(maximumStep, distance);

  henry.x += (differenceX / distance) * step;
  henry.y += (differenceY / distance) * step;

  /*
    Use the strongest movement axis to choose Henry's facing direction.
  */
  if (Math.abs(differenceX) > Math.abs(differenceY)) {
    henry.direction = differenceX < 0 ? "left" : "right";
  } else if (Math.abs(differenceY) > 0.01) {
    henry.direction = differenceY < 0 ? "up" : "down";
  }
}

/* ------------------------------------------------------------------ */
/* Scene rendering                                                     */
/* ------------------------------------------------------------------ */

/*
  Draw the character farther up the map first.

  The character farther down is drawn afterward and therefore appears
  visually in front.
*/
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

/*
  Draw one complete frame.
*/
function renderGame() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  /*
    Reconfirm crisp rendering in case browser state changes.
  */
  context.imageSmoothingEnabled = false;

  drawMap();
  drawCharacters();
}

/* ------------------------------------------------------------------ */
/* Main game loop                                                      */
/* ------------------------------------------------------------------ */

function gameLoop(currentTime) {
  /*
    The first frame has no previous timestamp.
  */
  if (gameState.previousFrameTime === 0) {
    gameState.previousFrameTime = currentTime;
  }

  let deltaSeconds =
    (currentTime - gameState.previousFrameTime) / 1000;

  /*
    Prevent large movement jumps after the browser tab has been inactive.
  */
  deltaSeconds = Math.min(deltaSeconds, 0.05);

  gameState.previousFrameTime = currentTime;

  updateMike(deltaSeconds);
  recordMikePosition(currentTime);
  updateHenry(currentTime, deltaSeconds);
  renderGame();

  requestAnimationFrame(gameLoop);
}

/*
  Add an initial history record before the first frame.
*/
gameState.mikePositionHistory.push({
  time: performance.now(),
  x: gameState.mike.x,
  y: gameState.mike.y,
  direction: gameState.mike.direction
});

/*
  Start the game.
*/
requestAnimationFrame(gameLoop);