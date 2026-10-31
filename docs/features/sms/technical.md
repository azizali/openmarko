# Texting: technical

## Code map

| File | Role |
|---|---|
| [components/Sending.tsx](../../../ui-mock/src/components/Sending.tsx) | Texting & calls setup flow |
| [data/providers.ts](../../../ui-mock/src/data/providers.ts) | `PhoneProviderId` fields |
| [data/messaging.ts](../../../ui-mock/src/data/messaging.ts) | `Channels.sms`, `Channels.call`, `PhoneNumber` |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | `disconnectPhone` |

```ts
type PhoneNumber = { location; number; how: "new" | "hosted" | "port"; status: "active" | "pending" };
Channels.sms = { provider; numbers: PhoneNumber[]; brand: Reg; campaign: Reg; quietStart; quietEnd; optOutLine };
Channels.call = { forwardTo; recordCalls; voicemailToText };
```

## Permissions (`sms`)

view · connect (buy numbers and register, manage).

## Real build

Twilio / Telnyx: number search and buy, Hosted SMS or port-in orders, A2P 10DLC brand + campaign registration through their APIs, messaging webhooks (`sms.*`), call forwarding and voicemail transcription (`call.*`, `voicemail.received`). Signed BAA before patient data.
