# Texting: roadmap

## Current state

Setup flow, per-Location numbers, registration, quiet hours (`83e1f32`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Number search, purchase, porting | Sample numbers. |
| 10DLC approval | Status set locally. |
| Delivery, replies, opt-outs, missed calls | Timers. |

## To build

1. Twilio/Telnyx adapters; managed numbers.
2. Registration submission and status polling.
3. Quiet hours and opt-out enforcement server-side.
4. Call routing and voicemail transcription.

## Changelog

- `83e1f32` introduced.
