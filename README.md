# Dropbox Plugin for SocialGata

A SocialGata sync plugin that enables cloud synchronization of your favorites and data using Dropbox.

## Features

- Sync your SocialGata favorites to Dropbox
- Automatic cloud backup of your data
- OAuth2 authentication for secure access
- Cross-device synchronization

## Installation

### From URL (Recommended)

Install the plugin in SocialGata by providing the manifest URL:
```
https://cdn.jsdelivr.net/gh/InfoGata/dropbox-socialgata@latest/manifest.json
```

### Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. In SocialGata, add the plugin from the `dist/` folder

## Configuration

To use this plugin, you need to set up a Dropbox app:

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access" and "Full Dropbox" or "App folder"
4. Name your app and create it
5. In the app settings, add your SocialGata redirect URI
6. Copy the App Key (Client ID)
7. Open the plugin options in SocialGata and enter your Client ID
8. Click to authenticate with Dropbox

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

This runs two builds:
- `npm run build:options` - Builds the options UI page
- `npm run build:plugin` - Builds the main plugin script

### Output

- `dist/index.js` - Main plugin script
- `dist/options.html` - Options/settings page

## Plugin API Methods

| Method | Description |
|--------|-------------|
| `onSyncUpload` | Upload document data to Dropbox |
| `onSyncDownload` | Download document data from Dropbox |
| `onLogin` | OAuth2 login flow |
| `onLogout` | Clear authentication |
| `onIsLoggedIn` | Check login status |

## License

MIT
