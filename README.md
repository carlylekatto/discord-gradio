# 🤖 Discord Gradio Integration

[![npm version](https://img.shields.io/npm/v/discord-gradio.svg)](https://www.npmjs.com/package/discord-gradio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Transform any **Gradio App** (Hugging Face Spaces, Shared Links, or Custom Domains) into a fully functional **Discord Interface** with zero configuration. Optimized for modern Discord standards and performance.

[Tiếng Việt](./docs/README_VI.md)

---

## 🌟 Why Discord-Gradio?

Bringing AI models and tools to Discord usually requires writing complex bot logic and manual UI mapping. **Discord-Gradio** automates this by bridging the gap between Gradio's web interface and Discord's Modal/Interaction system.

- **🚀 SDK-Free Stability**: Uses a custom-built SSE Queue engine (no `@gradio/client` dependency).
- **🎨 2026 Modal Support**: Native support for **Type 18 Labels** and **Type 19 File Uploads**.
- **📑 Auto-Pagination**: Automatically splits complex forms into multiple Modal pages.
- **🖼️ Smart File Handling**: Seamlessly handles images, audio, and video uploads from Discord to Gradio.
- **⚡ Stateless Architecture**: No database needed. Session data is encoded within interaction IDs.

---

## 📦 Installation

```bash
npm install discord-gradio
```

---

## 🛠 Quick Start (Discord.js v14)

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { GradioPlayground } = require('discord-gradio');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const playground = new GradioPlayground();

client.on('interactionCreate', async (interaction) => {
    // 1. Initialize session via Slash Command
    if (interaction.isChatInputCommand() && interaction.commandName === 'run') {
        const appRef = interaction.options.getString('url'); // e.g., 'black-forest-labs/FLUX.1-schnell'
        await playground.init(interaction, appRef);
        return;
    }

    // 2. Pass interactions to the playground
    if (await playground.handleSubmit(interaction)) return;
    if (await playground.handleButton(interaction)) return;
});

client.login('YOUR_TOKEN');
```

---

## 🧩 Supported Components

The library automatically maps Gradio components to the best possible Discord equivalent:

| Gradio Component | Discord UI | Notes |
|------------------|------------|-------|
| `Textbox` | `TextInput` | Supports short and paragraph styles. |
| `Slider` | `TextInput` | Validates numeric range (Min/Max). |
| `Number` | `TextInput` | Auto-parses to float/int. |
| `Dropdown` | `StringSelect` | Uses Modal Type 18 container. |
| `Radio` | `RadioGroup` | Single choice from list |
| `Checkbox` | `Checkbox` | Native Discord Checkbox (Standard 2026). |
| `Image/File` | `FileUpload` | Resolves Discord attachments to URLs. |

---

## 🎨 Advanced Customization

### The `customizers` Object

Tailor the bot's behavior and look without touching the core logic:

```javascript
const playground = new GradioPlayground({
    customizers: {
        // Customize the final prediction result
        result: ({ result, session }) => {
            return {
                content: `✅ **Prediction Complete!**\n${result.data.text}`,
                files: result.data.files.map(f => ({ attachment: f.buffer, name: f.filename }))
            };
        },

        // Customize the loading message while Gradio is processing
        loading: ({ session }) => ({
            embeds: [{
                title: "⏳ Processing...",
                description: `Running prediction on **${session.appReference}**`,
                color: 0x3498db
            }]
        }),

        // Customize the confirmation message between modal pages
        pageConfirmation: ({ session, pageIndex, totalPages }) => ({
            content: `✅ Step ${pageIndex + 1} of ${totalPages} done!`,
            button: { label: 'Go to Next Step', emoji: '🚀' }
        }),

        // Handle errors gracefully
        error: ({ error }) => ({
            content: `❌ **Inference Error:** ${error.message}`,
            ephemeral: true
        })
    }
});
```

### Available Customizer Keys
- `result`: Fired when prediction is successful.
- `error`: Fired when anything fails (Connection, Validation, or Inference).
- `loading`: Shown while the Gradio queue is processing.
- `formatModal`: Modify the raw Modal data before it's sent to Discord.
- `inputDescription`: Add hints/descriptions to individual input fields.

---

## ⚙️ Session Configuration

### Session Options

Options for specific sessions can be passed to the `init` method:

```javascript
await playground.init(interaction, 'user/space-id', null, {
    ephemeral: true,    // Only the user sees the output
    language: 'en',      // Preferred language for labels
    manualBridge: false, // Set to true to handle the bridge message yourself
    formatReply: (result) => ({ content: "Result ready!" }) // Custom result formatter
});
```

### 🪵 Logging System
Control library verbosity without changing source code:

```javascript
const { GradioPlayground, LogLevel } = require('discord-gradio');

const playground = new GradioPlayground({
    logLevel: LogLevel.DEBUG // Options: DEBUG, INFO, WARN, ERROR, NONE
});
```

### 🧹 Session Lifecycle & Memory Management
To prevent memory leaks from inactive or abandoned modal sessions, the library features an automatic background cleanup worker (ticks every 1 minute) to evict expired sessions:

```javascript
const playground = new GradioPlayground({
    sessionTimeoutMs: 15 * 60 * 1000 // Inactivity timeout in ms before session is evicted (Default: 15 minutes)
});

// Always call destroy when shutting down the bot to release timers cleanly
playground.destroy();
```

### 🎨 Advanced Customizers

Customize every aspect of the UI:

```javascript
const playground = new GradioPlayground({
    customizers: {
        // Customize the description/placeholder for each input
        inputDescription: ({ component }) => `Enter value for ${component.props.label}`,
        
        // Full control over the raw Modal JSON before sending to Discord
        formatModal: (modalData, session, pageIndex) => {
            modalData.title = `✨ Magic Prompt (${pageIndex + 1})`;
            return modalData;
        },

        // Custom loading message
        loading: ({ session }) => ({ embeds: [{ title: "Processing...", color: 0x3498db }] }),
        
        // Custom error handling
        error: ({ error }) => ({ content: `❌ Oops: ${error.message}` })
    }
});
```

### 🔢 Smart Numeric Inputs
For `number` and `slider` components, the library automatically appends range and step information to the description (e.g., `(R: 0-100, S: 1)`), ensuring users stay within bounds.

---

## 🌉 Handling Slow Spaces (The Bridge Button)

Discord Modals must be shown within **3 seconds** of an interaction. If a Gradio Space takes longer to load its configuration, the interaction will expire. 

To solve this, **Discord-Gradio** implements the **Bridge Button Pattern**:

1.  **Manual Defer**: Call `await interaction.deferReply()` in your bot code.
2.  **Bridge Button**: The library detects the deferment and sends a message with a "Start" button.
3.  **Fresh Window**: Clicking the button creates a new interaction, safely triggering the Modal.

### Custom Bridge Message (Manual Bridge)

If you want to design your own "Ready" message (e.g., with Embeds), use the `manualBridge` option:

```javascript
await interaction.deferReply();
await playground.init(interaction, appRef, null, { manualBridge: true });

const openModalId = playground.getOpenModalId(interaction);

await interaction.editReply({
    embeds: [{ title: "AI Model Ready", description: "Click below to start." }],
    components: [{
        type: 1,
        components: [{
            type: 2,
            style: 1,
            label: "Open Form",
            custom_id: openModalId // Managed by the library
        }]
    }]
});
```

---

## 🔍 Troubleshooting & Logging

The library includes a built-in Logger to help you debug connection or data extraction issues:

```javascript
const { Logger } = require('discord-gradio');
// Log levels: 'info', 'warn', 'error', 'debug'
```

**Common Issues:**
- **Unknown Interaction (10062)**: Occurs if the Gradio connection takes more than 3 seconds before you defer the reply. The library uses raw API calls to minimize this, but extremely slow spaces may still trigger it.
- **Inference Failed**: Ensure the Space is not private and doesn't require authentication.

---

## 🧪 Testing

The library includes a robust suite of unit tests powered by **Vitest** to ensure high stability and guard against regression.

To run the unit tests once:
```bash
npm run test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

---

## 🛠️ Development & Contributing

We welcome contributions from the community! To set up the library for local development:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/carlylekatto/discord-gradio.git
   cd discord-gradio
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Development Commands:**
   * **Rebuild on file changes:** `npm run dev`
   * **Build for production:** `npm run build`
   * **Run TypeScript linting:** `npm run lint`
   * **Run Unit Tests:** `npm run test` or `npm run test:watch`

Please make sure all unit tests pass and TypeScript check is clean before submitting a Pull Request!

---

## 📜 License

MIT License - Copyright (c) 2026 **Katt (カット)**
