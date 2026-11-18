# yt-convert

A minimal desktop app for saving YouTube videos as MP4 or MP3. Paste a link, pick a quality, and the file lands in your Downloads folder.

Built with Electron, electron-vite, and [yt-dlp](https://github.com/yt-dlp/yt-dlp) via [youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec).

## Features

- Accepts any YouTube link form: `youtube.com`, `youtu.be`, `music.youtube.com`, `m.youtube.com`, Shorts, embed, and live URLs
- Video as MP4 at 360p, 480p, 720p, or 1080p
- Audio as MP3 at 64, 128, 192, 256, or 320 kbps
- Shows title, uploader, duration, and thumbnail before converting
- Disables qualities the video does not offer
- Live progress with speed and time remaining, and a cancel button
- Saves to your Downloads folder as `Title [quality].ext`

## Requirements

- Node.js 20 or later
- [pnpm](https://pnpm.io/)
- Python 3.10 or later (needed by the yt-dlp binary)
- [ffmpeg](https://ffmpeg.org/) available on your `PATH`

The app checks for these on startup and shows a warning if something is missing.

On Debian or Ubuntu:

```bash
sudo apt install python3 ffmpeg
```

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm install` downloads the yt-dlp binary through a postinstall script. If it is skipped, make sure `pnpm-workspace.yaml` allows it:

```yaml
allowBuilds:
  electron-winstaller: true
  youtube-dl-exec: true
```

## Build

```bash
# Linux
pnpm build:linux

# Windows
pnpm build:win

# macOS
pnpm build:mac
```

Installers are written to `dist/`. Only Linux has been tested.

Install the Debian package:

```bash
sudo apt install ./dist/yt-convert_<version>_amd64.deb
```

Or run the AppImage:

```bash
chmod +x dist/yt-convert-<version>.AppImage
./dist/yt-convert-<version>.AppImage
```

Before building, `electron-builder.yml` must unpack the yt-dlp binary from the asar archive:

```yaml
asarUnpack:
  - resources/**
  - node_modules/youtube-dl-exec/bin/**
```

Building a `.deb` also requires a maintainer email, set under `linux` in `electron-builder.yml`:

```yaml
linux:
  maintainer: Your Name <you@example.com>
```

## Project structure

```text
src
├─ main
│  ├─ index.js        window setup
│  ├─ ipc.js          IPC handlers
│  ├─ downloader.js   yt-dlp calls, progress, cancel
│  ├─ presets.js      quality presets
│  └─ url.js          YouTube URL validation
├─ preload
│  └─ index.js        safe API exposed to the UI
└─ renderer
   ├─ index.html
   ├─ assets/app.css
   └─ src/renderer.js
```

The renderer never touches Node directly. It talks to the main process through the `window.api.yt` bridge defined in the preload script.

## Troubleshooting

**A warning says python3, ffmpeg, or yt-dlp is missing.**
Install the missing tool. If it is yt-dlp, run `pnpm install` again and check that `node_modules/youtube-dl-exec/bin/yt-dlp` exists.

**Downloads suddenly fail.**
YouTube changes often and yt-dlp must keep up. Update and rebuild:

```bash
pnpm install youtube-dl-exec@latest
```

**The build fails asking for an author email.**
Set `linux.maintainer` as shown in the Build section.

**The packaged app cannot find yt-dlp.**
Confirm the `asarUnpack` entry above, then check that this file exists:
`dist/linux-unpacked/resources/app.asar.unpacked/node_modules/youtube-dl-exec/bin/yt-dlp`

## Limitations

- Single videos only. Playlists and live streams are not supported.
- MP3 bitrate sets the encoding target. YouTube audio is usually 128 to 160 kbps at the source, so higher values will not improve quality.

## Disclaimer

Downloading content from YouTube may violate its Terms of Service. Use this tool only for content you own or have permission to download.
