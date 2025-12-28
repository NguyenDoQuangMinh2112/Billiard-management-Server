# Hướng Dẫn Triển Khai Backend Lên Production (Miễn Phí)

Tài liệu này hướng dẫn cách deploy backend (Bun/Node.js) lên **Render** và cơ sở dữ liệu PostgreSQL lên **Neon.tech** hoàn toàn miễn phí.

## Kiến Trúc
- **Hosting**: Render (Web Service - Free Tier)
- **Database**: Neon (PostgreSQL - Free Tier)
- **Code**: GitHub

---

## Bước 1: Chuẩn bị Cơ Sở Dữ Liệu (PostgreSQL)

Chúng ta sẽ sử dụng **Neon** vì nó cung cấp PostgreSQL miễn phí và rất nhanh.

1. Truy cập [neon.tech](https://neon.tech/) và đăng ký tài khoản (Sign Up).
2. Tạo một Project mới (đặt tên là `billiard-db` chẳng hạn).
3. Sau khi tạo xong, Neon sẽ hiển thị **Connection String**. Hãy copy chuỗi này.
   - Định dạng giống như: `postgres://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require`
   - Lưu lại chuỗi này để dùng ở Bước 3.

---

## Bước 2: Chuẩn bị Code

1. Đảm bảo code của bạn đã được đẩy lên **GitHub**.
2. Kiểm tra file `Dockerfile` trong thư mục gốc (đã có sẵn trong dự án):
   ```dockerfile
   FROM oven/bun:1.1
   WORKDIR /usr/src/app
   COPY package.json bun.lock* ./
   RUN bun install
   COPY . .
   EXPOSE 3000
   CMD ["bun", "run", "index.ts"]
   ```

---

## Bước 3: Deploy Backend lên Render

1. Truy cập [render.com](https://render.com/) và đăng ký tài khoản (bằng GitHub).
2. Tại Dashboard, chọn **New +** -> **Web Service**.
3. Chọn **Build and deploy from a Git repository**.
4. Kết nối với repo GitHub chứa code backend của bạn.
5. Cấu hình Web Service:
   - **Name**: `billiard-backend` (hoặc tên tùy ý)
   - **Region**: Singapore (cho gần Việt Nam) hoặc US.
   - **Branch**: `main` (hoặc nhánh chứa code).
   - **Runtime**: Chọn **Docker** (Quan trọng!).
   - **Instance Type**: Chọn **Free**.

6. Cấu hình **Environment Variables** (Biến môi trường):
   Kéo xuống phần "Environment Variables" và thêm các biến sau:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Dán chuỗi kết nối từ Neon (Bước 1) vào đây. |
   | `PORT` | `3000` |
   | `CORS_ORIGIN` | `*` (hoặc URL frontend của bạn sau khi deploy, e.g. `https://my-app.vercel.app`) |
   | `NODE_ENV` | `production` |

7. Nhấn **Create Web Service**.

---

## Bước 4: Kiểm tra

1. Render sẽ bắt đầu build Docker image và deploy. Quá trình này mất khoảng 2-5 phút.
2. Khi deploy thành công, bạn sẽ thấy trạng thái **Live** màu xanh.
3. Copy URL của backend (ví dụ: `https://billiard-backend.onrender.com`).
4. Thử truy cập `https://billiard-backend.onrender.com/` (hoặc endpoint health check nếu có) để xem server chạy chưa.

**Lưu ý về Free Tier của Render**: Service sẽ tự động "ngủ" (spin down) sau 15 phút không có request. Khi có request mới, nó sẽ mất khoảng 30s-1p để khởi động lại. Đây là bình thường với gói miễn phí.
