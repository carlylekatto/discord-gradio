# Discord Gradio Integration

A robust library to transform any Gradio App (Hugging Face Spaces, Shared Links, or Custom Domains) into a Discord interface using Modals and smart session management.

[Tiếng Việt](./docs/README_VI.md)

## Table of Contents
- [Why Discord-Gradio?](#why-discord-gradio)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Customization](#customization)
- [Supported Platforms](#supported-platforms)
- [Important Notes](#important-notes)
- [License](#license)

## Why Discord-Gradio?

Gradio is a fantastic way to build web interfaces for your Python scripts. **Discord-Gradio** allows you to bring those interfaces directly into your Discord server without rebuilding the logic:

- **Seamless Integration**: Bring any Gradio application (tools, calculators, data explorers, or models) into Discord chats.
- **Fast Development**: Skip the tedious process of designing Discord Modals and handling manual input parsing.
- **Stateless & Lightweight**: Built for performance using a stateless architecture—no database required to track user sessions.
- **Improved UX**: Automatically handles multi-page navigation for apps that exceed Discord's UI limits.

## Key Features

- **Universal Support**: Works with HF Spaces, `.gradio.live` links, and custom hosted Gradio apps.
- **Auto-Detection**: Heuristic-based API endpoint detection.
- **Hybrid Support**: Native support for ESM and CommonJS.
- **TypeScript First**: Full type safety and IntelliSense support.
- **i18n Ready**: Automatic translation lookup based on Gradio app configuration.
- **Smart UI**: Automatic mapping of Gradio components to Discord Modals with validation.

## Installation

```bash
npm install discord-gradio
```

## Quick Start

### JavaScript (CJS)
```javascript
const { GradioPlayground } = require('discord-gradio');
const playground = new GradioPlayground();

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand() && interaction.commandName === 'run') {
        await playground.init(interaction, 'user/space-id');
    }
    await playground.handleSubmit(interaction);
    await playground.handleButton(interaction);
});
```

## Customization

You can customize the UI and behavior by passing `customizers` to the constructor or using `setCustomizer`:

```javascript
const playground = new GradioPlayground({
    customizers: {
        result: ({ result }) => ({ content: 'Success!' })
    }
});

// Or set them later
playground.setCustomizer('error', ({ error }) => {
    return { content: `⚠️ Error: ${error.message}`, ephemeral: true };
});

// Available customizer keys: 'result', 'error', 'loading', 'formatModal', 'inputDescription', 'pageConfirmation'
```

### Session Options
Options for specific sessions can be passed to the `init` method:

```javascript
await playground.init(interaction, appRef, null, {
    ephemeral: true, // Only the user sees the interaction
    language: 'en'   // Force a specific language
});
```

## Supported Platforms

- **Hugging Face Spaces**: `username/space-name`
- **Gradio Shared Links**: `xxxx.gradio.live`
- **Custom Domains**: `https://your-gradio-app.com`

## Important Notes

> [!WARNING]
> **Complex Spaces Limitation**
> This library is optimized for standard Gradio input-to-output flows. Apps that rely heavily on custom JavaScript, complex reactive UI updates between components, or dynamic visibility toggling inside the modal may encounter limitations due to Discord's UI constraints.

## License

This project is licensed under the **MIT License**.

Copyright (c) 2026 カット Katt

See the [LICENSE](./LICENSE) file for more details.
