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
  6. Map-boundary collision
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

  Mike's 7-cell-wide grid therefore appears 14 pixels wide.
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

/*
  All changing game values live together here.

  This makes it easier to see what the game remembers from one frame
  to the next.
*/
const gameState = {
  previousFrameTime: 0,

  mike: {
    x: 80,
    y: 128,
    speed: 72,
    direction: "down",
    moving: false,

    /*
      Mike's collision is deliberately smaller than his full sprite.

      x and y represent the point where his feet touch the ground.
    */
    collisionHalfWidth: 5,
    collisionHeight: 8
  },

  henry: {
    x: 54,
    y: 132,
    direction: "right"
  },

  /*
    Henry follows old Mike positions rather than moving directly toward
    Mike's current position.

    This creates a short, natural-looking delay.
  */
  mikePositionHistory: [],

  /*
    Henry uses a position roughly this many milliseconds behind Mike.
  */
  henryDelayMilliseconds: 280
};

/* ------------------------------------------------------------------ */
/* Keyboard input                                                      */
/* ------------------------------------------------------------------ */

/*
  This object records which movement directions are currently held.
*/
const input = {
  up: false,
  down: false,
  left: false,
  right: false
};

/*
  Converts keyboard keys into the game's four movement directions.
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
  Prevent the browser from scrolling the page when game movement keys
  are pressed.
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

  Without this, a movement key can sometimes appear stuck after the
  player switches tabs while holding it.
*/
window.addEventListener("blur", () => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
});

/* ------------------------------------------------------------------ */
/* Letter-grid sprite rendering                                        */
/* ------------------------------------------------------------------ */

/*
  Draw one letter-grid sprite.

  Parameters:

  sprite:
    The sprite object from sprites.js.

  worldX and worldY:
    The position in canvas/world pixels.

  cellScale:
    The number of canvas pixels used for one letter-grid cell.
*/
function drawLetterGridSprite(sprite, worldX, worldY, cellScale) {
  const grid = sprite.grid;
  const palette = sprite.palette;

  const gridWidth = grid[0].length;
  const gridHeight = grid.length;

  const spriteWidth = gridWidth * cellScale;
  const spriteHeight = gridHeight * cellScale;

  let drawX = worldX;
  let drawY = worldY;

  /*
    World characters stand on a bottom-center anchor.

    Terrain tiles begin at a top-left anchor.
  */
  if (sprite.anchor === "bottom-center") {
    drawX = Math.round(worldX - spriteWidth / 2);
    drawY = Math.round(worldY - spriteHeight);
  } else {
    drawX = Math.round(worldX);
    drawY = Math.round(worldY);
  }

  /*
    Read every row and every cell in the letter grid.
  */
  for (let rowIndex = 0; rowIndex < gridHeight; rowIndex += 1) {
    const row = grid[rowIndex];

    for (let columnIndex = 0; columnIndex < gridWidth; columnIndex += 1) {
      const letter = row[columnIndex];

      /*
        A period means the cell is transparent.
      */
      if (letter === ".") {
        continue;
      }

      const color = palette[letter];

      /*
        Throw a clear error if a sprite uses an undefined palette letter.
        This makes sprite mistakes easier to diagnose.
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

/*
  Draw every tile in MAP_DATA.

  The map itself is data.
  This function only decides where each tile should be drawn.
*/
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

      /*
        Skip unknown tile codes instead of crashing the whole game.
      */
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

  x:
    -1 means left
     1 means right

  y:
    -1 means up
     1 means down
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
    Normalize diagonal movement.

    Without this, moving diagonally would be faster than moving in a
    single direction.
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

  When moving diagonally, horizontal movement is given visual priority.
  This keeps the four-direction system simple.
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

/*
  Move Mike and keep his collision area inside the map.

  Mike's x and y mark the location of his feet.
*/
function updateMike(deltaSeconds) {
  const movement = getMovementVector();
  const mike = gameState.mike;

  mike.moving = movement.x !== 0 || movement.y !== 0;

  if (!mike.moving) {
    return;
  }

  updateMikeDirection(movement);

  const proposedX =
    mike.x + movement.x * mike.speed * deltaSeconds;

  const proposedY =
    mike.y + movement.y * mike.speed * deltaSeconds;

  /*
    Horizontal map boundaries.

    Mike's center cannot move so far left or right that his small
    collision width leaves the canvas.
  */
  const minimumX = mike.collisionHalfWidth;
  const maximumX = WORLD_WIDTH - mike.collisionHalfWidth;

  /*
    Vertical map boundaries.

    His feet may reach the bottom edge.
    His collision body must remain above the top edge.
  */
  const minimumY = mike.collisionHeight;
  const maximumY = WORLD_HEIGHT - 1;

  mike.x = clamp(proposedX, minimumX, maximumX);
  mike.y = clamp(proposedY, minimumY, maximumY);
}

/* ------------------------------------------------------------------ */
/* Henry delayed following                                             */
/* ------------------------------------------------------------------ */

/*
  Save Mike's recent positions.

  Each record includes a timestamp so Henry can choose a position from
  a specific amount of time in the past.
*/
function recordMikePosition(currentTime) {
  gameState.mikePositionHistory.push({
    time: currentTime,
    x: gameState.mike.x,
    y: gameState.mike.y,
    direction: gameState.mike.direction
  });

  /*
    We only need a short history.

    Removing older records prevents this array from growing forever.
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
  Select the newest recorded Mike position that is old enough for Henry
  to follow.
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

  This produces a trailing companion rather than a character glued
  directly to Mike.
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

  /*
    Henry does not need to move if he is already extremely close to the
    delayed position.
  */
  if (distance < 0.5) {
    henry.x = delayedPosition.x;
    henry.y = delayedPosition.y;
    henry.direction = delayedPosition.direction;
    return;
  }

  /*
    Henry moves slightly faster than Mike so he can recover naturally
    if the frame rate briefly slows down.
  */
  const henrySpeed = 86;
  const maximumStep = henrySpeed * deltaSeconds;

  /*
    Never move farther than the remaining distance.
  */
  const step = Math.min(maximumStep, distance);

  henry.x += (differenceX / distance) * step;
  henry.y += (differenceY / distance) * step;

  /*
    Use the strongest movement axis to determine Henry's facing.
  */
  if (Math.abs(differenceX) > Math.abs(differenceY)) {
    henry.direction = differenceX < 0 ? "left" : "right";
  } else if (Math.abs(differenceY) > 0.01) {
    henry.direction = differenceY < 0 ? "up" : "down";
  }
}

/* ------------------------------------------------------------------ */
/* Sprite selection                                                    */
/* ------------------------------------------------------------------ */

/*
  Return Mike's current directional PLACEHOLDER sprite.
*/
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

/*
  Return Henry's current directional PLACEHOLDER sprite.
*/
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
/* Scene rendering                                                     */
/* ------------------------------------------------------------------ */

/*
  Draw Henry and Mike in vertical order.

  The character farther up the map is drawn first.
  The character farther down is drawn afterward.

  This simple form of depth sorting helps the lower character appear
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
  /*
    Clear the previous frame.
  */
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

/*
  requestAnimationFrame asks the browser to call this function before
  the next screen repaint.
*/
function gameLoop(currentTime) {
  /*
    The first frame has no earlier timestamp.

    A safe default avoids a huge movement jump when the game begins.
  */
  if (gameState.previousFrameTime === 0) {
    gameState.previousFrameTime = currentTime;
  }

  /*
    Convert elapsed time from milliseconds to seconds.
  */
  let deltaSeconds =
    (currentTime - gameState.previousFrameTime) / 1000;

  /*
    Limit unusually large frame gaps.

    This prevents Mike and Henry from jumping across the screen after
    the browser tab has been inactive.
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