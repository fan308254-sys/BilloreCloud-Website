# BilloreCloud Hosting Website

## Product & Category Management

The Admin Dashboard now supports:
- Edit categories (name, description, image)
- Edit products (name, price, category, type, image, description)
- Product resource configuration: CPU, RAM, Storage, Databases, Backups, Ports, Bandwidth
- Enable/disable each resource individually
- Enable/disable the complete resource configuration block
- Enable/disable product description on the public website
- Product active/disabled state
- Public product pages show only enabled configuration values

## Run

```bash
npm install
npm start
```

## Discord order notifications
Set `DISCORD_BOT_TOKEN` in `.env`. Clients must save their Discord User ID in **Account Settings → Discord Notifications**. The bot sends a DM immediately after payment proof submission and again when an admin clicks **Complete** on the order. The bot must be able to DM the user (normally the user should share a server with the bot and allow DMs).


## Discord Bot Presence & DM Embeds

Set `DISCORD_BOT_TOKEN` in `.env`. The included `bot.js` connects to Discord and keeps the bot presence at **Do Not Disturb**. Payment/account/completion DMs are sent as Discord embeds with a colored left accent line, title, timestamp, and optional site logo thumbnail.

Run `npm install` before `npm start` so `discord.js` is installed.


## Discord rejection DM & assistant
- Admin **Reject** now sends a Discord embed DM to the client.
- Admin Settings includes an editable **Order Rejected** message.
- The bot listens to direct messages and sends an AI-style BilloreCloud assistant reply using built-in intent matching; no external AI API key is required.
- The bot keeps Do Not Disturb presence.


AI assistant/API configuration has been removed. Discord is used only for transactional DMs (account created, payment proof submitted, order completed, order rejected) and bot presence.

## Discord Server Order System
Set `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in `.env`. The bot will create/use `🆕 New Orders > #new-orders` and `✅ Complete Orders > #completed-orders` when it has permission to Manage Channels and Send Messages.

When payment proof is submitted, the existing client DM is preserved and the bot also posts the order in `#new-orders` with the screenshot and Accept/Reject buttons. Accept/Reject updates the order and sends the existing client DM. When an admin completes an order from the dashboard, the existing client DM is preserved and a completed-order embed is posted in `#completed-orders` with the proof screenshot.
