# SquadCast Webhook Testing with Localtunnel

To test real payloads from SquadCast.fm on your local machine, follow these steps:

## 1. Install Localtunnel
If you haven't already, install the `localtunnel` package globally:
```bash
npm install -g localtunnel
```

## 2. Start your Local Server
Ensure your Recording Notes server is running:
```bash
npm run dev
```

## 3. Start Localtunnel
Create a tunnel to your local port (default 3000):
```bash
lt --port 3000
```
Localtunnel will provide a public URL like `https://chatty-dogs-bark.loca.lt`.

## 4. Configure SquadCast.fm Webhook
1. Log in to your SquadCast.fm developer dashboard.
2. Set the Webhook URL to: `https://your-unique-subdomain.loca.lt/api/webhooks/squadcast`
3. Select the events: `Session Created`, `Recording Started`, and `Recording Stopped`.

## 5. Verify
Perform actions in SquadCast and watch your local server logs and dashboard for automatic updates.
