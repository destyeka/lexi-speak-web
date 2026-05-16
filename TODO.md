# TODO

## Whisper STT (free/self-host)
- [x] Confirm current STT flow: client uploads `audio` blob to `POST /api/transcribe`.
- [ ] Add self-host option to `app/api/transcribe/route.ts` using local Whisper CLI + ffmpeg.
- [ ] Add helper(s) for saving uploaded audio to disk, running ffmpeg/whisper, and parsing output.
- [ ] Add env vars documented (e.g. `TRANSCRIBE_BACKEND`, `WHISPER_MODEL`, `WHISPER_LANGUAGE`).
- [ ] Keep existing OpenAI/Groq paths as fallback.
- [ ] Validate on Windows server/runtime (command execution, temp folder, permissions).


