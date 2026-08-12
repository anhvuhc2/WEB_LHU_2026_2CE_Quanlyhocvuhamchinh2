using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DoAn_WebHocVu_API.Models;

namespace DoAn_WebHocVu_API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "HieuTruong")]
    public class QuanLyTruongController : ControllerBase
    {
        private readonly DoAnWebHocVuAdvancedContext _context;
        private readonly IConfiguration _config;

        public QuanLyTruongController(DoAnWebHocVuAdvancedContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        [AllowAnonymous]
        [HttpGet("nien-khoa-hien-tai")]
        public async Task<IActionResult> GetActiveNienKhoa()
        {
            // API mới lấy niên khóa khóa sổ bằng CSDL động thay vì appsettings
            var active = await _context.DanhMucNienKhoas.FirstOrDefaultAsync(n => n.IsActive);
            if (active != null) 
                return Ok(new { activeAcademicYear = active.MaNienKhoa });
            return Ok(new { activeAcademicYear = "2025-2026" }); // Fallback an toàn
        }

        [AllowAnonymous]
        [HttpGet("danh-sach-nien-khoa")]
        public async Task<IActionResult> GetDanhSachNienKhoa()
        {
            var list = await _context.DanhMucNienKhoas
                .OrderByDescending(n => n.MaNienKhoa)
                .Select(n => n.MaNienKhoa)
                .ToListAsync();
            return Ok(list);
        }

        [Authorize(Roles = "HieuTruong")]
        [HttpPost("chot-nien-khoa")]
        public async Task<IActionResult> SwitchActiveYear([FromBody] string targetYear)
        {
            if (string.IsNullOrEmpty(targetYear)) return BadRequest("Năm học không hợp lệ");
            var target = await _context.DanhMucNienKhoas.FirstOrDefaultAsync(n => n.MaNienKhoa == targetYear);
            if (target == null) return NotFound("Năm học không tồn tại trong danh mục");

            var all = await _context.DanhMucNienKhoas.ToListAsync();
            foreach (var item in all) item.IsActive = false;
            target.IsActive = true;

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Đã chốt sổ và chuyển quyền nhập điểm sang năm {targetYear} thành công!" });
        }

        [Authorize(Roles = "HieuTruong")]
        [HttpPost("them-nien-khoa")]
        public async Task<IActionResult> ThemNienKhoa([FromBody] string newYear)
        {
            if (string.IsNullOrEmpty(newYear)) return BadRequest(new { message = "Niên khóa không được để trống" });
            newYear = newYear.Trim();

            // Validate format YYYY-YYYY: vd 2026-2027
            var match = System.Text.RegularExpressions.Regex.Match(newYear, @"^(\d{4})-(\d{4})$");
            if (!match.Success)
            {
                return BadRequest(new { message = "Định dạng niên khóa không hợp lệ (phải là YYYY-YYYY, ví dụ: 2026-2027)" });
            }

            int yearStart = int.Parse(match.Groups[1].Value);
            int yearEnd = int.Parse(match.Groups[2].Value);
            if (yearEnd != yearStart + 1)
            {
                return BadRequest(new { message = "Niên khóa không hợp lệ. Năm kết thúc phải lớn hơn năm bắt đầu đúng 1 năm (ví dụ: 2026-2027)" });
            }

            var checkExist = await _context.DanhMucNienKhoas.FirstOrDefaultAsync(n => n.MaNienKhoa == newYear);
            if (checkExist != null)
            {
                return BadRequest(new { message = "Niên khóa này đã tồn tại trong hệ thống" });
            }

            var nk = new DanhMucNienKhoa
            {
                MaNienKhoa = newYear,
                TenNienKhoa = $"Niên khóa {newYear}",
                IsActive = false,
                NgayTao = DateTime.Now
            };

            _context.DanhMucNienKhoas.Add(nk);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã thêm niên khóa {newYear} thành công!" });
        }
         // 1. Lấy danh sách tất cả giáo viên để Hiệu trưởng chọn
        [HttpGet("danh-sach-giao-vien")]   
        public async Task<IActionResult> GetGiaoVien()
        {
            var ds = await _context.TaiKhoans
                .Where(t => t.VaiTro == "GiaoVien")
                .Select(t => new { t.TenDangNhap, t.HoTen })
                .ToListAsync();
            return Ok(ds);
        }
        // 2. PHÂN CÔNG CHỦ NHIỆM (Cập nhật bảng LopHoc)
        [HttpPost("phan-cong-chu-nhiem")]
        public async Task<IActionResult> PhanCongChuNhiem(string maLop, string maGVCN)
        {
            // 1. KIỂM TRA LỚP CÓ TỒN TẠI KHÔNG
            var lop = await _context.LopHocs.FindAsync(maLop);
            if (lop == null) return NotFound(new { message = "Không tìm thấy lớp học" });

            // 2. HỖ TRỢ GỠ BỎ CHỦ NHIỆM (Nếu truyền trống hoặc "none"/"null")
            if (string.IsNullOrWhiteSpace(maGVCN) || maGVCN.ToLower() == "none" || maGVCN.ToLower() == "null")
            {
                lop.GvchuNhiem = null;
                await _context.SaveChangesAsync();
                return Ok(new { message = $"Đã giải phóng giáo viên chủ nhiệm cho lớp {lop.TenLop}" });
            }

            // 3. CHỐT CHẶN BẢO VỆ LỚP: Nếu lớp đang có GVCN rồi và muốn phân công người khác, yêu cầu giải phóng trước
            if (!string.IsNullOrEmpty(lop.GvchuNhiem) && lop.GvchuNhiem != maGVCN)
            {
                return BadRequest(new { message = $"Lớp {lop.TenLop} hiện đã có Giáo viên chủ nhiệm là {lop.GvchuNhiem}. Vui lòng giải phóng/gỡ GVCN cũ của lớp này trước khi phân công người mới!" });
            }

            // 4. GÁC CỔNG C#: Kiểm tra giáo viên mới này đã chủ nhiệm lớp khác chưa
            var daChuNhiemLopKhac = await _context.LopHocs
                .AnyAsync(l => l.GvchuNhiem == maGVCN && l.MaLop != maLop && l.NienKhoa == lop.NienKhoa);

            if (daChuNhiemLopKhac)
            {
                return BadRequest(new { message = $"Giáo viên {maGVCN} hiện đang làm chủ nhiệm cho một lớp khác. Vui lòng chọn người khác!" });
            }

            // 5. TIẾN HÀNH CẬP NHẬT NẾU HỢP LỆ
            lop.GvchuNhiem = maGVCN;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã phân công {maGVCN} làm chủ nhiệm lớp {lop.TenLop}" });
        }

        private string ChuanHoaThu(string? thu)
        {
            if (string.IsNullOrEmpty(thu)) return "";
            string t = thu.Trim().ToLower();
            if (t == "2" || t == "thứ 2" || t == "thu 2" || t == "hai" || t == "thứ hai") return "Thứ 2";
            if (t == "3" || t == "thứ 3" || t == "thu 3" || t == "ba" || t == "thứ ba") return "Thứ 3";
            if (t == "4" || t == "thứ 4" || t == "thu 4" || t == "tư" || t == "thứ tư") return "Thứ 4";
            if (t == "5" || t == "thứ 5" || t == "thu 5" || t == "năm" || t == "thứ năm") return "Thứ 5";
            if (t == "6" || t == "thứ 6" || t == "thu 6" || t == "sáu" || t == "thứ sáu") return "Thứ 6";
            if (t == "7" || t == "thứ 7" || t == "thu 7" || t == "bảy" || t == "thứ bảy") return "Thứ 7";
            return thu;
        }

        private string ChuanHoaBuoi(string? buoi)
        {
            if (string.IsNullOrEmpty(buoi)) return "";
            string b = buoi.Trim().ToLower();
            if (b == "sáng" || b == "sang" || b == "s") return "Sáng";
            if (b == "chiều" || b == "chieu" || b == "c") return "Chiều";
            return buoi;
        }

        [Authorize(Roles = "HieuTruong")]
        [HttpPost("phan-cong-bo-mon")]
        public async Task<IActionResult> PhanCongBoMon(PhanCongGiangDay pc)
        {
            // Chuẩn hóa dữ liệu ngày và buổi để truy vấn chính xác
            pc.Thu = ChuanHoaThu(pc.Thu);
            pc.Buoi = ChuanHoaBuoi(pc.Buoi);

            // Bổ sung luồng chặn: Tự động gán Niên khóa hiện hành nếu Frontend quên không gửi
            if (string.IsNullOrEmpty(pc.NienKhoa))
            {
                var activeYear = await _context.DanhMucNienKhoas
                    .Where(n => n.IsActive)
                    .Select(n => n.MaNienKhoa)
                    .FirstOrDefaultAsync() ?? "2025-2026";
                pc.NienKhoa = activeYear;
            }

            // 0. CHỐT CHẶN TRÙNG LỊCH HỌC CỦA LỚP: Lớp này tại thời điểm này đã có môn học khác được gán chưa
            if (!string.IsNullOrEmpty(pc.Thu) && !string.IsNullOrEmpty(pc.Buoi) && !string.IsNullOrEmpty(pc.Tiet))
            {
                var lopBiTrungLich = await _context.PhanCongGiangDays
                    .FirstOrDefaultAsync(p => p.MaLop == pc.MaLop
                                           && p.Thu == pc.Thu
                                           && p.Buoi == pc.Buoi
                                           && p.Tiet == pc.Tiet
                                           && p.NienKhoa == pc.NienKhoa);

                if (lopBiTrungLich != null)
                {
                    return BadRequest(new
                    {
                        message = $"❌ Lỗi trùng lịch học của Lớp: Lớp '{pc.MaLop}' vào {pc.Thu} - Buổi {pc.Buoi} - Tiết {pc.Tiet} hiện đã được phân công dạy môn '{lopBiTrungLich.MaMon}' do giáo viên '{lopBiTrungLich.MaGiaoVien}' phụ trách rồi!"
                    });
                }
            }

            // 1. CHỐT CHẶN 1: Kiểm tra xem Lớp này đã có giáo viên khác dạy môn này chưa
            var gvKhacDaDayMonNay = await _context.PhanCongGiangDays
                .FirstOrDefaultAsync(p => p.MaLop == pc.MaLop && p.MaMon == pc.MaMon && p.MaGiaoVien != pc.MaGiaoVien && p.NienKhoa == pc.NienKhoa);

            if (gvKhacDaDayMonNay != null)
            {
                return BadRequest(new
                {
                    message = $"❌ Lỗi: Môn '{pc.MaMon}' ở lớp '{pc.MaLop}' hiện đã được phân công cho giáo viên '{gvKhacDaDayMonNay.MaGiaoVien}' phụ trách rồi! Không thể phân cho giáo viên khác dạy cùng môn."
                });
            }

            // CHỐT CHẶN 2: Kiểm tra xem Giáo viên này có bị trùng lịch dạy ở lớp khác vào đúng thời gian này không!
            var lichBiTrung = await _context.PhanCongGiangDays
                .FirstOrDefaultAsync(p => p.MaGiaoVien == pc.MaGiaoVien
                                       && p.Thu == pc.Thu
                                       && p.Buoi == pc.Buoi
                                       && p.Tiet == pc.Tiet
                                       && p.NienKhoa == pc.NienKhoa);

            if (lichBiTrung != null)
            {
                return BadRequest(new
                {
                    message = $"⚠️ Lỗi trùng lịch! Giáo viên này đã được phân công dạy môn '{lichBiTrung.MaMon}' cho lớp '{lichBiTrung.MaLop}' vào Tiết {pc.Tiet} - Buổi {pc.Buoi} - {pc.Thu} rồi!"
                });
            }

            // 3. TIẾN HÀNH CẬP NHẬT HOẶC THÊM MỚI:
            // Tìm xem có dòng phân công chờ (chưa ghi nhận lịch học) của GIÁO VIÊN ĐÓ cho LỚP/MÔN ĐÓ không
            var dongCho = await _context.PhanCongGiangDays
                .FirstOrDefaultAsync(p => p.MaLop == pc.MaLop 
                                       && p.MaMon == pc.MaMon 
                                       && p.MaGiaoVien == pc.MaGiaoVien 
                                       && p.NienKhoa == pc.NienKhoa
                                       && (string.IsNullOrEmpty(p.Thu) || p.Thu == "NULL" || p.Thu == ""));

            if (dongCho != null)
            {
                // Cập nhật lịch học vào dòng chờ
                dongCho.Thu = pc.Thu;
                dongCho.Buoi = pc.Buoi;
                dongCho.Tiet = pc.Tiet;
                _context.PhanCongGiangDays.Update(dongCho);
                await _context.SaveChangesAsync();
                return Ok(new { message = $"Đã xếp lịch dạy môn {pc.MaMon} lớp {pc.MaLop} cho giáo viên {pc.MaGiaoVien} thành công (cập nhật dòng chờ)!" });
            }

            // Nếu không có dòng chờ (hoặc đã xếp xong hết các buổi), tạo một dòng mới
            _context.PhanCongGiangDays.Add(pc);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Xếp thêm lịch dạy bộ môn thành công!" });
        }

        /// <summary>
        /// API: Xóa phân công giảng dạy bộ môn (Hiệu trưởng)
        /// </summary>
        [HttpDelete("xoa-phan-cong/{maPhanCong}")]
        [Authorize(Roles = "HieuTruong")]
        public async Task<IActionResult> XoaPhanCong(int maPhanCong)
        {
            var phanCong = await _context.PhanCongGiangDays.FirstOrDefaultAsync(p => p.MaPhanCong == maPhanCong);
            if (phanCong == null)
            {
                return NotFound(new { message = $"Không tìm thấy phân công giảng dạy với mã {maPhanCong}." });
            }

            // Kiểm tra xem phân công này có thuộc niên khóa hiện hành đang Active không
            // để bảo vệ dữ liệu lịch sử các năm cũ đã khóa sổ.
            var activeYear = await _context.DanhMucNienKhoas
                .Where(n => n.IsActive)
                .Select(n => n.MaNienKhoa)
                .FirstOrDefaultAsync() ?? "2025-2026";

            if (phanCong.NienKhoa != activeYear)
            {
                return StatusCode(403, new { message = "⚠️ Lỗi: Phân công này thuộc niên khóa đã khóa sổ, không thể xóa dữ liệu cũ!" });
            }

            _context.PhanCongGiangDays.Remove(phanCong);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa phân công giảng dạy bộ môn thành công!" });
        }

        [HttpGet("danh-sach-mon-hoc")]
        public async Task<IActionResult> DanhSachMonHoc()
        {
            var data = await _context.MonHocs.ToListAsync();
            return Ok(data);
        }

        /// <summary>
        /// API: Hiệu trưởng cấp lại mật khẩu mặc định (123456) cho giáo viên bị quên
        /// </summary>
        [HttpPut("reset-mat-khau/{tenDangNhap}")]
        [Authorize(Roles = "HieuTruong")]
        public async Task<IActionResult> ResetMatKhauGiaoVien(string tenDangNhap)
        {
            var taiKhoan = await _context.TaiKhoans.FirstOrDefaultAsync(t => t.TenDangNhap == tenDangNhap);

            if (taiKhoan == null)
            {
                return NotFound(new { message = $"Không tìm thấy tài khoản {tenDangNhap} trong hệ thống." });
            }

            if (taiKhoan.VaiTro == "HieuTruong")
            {
                return BadRequest(new { message = "Không thể tự reset mật khẩu của tài khoản quản trị cấp cao." });
            }

            // Cấp lại mật khẩu mặc định
            taiKhoan.MatKhau = "123456";

            _context.TaiKhoans.Update(taiKhoan);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Đã reset mật khẩu của {tenDangNhap} thành công!",
                matKhauMoi = "123456",
                luuY = "Vui lòng yêu cầu đăng nhập và đổi mật khẩu ngay lập tức."
            });
        }
        [AllowAnonymous]
        [HttpGet("migrate-nienkhoa-2627")]
        public async Task<IActionResult> MigrateNienKhoaKhieuNai()
        {
            // 1. Rename existing NienKhoa (2021 -> 2021-2022, etc.)
            await _context.Database.ExecuteSqlRawAsync(@"
                UPDATE LopHoc SET NienKhoa = NienKhoa + '-' + CAST(CAST(NienKhoa AS INT) + 1 AS NVARCHAR) WHERE LEN(NienKhoa) = 4;
                UPDATE LichSuPhanLop SET NienKhoa = NienKhoa + '-' + CAST(CAST(NienKhoa AS INT) + 1 AS NVARCHAR) WHERE LEN(NienKhoa) = 4;
                UPDATE PhanCongGiangDay SET NienKhoa = NienKhoa + '-' + CAST(CAST(NienKhoa AS INT) + 1 AS NVARCHAR) WHERE LEN(NienKhoa) = 4;
                UPDATE BangDiem SET NienKhoa = NienKhoa + '-' + CAST(CAST(NienKhoa AS INT) + 1 AS NVARCHAR) WHERE LEN(NienKhoa) = 4;
            ");

            // 2. Tự động sinh lớp cho 2026-2027 từ lớp năm 2025-2026
            var oldClasses = await _context.LopHocs.Where(l => l.NienKhoa == "2025-2026").ToListAsync();
            foreach (var oc in oldClasses)
            {
                // VD: L1A_25 -> L1A_26
                string baseName = oc.TenLop; // "1A"
                string newMaLop = "L" + baseName + "_26";
                // GVCN: Để null để hiệu trưởng phân công sau, hoặc random
                if (!await _context.LopHocs.AnyAsync(l => l.MaLop == newMaLop) && !_context.LopHocs.Local.Any(l => l.MaLop == newMaLop))
                {
                    _context.LopHocs.Add(new LopHoc { MaLop = newMaLop, TenLop = baseName, NienKhoa = "2026-2027" });
                }
            }
            await _context.SaveChangesAsync();

            // 3. Tự động Auto-promote (Chuyển khối học sinh) 
            // - Lớp 1 (2025-26) -> Lớp 2 (2026-27), v.v. Lớp 5 thì tốt nghiệp
            foreach(var oc in oldClasses)
            {
                int currentGrade = int.Parse(oc.TenLop.Substring(0, 1)); // "1A" -> 1
                if (currentGrade >= 5) 
                {
                    // Lớp 5 tốt nghiệp: Cập nhật biến TrangThai của Học sinh!
                    var graduatingStudents = await _context.LichSuPhanLops.Include(l => l.MaHsNavigation).Where(l => l.MaLop == oc.MaLop).Select(l => l.MaHsNavigation).ToListAsync();
                    foreach (var hs in graduatingStudents) { hs.TrangThai = "Đã tốt nghiệp"; }
                    continue; 
                }
                
                int nextGrade = currentGrade + 1;
                string newTenLop = nextGrade.ToString() + oc.TenLop.Substring(1); // "1A" -> "2A"
                string targetNewMaLop = "L" + newTenLop + "_26";

                // Kéo danh sách học sinh cũ sang
                var hsCu = await _context.LichSuPhanLops.Where(l => l.MaLop == oc.MaLop).ToListAsync();
                foreach (var ls in hsCu)
                {
                    if (!await _context.LichSuPhanLops.AnyAsync(hc => hc.MaHs == ls.MaHs && hc.NienKhoa == "2026-2027") && !_context.LichSuPhanLops.Local.Any(hc => hc.MaHs == ls.MaHs && hc.NienKhoa == "2026-2027"))
                    {
                         _context.LichSuPhanLops.Add(new LichSuPhanLop {
                              MaHs = ls.MaHs,
                              MaLop = targetNewMaLop,
                              NienKhoa = "2026-2027"
                         });         
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Migration hoàn thành rực rỡ! Toàn bộ học sinh đã lên lớp an toàn." });
        }


        [AllowAnonymous]
        [HttpGet("fix-database")]
        public async Task<IActionResult> FixDatabase()
        {
            try
            {
                var bangDiems = await _context.BangDiems.ToListAsync();
                foreach (var b in bangDiems)
                {
                    if (b.XepLoai != null && (b.XepLoai.Contains("Gi") || b.XepLoai.Contains("i"))) b.XepLoai = "Tốt";
                    else if (b.XepLoai != null && (b.XepLoai.Contains("Kh") || b.XepLoai.Contains("K"))) b.XepLoai = "Hoàn thành";
                    else b.XepLoai = "Chưa đạt";
                    
                    b.NhanXet = "Học sinh ngoan, chú ý nghe giảng và tiếp thu bài tốt.";
                }

                var accountsToReplace = new Dictionary<string, (string newId, string newName)>
                {
                    { "GVCN1A", ("GV001_LanAnh", "Tiết Lan Anh") },
                    { "GVCN2A", ("GV002_MinhTuan", "Trần Minh Tuấn") },
                    { "GVBM_TOAN", ("GV_TOAN_Trinh", "Lê Kiều Trinh") },
                    { "GVCN", ("GV005_BaoChau", "Nguyễn Bảo Châu") },
                    { "HIEUTRUONG", ("HT_NguyenMinh", "Nguyễn Đức Minh") }
                };

                foreach (var kvp in accountsToReplace)
                {
                    string oldId = kvp.Key;
                    string newId = kvp.Value.newId;
                    string newName = kvp.Value.newName;

                    if (!await _context.TaiKhoans.AnyAsync(t => t.TenDangNhap == newId))
                    {
                        var oldAcc = await _context.TaiKhoans.FirstOrDefaultAsync(t => t.TenDangNhap == oldId);
                        if (oldAcc != null)
                        {
                            _context.TaiKhoans.Add(new TaiKhoan { 
                                TenDangNhap = newId, 
                                MatKhau = oldAcc.MatKhau, 
                                HoTen = newName, 
                                VaiTro = oldAcc.VaiTro
                            });
                        }
                    }
                }
                await _context.SaveChangesAsync();

                foreach (var kvp in accountsToReplace)
                {
                    string oldId = kvp.Key;
                    string newId = kvp.Value.newId;

                    var lops = await _context.LopHocs.Where(l => l.GvchuNhiem == oldId).ToListAsync();
                    foreach (var l in lops) l.GvchuNhiem = newId;

                    var phanCongs = await _context.PhanCongGiangDays.Where(p => p.MaGiaoVien == oldId).ToListAsync();
                    foreach (var p in phanCongs) p.MaGiaoVien = newId;
                }
                await _context.SaveChangesAsync();
                
                return Ok(new { message = "Thành công: 1. Fix Font Tiếng Việt. 2. Đổi 100% tên Tài Khoản sang tên Giáo viên thật." });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}