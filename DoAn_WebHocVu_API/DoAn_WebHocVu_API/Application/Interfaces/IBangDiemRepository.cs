using System.Collections.Generic;
using System.Threading.Tasks;
using DoAn_WebHocVu_API.Models;

namespace DoAn_WebHocVu_API.Application.Interfaces
{
    public interface IBangDiemRepository
    {
        Task<MonHoc?> GetMonHocAsync(string maMon);
        Task<HocSinh?> GetHocSinhAsync(string maHs);
        Task<LopHoc?> GetLopHocAsync(string maLop);
        Task<bool> CheckPhanCongGiangDayAsync(string maGiaoVien, string maLop, string maMon);
        Task<bool> CheckDaCoGvChuyenTrachAsync(string maLop, string maMon);
        Task<BangDiem?> GetBangDiemAsync(string maHs, string maMon, string nienKhoa, int hocKy);
        void AddBangDiem(BangDiem bangDiem);
        void UpdateBangDiem(BangDiem bangDiem);
        
        Task<string?> GetTenMonByMaMonAsync(string maMon);
        Task<List<BangDiem>> GetBangDiemsOfHocSinhAsync(string maHs, string? nienKhoa, int? hocKy);
        
        Task<List<HocSinh>> GetDanhSachHocSinhByLopAsync(string maLop);
        Task<List<BangDiem>> GetBangDiemsByHocSinhsAsync(List<string> maHocSinhs, string? nienKhoa = null, int? hocKy = null);
        Task<List<MonHoc>> GetAllMonHocAsync();
        
        void AddKeHoachLop(KeHoachLop keHoach);
        Task<TaiKhoan?> GetTaiKhoanPhuHuynhAsync(string maHs);
        void AddTuongTac(TuongTac tuongTac);
        
        Task SaveChangesAsync();
    }
}
