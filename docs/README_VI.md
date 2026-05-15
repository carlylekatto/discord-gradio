# Discord Gradio Integration (Tiếng Việt)

Thư viện giúp tích hợp nhanh chóng mọi ứng dụng Gradio (Hugging Face Spaces, link chia sẻ, hoặc domain riêng) vào Discord thông qua Modal và hệ thống quản lý session thông minh.

[English](../README.md)

## Mục lục
- [Tại sao nên dùng Discord-Gradio?](#tại-sao-nên-dùng-discord-gradio)
- [Tính năng chính](#tính-năng-chính)
- [Cài đặt](#cài-đặt)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Tùy biến](#tùy biến)
- [Nền tảng hỗ trợ](#nền-tảng-hỗ-trợ)
- [Lưu ý quan trọng](#lưu-ý-quan-trọng)
- [License](#license)

## Tại sao nên dùng Discord-Gradio?

Gradio là một công cụ tuyệt vời để tạo giao diện web cho các script Python của bạn. **Discord-Gradio** cho phép bạn mang những giao diện đó trực tiếp vào máy chủ Discord mà không cần xây dựng lại logic:

- **Tích hợp mượt mà**: Đưa bất kỳ ứng dụng Gradio nào (công cụ tính toán, trình khám phá dữ liệu, hay các mô hình) vào không gian chat Discord.
- **Phát triển nhanh chóng**: Bỏ qua quy trình thiết kế Discord Modal thủ công và xử lý dữ liệu đầu vào phức tạp.
- **Nhẹ nhàng & Hiệu quả**: Kiến trúc không lưu trạng thái (stateless)—không cần cơ sở dữ liệu để quản lý session người dùng.
- **Trải nghiệm người dùng tốt hơn**: Tự động xử lý điều hướng nhiều trang cho các ứng dụng có số lượng input vượt quá giới hạn giao diện của Discord.

## Tính năng chính

- **Hỗ trợ vạn năng**: Hoạt động với HF Spaces, link `.gradio.live` và các ứng dụng Gradio tự host.
- **Tự động phát hiện**: Tự động tìm kiếm endpoint API thông minh.
- **Hỗ trợ Hybrid**: Hỗ trợ bản địa cho ESM và CommonJS.
- **TypeScript First**: Hỗ trợ đầy đủ type safety và IntelliSense.
- **Đa ngôn ngữ (i18n)**: Tự động tra cứu bảng dịch từ ứng dụng Gradio.
- **Giao diện thông minh**: Ánh xạ tự động các thành phần Gradio sang Discord Modal.

## Cài đặt

```bash
npm install discord-gradio
```

## Bắt đầu nhanh

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

## Tùy biến

Bạn có thể tùy biến giao diện và hành vi thông qua đối tượng `customizers` trong constructor hoặc sử dụng phương thức `setCustomizer`:

```javascript
const playground = new GradioPlayground({
    customizers: {
        result: ({ result }) => ({ content: 'Thành công!' })
    }
});

// Hoặc thiết lập sau đó
playground.setCustomizer('error', ({ error }) => {
    return { content: `⚠️ Lỗi: ${error.message}`, ephemeral: true };
});

// Các key customizer có sẵn: 'result', 'error', 'loading', 'formatModal', 'inputDescription', 'pageConfirmation'
```

### Session Options
Các tùy chọn cho từng session cụ thể có thể được truyền vào phương thức `init`:

```javascript
await playground.init(interaction, appRef, null, {
    ephemeral: true, // Chỉ người gọi lệnh mới thấy kết quả
    language: 'vi'   // Ép buộc sử dụng một ngôn ngữ cụ thể
});
```

## Nền tảng hỗ trợ

- **Hugging Face Spaces**: `username/space-name`
- **Gradio Shared Links**: `xxxx.gradio.live`
- **Domain riêng**: `https://your-gradio-app.com`

## Lưu ý quan trọng

> [!WARNING]
> **Hạn chế đối với các Space phức tạp**
> Thư viện này được tối ưu hóa cho các luồng xử lý input-to-output tiêu chuẩn. Những ứng dụng phụ thuộc nặng nề vào JavaScript tùy chỉnh, cập nhật giao diện phản ứng (reactive UI) phức tạp giữa các thành phần bên trong modal có thể gặp hạn chế do giới hạn kỹ thuật của Discord.

## License

Dự án này được phát hành dưới giấy phép **MIT License**.

Bản quyền (c) 2026 カット Katt

Xem file [LICENSE](../LICENSE) để biết thêm chi tiết.
