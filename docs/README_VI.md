# 🤖 Tích hợp Discord với Gradio

[![npm version](https://img.shields.io/npm/v/discord-gradio.svg)](https://www.npmjs.com/package/discord-gradio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Chuyển đổi bất kỳ **Gradio App** nào (Hugging Face, Link chia sẻ, hoặc Tên miền riêng) thành một **Giao diện Discord** hoàn chỉnh mà không cần cấu hình phức tạp. Được tối ưu hóa cho các tiêu chuẩn Discord hiện đại và hiệu suất cao.

[English](../README.md)

## 📖 Mục lục
- [🌟 Tại sao nên dùng Discord-Gradio?](#-tại-sao-nên-dùng-discord-gradio)
- [📦 Cài đặt](#-cài-đặt)
- [🛠 Bắt đầu nhanh (Discord.js v14)](#-bắt-đầu-nhanh-discordjs-v14)
- [🧩 Các thành phần hỗ trợ & Giới hạn](#-các-thành-phần-hỗ-trợ--giới-hạn)
- [🎨 Tùy chỉnh nâng cao](#-tùy-chỉnh-nâng-cao)
  - [Đối tượng `customizers`](#đối-tượng-customizers)
  - [Cập nhật tiến độ hàng đợi SSE thời gian thực](#cập-nhật-tiến-độ-hàng-đợi-sse-thời-gian-thực)
  - [Các khóa tùy chỉnh có sẵn](#các-khóa-tùy-chỉnh-có-sẵn)
- [⚙️ Cấu hình phiên làm việc](#-cấu-hình-phiên-làm-việc)
  - [Tùy chọn phiên làm việc](#tùy-chọn-phiên-làm-việc)
  - [Hệ thống Logging](#-hệ-thống-logging)
  - [Vòng đời phiên & Quản lý bộ nhớ](#-vòng-đời-phiên--quản-lý-bộ-nhớ)
  - [Nhập số thông minh](#-nhập-số-thông-minh)
- [🌉 Xử lý App tải chậm (Cơ chế Bridge Button)](#-xử-lý-app-tải-chậm-cơ-chế-bridge-button)
- [⚠️ Hạn chế & Cảnh báo trạng thái động (Dynamic State)](#️-hạn-chế--cảnh-báo-trạng-thái-động-dynamic-state)
- [❓ Câu hỏi thường gặp (FAQ)](#-câu-hỏi-thường-gặp-faq)
- [🧪 Kiểm thử (Testing)](#-kiểm-thử-testing)
- [🛠️ Phát triển & Đóng góp (Contributing)](#️-phát-triển--đóng-góp-contributing)
- [📜 Bản quyền](#-bản-quyền)

---

## 🌟 Tại sao nên dùng Discord-Gradio?

Việc mang các mô hình AI và công cụ lên Discord thường yêu cầu viết code bot phức tạp và ánh xạ giao diện thủ công. **Discord-Gradio** tự động hóa việc này bằng cách tạo cầu nối giữa giao diện web của Gradio và hệ thống Modal/Interaction của Discord.

- **🚀 Ổn định không cần SDK**: Sử dụng cơ chế SSE Queue tùy chỉnh (không phụ thuộc vào `@gradio/client`).
- **🎨 Sẵn sàng cho Modal 2026**: Hỗ trợ gốc cho **Type 18 Label** và **Type 19 File Upload**.
- **📑 Tự động phân trang**: Tự động chia các biểu mẫu phức tạp thành nhiều trang Modal nếu vượt quá giới hạn của Discord.
- **🖼️ Xử lý tệp thông minh**: Chuyển đổi mượt mà hình ảnh, âm thanh và video từ Discord sang Gradio.
- **⚡ Kiến trúc Stateless**: Không cần cơ sở dữ liệu. Dữ liệu phiên được mã hóa ngay trong ID của các tương tác.

---

## 📦 Cài đặt

```bash
npm install discord-gradio
```

---

## 🛠 Bắt đầu nhanh (Discord.js v14)

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { GradioPlayground } = require('discord-gradio');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const playground = new GradioPlayground();

client.on('interactionCreate', async (interaction) => {
    // 1. Khởi tạo phiên qua Slash Command
    if (interaction.isChatInputCommand() && interaction.commandName === 'run') {
        const appRef = interaction.options.getString('app'); // VD: 'black-forest-labs/FLUX.1-schnell'
        await playground.init(interaction, appRef);
        return;
    }

    // 2. Chuyển tiếp tương tác cho playground xử lý
    if (await playground.handleSubmit(interaction)) return;
    if (await playground.handleButton(interaction)) return;
});

client.login('YOUR_TOKEN');
```

---

## 🧩 Các thành phần hỗ trợ & Giới hạn

Thư viện tự động ánh xạ các thành phần Gradio sang giao diện Discord tương ứng tốt nhất. Do giới hạn của Discord API, các lựa chọn cho đầu vào sẽ được cắt bớt để ngăn ngừa lỗi API (`BASE_TYPE_BAD_LENGTH`):

| Thành phần Gradio | Giao diện Discord | Giới hạn / Hành vi | Ghi chú |
|-------------------|-------------------|--------------------|---------|
| `Textbox` | `TextInput` | Tối đa 4000 ký tự | Hỗ trợ cả kiểu ngắn và đoạn văn. |
| `Slider` | `TextInput` | - | Tự động kiểm tra phạm vi số (Min/Max). |
| `Number` | `TextInput` | - | Tự động chuyển đổi sang số thực/nguyên. |
| `Dropdown` | `StringSelect` | **Tối đa 25 lựa chọn** | Lựa chọn thừa sẽ bị cắt bớt; ghi log cảnh báo bằng `Logger.warn`. |
| `Radio` | `RadioGroup` | **Tối đa 10 lựa chọn** | Lựa chọn thừa sẽ bị cắt bớt; ghi log cảnh báo bằng `Logger.warn`. |
| `CheckboxGroup` | `CheckboxGroup` | **Tối đa 10 lựa chọn** | Lựa chọn thừa sẽ bị cắt bớt; ghi log cảnh báo bằng `Logger.warn`. |
| `Checkbox` | `Checkbox` | - | Checkbox gốc của Discord (Chuẩn 2026). |
| `Image/File` | `FileUpload` | - | Tự động lấy URL từ tệp đính kèm Discord. |

---

## 🎨 Tùy chỉnh nâng cao

### Đối tượng `customizers`

Thay đổi hành vi và giao diện của bot mà không cần sửa code lõi:

```javascript
const playground = new GradioPlayground({
    customizers: {
        // Tùy chỉnh tin nhắn kết quả cuối cùng
        result: ({ result, session }) => {
            return {
                content: `✅ **Xử lý hoàn tất!**\n${result.data.text}`,
                files: result.data.files.map(f => ({ attachment: f.buffer, name: f.filename }))
            };
        },

        // Tùy chỉnh tin nhắn đang tải khi Gradio đang xử lý
        loading: ({ session }) => ({
            embeds: [{
                title: "⏳ Đang xử lý...",
                description: `Đang chạy dự đoán trên **${session.appReference}**`,
                color: 0x3498db
            }]
        }),

        // Tùy chỉnh tin nhắn xác nhận giữa các trang Modal
        pageConfirmation: ({ session, pageIndex, totalPages }) => ({
            content: `✅ Bước ${pageIndex + 1} trên ${totalPages} đã xong!`,
            button: { label: 'Tiếp tục bước kế', emoji: '🚀' }
        }),

        // Xử lý lỗi một cách chuyên nghiệp
        error: ({ error }) => ({
            content: `❌ **Lỗi xử lý:** ${error.message}`,
            ephemeral: true
        })
    }
});
```

### Cập nhật tiến độ hàng đợi SSE thời gian thực

Thư viện giao tiếp với hệ thống hàng đợi của Gradio bằng Server-Sent Events (SSE). Bạn có thể bắt vị trí hàng đợi và thời gian chờ ước tính theo thời gian thực bằng customizer hook `loading`:

```javascript
const playground = new GradioPlayground({
    customizers: {
        loading: ({ session, queue }) => {
            if (queue) {
                const { position, size, estimatedTime } = queue;
                const posText = position === 0 ? 'Đang xử lý...' : `Vị trí hàng chờ: ${position}/${size || '?'}`;
                const etaText = estimatedTime ? ` (Ước tính: ${Math.round(estimatedTime)}s)` : '';
                return {
                    content: `⏳ **${session.appReference}** đang chạy. ${posText}${etaText}`
                };
            }
            return { content: "🚀 Đang kết nối với hàng chờ..." };
        }
    }
});
```

Tham số `queue` có kiểu dữ liệu là đối tượng `QueueStatus`:
```typescript
interface QueueStatus {
    position: number;       // Thứ hạng hiện tại trong hàng đợi (0 = đang chạy)
    size?: number;          // Tổng số phiên trong hàng đợi
    estimatedTime?: number; // Thời gian chờ dự kiến tính bằng giây
}
```

### Các khóa tùy chỉnh có sẵn
- `result`: Gọi khi dự đoán thành công.
- `error`: Gọi khi có lỗi (Kết nối, Xác thực hoặc Dự đoán).
- `loading`: Hiển thị trong khi đợi hàng đợi của Gradio (hỗ trợ cập nhật trạng thái `queue` thời gian thực).
- `processingFile`: Gọi khi tải và đẩy tệp đính kèm của Discord lên Gradio.
- `beforeInference`: Gọi ngay trước khi Gradio bắt đầu suy luận (sau khi tất cả các tệp tải lên hoàn tất).
- `formatModal`: Chỉnh sửa dữ liệu Modal thô trước khi gửi cho Discord.
- `inputDescription`: Thêm gợi ý/mô tả cho từng trường nhập liệu.

---

### Tùy chọn phiên làm việc

Các tùy chọn cho từng phiên cụ thể có thể được truyền vào phương thức `init`:

```javascript
await playground.init(interaction, appRef, null, {
    ephemeral: true,    // Chỉ người dùng thấy kết quả
    language: 'vi',      // Ngôn ngữ ưu tiên cho nhãn
    manualBridge: false, // Đặt thành true nếu bạn muốn tự xử lý tin nhắn cầu nối
    customizers: {
        result: ({ result }) => ({ content: "Kết quả đã sẵn sàng!" }) // Định dạng kết quả tùy chỉnh
    }
});
```

### 🪵 Hệ thống Logging
Kiểm soát độ chi tiết của log mà không cần sửa mã nguồn:

```javascript
const { GradioPlayground, LogLevel } = require('discord-gradio');

const playground = new GradioPlayground({
    logLevel: LogLevel.DEBUG // Các lựa chọn: DEBUG, INFO, WARN, ERROR, NONE
});
```

### 🧹 Vòng đời phiên & Quản lý bộ nhớ
Để tránh rò rỉ bộ nhớ (Memory Leak) từ các phiên Modal bị người dùng bỏ quên, thư viện tích hợp sẵn trình dọn dẹp tự động chạy ngầm (mỗi 1 phút) để xoá các phiên đã hết hạn:

```javascript
const playground = new GradioPlayground({
    sessionTimeoutMs: 15 * 60 * 1000 // Thời gian hết hạn phiên không hoạt động tính bằng ms (Mặc định: 15 phút)
});

// Luôn gọi destroy() khi dừng bot để giải phóng các bộ hẹn giờ chạy ngầm một cách sạch sẽ
playground.destroy();
```

### 🎨 Tùy chỉnh nâng cao (Customizers)

Tùy chỉnh mọi khía cạnh của giao diện:

```javascript
const playground = new GradioPlayground({
    customizers: {
        // Tùy chỉnh mô tả/gợi ý cho mỗi ô nhập liệu
        inputDescription: ({ component }) => `Nhập giá trị cho ${component.props.label}`,
        
        // Toàn quyền kiểm soát JSON Modal thô trước khi gửi tới Discord
        formatModal: (modalData, session, pageIndex) => {
            modalData.title = `✨ Magic Prompt (${pageIndex + 1})`;
            return modalData;
        },

        // Tin nhắn đang xử lý tùy chỉnh
        loading: ({ session }) => ({ embeds: [{ title: "Đang xử lý...", color: 0x3498db }] }),
        
        // Xử lý lỗi tùy chỉnh
        error: ({ error }) => ({ content: `❌ Lỗi: ${error.message}` })
    }
});
```

### 🔢 Nhập số thông minh
Đối với các linh kiện `number` và `slider`, thư viện sẽ tự động thêm thông tin về khoảng giá trị và bước nhảy vào phần mô tả (ví dụ: `(R: 0-100, S: 1)`), giúp người dùng luôn nhập đúng giới hạn.

---

## 🌉 Xử lý App tải chậm (Cơ chế Bridge Button)

Discord Modal bắt buộc phải được hiển thị trong vòng **3 giây** kể từ khi có tương tác. Nếu một Gradio App mất nhiều thời gian hơn để tải cấu hình, tương tác sẽ hết hạn.

Để giải quyết vấn đề này, **Discord-Gradio** triển khai cơ chế **Bridge Button (Nút bấm cầu nối)**:

1.  **Trì hoãn thủ công**: Gọi `await interaction.deferReply()` trong code bot của bạn.
2.  **Nút bấm cầu nối**: Thư viện nhận diện việc trì hoãn và gửi một tin nhắn với nút bấm "Bắt đầu".
3.  **Cửa sổ mới**: Việc nhấn nút sẽ tạo ra một tương tác mới, giúp kích hoạt Modal một cách an toàn.

### Tùy chỉnh tin nhắn cầu nối (Manual Bridge)

Nếu bạn muốn tự thiết kế tin nhắn "Sẵn sàng" của riêng mình (VD: có Embed), hãy sử dụng tùy chọn `manualBridge`:

```javascript
await interaction.deferReply();
await playground.init(interaction, appRef, null, { manualBridge: true });

const openModalId = playground.getOpenModalId(interaction);

await interaction.editReply({
    embeds: [{ title: "Mô hình AI đã sẵn sàng", description: "Nhấn vào nút dưới đây để bắt đầu." }],
    components: [{
        type: 1,
        components: [{
            type: 2,
            style: 1,
            label: "Mở Form Nhập Liệu",
            custom_id: openModalId // Được quản lý bởi thư viện
        }]
    }]
});
```

---

## 🔍 Giải quyết sự cố & Nhật ký

Thư viện tích hợp sẵn Logger để giúp bạn theo dõi các vấn đề về kết nối hoặc trích xuất dữ liệu:

```javascript
const { Logger } = require('discord-gradio');
// Các mức độ log: 'info', 'warn', 'error', 'debug'
```

**Các lỗi thường gặp:**
- **Unknown Interaction (10062)**: Xảy ra nếu việc kết nối Gradio mất hơn 3 giây trước khi bạn `deferReply`. Thư viện sử dụng các lệnh gọi API thô để giảm thiểu việc này, nhưng các App quá chậm vẫn có thể gặp lỗi.
- **Inference Failed**: Đảm bảo App không ở chế độ riêng tư và không yêu cầu đăng nhập.

---

## ⚠️ Hạn chế & Cảnh báo trạng thái động (Dynamic State)

> [!WARNING]
> **Không hỗ trợ Giao diện động & Logic có điều kiện phức tạp**
> Các ứng dụng Gradio phụ thuộc nhiều vào việc thay đổi giao diện động (ví dụ: ẩn/hiện trường nhập liệu, thay đổi danh sách tùy chọn dựa trên `gr.State` hoặc chạy callback thay đổi giá trị input trước khi submit chính thức) **sẽ không hoạt động chính xác**.
>
> **Lý do?**
> `discord-gradio` ánh xạ giao diện Gradio một cách tĩnh dựa trên cấu hình lấy về lúc đầu. Do Discord Modal không hỗ trợ đồng bộ hóa trạng thái theo thời gian thực hoặc gọi callback sự kiện khi đang gõ văn bản, mọi cập nhật giao diện động từ Gradio không thể phản ánh lên Modal Discord. Chỉ các bố cục form tiêu chuẩn với tập hợp các trường input tĩnh là được hỗ trợ đầy đủ.

---

## ❓ Câu hỏi thường gặp (FAQ)

#### Q: Bot của tôi bị lỗi hoặc ghi log "BASE_TYPE_BAD_LENGTH" khi dùng dropdown.
**A:** Discord giới hạn dropdown (StringSelect) chỉ có tối đa **25** lựa chọn, Radio Group và Checkbox Group tối đa **10** lựa chọn. `discord-gradio` tự động cắt bớt các lựa chọn thừa và đưa ra cảnh báo qua `Logger.warn` để tránh lỗi Discord API (`BASE_TYPE_BAD_LENGTH`).

#### Q: Bot xử lý việc tải lên tệp (hình ảnh, âm thanh, video) thế nào?
**A:** Discord-Gradio tự động ánh xạ các loại dữ liệu đầu vào `Image`, `Audio`, `Video` và `File` sang thành phần FileUpload trên Discord. Khi modal được gửi lên, thư viện tải tệp xuống từ CDN của Discord, sau đó tải tệp đó lên endpoint `/upload` của Gradio App và thay thế đường dẫn tệp trong payload gửi lên Gradio.

#### Q: Tôi có thể sử dụng các Hugging Face App ở chế độ riêng tư (Private) không?
**A:** Hiện tại, thư viện chưa hỗ trợ các App riêng tư yêu cầu xác thực hoặc đăng nhập (OAuth/Bearer Token). Thư viện chỉ hoạt động tốt với các public Gradio App hoặc các App không yêu cầu thông tin đăng nhập.

#### Q: Làm sao để xử lý việc các Gradio App phản hồi quá chậm gây hết hạn tương tác (timeout)?
**A:** Discord yêu cầu tương tác phải được phản hồi trong vòng 3 giây. Đối với các App phản hồi chậm, hãy luôn sử dụng `interaction.deferReply()` và kích hoạt quy trình **Bridge Button**. Bạn cũng có thể tùy biến tin nhắn cầu nối qua tùy chọn `manualBridge`.

---

## 🧪 Kiểm thử (Testing)

Thư viện bao gồm một bộ unit test cực kỳ hoàn chỉnh sử dụng **Vitest** để kiểm tra tính năng và chống lỗi tái diễn (regression).

Để chạy tất cả các test một lần duy nhất:
```bash
npm run test
```

Để chạy test ở chế độ theo dõi (watch mode) khi phát triển dự án:
```bash
npm run test:watch
```

---

## 🛠️ Phát triển & Đóng góp (Contributing)

Chúng tôi rất hoan nghênh các đóng góp từ cộng đồng! Để cài đặt và phát triển thư viện cục bộ:

1. **Khởi tạo và nhân bản mã nguồn (Clone repository):**
   ```bash
   git clone https://github.com/carlylekatto/discord-gradio.git
   cd discord-gradio
   ```

2. **Cài đặt các gói phụ thuộc (Dependencies):**
   ```bash
   npm install
   ```

3. **Các câu lệnh phát triển khả dụng:**
   * **Tự động biên dịch lại khi thay đổi tệp:** `npm run dev`
   * **Biên dịch sản phẩm (Production build):** `npm run build`
   * **Kiểm tra cú pháp và cấu trúc TypeScript (Lint):** `npm run lint`
   * **Chạy bộ kiểm thử (Unit Tests):** `npm run test` hoặc `npm run test:watch`

Vui lòng đảm bảo rằng tất cả các bài kiểm tra tự động đều vượt qua (passed) và trình kiểm tra TypeScript không phát hiện lỗi nào trước khi gửi Pull Request!

---

## 📜 Bản quyền

Giấy phép MIT - Bản quyền (c) 2026 **Katt (カット)**
