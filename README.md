<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/discord-gradio-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./docs/discord-gradio.png">
    <img alt="Discord Gradio" src="./docs/discord-gradio.png" width="400">
  </picture>
</p>

<h1 align="center">🤖 Discord Gradio Integration</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/discord-gradio">
    <img src="https://img.shields.io/npm/v/discord-gradio.svg" alt="npm version" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
  </a>
</p>

<p align="center">
  Transform any <b>Gradio App</b> (Hugging Face, Shared Links, or Custom Domains) into a fully functional <b>Discord Interface</b> with zero configuration. Optimized for modern Discord standards and performance.
</p>

<p align="center">
  <a href="./docs/README_VI.md"><b>Tiếng Việt 🇻🇳</b></a>
</p>

---

## 📖 Table of Contents
- [🌟 Why Discord-Gradio?](#-why-discord-gradio)
- [📦 Installation](#-installation)
- [🛠 Quick Start (Discord.js v14)](#-quick-start-discordjs-v14)
- [🧩 Supported Components & Limits](#-supported-components--limits)
- [🎨 Advanced Customization](#-advanced-customization)
  - [The `customizers` Object](#the-customizers-object)
  - [Live SSE Queue Updates](#live-sse-queue-updates)
  - [Available Customizer Keys](#available-customizer-keys)
- [⚙️ Session Configuration](#️-session-configuration)
  - [Session Options](#session-options)
  - [Logging System](#-logging-system)
  - [Session Lifecycle & Memory Management](#-session-lifecycle--memory-management)
  - [Smart Numeric Inputs](#-smart-numeric-inputs)
- [🌉 Handling Slow Apps (The Bridge Button)](#-handling-slow-apps-the-bridge-button)
- [⚠️ Limitations & Dynamic State Warning](#️-limitations--dynamic-state-warning)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [🧪 Testing](#-testing)
- [🛠️ Development & Contributing](#️-development--contributing)
- [📜 License](#-license)

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
        const appRef = interaction.options.getString('app'); // e.g., 'black-forest-labs/FLUX.1-schnell'
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

## 🧩 Supported Components & Limits

The library automatically maps Gradio components to the best possible Discord equivalent. Due to Discord API limits, options for selection inputs are sliced to prevent API errors (`BASE_TYPE_BAD_LENGTH`):

| Gradio Component | Discord UI | Limits / Behavior | Notes |
|------------------|------------|-------------------|-------|
| `Textbox` | `TextInput` | Max 4000 chars | Supports short and paragraph styles. |
| `Slider` | `TextInput` | - | Validates numeric range (Min/Max). |
| `Number` | `TextInput` | - | Auto-parses to float/int. |
| `Dropdown` | `StringSelect` | **Max 25 choices** | Excess options are sliced; logs `Logger.warn`. |
| `Radio` | `RadioGroup` | **Max 10 choices** | Excess choices are sliced; logs `Logger.warn`. |
| `CheckboxGroup` | `CheckboxGroup` | **Max 10 choices** | Excess choices are sliced; logs `Logger.warn`. |
| `Checkbox` | `Checkbox` | - | Native Discord Checkbox (Standard 2026). |
| `Image/File` | `FileUpload` | - | Resolves Discord attachments to URLs. |

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

### Live SSE Queue Updates

The library communicates with Gradio's queue system using Server-Sent Events (SSE). You can capture real-time queue position and estimation time using the `loading` customizer hook:

```javascript
const playground = new GradioPlayground({
    customizers: {
        loading: ({ session, queue }) => {
            if (queue) {
                const { position, size, estimatedTime } = queue;
                const posText = position === 0 ? 'Processing...' : `Queue Position: ${position}/${size || '?'}`;
                const etaText = estimatedTime ? ` (Est: ${Math.round(estimatedTime)}s)` : '';
                return {
                    content: `⏳ **${session.appReference}** is running. ${posText}${etaText}`
                };
            }
            return { content: "🚀 Connecting to queue..." };
        }
    }
});
```

The `queue` parameter is typed as a `QueueStatus` object:
```typescript
interface QueueStatus {
    position: number;       // Current rank in queue (0 = active execution)
    size?: number;          // Total size of the queue
    estimatedTime?: number; // Estimated remaining wait time in seconds
}
```

### Available Customizer Keys
- `result`: Fired when prediction is successful.
- `error`: Fired when anything fails (Connection, Validation, or Inference).
- `loading`: Shown while the Gradio queue is processing (supports real-time `queue` updates).
- `processingFile`: Fired when downloading and uploading Discord attachments to Gradio.
- `beforeInference`: Fired right before prediction starts, after files have finished uploading.
- `formatModal`: Modify the raw Modal data before it's sent to Discord.
- `inputDescription`: Add hints/descriptions to individual input fields.

---

## ⚙️ Session Configuration

### Session Options

Options for specific sessions can be passed to the `init` method:

```javascript
await playground.init(interaction, 'user/app-id', null, {
    ephemeral: true,    // Only the user sees the output
    language: 'en',      // Preferred language for labels
    manualBridge: false, // Set to true to handle the bridge message yourself
    customizers: {
        result: ({ result }) => ({ content: "Result ready!" }) // Custom result formatter
    }
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

## 🌉 Handling Slow Apps (The Bridge Button)

Discord Modals must be shown within **3 seconds** of an interaction. If a Gradio App takes longer to load its configuration, the interaction will expire. 

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
- **Unknown Interaction (10062)**: Occurs if the Gradio connection takes more than 3 seconds before you defer the reply. The library uses raw API calls to minimize this, but extremely slow apps may still trigger it.
- **Inference Failed**: Ensure the App is not private and doesn't require authentication.

---

## ⚠️ Limitations & Dynamic State Warning

> [!WARNING]
> **Dynamic States & Conditional UI is NOT supported**
> Gradio applications that use dynamic interface updates (e.g., hiding/showing inputs, changing choices dynamically using `gr.State`, or executing callbacks on input change before final submission) **will not work properly**.
>
> **Why?**
> `discord-gradio` maps the Gradio interface statically from the initial configuration payload. Because Discord Modals do not support real-time state synchronization or event callbacks on text change, interactive UI updates cannot be reflected in the Modal. Only standard form layouts with a static set of inputs are fully supported.

---

## ❓ Frequently Asked Questions (FAQ)

#### Q: My bot crashes or logs a "BASE_TYPE_BAD_LENGTH" error when using dropdowns.
**A:** Discord restricts dropdown (StringSelect) choices to **25**, and Radio Group / Checkbox Group options to **10**. `discord-gradio` automatically truncates options exceeding these limits and outputs a warning through `Logger.warn` to prevent Discord API errors (`BASE_TYPE_BAD_LENGTH`).

#### Q: How does the bot handle file uploads (images, audio, video)?
**A:** Discord-Gradio automatically maps `Image`, `Audio`, `Video`, and `File` input types to Discord's FileUpload component. When the modal is submitted, the library downloads the uploaded file from Discord's CDN, uploads it to the Gradio app's `/upload` endpoint, and substitutes the local filepath in the Gradio payload.

#### Q: Can I run private Hugging Face Apps?
**A:** Currently, the library does not support authenticated private apps. It only interacts with public Gradio apps or apps that do not require OAuth credentials or bearer tokens.

#### Q: How do I handle slow Gradio apps that timeout?
**A:** Discord requires replies within 3 seconds. For slow apps, always use `interaction.deferReply()` and allow the **Bridge Button** flow. You can also customize the bridge button using `manualBridge` to keep the user engaged.

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
