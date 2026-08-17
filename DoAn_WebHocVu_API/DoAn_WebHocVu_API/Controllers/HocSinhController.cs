using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DoAn_WebHocVu_API.Models;
using System.Linq;

namespace DoAn_WebHocVu_API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "GiaoVien,HieuTruong")] // TẤT CẢ GIÁO VIÊN ĐỀU VÀO ĐƯỢC ĐÂY (Thỏa mãn điều kiện XEM ĐIỂM/DANH SÁCH)
    public class HocSinhController : ControllerBase
    {
        private readonly DoAnWebHocVuAdvancedContext _context;

        public HocSinhController(DoAnWebHocVuAdvancedContext context)
        {
            _context = context;
        }

        /// <summary>
        /// API dành cho Quản trị viên/BGH: Truy xuất toàn bộ hồ sơ lưu trữ của lớp
        /// Bao gồm cả học sinh đang học và học sinh đã chuyển trường/thôi học để làm báo cáo, thống kê.
        /// </summary>
        [HttpGet("truy-xuat-ho-so/{maLop}")]
        public async Task<IActionResult> TruyXuatHoSoTheoLop(string maLop)
        {
            // Lọc danh sách học sinh theo mã lớp thông qua bảng Lịch Sử Phân Lớp v2
            var danhSach = await _context.LichSuPhanLops
                .Include(l => l.MaHsNavigation)
                .Where(l => l.MaLop == maLop)
                .Select(l => new HocSinh
                {
                    MaHs = l.MaHsNavigation.MaHs,
                    HoTen = l.MaHsNavigation.HoTen,
                    NgaySinh = l.MaHsNavigation.NgaySinh,
                    SdtphuHuynh = l.MaHsNavigation.SdtphuHuynh,
                    TaiKhoanPhuHuynh = l.MaHsNavigation.TaiKhoanPhuHuynh,
                    UuTienZalo = l.MaHsNavigation.UuTienZalo,
                    Nu = l.MaHsNavigation.Nu,
                    DanTocKhac = l.MaHsNavigation.DanTocKhac,
                    TrangThai = l.MaHsNavigation.TrangThai,
                    MaLop = l.MaLop // Trả về MaLop cho UI Next.js hiển thị
                })
                .ToListAsync();

            return Ok(danhSach);
        }

        /// <summary>
        /// API 2: Thêm mới học sinh (Chỉ GVCN lớp đó mới được thêm)
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateHocSinh([FromBody] HocSinh hs)
        {
            // 1. Lấy mã giáo viên đang thao tác từ Token
            var maGiaoVien = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            // 2. Tìm lớp học xem ai làm chủ nhiệm
            var lopHoc = await _context.LopHocs.FirstOrDefaultAsync(l => l.MaLop == hs.MaLop);
            if (lopHoc == null)
                return NotFound("Không tìm thấy mã lớp học này.");

            // 3. Kiểm tra xem giáo viên này có phải GVCN của lớp hoặc Hiệu trưởng không
            bool isHieuTruong = User.IsInRole("HieuTruong");
            if (lopHoc.GvchuNhiem != maGiaoVien && !isHieuTruong)
            {
                return StatusCode(403, new { message = $"Bạn không có quyền! Chỉ Hiệu trưởng hoặc GVCN của lớp {hs.MaLop} mới được phép thêm học sinh." });
            }

            // 4. Nếu đúng là GVCN -> Tiến hành thêm mới
            // Kiểm tra xem mã tài khoản phụ huynh nhập vào đã tồn tại trong bảng TaiKhoan chưa
            if (!string.IsNullOrWhiteSpace(hs.TaiKhoanPhuHuynh))
            {
                var tkTonTai = await _context.TaiKhoans.AnyAsync(t => t.TenDangNhap == hs.TaiKhoanPhuHuynh);
                if (!tkTonTai)
                {
                    return BadRequest(new { message = $"Thất bại! Tài khoản phụ huynh '{hs.TaiKhoanPhuHuynh}' chưa tồn tại trong hệ thống. Vui lòng tạo tài khoản này trước." });
                }
            }

            // Thêm Học sinh gốc
            _context.HocSinhs.Add(hs);

            // Thêm bản ghi Lịch Sử Phân Lớp v2
            var lichSuMoi = new LichSuPhanLop {
                MaHs = hs.MaHs,
                MaLop = hs.MaLop,
                NienKhoa = lopHoc.NienKhoa ?? "Unknown"
            };
            _context.LichSuPhanLops.Add(lichSuMoi);

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Thành công! Đã thêm học sinh {hs.HoTen} vào lớp {hs.MaLop} niên khóa {lopHoc.NienKhoa}." });
        }

        /// <summary>
        /// API 3: Sửa thông tin học sinh (Chỉ GVCN lớp đó mới được sửa)
        /// </summary>
        [HttpPut("{maHS}")]
        public async Task<IActionResult> UpdateHocSinh(string maHS, [FromBody] HocSinh hsCapNhat)
        {
            var maGiaoVien = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            // Tìm học sinh gốc trong DB
            var hocSinhGoc = await _context.HocSinhs.FirstOrDefaultAsync(h => h.MaHs == maHS);
            if (hocSinhGoc == null)
                return NotFound("Không tìm thấy học sinh cần sửa.");

            // Tìm record phân lớp gần nhất (hoặc đang chọn)
            var currentLopHistory = await _context.LichSuPhanLops
                .Include(l => l.MaLopNavigation)
                .OrderByDescending(l => l.NienKhoa)
                .FirstOrDefaultAsync(l => l.MaHs == maHS);

            var lopHoc = currentLopHistory?.MaLopNavigation;

            bool isHieuTruong = User.IsInRole("HieuTruong");
            if (lopHoc == null || (lopHoc.GvchuNhiem != maGiaoVien && !isHieuTruong))
            {
                return StatusCode(403, new { message = $"Bạn không có quyền sửa. Chỉ Hiệu trưởng hoặc GVCN mới có quyền." });
            }

            // Kiểm tra TK PH
            if (!string.IsNullOrWhiteSpace(hsCapNhat.TaiKhoanPhuHuynh))
            {
                var tkTonTai = await _context.TaiKhoans.AnyAsync(t => t.TenDangNhap == hsCapNhat.TaiKhoanPhuHuynh);
                if (!tkTonTai)
                {
                    return BadRequest(new { message = $"Thất bại! Tài khoản phụ huynh '{hsCapNhat.TaiKhoanPhuHuynh}' chưa tồn tại trong hệ thống." });
                }
            }

            // Tiến hành cập nhật thông tin gốc
            hocSinhGoc.HoTen = hsCapNhat.HoTen;
            hocSinhGoc.NgaySinh = hsCapNhat.NgaySinh;
            hocSinhGoc.TaiKhoanPhuHuynh = hsCapNhat.TaiKhoanPhuHuynh;
            hocSinhGoc.SdtphuHuynh = hsCapNhat.SdtphuHuynh;
            hocSinhGoc.UuTienZalo = hsCapNhat.UuTienZalo;
            hocSinhGoc.Nu = hsCapNhat.Nu;
            hocSinhGoc.DanTocKhac = hsCapNhat.DanTocKhac;
            hocSinhGoc.TrangThai = hsCapNhat.TrangThai;

            // Có thể chuyển lớp nếu truyền lên thay đổi MaLop
            if (!string.IsNullOrEmpty(hsCapNhat.MaLop) && currentLopHistory != null && hsCapNhat.MaLop != currentLopHistory.MaLop)
            {
                // Kiểm tra xem Lớp mới có cùng niên khóa với lớp cũ không, nếu CÙNG niên khóa thì đổi lớp, nếu tạo niên khóa mới thì phải Update NienKhoa
                var lopMoi = await _context.LopHocs.FirstOrDefaultAsync(l => l.MaLop == hsCapNhat.MaLop);
                if (lopMoi != null)
                {
                    _context.LichSuPhanLops.Remove(currentLopHistory);

                    var newHistory = new LichSuPhanLop {
                        MaHs = hocSinhGoc.MaHs,
                        MaLop = lopMoi.MaLop,
                        NienKhoa = lopMoi.NienKhoa ?? "Unknown"
                    };
                    _context.LichSuPhanLops.Add(newHistory);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Thành công! Đã cập nhật thông tin học sinh {maHS}." });
        }

        /// <summary>
        /// API 4: Xóa học sinh (Thực chất là chuyển trạng thái - Soft Delete)
        /// </summary>
        [HttpDelete("{maHS}")]
        public async Task<IActionResult> DeleteHocSinh(string maHS)
        {
            var maGiaoVien = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(maGiaoVien))
            {
                return StatusCode(401, new { message = "Lỗi Token: Không thể lấy được mã giáo viên từ thẻ đăng nhập!" });
            }

            var hocSinh = await _context.HocSinhs.FirstOrDefaultAsync(h => h.MaHs == maHS);
            if (hocSinh == null) return NotFound("Không tìm thấy học sinh cần xóa.");

            var currentHistory = await _context.LichSuPhanLops
                .Include(l => l.MaLopNavigation)
                .OrderByDescending(l => l.NienKhoa)
                .FirstOrDefaultAsync(l => l.MaHs == maHS);

            var lopHoc = currentHistory?.MaLopNavigation;
            bool isHieuTruong = User.IsInRole("HieuTruong");
            if (lopHoc == null || (lopHoc.GvchuNhiem?.Trim().ToUpper() != maGiaoVien.Trim().ToUpper() && !isHieuTruong))
            {
                return StatusCode(403, new { message = $"Bạn không có quyền! Thao tác này chỉ dành cho Hiệu trưởng hoặc GVCN." });
            }

            hocSinh.TrangThai = "Đã chuyển trường";

            await _context.SaveChangesAsync();

            return Ok(new { message = $"Thành công! Đã chuyển trạng thái hồ sơ của em {hocSinh.HoTen} thành 'Đã chuyển trường'." });
        }

        /// <summary>
        /// API: Tìm kiếm học sinh theo Mã Học Sinh (maHS)
        /// Cả Giáo viên và Hiệu trưởng đều tìm kiếm được.
        /// </summary>
        [HttpGet("tim-kiem/{maHS}")]
        public async Task<IActionResult> TimKiemHocSinh(string maHS)
        {
            if (string.IsNullOrWhiteSpace(maHS)) return BadRequest("Mã học sinh không được để trống.");
            maHS = maHS.Trim();

            var hocSinh = await _context.HocSinhs.FirstOrDefaultAsync(h => h.MaHs == maHS);
            if (hocSinh == null) return NotFound(new { message = $"Không tìm thấy học sinh với mã '{maHS}'." });

            // Tìm thông tin lớp học và niên khóa mới nhất học sinh tham gia
            var history = await _context.LichSuPhanLops
                .Include(l => l.MaLopNavigation)
                .Where(l => l.MaHs == maHS)
                .OrderByDescending(l => l.NienKhoa)
                .FirstOrDefaultAsync();

            var result = new
            {
                maHs = hocSinh.MaHs,
                hoTen = hocSinh.HoTen,
                ngaySinh = hocSinh.NgaySinh,
                nu = hocSinh.Nu,
                danTocKhac = hocSinh.DanTocKhac,
                sdtPhuHuynh = hocSinh.SdtphuHuynh,
                taiKhoanPhuHuynh = hocSinh.TaiKhoanPhuHuynh,
                uuTienZalo = hocSinh.UuTienZalo,
                trangThai = hocSinh.TrangThai,
                maLop = history?.MaLop ?? "",
                tenLop = history?.MaLopNavigation?.TenLop ?? "",
                nienKhoa = history?.NienKhoa ?? ""
            };

            return Ok(result);
        }
    }
}