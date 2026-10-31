# Integrations: how to

## Connect a service

1. Open **Settings → Integrations**. Filter by category or search by what you need ("send email", "reviews").
2. Open the service. It lists what it powers and which features use it.
3. Choose **Connect** and follow the steps: sign in for services like Google or Meta, or paste an API key.
4. If it belongs to a place, pick the Location or Website.

You can also connect from a feature page: wherever something needs a connection, a **Connect** message opens the same steps.

If **Connect** is greyed out, your role can't connect that service. Ask an Owner or Admin.

## Set up email sending

1. **Settings → Email & texting → Email setup**.
2. Pick the built-in sending option, or your own provider (Amazon SES, Resend, Mailgun, Postmark, SendGrid) and paste its keys.
3. Enter a sending domain. A `mail.` subdomain is suggested so your main domain's email isn't affected.
4. Add the DNS records shown at your domain host (copy buttons are provided; for Cloudflare, **Add them for me**).
5. Choose **Check now** until the domain shows verified.

## Set up texting and calls

1. **Settings → Email & texting → Texting & calls setup**.
2. Pick built-in numbers or your Twilio / Telnyx account.
3. Per Location: get a new local number (search by area code), text-enable your current number, or port it.
4. Confirm the prefilled carrier registration (A2P 10DLC).
5. Set quiet hours and the opt-out line.

Campaigns and replies stay blocked until a channel is ready.

## Replace or disconnect

Connecting a second email sender or phone provider replaces the first. To disconnect, open the service and choose **Disconnect**. Features that used it show a Connect message again; nothing else is deleted.
