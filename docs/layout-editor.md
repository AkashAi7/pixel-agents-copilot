# Layout Editor

The built-in layout editor lets you design your pixel art office with floors, walls, and furniture.

## Opening the Editor

Click the **Layout** button in the bottom toolbar of the Pixel Agents panel. Click it again (or press **Esc**) to close.

---

## Tools

The toolbar on the left side of the panel exposes the following tools. Press **Esc** at any time to cycle backwards through active selections (deselect catalog → close tab → deselect furniture → close editor).

### Select (`S`)

Default tool. Click any placed furniture item to select it. Selected items show:

- A **white outline** highlight
- A **rotate button** (blue arrow, top-right corner) — rotates to the next available orientation
- A **delete button** (red ×, top-left corner) — removes the item
- **HSBC color sliders** in the toolbar — tint the selected item (enable with the Color checkbox; clear with the Clear button)

Drag a selected item to move it. Undo/redo tracks moves as a single step.

### Floor Paint (`F`)

Click or drag tiles to paint floor. Each tile stores:

- **Pattern** — chosen from the 7 patterns in the palette (from `assets/floors/`)
- **Color** — HSBC sliders (Photoshop Colorize mode: hue + saturation + brightness + contrast)
- The eyedropper (bottom of toolbar) picks the pattern and color from a painted tile

### Wall Paint (`W`)

Click or drag to add walls. Click or drag existing wall tiles to remove them (the action direction is determined by the first tile you touch in each drag). All wall tiles share a single HSBC color (Colorize mode).

Furniture cannot be placed on wall tiles, except items with `canPlaceOnWalls: true` (wall-mounted items: paintings, clocks, windows).

### Erase (`E`)

Sets tiles to `VOID` — transparent, non-walkable, no furniture. Right-click in any of the floor / wall / erase tools also erases (and supports drag-erasing). The browser context menu is suppressed in edit mode.

### Furniture (`U`)

Opens the furniture palette. Items are grouped by category:

| Tab         | Contents                                        |
| ----------- | ----------------------------------------------- |
| All         | Every catalog item                              |
| Desks       | Desks and tables                                |
| Chairs      | Chairs and seating                              |
| Storage     | Shelves, filing cabinets                        |
| Electronics | Monitors, PCs, keyboards                        |
| Decor       | Plants, rugs, lamps                             |
| Wall        | Wall-mounted items (paintings, windows, clocks) |
| Misc        | Everything else                                 |

Click a catalog item to select it. Move your cursor over the grid to see a **ghost preview** (green = valid placement, red = blocked). Click to place. The selected catalog item stays active until you press **Esc** or switch tools.

**Rotation:** Press **R** to cycle through available orientations (front/back/left/right as defined in the manifest). Not all items have all orientations.

**State toggle:** Press **T** to toggle on/off state for items with two states (e.g. monitors on/off).

**Color:** After placing, select the item with the Select tool and use the HSBC sliders.

### Eyedropper (`I`)

Hover over a floor tile to preview and click to pick its pattern + color, switching automatically to the Floor Paint tool with those settings copied.

Hovering over a wall tile picks its color and switches to Wall Paint.

### Pick (`P`)

Click any placed furniture item to copy its type (and color tint) into the Furniture tool, ready to place more of the same item.

---

## Grid Expansion

In the Floor, Wall, or Erase tools, a **dashed ghost border** appears one tile outside the current grid edges. Clicking a ghost tile expands the grid by one tile in that direction.

- **Maximum grid size:** 64 × 64 tiles
- **Default grid size:** 20 × 11 tiles
- When expanding left or up, all existing furniture positions and character positions shift to compensate

---

## Undo / Redo

- **Undo:** `Ctrl+Z` (50 levels)
- **Redo:** `Ctrl+Y`

The **EditActionBar** appears at the top-center of the panel whenever there are unsaved changes. It provides Undo, Redo, **Save**, and **Reset** (discards all unsaved changes).

---

## Saving and Sharing

Layouts are automatically saved to `~/.pixel-agents/layout.json` when you click **Save** in the EditActionBar. This file is shared across all VS Code windows and workspaces.

### Export

Settings modal → **Export Layout** — opens a save dialog and writes the current layout as a JSON file. Share this file with other users or keep it as a backup.

### Import

Settings modal → **Import Layout** — opens a file picker. The selected JSON file must have `version: 1` and a `tiles` array. On import the layout is written to `~/.pixel-agents/layout.json` and loaded immediately.

---

## Furniture Color Tinting

Any placed furniture item can be tinted using the HSBC sliders in the Select tool:

| Slider             | Effect                                           |
| ------------------ | ------------------------------------------------ |
| **H** (Hue)        | Rotates the hue of original pixel colors (±180°) |
| **S** (Saturation) | Shifts saturation (±100)                         |
| **B** (Brightness) | Shifts lightness (±100)                          |
| **C** (Contrast)   | Adjusts contrast (±100)                          |

The **Color** checkbox enables tinting. **Clear** removes the tint. A single undo step is recorded per continuous editing session (tracked by item UID).

---

## Seats and Agent Assignment

Every chair tile automatically becomes a **seat**. Agent characters pathfind to their assigned seat and animate there.

To reassign an agent:

1. Click a character to select it (white outline appears)
2. Click any available seat (chair tile that isn't occupied) to move the agent there

Seat assignments are persisted in `workspaceState` alongside the agent list.

---

## Layout File Format

The layout is stored as JSON with the following shape:

```jsonc
{
  "version": 1,
  "cols": 20,          // grid width in tiles
  "rows": 11,          // grid height in tiles
  "tiles": [           // cols × rows flat array of TileType values
    0, 1, 1, ...
  ],
  "tileColors": [      // optional; per-tile HSBC color for floors and walls
    { "h": 200, "s": 40, "b": 0, "c": 0, "colorize": true },
    ...
  ],
  "furniture": [       // placed furniture items
    {
      "uid": "abc123",
      "type": "DESK_FRONT",
      "col": 4,
      "row": 3,
      "color": { "h": 30, "s": 20, "b": 0, "c": 0 }  // optional tint
    },
    ...
  ]
}
```

**TileType values:**

| Value | Name    | Description                               |
| ----- | ------- | ----------------------------------------- |
| `0`   | `VOID`  | Transparent, non-walkable, no furniture   |
| `1`   | `FLOOR` | Walkable floor                            |
| `2`   | `WALL`  | Wall tile (blocks movement and furniture) |

---

## Default Layout

When no saved layout exists (`~/.pixel-agents/layout.json` is absent), the extension loads `webview-ui/public/assets/default-layout-1.json`.

To update the bundled default:

1. Design your layout in the Extension Development Host
2. Run **Pixel Agents: Export Layout as Default** from the command palette
3. Rebuild: `npm run build`

---

## Keyboard Shortcuts (Edit Mode)

| Key                | Action                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `Ctrl+Z`           | Undo                                                                           |
| `Ctrl+Y`           | Redo                                                                           |
| `R`                | Rotate selected/ghost furniture                                                |
| `T`                | Toggle on/off state                                                            |
| `Esc`              | Multi-stage exit (deselect catalog → close tab → deselect item → close editor) |
| Right-click + drag | Erase tiles (floor/wall/erase tools)                                           |
