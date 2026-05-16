# 🤖 Tích hợp Discord với Gradio

[![npm version](https://img.shields.io/npm/v/discord-gradio.svg)](https://www.npmjs.com/package/discord-gradio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Chuyển đổi bất kỳ **Gradio App** nào (Hugging Face Spaces, Link chia sẻ, hoặc Tên miền riêng) thành một **Giao diện Discord** hoàn chỉnh mà không cần cấu hình phức tạp. Được tối ưu hóa cho các tiêu chuẩn Discord hiện đại và hiệu suất cao.

[English](../README.md)

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
        const appRef = interaction.options.getString('url'); // VD: 'black-forest-labs/FLUX.1-schnell'
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

## 🧩 Các thành phần hỗ trợ

Thư viện tự động ánh xạ các thành phần Gradio sang giao diện Discord tương ứng tốt nhất:

| Thành phần Gradio | Giao diện Discord | Ghi chú |
|-------------------|-------------------|---------|
| `Textbox` | `TextInput` | Hỗ trợ cả kiểu ngắn và đoạn văn. |
| `Slider` | `TextInput` | Tự động kiểm tra phạm vi số (Min/Max). |
| `Number` | `TextInput` | Tự động chuyển đổi sang số thực/nguyên. |
| `Dropdown` | `StringSelect` | Sử dụng container Modal Type 18. |
| `Radio` | `RadioGroup` | Chọn một mục từ danh sách. |
| `Checkbox` | `Checkbox` | Checkbox gốc của Discord (Chuẩn 2026). |
| `Image/File` | `FileUpload` | Tự động lấy URL từ tệp đính kèm Discord. |

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

### Các khóa tùy chỉnh có sẵn
- `result`: Gọi khi dự đoán thành công.
- `error`: Gọi khi có lỗi (Kết nối, Xác thực hoặc Dự đoán).
- `loading`: Hiển thị trong khi đợi hàng đợi của Gradio.
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
    formatReply: (result) => ({ content: "Kết quả đã sẵn sàng!" }) // Định dạng kết quả tùy chỉnh
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

## 🌉 Xử lý Space tải chậm (Cơ chế Bridge Button)

Discord Modal bắt buộc phải được hiển thị trong vòng **3 giây** kể từ khi có tương tác. Nếu một Gradio Space mất nhiều thời gian hơn để tải cấu hình, tương tác sẽ hết hạn.

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
- **Unknown Interaction (10062)**: Xảy ra nếu việc kết nối Gradio mất hơn 3 giây trước khi bạn `deferReply`. Thư viện sử dụng các lệnh gọi API thô để giảm thiểu việc này, nhưng các Space quá chậm vẫn có thể gặp lỗi.
- **Inference Failed**: Đảm bảo Space không ở chế độ riêng tư và không yêu cầu đăng nhập.

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
