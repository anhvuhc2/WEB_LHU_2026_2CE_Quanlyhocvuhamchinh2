'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, InputNumber, Select, Alert, Space, Typography, Tooltip, message, Badge, Spin, Modal, Empty, Input, Switch, Popconfirm } from 'antd';
import { SafetyOutlined, LockOutlined, ExportOutlined, SendOutlined, ExclamationCircleOutlined, UserOutlined, BookOutlined, FileExcelOutlined } from '@ant-design/icons';
import apiClient from '../../../services/apiClient';

const { Title, Paragraph, Text } = Typography;

interface Subject {
  maMon: string;
  tenMon: string;
  kieu: 'diem_chu' | 'chu'; // 'diem_chu' là môn có cả Điểm số và Xếp loại, 'chu' là môn chỉ có Xếp loại
}

interface ScoreDetail {
  diemThi: number | null;
  xepLoai: string | null;
  nhanXet: string | null;
}

interface StudentGradeRecord {
  maHs: string;
  hoTen: string;
  trangThai: string;
  scores: Record<string, ScoreDetail>; // maMon -> Chi tiết điểm
  tongVang?: number;
  chiTietVang?: Array<{ ngay: string, trangThai: string }>;
}

// Helper giải mã Token JWT
const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

const getClaimsFromToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  const decoded = parseJwt(token);
  if (!decoded) return null;

  const username = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || decoded["nameid"] || decoded["sub"];
  const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || decoded["role"];
  const displayName = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || decoded["unique_name"] || decoded["name"] || "";

  return { username, role, displayName };
};

export default function GradingPage() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; displayName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Danh sách học sinh kèm điểm số map động
  const [gradeRecords, setGradeRecords] = useState<StudentGradeRecord[]>([]);
  const [classes, setClasses] = useState<{ maLop: string; tenLop: string; gvchuNhiem: string | null; nienKhoa?: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [nienKhoaList, setNienKhoaList] = useState<string[]>([]);
  const [selectedNienKhoa, setSelectedNienKhoa] = useState<string>('');
  const [selectedHocKy, setSelectedHocKy] = useState<number>(1);

  // Tự động nhận diện năm học mới nhất làm Active Year
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>('');
  const isLockedByYear = selectedNienKhoa !== activeAcademicYear && selectedNienKhoa !== '';
  
  // Toggling display of all students (including transferred)
  const [showAllStudents, setShowAllStudents] = useState<boolean>(false);
  
  const handleChotNienKhoa = async (nienKhoaToLock: string) => {
    try {
      const res = await apiClient.post('/QuanLyTruong/chot-nien-khoa', { maNienKhoa: nienKhoaToLock });
      message.success(res.data.message || `Đã chốt năm học ${nienKhoaToLock} làm năm hiện hành!`);
      setActiveAcademicYear(nienKhoaToLock);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi chốt niên khóa!');
    }
  };

  // Quyền năng nhập điểm của Giáo viên đang đăng nhập đối với từng Môn học ở lớp lựa chọn
  const [permissionMap, setPermissionMap] = useState<Record<string, boolean>>({});
  
  const [isGvcn, setIsGvcn] = useState(false);
  const [myGvcnClass, setMyGvcnClass] = useState<string>('');

  // 1. Phân chia cấu hình môn học theo Khối dựa trên mã lớp (Đối sánh C# logic line 176)
  const getSubjectsForClass = (maLopCode: string): Subject[] => {
    if (!maLopCode) return [];
    
    // Tự động phân loại khối 1,2 hoặc 3 hoặc 4,5
    const laKhoi12 = maLopCode.includes("1") || maLopCode.includes("2");
    const laKhoi3 = maLopCode.includes("3");
    
    const commonSubjects: Subject[] = [
      { maMon: 'TOAN', tenMon: 'Toán', kieu: 'diem_chu' },
      { maMon: 'TV', tenMon: 'Tiếng Việt', kieu: 'diem_chu' },
      { maMon: 'DD', tenMon: 'Đạo đức', kieu: 'chu' },
      { maMon: 'GDTC', tenMon: 'Giáo dục thể chất', kieu: 'chu' },
      { maMon: 'AN', tenMon: 'Âm nhạc', kieu: 'chu' },
      { maMon: 'MT', tenMon: 'Mĩ thuật', kieu: 'chu' },
      { maMon: 'HĐTN', tenMon: 'HĐ Trải nghiệm', kieu: 'chu' }
    ];

    if (laKhoi12) {
      return [
        ...commonSubjects,
        { maMon: 'TNXH', tenMon: 'Tự nhiên & Xã hội', kieu: 'chu' },
        { maMon: 'ANH', tenMon: 'Tiếng Anh', kieu: 'chu' }
      ];
    } else if (laKhoi3) {
      return [
        ...commonSubjects,
        { maMon: 'TNXH', tenMon: 'Tự nhiên & Xã hội', kieu: 'chu' },
        { maMon: 'ANH', tenMon: 'Tiếng Anh', kieu: 'diem_chu' },
        { maMon: 'TIN', tenMon: 'Tin học', kieu: 'diem_chu' },
        { maMon: 'CN', tenMon: 'Công nghệ', kieu: 'diem_chu' }
      ];
    } else {
      return [
        ...commonSubjects,
        { maMon: 'KH', tenMon: 'Khoa học', kieu: 'diem_chu' },
        { maMon: 'LSĐL', tenMon: 'Lịch sử & Địa lý', kieu: 'diem_chu' },
        { maMon: 'ANH', tenMon: 'Tiếng Anh', kieu: 'diem_chu' },
        { maMon: 'TIN', tenMon: 'Tin học', kieu: 'diem_chu' },
        { maMon: 'CN', tenMon: 'Công nghệ', kieu: 'diem_chu' }
      ];
    }
  };

  const currentSubjects = getSubjectsForClass(selectedClass);

  // Khởi chạy ban đầu
  useEffect(() => {
    const claims = getClaimsFromToken();
    if (claims) {
      setCurrentUser(claims);
      initGradingFlow(claims.username, claims.role);
    } else {
      message.error("Vui lòng đăng nhập lại để làm việc!");
    }
  }, []);

  const initGradingFlow = async (username: string, role: string) => {
    setLoading(true);
    try {
      const resClasses = await apiClient.get('/LopHoc/danh-sach');
      const listClasses = resClasses.data || [];
      setClasses(listClasses);

      const savedWorkingYear = localStorage.getItem('working_academic_year') || '';

      // Tải niên khóa hiện tại
      let currentActiveNK = '2025-2026';
      try {
        const resNK = await apiClient.get('/QuanLyTruong/nien-khoa-hien-tai');
        if (resNK.data?.activeAcademicYear) {
          setActiveAcademicYear(resNK.data.activeAcademicYear);
          currentActiveNK = resNK.data.activeAcademicYear;
        }
      } catch (err) {
        console.warn("Could not fetch active academic year", err);
      }

      const workingNK = savedWorkingYear || currentActiveNK;
      setSelectedNienKhoa(workingNK);

      // Tải danh sách niên khóa từ DB
      try {
        const resNKList = await apiClient.get('/QuanLyTruong/danh-sach-nien-khoa');
        if (resNKList.data) {
          setNienKhoaList(resNKList.data);
        }
      } catch (e) {
        if (listClasses.length > 0) {
          const uniqueNK = Array.from(new Set(listClasses.map((x: any) => x.nienKhoa))).sort((a: any, b: any) => b.localeCompare(a));
          setNienKhoaList(uniqueNK as string[]);
        }
      }

      const classesInYear = listClasses.filter((c: any) => c.nienKhoa === workingNK);

      const setInitialClass = async (classCode: string, nk?: string) => {
        setSelectedClass(classCode);
        await loadClassGradesAndPermissions(classCode, username, role, false, nk || workingNK);
      };

      if (role === 'HieuTruong') {
        if (classesInYear.length > 0) {
          await setInitialClass(classesInYear[0].maLop, classesInYear[0].nienKhoa);
        } else {
          setSelectedClass('');
          setGradeRecords([]);
        }
      } else if (role === 'GiaoVien') {
        // Kiểm tra xem là chủ nhiệm lớp nào của năm học đang chọn
        const gvcnObj = classesInYear.find(
          (c: any) => c.gvchuNhiem?.trim().toUpperCase() === username.trim().toUpperCase()
        );

        if (gvcnObj) {
          setIsGvcn(true);
          setMyGvcnClass(gvcnObj.maLop);
          await setInitialClass(gvcnObj.maLop, gvcnObj.nienKhoa);
        } else {
          // Là GVBM, tải lịch giảng dạy của mình để biết được phân công chuyên môn
          setIsGvcn(false);
          const resLich = await apiClient.get(`/TaiKhoan/lich-day/${username}`);
          if (resLich.data && Array.isArray(resLich.data)) {
            // Lọc ra các phân công nằm thuộc niên khóa đang hoạt động/làm việc
            const currentYearSchedules = resLich.data.filter((l: any) => l.nienKhoa === workingNK);
            const assignedClassCodes = Array.from(new Set(currentYearSchedules.map((l: any) => l.maLop))) as string[];
            if (assignedClassCodes.length > 0) {
              const matchedClass = classesInYear.find((c: any) => c.maLop === assignedClassCodes[0]);
              await setInitialClass(assignedClassCodes[0], matchedClass?.nienKhoa);
            } else {
              setSelectedClass('');
              setGradeRecords([]);
              message.info(`Giáo viên ${username} chưa được sắp lịch giảng dạy nào trong năm ${workingNK}.`);
            }
          } else {
            setSelectedClass('');
            setGradeRecords([]);
          }
        }
      }
    } catch (err: any) {
      message.error('Lỗi nạp cổng điểm: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadClassGradesAndPermissions = async (
    maLop: string, 
    username: string, 
    userRole: string, 
    includeAll: boolean = showAllStudents,
    nienKhoaParam?: string,
    hocKyParam?: number
  ) => {
    if (!maLop) return;
    setLoading(true);
    try {
      // 1. Phân luồng API tùy thuộc vào yêu cầu (Chỉ hiển thị HS hiện tại, hoặc bật kho lưu trữ tổng)
      // FIX: Nếu đang xem dữ liệu năm cũ (Archived), BẮT BUỘC tải toàn bộ học sinh (bao gồm đã tốt nghiệp/thăng lớp)
      const isArchivedYear = selectedNienKhoa !== activeAcademicYear && selectedNienKhoa !== '';
      const forceFetchAll = includeAll || isArchivedYear;
      
      const apiEndpoint = forceFetchAll ? `/HocSinh/truy-xuat-ho-so/${maLop}` : `/LopHoc/${maLop}/danh-sach-hien-tai`;
      const studentRes = await apiClient.get(apiEndpoint);
      const studentList = studentRes.data || [];

      // 2. Lấy danh sách môn học của lớp này
      const subjs = getSubjectsForClass(maLop);

      // 3. Tải song song quyền chỉnh sửa (kiem-tra-phan-cong) của từng môn học đối với Giáo viên
      const pMap: Record<string, boolean> = {};
      if (userRole === 'HieuTruong' || userRole === 'PhuHuynh') {
        // Hiệu trưởng và Phụ huynh không bao giờ được sửa bảng điểm
        subjs.forEach(s => { pMap[s.maMon] = false; });
      } else {
        await Promise.all(
          subjs.map(async (subj) => {
            try {
              // Gọi API kiem-tra-phan-cong thực tế tại Server C#
              const res = await apiClient.get('/TaiKhoan/kiem-tra-phan-cong', {
                params: { maGiaoVien: username, maLop, maMon: subj.maMon }
              });
              pMap[subj.maMon] = res.data.quyen === true;
            } catch {
              pMap[subj.maMon] = false;
            }
          })
        );
      }
      setPermissionMap(pMap);

      // 5. Tải số liệu chuyên cần (Vắng mặt)
      let dsDiemDanh: any[] = [];
      try {
        const ddRes = await apiClient.get(`/LopHoc/${maLop}/tong-hop-diem-danh`);
        dsDiemDanh = ddRes.data || [];
      } catch (err) {
        console.warn("Lỗi nạp chuyên cần", err);
      }

      // 4. Lấy điểm chi tiết của từng học sinh
      const nkToUse = nienKhoaParam !== undefined ? nienKhoaParam : selectedNienKhoa;
      const hkToUse = hocKyParam !== undefined ? hocKyParam : selectedHocKy;

      const records: StudentGradeRecord[] = await Promise.all(
        studentList.map(async (hs: any) => {
          const scoreMap: Record<string, ScoreDetail> = {};
          
          // Điền mặc định trống
          subjs.forEach(s => {
            scoreMap[s.maMon] = { diemThi: null, xepLoai: null, nhanXet: null };
          });

          try {
            // Lấy điểm thi từ C# lọc theo năm học và học kỳ
            const scoreRes = await apiClient.get(`/BangDiem/xem-diem/${hs.maHs}`, {
              params: { nienKhoa: nkToUse, hocKy: hkToUse }
            });
            if (scoreRes.data && Array.isArray(scoreRes.data)) {
              scoreRes.data.forEach((sc: any) => {
                const mCode = (sc.maMon || '').toUpperCase();
                if (scoreMap[mCode]) {
                  scoreMap[mCode] = {
                    diemThi: sc.diemThi != null ? Number(sc.diemThi) : null,
                    xepLoai: sc.xepLoai || null,
                    nhanXet: sc.nhanXet || null
                  };
                }
              });
            }
          } catch {
            // Trường hợp lỗi hoặc chưa có điểm
          }

          const thongTinVang = dsDiemDanh.find(d => d.maHs === hs.maHs);

          return {
            maHs: hs.maHs,
            hoTen: hs.hoTen,
            trangThai: hs.trangThai,
            scores: scoreMap,
            tongVang: thongTinVang?.tongVang || 0,
            chiTietVang: thongTinVang?.chiTiet || []
          };
        })
      );
      setGradeRecords(records);
    } catch (err: any) {
      if (err.response?.status === 403) {
        message.warning('Từ chối bảo mật (403): Thẻ truy cập của bạn bị khóa khỏi bảng điểm lớp này.');
      } else {
        message.error('Lỗi khi tải bảng điểm: ' + (err.response?.data?.message || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = async (val: string, nienKhoaParam?: string) => {
    setSelectedClass(val);
    if (currentUser) {
      const nk = nienKhoaParam !== undefined ? nienKhoaParam : selectedNienKhoa;
      await loadClassGradesAndPermissions(val, currentUser.username, currentUser.role, showAllStudents, nk, selectedHocKy);
    }
  };

  const handleToggleShowAll = async (checked: boolean) => {
    setShowAllStudents(checked);
    if (selectedClass && currentUser) {
      await loadClassGradesAndPermissions(selectedClass, currentUser.username, currentUser.role, checked, selectedNienKhoa, selectedHocKy);
    }
  };

  // Hàm cập nhật điểm thi / xếp loại trung chuyển Optimistic & Rollback
  const handleSaveGrade = async (
    maHs: string, 
    maMon: string, 
    key: 'diemThi' | 'xepLoai' | 'nhanXet', 
    newVal: any, 
    oldRecord: ScoreDetail
  ) => {
    // Bước 1: UI Cập nhật ngay lập tức (Optimistic Update)
    setGradeRecords(prev => 
      prev.map(row => {
        if (row.maHs === maHs) {
          const updatedScores = { ...row.scores };
          updatedScores[maMon] = {
            ...updatedScores[maMon],
            [key]: newVal
          };
          return { ...row, scores: updatedScores };
        }
        return row;
      })
    );

    // Chuẩn bị payload khớp đúng DTO C# NhapDiemDto
    const scoreState = { ...oldRecord, [key]: newVal };
    const payload = {
      maHS: maHs,
      maMon: maMon,
      diemThi: scoreState.diemThi,
      xepLoai: scoreState.xepLoai,
      nhanXet: scoreState.nhanXet || `Ghi nhận ${maMon}`,
      nienKhoa: selectedNienKhoa,
      hocKy: selectedHocKy
    };

    setLoading(true);
    try {
      const res = await apiClient.post('/BangDiem/nhap-diem', payload);
      message.success(res.data.message || 'Cập nhật thành công!');
    } catch (err: any) {
      // Thất bại -> Báo lỗi và Rollback UI
      if (err.response?.status === 403) {
        message.warning('Rất tiếc! Bạn chưa được phân công giảng dạy môn này tại lớp hiện hành nên hệ thống không thể lưu điểm. Xin cảm ơn!');
      } else {
        const errorMsg = err.response?.data?.message || err.response?.data || 'Lưu dữ liệu không thành công do lỗi hệ thống!';
        message.error(`Lỗi: ${errorMsg}`);
      }

      // Rollback UI về trạng thái cũ ban đầu từ DB
      setGradeRecords(prev =>
        prev.map(row => {
          if (row.maHs === maHs) {
            const rolledBackScores = { ...row.scores };
            rolledBackScores[maMon] = oldRecord;
            return { ...row, scores: rolledBackScores };
          }
          return row;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Quét kiểm duyệt lỗi thiếu điểm trong lớp
  const getValidationErrors = () => {
    const errorList: string[] = [];
    
    gradeRecords.forEach(row => {
      if (row.trangThai === 'Đã chuyển trường') return; // Không cần xét điểm học sinh vắng lâu dài
      
      const missingSubjects: string[] = [];
      currentSubjects.forEach(sub => {
        const sc = row.scores[sub.maMon] || { diemThi: null, xepLoai: null };
        if (sub.kieu === 'diem_chu') {
          // Bắt buộc có điểm thi
          if (sc.diemThi === null || sc.diemThi === undefined) {
            missingSubjects.push(`${sub.tenMon} (Trống điểm)`);
          }
        } else if (sub.kieu === 'chu') {
          // Bắt buộc có xếp loại
          if (!sc.xepLoai) {
            missingSubjects.push(`${sub.tenMon} (Trống xếp loại)`);
          }
        }
      });

      if (missingSubjects.length > 0) {
        errorList.push(`Bé ${row.hoTen} (${row.maHs}): Thiếu ${missingSubjects.join(', ')}`);
      }
    });

    return errorList;
  };

  const validationErrors = getValidationErrors();
  const isDataIncomplete = validationErrors.length > 0;

  // Quyền xuất học bạ & gửi tin nhắn: Chỉ dành riêng cho Giáo viên chủ nhiệm lớp hiện tại
  const canPerformGvcnActions = currentUser?.role === 'GiaoVien' && isGvcn && selectedClass === myGvcnClass;

  // Quyền xuất học bạ: Giáo viên chủ nhiệm của lớp đó HOẶC Ban giám hiệu (Hiệu trưởng)
  const canExportGrades = canPerformGvcnActions || currentUser?.role === 'HieuTruong';

  // Hỗ trợ xuất Excel bảng điểm lớp học (định dạng UTF-16LE TSV tiếng Việt chuẩn)
  const exportGradesToExcel = (data: any[], classNameVal: string, semesterNameVal: string) => {
    if (!data || data.length === 0) {
      message.warning('Không có dữ liệu điểm để xuất!');
      return;
    }
    const subjects = data[0].chiTietDiem || [];
    const headers = ['Mã Học Sinh', 'Tên Học Sinh', ...subjects.map((sub: any) => sub.tenMon), 'Danh hiệu thi đua'];
    
    const rows = data.map((hs: any) => {
      const row = [
        hs.maHs,
        hs.hoTen || ''
      ];
      subjects.forEach((sub: any) => {
        const mon = hs.chiTietDiem?.find((m: any) => m.tenMon === sub.tenMon);
        let cellVal = '';
        if (mon) {
          if (mon.diemThi !== null && mon.xepLoai) {
            cellVal = `${mon.diemThi} (${mon.xepLoai})`;
          } else if (mon.diemThi !== null) {
            cellVal = `${mon.diemThi}`;
          } else if (mon.xepLoai) {
            cellVal = mon.xepLoai;
          }
        }
        row.push(cellVal);
      });
      row.push(hs.khenThuong || '');
      return row;
    });

    const content = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\r\n');
    const buffer = new ArrayBuffer(2 + content.length * 2);
    const view = new DataView(buffer);
    view.setUint16(0, 0xFEFF, true); // UTF-16LE BOM
    for (let i = 0; i < content.length; i++) {
      view.setUint16(2 + i * 2, content.charCodeAt(i), true);
    }

    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-16le;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_diem_lop_${classNameVal.replace(/\s+/g, '_')}_Ky_${semesterNameVal.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Đã tải xuống file Excel bảng điểm!');
  };

  // Gọi API xuất học bạ cấp lớp của GVCN
  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/BangDiem/xuat-bang-diem-tong/${selectedClass}?nienKhoa=${selectedNienKhoa}&hocKy=${selectedHocKy}`);
      const data = res.data?.data || [];
      const countXuatSac = data.filter((r: any) => r.khenThuong === 'Học sinh xuất sắc').length;
      const countTieuBieu = data.filter((r: any) => r.khenThuong && r.khenThuong.startsWith('Học sinh tiêu biểu')).length;

      Modal.success({
        title: `🎉 Bảng Điểm Khen Thưởng Lớp ${selectedClass}`,
        width: 1200,
        content: (
          <div className="max-h-[500px] overflow-y-auto mt-4 text-xs font-sans">
            <p className="text-emerald-700 font-bold mb-2">{res.data.message}</p>
            
            {/* Thẻ Thống Kê Học Sinh Xuất Sắc & Học Sinh Tiêu Biểu */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div style={{ color: '#065f46', fontWeight: 'bold' }}>Học Sinh Xuất Sắc</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', marginTop: '4px' }}>{countXuatSac} em</div>
              </div>
              <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ color: '#78350f', fontWeight: 'bold' }}>Học Sinh Tiêu Biểu</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>{countTieuBieu} em</div>
              </div>
            </div>

            <div className="mb-4 text-right">
              <Button 
                type="primary" 
                icon={<FileExcelOutlined />} 
                className="bg-emerald-600 border-emerald-600 hover:bg-emerald-700 font-semibold"
                onClick={() => {
                  const getSemesterName = (hk: number) => {
                    switch (hk) {
                      case 1: return 'Giữa HK1';
                      case 2: return 'Cuối HK1';
                      case 3: return 'Giữa HK2';
                      case 4: return 'Cuối HK2';
                      default: return 'HK' + hk;
                    }
                  };
                  exportGradesToExcel(data, selectedClass, getSemesterName(selectedHocKy));
                }}
              >
                Tải File Excel Bảng Điểm
              </Button>
            </div>

            <Table
              dataSource={data}
              pagination={false}
              size="small"
              rowKey="maHs"
              columns={[
                { title: 'Mã HS', dataIndex: 'maHs', key: 'maHs', width: '15%' },
                { title: 'Tên Học sinh', dataIndex: 'hoTen', key: 'hoTen', width: '30%' },
                ...(data?.[0]?.chiTietDiem?.map((sm: any) => ({
                  title: sm.tenMon,
                  key: sm.tenMon,
                  render: (_: any, record: any) => {
                    const mon = record.chiTietDiem?.find((m: any) => m.tenMon === sm.tenMon);
                    if (!mon) return '-';
                    if (mon.diemThi !== null && mon.xepLoai) return `${mon.diemThi} (${mon.xepLoai})`;
                    if (mon.diemThi !== null) return mon.diemThi;
                    if (mon.xepLoai) return mon.xepLoai;
                    return '-';
                  }
                })) || []),
                { 
                  title: 'Danh hiệu thi đua', 
                  dataIndex: 'khenThuong', 
                  key: 'khenThuong',
                  render: (val) => val ? <Tag color="gold" className="font-bold">{val}</Tag> : <Text type="secondary">-</Text>
                }
              ]}
            />
          </div>
        )
      });
    } catch (err: any) {
      const respData = err.response?.data;
      const errMsg = respData?.message || 'Lỗi kiểm duyệt dữ liệu học bạ lớp!';
      const detailedErrors = respData?.chiTietLoi || [];
      Modal.error({
        title: '⚠️ Bị chặn bởi cơ quan C# Validator',
        content: (
          <div className="text-xs mt-2">
            <p className="font-semibold text-red-600 mb-2">{errMsg}</p>
            {detailedErrors.length > 0 && (
              <ul className="list-disc pl-4 text-slate-500 leading-relaxed font-mono">
                {detailedErrors.map((e: string, idx: number) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  // Báo điểm SMS cho Phụ huynh qua bảng TuongTac
  const handleSendNotification = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post(`/BangDiem/gui-thong-bao-diem/${selectedClass}?nienKhoa=${selectedNienKhoa}&hocKy=${selectedHocKy}`);
      message.success(`📤 ${res.data.message || 'Hệ thống đã truyền dữ liệu học bạ đến phụ huynh!'}`);
    } catch (err: any) {
      const respData = err.response?.data;
      const errMsg = respData?.message || 'Lỗi gửi báo cáo!';
      const detailedErrors = respData?.chiTietLoi || [];
      Modal.error({
        title: '⚠️ Khóa hành trình gửi báo điểm',
        content: (
          <div className="text-xs mt-2">
            <p className="font-semibold text-red-600 mb-2">{errMsg}</p>
            {detailedErrors.length > 0 && (
              <ul className="list-disc pl-4 text-slate-500 leading-relaxed font-mono">
                {detailedErrors.map((e: string, idx: number) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  // BUILD DYNAMIC TABLE COLUMNS BASED ON CURRENT SUBJECTS LIST
  const buildTableColumns = () => {
    const defaultCols = [
      {
        title: 'Học Sinh',
        key: 'student',
        fixed: 'left' as const,
        width: '160px',
        render: (_: any, record: StudentGradeRecord) => (
          <Space orientation="vertical" size={0}>
            <Text className="font-semibold text-slate-800">{record.hoTen}</Text>
            <Text type="secondary" className="text-[10px]">{record.maHs}</Text>
            {record.trangThai === 'Đã chuyển trường' ? (
              <Tag color="volcano" className="text-[9px] py-0 px-1 m-0">Đã chuyển trường</Tag>
            ) : (
              validationErrors.some(e => e.includes(record.maHs)) && (
                <Badge status="warning" text="Chưa đủ điểm" style={{ fontSize: '9px' }} />
              )
            )}
          </Space>
        )
      }
    ];

    // Build môn học động
    const subjectCols = currentSubjects.map((sub) => {
      const isSubjectLocked = permissionMap[sub.maMon] !== true;
      const isLocked = isSubjectLocked || isLockedByYear;
      return {
        title: (
          <SpaceDirectionTitle
            tenMon={sub.tenMon}
            maMon={sub.maMon}
            isLocked={isLocked}
          />
        ),
        key: sub.maMon,
        width: sub.kieu === 'diem_chu' ? '220px' : '150px',
        render: (_: any, record: StudentGradeRecord) => {
          const detail = record.scores[sub.maMon] || { diemThi: null, xepLoai: null, nhanXet: null };
          const isRowLocked = isLocked || record.trangThai === 'Đã chuyển trường';

          return (
            <div className="flex flex-col gap-2 p-1">
              {/* PHẦN 1: MÔN CÓ ĐIỂM SỐ */}
              {sub.kieu === 'diem_chu' && (
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-slate-400">Điểm:</span>
                  <InputNumber
                    min={0}
                    max={10}
                    precision={0}
                    disabled={isRowLocked}
                    value={detail.diemThi}
                    placeholder="1-10"
                    onChange={(val) => handleSaveGrade(record.maHs, sub.maMon, 'diemThi', val, detail)}
                    style={{ width: '80%' }}
                    size="small"
                  />
                </div>
              )}

              {/* PHẦN 2: CHỮ XẾP LOẠI - Cả môn điểm số hay môn đánh giá đều điền được xếp loại như C# Models */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-400">Xếp loại:</span>
                <Select
                  disabled={isRowLocked}
                  value={detail.xepLoai || undefined}
                  onChange={(val) => handleSaveGrade(record.maHs, sub.maMon, 'xepLoai', val, detail)}
                  placeholder="H/T/C"
                  size="small"
                  style={{ width: '80%' }}
                  options={[
                    { value: 'T', label: 'Tốt (T)', className: 'text-emerald-600 font-semibold' },
                    { value: 'H', label: 'Hoàn thành (H)', className: 'text-blue-600 font-semibold' },
                    { value: 'C', label: 'Chưa đạt (C)', className: 'text-red-500 font-semibold' }
                  ]}
                />
              </div>

              {/* PHẦN 3: NHẬN XÉT CHI TIẾT */}
              <Input
                placeholder={`Ghi nhận ${sub.tenMon}`}
                size="small"
                disabled={isRowLocked}
                defaultValue={detail.nhanXet || ''}
                onBlur={(e) => {
                  if (!isRowLocked && e.target.value !== detail.nhanXet) {
                    handleSaveGrade(record.maHs, sub.maMon, 'nhanXet', e.target.value, detail);
                  }
                }}
                className={`text-[10px] ${isRowLocked ? 'bg-gray-100 text-gray-400' : ''}`}
              />
            </div>
          );
        }
      };
    });

    const chuyenCanCol = {
      title: 'Chuyên Cần',
      key: 'chuyenCan',
      width: '120px',
      align: 'center' as const,
      render: (_: any, record: StudentGradeRecord) => {
        if (record.tongVang === 0) return <Tag color="green">Đầy đủ</Tag>;
        
        const chiTiet = (
          <ul className="pl-4 m-0 text-xs">
            {record.chiTietVang?.map((v, idx) => (
              <li key={idx} className={v.trangThai === 'Không phép' ? 'text-red-500 font-bold' : 'text-orange-500'}>
                {v.ngay} - {v.trangThai}
              </li>
            ))}
          </ul>
        );
        
        return (
          <Tooltip title={chiTiet} color="purple">
            <Badge count={record.tongVang} color={record.chiTietVang?.some(v => v.trangThai === 'Không phép') ? 'red' : 'gold'}>
              <Button size="small" type="dashed" danger={record.chiTietVang?.some(v => v.trangThai === 'Không phép')}>
                Vắng {record.tongVang}
              </Button>
            </Badge>
          </Tooltip>
        );
      }
    };

    return [...defaultCols, ...subjectCols, chuyenCanCol];
  };

  // Sub-component phụ trợ tiêu đề cột
  const SpaceDirectionTitle = ({ tenMon, maMon, isLocked }: { tenMon: string; maMon: string; isLocked: boolean }) => (
    <Tooltip title={isLocked ? "Chỉ Được Xem (Bạn không được phân công dạy môn này ở lớp này nên không thể sửa điểm)" : `Bạn có quyền sửa điểm môn ${tenMon}`}>
      <Space size={4} className="cursor-pointer select-none">
        <span>Môn {tenMon}</span>
        {isLocked ? (
          <Badge count={<LockOutlined style={{ color: '#ff4d4f', fontSize: '9px' }} />} />
        ) : (
          <Badge status="success" />
        )}
      </Space>
    </Tooltip>
  );

  // Chặn đứng hoàn toàn Phụ huynh
  if (currentUser?.role === 'PhuHuynh') {
    return (
      <div className="py-4">
        <Typography.Title level={3} className="text-slate-800 mb-6">
          Học bạ & Tiến trình Học tập
        </Typography.Title>
        
        <Card className="rounded-2xl border-rose-200 bg-rose-50/50 shadow-md">
          <div className="flex items-start gap-4 p-2">
            <div className="text-3xl">🛡️</div>
            <div>
              <Typography.Title level={4} className="text-rose-800 mt-0">
                Ủy quyền Tuyệt đối cấp bởi Backend API C# (403 Forbidden)
              </Typography.Title>
              <Paragraph className="text-rose-700 leading-relaxed text-sm">
                Theo cấu trúc bảo mật hệ thống (RBAC & ABAC) của Backend C#, **Phụ huynh không có quyền truy cập trực tiếp các API bảng điểm của lớp học**. 
              </Paragraph>
              <Paragraph className="text-slate-600 leading-relaxed text-xs">
                Toàn bộ danh sách điểm số thô đã bị máy chủ API chặn đứng để bảo vệ an toàn thông tin của các học sinh khác trong lớp.
                <br />
                Kính mong Phụ huynh truy cập vào trang **"Hộp thư của tôi" (Module 3. Kế hoạch & Thông báo)** để xem chi tiết điểm số của riêng con em mình do Giáo viên chủ nhiệm gửi thông báo liên định kỳ.
              </Paragraph>
              <Space className="mt-3">
                <Button 
                  type="primary" 
                  danger
                  href="/modules/planning-notifications"
                  icon={<SendOutlined />}
                  className="rounded-lg"
                >
                  Băng sang Hộp thư thông báo
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={3} className="m-0 text-slate-800">Cổng Nhập Điểm & Đánh giá theo Thông tư 27</Title>
          <Paragraph className="text-slate-500 text-xs">
            Hệ thống tự động đồng bộ gác cổng phân công (GVCN dạy đại trà, GVBM dạy môn chuyên trách).
          </Paragraph>
        </div>
        
        {classes.length > 0 && (
          <Space size="large" align="center" className="flex-wrap">
            <div className="flex items-center gap-2">
               <span className="text-xs font-semibold text-slate-600">Truy xuất toàn bộ hồ sơ (kể cả chuyển trường)</span>
               <Switch 
                 size="small" 
                 checked={showAllStudents} 
                 onChange={handleToggleShowAll}
               />
            </div>
            <div className="flex items-center gap-2">
              <Text className="text-slate-600 font-bold text-xs">Năm Học:</Text>
              <Tag color="blue" className="font-bold text-sm px-3 py-1 m-0 border-blue-200">
                {selectedNienKhoa}
              </Tag>
            </div>
            <div className="flex items-center gap-2">
              <Text className="text-slate-600 font-bold text-xs">Học Kỳ:</Text>
              <Select
                value={selectedHocKy}
                onChange={async (val) => {
                  setSelectedHocKy(val);
                  if (selectedClass && currentUser) {
                    await loadClassGradesAndPermissions(selectedClass, currentUser.username, currentUser.role, showAllStudents, selectedNienKhoa, val);
                  }
                }}
                style={{ width: 110 }}
                className="font-bold border-indigo-400"
                options={[
                  { value: 1, label: 'Giữa Học kỳ 1' },
                  { value: 2, label: 'Cuối Học kỳ 1' },
                  { value: 3, label: 'Giữa Học kỳ 2' },
                  { value: 4, label: 'Cuối Học kỳ 2' }
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
            <Text className="text-slate-600 font-bold text-xs">Chọn lớp học quản lý:</Text>
            <Select
              value={selectedClass}
              onChange={(val) => handleClassChange(val)}
              style={{ width: 140 }}
              className="font-bold border-indigo-400"
              options={classes.filter((c: any) => c.nienKhoa === selectedNienKhoa).map(c => ({
                value: c.maLop,
                label: `Lớp ${c.tenLop}`
              }))}
            />
            </div>
          </Space>
        )}
      </div>

      <Card className="mb-6 border-amber-200 bg-amber-50/50 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ExclamationCircleOutlined className="text-xl text-amber-500 mt-1" />
            <div>
              <div className="text-xs font-bold text-amber-800">Cấu hình Đánh Giá Môn Học theo Khối Lớp</div>
              <ul className="pl-4 list-disc text-[11px] text-amber-700 mt-1 leading-relaxed">
                <li><b>Khối 1, 2:</b> Môn tính điểm: Toán, Tiếng Việt. Đánh giá chữ (T/H/C): Đạo đức, Tự nhiên - Xã hội, GD Thể chất, Âm nhạc, Mĩ thuật, HĐ Trải nghiệm.</li>
                <li><b>Khối 3:</b> Bổ sung 3 môn tính điểm: Tiếng Anh, Tin học, Công nghệ.</li>
                <li><b>Khối 4, 5:</b> Áp dụng như Khối 3. Môn Tự nhiên - Xã hội cấu trúc thành 2 môn tính điểm: Khoa học, Lịch sử & Địa lý.</li>
                <li>Hệ thống <b>khóa chức năng</b> Báo Điểm & Xuất bảng điểm nếu phát hiện còn ô trống điểm hoặc đánh giá chữ (T/H/C) bắt buộc.</li>
              </ul>
            </div>
          </div>
          <div>
            {isDataIncomplete ? (
              <Tag color="red" className="text-xs font-semibold py-1 px-3">Bảng điểm: Chưa hoàn thiện</Tag>
            ) : (
              <Tag color="green" className="text-xs font-semibold py-1 px-3">Bảng điểm: Sẵn sàng xuất</Tag>
            )}
          </div>
        </div>
      </Card>

      {isDataIncomplete && (
        <Alert
          title="Phát hiện học sinh bị trống điểm thi hoặc đánh giá"
          description={
            <div className="text-xs font-mono max-h-[120px] overflow-y-auto">
              {validationErrors.map((e, index) => (
                <div key={index} className="mt-1">
                  • {e}
                </div>
              ))}
            </div>
          }
          type="error"
          showIcon
          className="mb-6 rounded-xl"
        />
      )}

      {isLockedByYear && (
        <Alert
          title="Năm Học Đã Khóa Sổ (Archived)"
          description="Dữ liệu điểm số của năm học cũ đã được niêm phong vĩnh viễn. Mọi chức năng sửa đổi bảng điểm đã bị khóa để đảm bảo tính toàn vẹn dữ liệu."
          type="warning"
          showIcon
          className="mb-6 rounded-xl"
        />
      )}

      <Card 
        className="shadow-sm border border-slate-200 rounded-2xl"
        title={
          <div className="flex items-center justify-between flex-wrap gap-4 w-full">
            <span className="text-sm font-semibold text-slate-800">
              Sổ điểm chi tiết - Lớp {selectedClass}
            </span>
            <Space>
              <Tooltip title={!canExportGrades ? 'Chỉ Giáo viên chủ nhiệm hoặc Ban giám hiệu mới được phép Xuất bảng điểm.' : isDataIncomplete ? 'Yêu cầu hoàn thiện điểm số lớp hợp lệ trước khi xuất!' : ''}>
                <Button 
                  type="default" 
                  icon={<ExportOutlined />} 
                  onClick={handleExport}
                  disabled={!canExportGrades || isDataIncomplete || isLockedByYear}
                >
                  Xuất bảng điểm (Excel)
                </Button>
              </Tooltip>
              
              <Tooltip title={!canPerformGvcnActions ? 'Chỉ Giáo viên chủ nhiệm mới được phép Báo Điểm.' : isDataIncomplete ? 'Gửi tin nhắn bị chặn do bảng điểm chưa hoàn tất!' : ''}>
                <Button 
                  type="primary" 
                  icon={<SendOutlined />} 
                  onClick={handleSendNotification}
                  disabled={!canPerformGvcnActions || isDataIncomplete || isLockedByYear}
                  className={canPerformGvcnActions && !isDataIncomplete ? 'bg-indigo-600 border-indigo-600' : ''}
                >
                  Báo Điểm PH (GVCN)
                </Button>
              </Tooltip>
            </Space>
          </div>
        }
      >
        <Spin spinning={loading} description="Đang đọc điểm số từ SQL Server...">
          {gradeRecords.length === 0 ? (
            <Empty description="Không tìm thấy học sinh nào thuộc lớp này." />
          ) : (
            <Table
              dataSource={gradeRecords}
              columns={buildTableColumns()}
              pagination={false}
              size="middle"
              scroll={{ x: 1000 }}
              rowKey="maHs"
              className="border border-slate-100 rounded-lg overflow-hidden"
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
