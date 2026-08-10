using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using DoAn_WebHocVu_API.Application.Interfaces;
using DoAn_WebHocVu_API.Models;

namespace DoAn_WebHocVu_API.Infrastructure.Repositories
{
    public class BangDiemRepository : IBangDiemRepository
    {
        private readonly DoAnWebHocVuAdvancedContext _context;

        public BangDiemRepository(DoAnWebHocVuAdvancedContext context)
        {
            _context = context;
        }

        public async Task<MonHoc?> GetMonHocAsync(string maMon)
        {
            return await _context.MonHocs.FirstOrDefaultAsync(m => m.MaMon == maMon);
        }

        public async Task<HocSinh?> GetHocSinhAsync(string maHs)
        {
            return await _context.HocSinhs.FirstOrDefaultAsync(h => h.MaHs == maHs && h.TrangThai == "Đang học");
        }

        public async Task<LopHoc?> GetLopHocAsync(string maLop)
        {
            return await _context.LopHocs.FirstOrDefaultAsync(l => l.MaLop == maLop);
        }

        public async Task<bool> CheckPhanCongGiangDayAsync(string maGiaoVien, string maLop, string maMon)
        {
            string mndTrim = maGiaoVien.Trim().ToUpper();
            string mmTrim = maMon.Trim().ToUpper();
            return await _context.PhanCongGiangDays
                .AnyAsync(pc => pc.MaGiaoVien.Trim().ToUpper() == mndTrim && pc.MaLop == maLop && pc.MaMon.Trim().ToUpper() == mmTrim);
        }

        public async Task<bool> CheckDaCoGvChuyenTrachAsync(string maLop, string maMon)
        {
            string mmTrim = maMon.Trim().ToUpper();
            return await _context.PhanCongGiangDays
                .AnyAsync(pc => pc.MaLop == maLop && pc.MaMon.Trim().ToUpper() == mmTrim);
        }

        public async Task<BangDiem?> GetBangDiemAsync(string maHs, string maMon, string nienKhoa, int hocKy)
        {
            return await _context.BangDiems.FirstOrDefaultAsync(b => b.MaHs == maHs && b.MaMon == maMon && b.NienKhoa == nienKhoa && b.HocKy == hocKy);
        }

        public void AddBangDiem(BangDiem bangDiem)
        {
            _context.BangDiems.Add(bangDiem);
        }

        public void UpdateBangDiem(BangDiem bangDiem)
        {
            _context.BangDiems.Update(bangDiem);
        }

        public async Task<string?> GetTenMonByMaMonAsync(string maMon)
        {
            var mon = await _context.MonHocs.FirstOrDefaultAsync(m => m.MaMon == maMon);
            return mon?.TenMon;
        }

        public async Task<List<BangDiem>> GetBangDiemsOfHocSinhAsync(string maHs, string? nienKhoa, int? hocKy)
        {
            var query = _context.BangDiems.Where(b => b.MaHs == maHs);
            if (!string.IsNullOrEmpty(nienKhoa))
            {
                query = query.Where(b => b.NienKhoa == nienKhoa);
            }
            if (hocKy.HasValue)
            {
                query = query.Where(b => b.HocKy == hocKy.Value);
            }
            return await query.ToListAsync();
        }

        public async Task<List<HocSinh>> GetDanhSachHocSinhByLopAsync(string maLop)
        {
            return await _context.HocSinhs.Where(h => h.MaLop == maLop).ToListAsync();
        }

        public async Task<List<BangDiem>> GetBangDiemsByHocSinhsAsync(List<string> maHocSinhs, string? nienKhoa = null, int? hocKy = null)
        {
            var query = _context.BangDiems.Where(b => maHocSinhs.Contains(b.MaHs));
            if (!string.IsNullOrEmpty(nienKhoa))
            {
                query = query.Where(b => b.NienKhoa == nienKhoa);
            }
            if (hocKy.HasValue)
            {
                query = query.Where(b => b.HocKy == hocKy.Value);
            }
            return await query.ToListAsync();
        }

        public async Task<List<MonHoc>> GetAllMonHocAsync()
        {
            return await _context.MonHocs.ToListAsync();
        }

        public void AddKeHoachLop(KeHoachLop keHoach)
        {
            _context.KeHoachLops.Add(keHoach);
        }

        public async Task<TaiKhoan?> GetTaiKhoanPhuHuynhAsync(string maHs)
        {
            string maTaiKhoanPhuHuynh = ("PH_" + maHs.Trim()).Trim();
            return await _context.TaiKhoans.FirstOrDefaultAsync(tk => tk.TenDangNhap == maTaiKhoanPhuHuynh);
        }

        public void AddTuongTac(TuongTac tuongTac)
        {
            _context.TuongTacs.Add(tuongTac);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
