# js-gallery

Simple, dynamic and sleek media gallery/slider written in pure ES6/ES2015 JavaScript with no dependencies.

Work in progress.

Features include:
- Responsiveness (adapts to its container)
- Only CSS animations = efficient and smooth
- Proper keyboard, mouse and touch gestures handling:
    - Keyboard:
        - left/right arrows to change image
    - Mouse:
        - Drag left/right to change image
        - Double click to zoom/unzoom
        - Drag to pan while zoomed
    - Touch:
        - Swipe left/right to change image
        - Double tap to zoom/unzoom
        - Pinch to zoom (two fingers)
        - Drag to pan while zoomed

Tested on:
- Android: Firefox 89, Chrome 91
- Windows: Firefox 89, Edge 91

## Development

All you need is Node.js (v14/LTS).

The `server.js` script is a simple web server that listens on `localhost:8080` and serves `index.html`, mainly to abide to CORS policies.
