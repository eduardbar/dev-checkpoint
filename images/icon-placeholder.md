# Icon Placeholder

A real `128x128 PNG` icon is required at `images/icon.png` before publishing to the VS Code Marketplace.

## Icon Specs

- **Size**: 128x128 pixels (PNG)
- **Background**: `#0d1117` (dark, matches VS Code dark theme)
- **Symbol**: Bookmark or checkpoint symbol in VS Code blue (`#0078d4`)
- **File path**: `images/icon.png`

## Why it matters

The marketplace requires the icon path declared in `package.json` (`"icon": "images/icon.png"`) to exist at package time (`vsce package`). Without it, packaging will fail.

## Next step

Create or export a 128x128 PNG and place it at `images/icon.png`, then delete this file.
