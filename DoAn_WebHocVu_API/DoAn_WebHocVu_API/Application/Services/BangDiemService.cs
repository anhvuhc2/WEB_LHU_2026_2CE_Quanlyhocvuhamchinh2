using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DoAn_WebHocVu_API.Application.DTOs;
using DoAn_WebHocVu_API.Application.Interfaces;
using DoAn_WebHocVu_API.Controllers;
using DoAn_WebHocVu_API.Models;

namespace DoAn_WebHocVu_API.Application.Services
{
    public class BangDiemService : IBangDiemService
    {
        private readonly IBangDiemRepository _repository;

        public BangDiemService(IBangDiemRepository repository)
        {
            _repository = repository;
        }

        public async Task<ServiceResult> NhapDiemAsync(BangDiemController.NhapDiemDto model, string maGiaoVien)
        {
            if (string.IsNullOrEmpty(model.MaMon) || string.IsNullOrEmpty(model.MaHS)) 
                return ServiceResult.BadRequest("Mã môn hoặc mã học sinh không hợp lệ.");

            var monHoc = await _repository.GetMonHocAsync(model.MaMon);
            var hocSinh = await _repository.GetHocSinhAsync(model.MaHS);

            if (monHoc == null) return ServiceResult.NotFound("Không tìm thấy môn học.");
            if (hocSinh == null) return ServiceResult.BadRequest("Học sinh này không tồn tại hoặc đã chuyển trường/nghỉ học!");

            bool duocPhepThaoTac = false;
            string mndTrim = maGiaoVien?.Trim().ToUpper() ?? "";
            string mmTrim = model.MaMon.Trim().ToUpper();

            string targetNienKhoa = model.NienKhoa ?? "2025-2026";
            string maLopHienTai = await _repository.GetMaLopByHocSinhAndNienKhoaAsync(model.MaHS, targetNienKhoa) ?? hocSinh.MaLop;

            var lopHoc = await _repository.GetLopHocAsync(maLopHienTai);
            bool laGVCN = (lopHoc != null && lopHoc.GvchuNhiem?.Trim().ToUpper() == mndTrim);
            bool laGVBM = await _repository.CheckPhanCongGiangDayAsync(mndTrim, maLopHienTai, mmTrim);

            if (laGVBM)
            {
                duocPhepThaoTac = true;
            }
            else if (laGVCN)
            {
                bool daCoGvChuyenTrach = await _repository.CheckDaCoGvChuyenTrachAsync(maLopHienTai, mmTrim);
                if (daCoGvChuyenTrach)
                {
                    return ServiceResult.Forbidden($"Từ chối truy cập: Bạn là Chủ nhiệm, nhưng môn {monHoc.TenMon} của lớp này đã được giao phó riêng cho Giáo viên bộ môn. Bạn không được nhập đè!");
                }
                duocPhepThaoTac = true;
            }

            if (!duocPhepThaoTac)
            {
                return ServiceResult.Forbidden("Lỗi phân quyền: Bạn không có quyền nhập điểm cho môn này của lớp này!");
            }

            var cacMonNhanXet = new List<string> { "TNXH", "GDTC", "HDTN", "HĐTN", "DD", "AN", "MT" };
            bool hocKhoi12 = maLopHienTai.Contains("1") || maLopHienTai.Contains("2");
            if (hocKhoi12) cacMonNhanXet.Add("ANH");

            if (cacMonNhanXet.Contains(model.MaMon.ToUpper()))
            {
                model.DiemThi = null;
                if (string.IsNullOrEmpty(model.XepLoai))
                    return ServiceResult.BadRequest($"Môn {model.MaMon} là môn đánh giá nhận xét, bắt buộc phải nhập xếp loại (H/T/C)!");
            }
            else
            {
                if (model.DiemThi == null)
                    return ServiceResult.BadRequest($"Môn {model.MaMon} yêu cầu phải có điểm số, không được bỏ trống!");
            }

            string nienKhoa = model.NienKhoa ?? lopHoc?.NienKhoa ?? "2025-2026";
            int hocKy = model.HocKy ?? 1;

            var bangDiem = await _repository.GetBangDiemAsync(model.MaHS, model.MaMon, nienKhoa, hocKy);
            if (bangDiem == null)
            {
                bangDiem = new BangDiem
                {
                    MaHs = model.MaHS,
                    MaMon = model.MaMon,
                    NienKhoa = nienKhoa,
                    HocKy = hocKy,
                    DiemThi = model.DiemThi,
                    XepLoai = model.XepLoai?.ToUpper(),
                    NhanXet = model.NhanXet,
                    NgayCapNhat = DateTime.Now
                };
                _repository.AddBangDiem(bangDiem);
            }
            else
            {
                bangDiem.DiemThi = model.DiemThi;
                bangDiem.XepLoai = model.XepLoai?.ToUpper();
                bangDiem.NhanXet = model.NhanXet;
                bangDiem.NgayCapNhat = DateTime.Now;
                _repository.UpdateBangDiem(bangDiem);
            }

            await _repository.SaveChangesAsync();
            return ServiceResult.Ok($"Thành công! Đã cập nhật dữ liệu học tập môn {monHoc.TenMon} cho học sinh {hocSinh.HoTen}.");
        }

        public async Task<ServiceResult> XemDiemAsync(string maHs, string? nienKhoa, int? hocKy)
        {
            var bangDiems = await _repository.GetBangDiemsOfHocSinhAsync(maHs, nienKhoa, hocKy);
            var result = new List<object>();
            foreach (var b in bangDiems)
            {
                string tenMon = await _repository.GetTenMonByMaMonAsync(b.MaMon) ?? "Unknown";
                result.Add(new
                {
                    MaMon = b.MaMon,
                    TenMon = tenMon,
                    DiemThi = b.DiemThi,
                    XepLoai = b.XepLoai,
                    NhanXet = b.NhanXet,
                    NgayCapNhat = b.NgayCapNhat
                });
            }
            return ServiceResult.Ok("Success", result);
        }

        public async Task<ServiceResult> XuatBangDiemTongAsync(string maLop, string maGiaoVien, bool isHieuTruong, string? nienKhoa = null, int? hocKy = null)
        {
            var lopHoc = await _repository.GetLopHocAsync(maLop);
            if (lopHoc == null) return ServiceResult.NotFound("Không tìm thấy lớp học này!");

            if (!isHieuTruong)
            {
                if (lopHoc.GvchuNhiem?.Trim().ToUpper() != maGiaoVien?.Trim().ToUpper())
                {
                    return ServiceResult.Forbidden($"TỪ CHỐI: Chỉ Giáo viên chủ nhiệm mới được quyền xuất điểm của lớp {lopHoc.TenLop}.");
                }
            }

            var danhSachHocSinh = await _repository.GetDanhSachHocSinhByLopAsync(maLop);
            var maHocSinhs = danhSachHocSinh.Select(h => h.MaHs).ToList();

            string nkLoc = nienKhoa ?? lopHoc.NienKhoa ?? "2025-2026";
            int hkLoc = hocKy ?? 1;
            var danhSachDiem = await _repository.GetBangDiemsByHocSinhsAsync(maHocSinhs, nkLoc, hkLoc);
            
            var tatCaMon = await _repository.GetAllMonHocAsync();
            var validSubjectCodes = GetClassSubjectCodes(maLop);
            var danhSachMonHoc = tatCaMon.Where(m => validSubjectCodes.Contains(m.MaMon.Trim().ToUpper())).ToList();

            var cacMonNgoaiLeCodes = new List<string> { "DD", "GDTC", "AN", "MT", "HDTN", "HĐTN", "TNXH" };
            if (maLop.Contains("1") || maLop.Contains("2")) cacMonNgoaiLeCodes.Add("ANH");

            var danhSachLoi = new List<string>();

            foreach (var hs in danhSachHocSinh)
            {
                if (hs.TrangThai == "Đã chuyển trường") continue;
                foreach (var mon in danhSachMonHoc)
                {
                    var diemMon = danhSachDiem.FirstOrDefault(d => d.MaHs == hs.MaHs && d.MaMon == mon.MaMon);
                    bool laMonNhanXet = cacMonNgoaiLeCodes.Contains(mon.MaMon.Trim().ToUpper());
                    if (laMonNhanXet)
                    {
                        if (diemMon == null || string.IsNullOrWhiteSpace(diemMon.XepLoai))
                            danhSachLoi.Add($"Em {hs.HoTen} chưa có đánh giá (Xếp loại) môn {mon.TenMon}.");
                    }
                    else
                    {
                        if (diemMon == null || diemMon.DiemThi == null)
                            danhSachLoi.Add($"Em {hs.HoTen} đang bị trống điểm thi môn {mon.TenMon}.");
                    }
                }
            }

            if (danhSachLoi.Count > 0)
                return ServiceResult.BadRequest("CHƯA THỂ XUẤT! Hệ thống phát hiện dữ liệu chưa hoàn tất.", danhSachLoi);

            var ketQuaXuat = danhSachHocSinh.Where(hs => hs.TrangThai != "Đã chuyển trường").Select(hs =>
            {
                var chiTietDiemHs = danhSachMonHoc.Select(mon =>
                {
                    var d = danhSachDiem.FirstOrDefault(x => x.MaHs == hs.MaHs && x.MaMon == mon.MaMon);
                    return new
                    {
                        TenMon = mon.TenMon,
                        DiemThi = d?.DiemThi,
                        XepLoai = d?.XepLoai,
                        NhanXet = d?.NhanXet,
                        LaMonNhanXet = cacMonNgoaiLeCodes.Contains(mon.MaMon.Trim().ToUpper())
                    };
                }).ToList();

                string khenThuong = "";
                var cacMonNhanXet = chiTietDiemHs.Where(x => x.LaMonNhanXet).ToList();
                bool tatCaMonNhanXetDatT = cacMonNhanXet.All(x => x.XepLoai?.Trim().ToUpper() == "T");

                if (tatCaMonNhanXetDatT && cacMonNhanXet.Count > 0)
                {
                    var cacMonTinhDiem = chiTietDiemHs.Where(x => !x.LaMonNhanXet).ToList();
                    bool tatCaMonTu9TroLen = cacMonTinhDiem.All(x => x.DiemThi >= 9);

                    if (tatCaMonTu9TroLen && cacMonTinhDiem.Count > 0)
                    {
                        khenThuong = "Học sinh xuất sắc";
                    }
                    else
                    {
                        var cacMonTu9 = cacMonTinhDiem.Where(x => x.DiemThi >= 9).ToList();
                        var cacMonConLai = cacMonTinhDiem.Where(x => x.DiemThi < 9).ToList();
                        bool cacMonConLaiDatKhá = cacMonConLai.All(x => x.DiemThi >= 7);

                        if (cacMonTu9.Count > 0 && cacMonConLaiDatKhá)
                        {
                            var tenMonTieuBieu = string.Join(", ", cacMonTu9.Select(x => x.TenMon));
                            khenThuong = $"Học sinh tiêu biểu môn {tenMonTieuBieu}";
                        }
                    }
                }

                return new
                {
                    MaHs = hs.MaHs,
                    HoTen = hs.HoTen,
                    TrangThai = hs.TrangThai,
                    KhenThuong = khenThuong,
                    ChiTietDiem = chiTietDiemHs.Select(d => new { d.TenMon, d.DiemThi, d.XepLoai, d.NhanXet }).ToList()
                };
            }).ToList();

            return ServiceResult.Ok("Dữ liệu đầy đủ hợp lệ!", ketQuaXuat);
        }

        public async Task<ServiceResult> GuiThongBaoDiemAsync(string maLop, string maGiaoVien, string? nienKhoa = null, int? hocKy = null)
        {
            var lopHoc = await _repository.GetLopHocAsync(maLop);
            if (lopHoc == null) return ServiceResult.NotFound("Không tìm thấy lớp học này!");

            if (lopHoc.GvchuNhiem?.Trim().ToUpper() != maGiaoVien?.Trim().ToUpper())
            {
                return ServiceResult.Forbidden($"TỪ CHỐI: Chỉ Giáo viên chủ nhiệm mới được quyền gửi thông báo cho lớp {lopHoc.TenLop}.");
            }

            var danhSachHocSinh = await _repository.GetDanhSachHocSinhByLopAsync(maLop);
            var maHocSinhs = danhSachHocSinh.Select(h => h.MaHs).ToList();

            string nkLoc = nienKhoa ?? lopHoc.NienKhoa ?? "2025-2026";
            int hkLoc = hocKy ?? 1;
            var danhSachDiem = await _repository.GetBangDiemsByHocSinhsAsync(maHocSinhs, nkLoc, hkLoc);
            var tatCaMon = await _repository.GetAllMonHocAsync();

            var validSubjectCodes = GetClassSubjectCodes(maLop);
            var danhSachMonHoc = tatCaMon.Where(m => validSubjectCodes.Contains(m.MaMon.Trim().ToUpper())).ToList();

            var cacMonNgoaiLeCodes = new List<string> { "DD", "GDTC", "AN", "MT", "HDTN", "HĐTN", "TNXH" };
            if (maLop.Contains("1") || maLop.Contains("2")) cacMonNgoaiLeCodes.Add("ANH");

            var danhSachLoi = new List<string>();
            foreach (var hs in danhSachHocSinh)
            {
                if (hs.TrangThai == "Đã chuyển trường") continue;
                foreach (var mon in danhSachMonHoc)
                {
                    var diemCuaHs = danhSachDiem.FirstOrDefault(d => d.MaHs == hs.MaHs && d.MaMon == mon.MaMon);
                    bool laMonNhanXet = cacMonNgoaiLeCodes.Contains(mon.MaMon.Trim().ToUpper());
                    if (diemCuaHs == null || (laMonNhanXet && string.IsNullOrEmpty(diemCuaHs.XepLoai)) || (!laMonNhanXet && diemCuaHs.DiemThi == null))
                    {
                        danhSachLoi.Add($"Em {hs.HoTen} bị trống điểm môn {mon.TenMon}");
                    }
                }
            }

            if (danhSachLoi.Count > 0)
                return ServiceResult.BadRequest("CHƯA THỂ GỬI THÔNG BÁO! Bảng điểm của lớp chưa được nhập hoàn tất.", danhSachLoi);

            var keHoachBaoDiem = new KeHoachLop
            {
                MaLop = maLop,
                TieuDe = $"Báo điểm định kỳ lớp {lopHoc.TenLop}",
                NoiDung = $"Hệ thống đã gửi tự động bảng điểm chi tiết đến từng phụ huynh của lớp {lopHoc.TenLop}. Kính mong ban giám hiệu theo dõi tiến độ.",
                LoaiThongBao = "Báo điểm",
                NgayDang = DateTime.Now,
                NguoiDang = maGiaoVien
            };
            
            _repository.AddKeHoachLop(keHoachBaoDiem);
            await _repository.SaveChangesAsync();

            foreach (var hs in danhSachHocSinh)
            {
                if (hs.TrangThai == "Đã chuyển trường") continue;
                var chiTietDiem = new List<string>();
                foreach (var mon in danhSachMonHoc)
                {
                    var d = danhSachDiem.FirstOrDefault(x => x.MaHs == hs.MaHs && x.MaMon == mon.MaMon);
                    string diemHienThi = "";
                    if (d != null)
                    {
                        if (d.DiemThi != null && !string.IsNullOrEmpty(d.XepLoai)) diemHienThi = $"{d.DiemThi} ({d.XepLoai})";
                        else if (d.DiemThi != null) diemHienThi = d.DiemThi.ToString();
                        else if (!string.IsNullOrEmpty(d.XepLoai)) diemHienThi = d.XepLoai;
                    }
                    chiTietDiem.Add($"{mon.TenMon}: {diemHienThi}");
                }
                
                string noiDungTinNhan = $"Trường TH thông báo điểm của em {hs.HoTen}: {string.Join(", ", chiTietDiem)}.";
                var taiKhoanPhuHuynh = await _repository.GetTaiKhoanPhuHuynhAsync(hs.MaHs);

                if (taiKhoanPhuHuynh != null)
                {
                    var tuongTacMoi = new TuongTac
                    {
                        MaKeHoach = keHoachBaoDiem.MaKeHoach,
                        TenDangNhap = taiKhoanPhuHuynh.TenDangNhap,
                        NoiDung = $"[Thông báo cá nhân] - {noiDungTinNhan}",
                        ThoiGian = DateTime.Now,
                        TrangThai = "Chưa xem"
                    };
                    _repository.AddTuongTac(tuongTacMoi);
                }
            }
            await _repository.SaveChangesAsync();
            return ServiceResult.Ok($"Đã gửi thông báo điểm thành công cho lớp {lopHoc.TenLop}. Ban giám hiệu có thể theo dõi tại mục Kế hoạch lớp!");
        }

        private List<string> GetClassSubjectCodes(string maLop)
        {
            if (string.IsNullOrEmpty(maLop)) return new List<string>();
            bool laKhoi12 = maLop.Contains("1") || maLop.Contains("2");
            bool laKhoi3 = maLop.Contains("3");
            var list = new List<string> { "TOAN", "TV", "DD", "GDTC", "AN", "MT", "HDTN", "HĐTN" };
            if (laKhoi12) { list.Add("TNXH"); list.Add("ANH"); }
            else if (laKhoi3) { list.Add("TNXH"); list.Add("ANH"); list.Add("TIN"); list.Add("CN"); }
            else { list.Add("KH"); list.Add("LSĐL"); list.Add("ANH"); list.Add("TIN"); list.Add("CN"); }
            return list;
        }
    }
}
