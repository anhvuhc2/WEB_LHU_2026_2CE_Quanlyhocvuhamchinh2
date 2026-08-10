# HỆ THỐNG QUẢN LÝ HỌC VỤ TRƯỜNG TIỂU HỌC HÀM CHÍNH 2

## Giới thiệu

Đây là đồ án tốt nghiệp xây dựng hệ thống Web App quản lý học vụ cho Trường Tiểu học Hàm Chính 2.

Hệ thống hỗ trợ:

- Quản lý học sinh
- Quản lý lớp học
- Quản lý giáo viên
- Phân công giảng dạy
- Nhập điểm
- Điểm danh
- Kế hoạch lớp
- Thông báo phụ huynh
- AI Assistant hỗ trợ giải đáp theo Thông tư 27

---

# Công nghệ sử dụng

## Backend

- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- JWT Authentication

## Frontend

- Next.js
- React
- Ant Design
- Tailwind CSS

## Database

- Microsoft SQL Server

---

# Yêu cầu cài đặt

Cần cài đặt:

- Visual Studio 2022
- .NET 8 SDK
- SQL Server 2019 hoặc mới hơn
- SQL Server Management Studio (SSMS)
- Node.js 20+
- npm

---

# Hướng dẫn chạy Database

1. Mở SQL Server Management Studio.

2. Tạo database

```
PROJECT_QUANLYHOCSINH26BT
```

3. Chạy file

```
database.sql
```

để tạo toàn bộ bảng dữ liệu.

---

# Chạy Backend

Di chuyển vào thư mục backend

```
cd backend
```

Khôi phục package

```
dotnet restore
```

Chạy project

```
dotnet run
```

API mặc định

```
https://localhost:5001
```

Swagger

```
https://localhost:5001/swagger
```

---

# Chạy Frontend

Di chuyển vào thư mục frontend

```
cd frontend
```

Cài package

```
npm install
```

Chạy project

```
npm run dev
```

Mở trình duyệt

```
http://localhost:3000
```

---

# Tài khoản mẫu

## Hiệu trưởng

```
Username: admin
Password: 123456
```

## Giáo viên

```
Username: gv01
Password: 123456
```

## Phụ huynh

```
Username: ph01
Password: 123456
```

---

# Cấu trúc thư mục

```
backend/
    Controllers/
    Models/
    Services/
    Data/

frontend/
    app/
    components/
    services/

database/
    database.sql

docs/
    blueprint.md
```

---

# Chức năng chính

- Quản lý học sinh
- Quản lý lớp
- Quản lý môn học
- Phân công giảng dạy
- Điểm danh
- Nhập điểm
- Thông báo
- AI Chat Assistant
- Phân quyền JWT
- RBAC
- ABAC

---

# Tài liệu

Tài liệu đặc tả hệ thống:

```
docs/blueprint.md
```

Bao gồm:

- Kiến trúc hệ thống
- Thiết kế CSDL
- Đặc tả Module
- Quy trình nghiệp vụ
- Phân quyền
- AI Workflow

---

# Tác giả

Nguyễn Thị Anh Vũ

Đồ án tốt nghiệp

Hệ thống Quản lý học vụ Trường Tiểu học Hàm Chính 2