# InterNyay Scan

Expo (React Native, TypeScript) app that scans legal documents, recognises English and Hindi text on the device, and uploads them to the existing InterNyay backend.

## Requirements

- Node 20+, a development build (Expo Go is not supported: native scanner and OCR modules)
- Backend with the scan overlay applied (`internyay-backend-scan-overlay.zip`)

## Setup

```
cp .env.example .env
npm install
npx expo run:android
npx expo run:ios
```

`EXPO_PUBLIC_API_BASE_URL` must end with `/api` and use HTTPS in production.

EAS builds: `eas build --profile development --platform all`.

## Structure

- `app/` screens (expo-router): login, tabs (Home, My Scans, Documents, Profile), edit, crop, review, text, folder
- `src/api/` HTTP client with JWT and `X-Refreshed-Token` handling, endpoints, queries
- `src/imaging/` Skia pipeline: perspective crop, filters, shadow removal, brightness and contrast, rotation, edge detection
- `src/ocr/` ML Kit recognition (Latin and Devanagari) and paragraph structuring
- `src/pipeline/` import (camera, gallery, PDF) and page preparation
- `src/upload/` local queue (SQLite), multipart upload with progress, retry, cleanup
- `tests/` unit tests for geometry, edge detection and text structuring (`npm test`)

## Page editor

The edit screen has a scrolling tool row and a bottom bar.

- Retake, Crop, Rotate, Filters, Adjust and Delete work on the current page.
- Edit text adds, moves, recolours and resizes text boxes. Find text reads the page, lets you tap a printed line, erases it and puts the same words in an editable box.
- Magic eraser fills painted areas with the surrounding paper colour. Cleanup wipes painted areas to white.
- Markup draws with a pen or highlighter. Every brush screen has undo and Done; Cancel discards.
- Resize places all pages on A3, A4, A5, US letter or US legal paper (portrait or landscape) with white margins, or keeps the scan size (Auto fit).
- Keep scanning adds pages. Share builds a PDF and opens the share sheet. Save PDF goes to the Save to InterNyay screen; the arrow offers save to phone, share and preview.

Strokes and text are stored per page in normalized coordinates (`src/imaging/marks.ts`) and drawn after crop, rotation and brightness/contrast, so they survive rotation but are cleared when a page is re-cropped. The web build shows a notice instead of the editors.

## Upload flow

1. Pages are rendered at the chosen PDF quality and recognised on the device.
2. The scan is queued locally under an upload id, then posted to `POST /api/documents/scan`.
3. The backend builds the searchable PDF and creates one document record linked to the case and its client.
4. On success the local files are deleted. On failure the scan stays in My Scans for retry; the upload id makes retries idempotent.

## Notes

- Camera capture, edge detection, auto-capture, flash and autofocus come from the platform scanners (ML Kit Document Scanner on Android, VisionKit on iOS).
- Pending scans live in the app cache directory and are not included in device backups. The OS may clear them under storage pressure.
- Signing out deletes local scans, downloads and settings.
