SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

UPDATE BangDiem SET XepLoai = N'Tốt' WHERE XepLoai LIKE '%Gi%' OR XepLoai LIKE '%i%';
UPDATE BangDiem SET XepLoai = N'Hoàn thành' WHERE XepLoai LIKE '%Kh%' OR XepLoai LIKE '%K%';
UPDATE BangDiem SET XepLoai = N'Chưa đạt' WHERE XepLoai NOT LIKE '%Tốt%' AND XepLoai NOT LIKE '%Hoàn thành%';
UPDATE BangDiem SET NhanXet = N'Học sinh chăm ngoan, có ý thức học tập và tiếp thu bài tốt.';

INSERT INTO TaiKhoan (TenDangNhap, MatKhau, HoTen, VaiTro) VALUES 
('GV001_LanAnh', '123456', N'Tiết Lan Anh', 'GiaoVien'),
('GV002_MinhTuan', '123456', N'Trần Minh Tuấn', 'GiaoVien'),
('GV_TOAN_Trinh', '123456', N'Lê Kiều Trinh', 'GiaoVien'),
('GV005_BaoChau', '123456', N'Nguyễn Bảo Châu', 'GiaoVien'),
('HT_NguyenMinh', '123456', N'Nguyễn Đức Minh', 'HieuTruong');

UPDATE LopHoc SET GVChuNhiem = 'GV001_LanAnh' WHERE GVChuNhiem = 'GVCN1A';
UPDATE LopHoc SET GVChuNhiem = 'GV002_MinhTuan' WHERE GVChuNhiem = 'GVCN2A';

UPDATE PhanCongGiangDay SET MaGiaoVien = 'GV001_LanAnh' WHERE MaGiaoVien = 'GVCN1A';
UPDATE PhanCongGiangDay SET MaGiaoVien = 'GV002_MinhTuan' WHERE MaGiaoVien = 'GVCN2A';
