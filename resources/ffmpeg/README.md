# FFmpeg Binaries Required

This folder should contain the FFmpeg binaries for Windows.

## Download FFmpeg

1. Go to: https://www.gyan.dev/ffmpeg/builds/
2. Download: **ffmpeg-release-essentials.zip** (or full build)
3. Extract the downloaded ZIP file
4. Copy the following files from `ffmpeg-X.X.X-essentials_build/bin/` to this folder:
   - `ffmpeg.exe`
   - `ffprobe.exe`

## Folder Structure

After adding the binaries, this folder should contain:

```
resources/
└── ffmpeg/
    ├── ffmpeg.exe
    ├── ffprobe.exe
    └── README.md (this file)
```

## Why is this needed?

The application uses FFmpeg to process videos. By bundling FFmpeg binaries, users don't need to install FFmpeg separately on their system.

## Important Notes

- **File Size**: ffmpeg.exe is approximately 80-100MB
- **License**: FFmpeg is licensed under LGPL/GPL. Make sure to comply with license requirements if distributing your application.
- **Updates**: You can update FFmpeg by replacing these files with newer versions from the official builds.

## Alternative: System FFmpeg

During development, if you have FFmpeg installed on your system and available in PATH, the application will try to use the system version if these files are not found.
