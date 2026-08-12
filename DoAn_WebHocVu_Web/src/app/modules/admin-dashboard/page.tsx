'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, message, Row, Col, Spin, Alert } from 'antd';
import { AppstoreOutlined, TeamOutlined, UserOutlined, NotificationOutlined, BarChartOutlined, PlusOutlined, LockOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import apiClient from '../../../services/apiClient';

const { Title, Text } = Typography;

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [lopHocs, setLopHocs] = useState<any[]>([]);
  const [giaoViens, setGiaoViens] = useState<any[]>([]);
  const [monHocs, setMonHocs] = useState<any[]>([]);
  const [tienDoKeHoachs, setTienDoKeHoachs] = useState<any[]>([]);
  const [progressType, setProgressType] = useState<string>('gvcn');
  
  // States cho Bảng Điểm
  const [selectedClassForGrades, setSelectedClassForGrades] = useState<string>('');
  const [gradeData, setGradeData] = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [selectedHocKyForGrades, setSelectedHocKyForGrades] = useState<number>(1);
  
  // States cho Tài khoản
  const [parentAccounts, setParentAccounts] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [crossCheckResult, setCrossCheckResult] = useState<string>('');
  const [selectedClassForParents, setSelectedClassForParents] = useState<string>('');
  
  // Modals
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  
  // States Modal Phân công & Thêm GV
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetTeacher, setAssignTargetTeacher] = useState('');
  
  const [classForm] = Form.useForm();
  const [crossCheckForm] = Form.useForm();
  const [teacherForm] = Form.useForm();
  const [assignHomeroomForm] = Form.useForm();
  const [assignSubjectForm] = Form.useForm();
  
  const [currentSelectedUsername, setCurrentSelectedUsername] = useState('');

  // Nien Khoa Lock States
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>('');
  const [schoolActiveYear, setSchoolActiveYear] = useState<string>('');
  const [nienKhoaList, setNienKhoaList] = useState<string[]>([]);
  const [selectedNienKhoaToLock, setSelectedNienKhoaToLock] = useState<string>('');
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [isAddingYear, setIsAddingYear] = useState<boolean>(false);

  const isLocked = activeAcademicYear !== schoolActiveYear && activeAcademicYear !== '';

  const [migrationSourceYear, setMigrationSourceYear] = useState<string>('');
  const [migrationTargetYear, setMigrationTargetYear] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  const handleMigration = async () => {
    if (!migrationSourceYear || !migrationTargetYear) {
      message.error("Vui lòng chọn cả niên khóa nguồn và niên khóa đích!");
      return;
    }
    if (migrationSourceYear === migrationTargetYear) {
      message.error("Niên khóa nguồn và đích phải khác nhau!");
      return;
    }
    setIsMigrating(true);
    try {
      const res = await apiClient.post(`/QuanLyTruong/migrate-dong-nienkhoa?tuNienKhoa=${migrationSourceYear}&denNienKhoa=${migrationTargetYear}`);
      Modal.success({
        title: 'Chuyển khóa học sinh thành công!',
        content: (
          <div>
            <p>{res.data?.message || 'Đã chuyển toàn bộ học sinh lên lớp mới thành công.'}</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Số học sinh lên lớp: <b>{res.data?.promoted ?? 0}</b> em</li>
              <li>Số học sinh tốt nghiệp: <b>{res.data?.graduated ?? 0}</b> em</li>
            </ul>
          </div>
        )
      });
      fetchDashboardData();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi thực hiện chuyển khóa!");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAddNewYear = async () => {
    if (!newYearInput || !newYearInput.trim()) {
      message.error("Vui lòng nhập niên khóa mới");
      return;
    }
    const cleanInput = newYearInput.trim();
    setIsAddingYear(true);
    try {
      const res = await apiClient.post('/QuanLyTruong/them-nien-khoa', JSON.stringify(cleanInput), {
        headers: { 'Content-Type': 'application/json' }
      });
      message.success(res.data?.message || `Đã thêm niên khóa ${cleanInput} thành công!`);
      setNewYearInput('');
      
      // Reload danh sách niên khóa
      const resNKList = await apiClient.get('/QuanLyTruong/danh-sach-nien-khoa');
      if (resNKList.data) {
        setNienKhoaList(resNKList.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi thêm niên khóa mới");
    } finally {
      setIsAddingYear(false);
    }
  };

  const handleChotNienKhoa = async (nienKhoaToLock: string) => {
    try {
      const res = await apiClient.post('/QuanLyTruong/chot-nien-khoa', JSON.stringify(nienKhoaToLock), {
        headers: { 'Content-Type': 'application/json' }
      });
      message.success(res.data.message || `Đã chốt năm học ${nienKhoaToLock} làm năm hiện hành!`);
      setSchoolActiveYear(nienKhoaToLock);
      localStorage.setItem('working_academic_year', nienKhoaToLock);
      setSelectedNienKhoaToLock('');
      window.location.reload();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi chốt niên khóa!');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchTienDoData();
  }, [progressType]);

  const fetchTienDoData = async (nk?: string) => {
    const yearToFetch = nk || schoolActiveYear;
    if (!yearToFetch) return;
    try {
      const resTienDo = await apiClient.get(`/KeHoach/tien-do-toan-truong?loai=${progressType}&nienKhoa=${yearToFetch}`);
      if (resTienDo.data) setTienDoKeHoachs(resTienDo.data);
    } catch (err: any) {
      console.warn("Lỗi tải tiến độ kế hoạch:", err);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let currentNK = '';
      const savedWorkingYear = localStorage.getItem('working_academic_year');

      try {
        const resNK = await apiClient.get('/QuanLyTruong/nien-khoa-hien-tai');
        if (resNK.data?.activeAcademicYear) {
          setSchoolActiveYear(resNK.data.activeAcademicYear);
          if (!savedWorkingYear) {
            localStorage.setItem('working_academic_year', resNK.data.activeAcademicYear);
            setActiveAcademicYear(resNK.data.activeAcademicYear);
            currentNK = resNK.data.activeAcademicYear;
          }
        }
      } catch (e) {}

      if (savedWorkingYear) {
        setActiveAcademicYear(savedWorkingYear);
        currentNK = savedWorkingYear;
      }

      // 1. Tải danh sách lớp
      const resLop = await apiClient.get('/LopHoc/danh-sach');
      if (resLop.data) {
        setLopHocs(resLop.data);
      }

      // Tải danh sách niên khóa từ DB
      try {
        const resNKList = await apiClient.get('/QuanLyTruong/danh-sach-nien-khoa');
        if (resNKList.data) {
          setNienKhoaList(resNKList.data);
        }
      } catch (e) {
        if (resLop.data) {
          const uniqueNK = Array.from(new Set(resLop.data.map((x: any) => x.nienKhoa))).sort((a: any, b: any) => b.localeCompare(a));
          setNienKhoaList(uniqueNK as string[]);
        }
      }

      // 2. Tải danh sách giáo viên
      const resGV = await apiClient.get('/QuanLyTruong/danh-sach-giao-vien');
      if (resGV.data) setGiaoViens(resGV.data);

      // Tải danh sách môn học
      const resMon = await apiClient.get('/QuanLyTruong/danh-sach-mon-hoc');
      if (resMon.data) setMonHocs(resMon.data);

      // 3. Tải tiến độ kế hoạch
      await fetchTienDoData(currentNK);
      
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi tải dữ liệu tổng quan!');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleAddClass = async (values: any) => {
    try {
      const payload = {
        ...values,
        nienKhoa: schoolActiveYear
      };
      await apiClient.post('/LopHoc/them-moi', payload);
      message.success('Đã thêm cấu trúc lớp học mới thành công!');
      setIsAddClassModalOpen(false);
      classForm.resetFields();
      fetchDashboardData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi thêm lớp học.');
    }
  };

  const handleResetPassword = async () => {
    try {
      const res = await apiClient.put(`/QuanLyTruong/reset-mat-khau/${currentSelectedUsername}`);
      setIsResetPassModalOpen(false);
      
      Modal.success({
        title: 'Reset Khôi Phục Mật Khẩu Giáo Viên',
        content: (
          <div>
            <p className="mb-2">Đã reset mật khẩu cho tài khoản giáo viên <b>{currentSelectedUsername}</b> thành công!</p>
            <p>Tên đăng nhập: <b>{currentSelectedUsername}</b></p>
            <p>Mật khẩu mới: <b>123456</b></p>
            <p className="text-amber-600 font-semibold mt-2">
              BGH vui lòng nhắc giáo viên đổi mật khẩu ngay sau khi đăng nhập.
            </p>
          </div>
        )
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể khôi phục mật khẩu.');
    }
  };

  const handleDeleteAccount = async (username: string) => {
    try {
      const res = await apiClient.delete(`/TaiKhoan/xoa-tai-khoan/${username}`);
      message.success(res.data?.message || 'Đã xóa tài khoản khỏi hệ thống.');
      fetchDashboardData(); // Reload
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi thu hồi tài khoản.');
    }
  };

  const handleAddTeacher = async (values: any) => {
    try {
      const payload = {
        tenDangNhap: values.tenDangNhap,
        matKhau: values.matKhau || '123456',
        hoTen: values.hoTen,
        vaiTro: 'GiaoVien'
      };
      const res = await apiClient.post('/TaiKhoan/them-tai-khoan', payload);
      message.success(res.data?.message || 'Đã thêm giáo viên mới!');
      setIsAddTeacherModalOpen(false);
      teacherForm.resetFields();
      fetchDashboardData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi thêm tài khoản GV.');
    }
  };

  const handleAssignHomeroom = async (values: any) => {
    try {
      const res = await apiClient.post(`/QuanLyTruong/phan-cong-chu-nhiem?maLop=${values.maLop}&maGVCN=${assignTargetTeacher}`);
      message.success(res.data?.message || 'Đã phân công chủ nhiệm!');
      setIsAssignModalOpen(false);
      assignHomeroomForm.resetFields();
      fetchDashboardData(); 
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi phân công.');
    }
  };

  const handleAssignSubject = async (values: any) => {
    try {
      const payload = {
        maGiaoVien: assignTargetTeacher,
        maLop: values.maLop,
        maMon: values.maMon,
        thu: values.thu,
        buoi: values.buoi,
        tiet: values.tiet?.toString() || '',
        nienKhoa: schoolActiveYear
      };
      const res = await apiClient.post('/QuanLyTruong/phan-cong-bo-mon', payload);
      message.success(res.data?.message || 'Đã phân công bộ môn!');
      setIsAssignModalOpen(false);
      assignSubjectForm.resetFields();
      fetchDashboardData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi phân công.');
    }
  };

  const fetchGradesForClass = async (classId: string, hocKy: number = selectedHocKyForGrades) => {
    if (!classId) return;
    setLoadingGrades(true);
    try {
      const res = await apiClient.get(`/BangDiem/xuat-bang-diem-tong/${classId}?nienKhoa=${activeAcademicYear}&hocKy=${hocKy}`);
      if (res.data?.data && Array.isArray(res.data.data)) {
        setGradeData(res.data.data);
      } else if (res.data && Array.isArray(res.data)) {
        setGradeData(res.data);
      } else {
        setGradeData([]);
      }
    } catch (err: any) {
      setTimeout(() => message.error(err.response?.data?.message || 'Không có dữ liệu điểm cho lớp này.'), 500);
      setGradeData([]);
    } finally {
      setLoadingGrades(false);
    }
  };

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
    
    // Find class friendly name
    const foundClass = lopHocs.find(c => c.maLop === classNameVal);
    const classLabel = foundClass ? foundClass.tenLop : classNameVal;

    link.setAttribute('download', `Bang_diem_lop_${String(classLabel).replace(/\s+/g, '_')}_Ky_${semesterNameVal.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Đã tải xuống file Excel bảng điểm!');
  };

  const fetchParentsForClass = async (classId: string) => {
    if (!classId) return;
    setLoadingParents(true);
    setSelectedClassForParents(classId);
    try {
      const res = await apiClient.get(`/TaiKhoan/danh-sach-phu-huynh/theo-lop/${classId}`);
      if (res.data && Array.isArray(res.data)) {
         setParentAccounts(res.data);
      } else if (res.data && Array.isArray(res.data.data)) {
         setParentAccounts(res.data.data); // Xử lý trường hợp trả về { message: ..., data: [] }
      } else {
         setParentAccounts([]);
      }
    } catch (err: any) {
      setParentAccounts([]);
    } finally {
      setLoadingParents(false);
    }
  };

  const handleCrossCheck = async (values: any) => {
    try {
      const res = await apiClient.get(`/TaiKhoan/kiem-tra-phan-cong?maGiaoVien=${values.maGiaoVien}&maLop=${values.maLop}&maMon=${values.maMon}`);
      setCrossCheckResult(res.data?.message || 'Có quyền truy cập');
    } catch (err: any) {
      setCrossCheckResult(err.response?.data?.message || 'Không có quyền truy cập');
    }
  };

  // --- Columns động sinh từ kết quả Pivot giống GVCN ---
  const getDynamicGradeColumns = () => {
    const defaultCols = [
      { title: 'Mã HS', dataIndex: 'maHs', key: 'maHs', width: '15%', render: (t: string) => <b>{t}</b> },
      { title: 'Tên Học sinh', dataIndex: 'hoTen', key: 'hoTen', width: '30%' }
    ];

    if (!gradeData || gradeData.length === 0) {
      return defaultCols;
    }

    const firstStudent = gradeData[0];
    const subjectCols = (firstStudent.chiTietDiem || []).map((sub: any) => ({
      title: sub.tenMon,
      key: sub.tenMon,
      render: (_: any, record: any) => {
        const mon = record.chiTietDiem?.find((m: any) => m.tenMon === sub.tenMon);
        if (!mon) return '-';
        if (mon.diemThi !== null && mon.xepLoai) return `${mon.diemThi} (${mon.xepLoai})`;
        if (mon.diemThi !== null) return mon.diemThi;
        if (mon.xepLoai) return mon.xepLoai;
        return '-';
      }
    }));

    const rewardCol = {
      title: 'Danh hiệu thi đua',
      dataIndex: 'khenThuong',
      key: 'khenThuong',
      render: (val: string) => val ? <Tag color="gold" className="font-bold">{val}</Tag> : <Text type="secondary">-</Text>
    };

    return [...defaultCols, ...subjectCols, rewardCol];
  };

  const lopHocColumns = [
    { title: 'Mã Lớp', dataIndex: 'maLop', key: 'maLop', render: (text: string) => <Tag color="blue">{text}</Tag> },
    { title: 'Tên Lớp', dataIndex: 'tenLop', key: 'tenLop', className: 'font-semibold' },
    { title: 'Giáo viên Chủ nhiệm', dataIndex: 'gvchuNhiem', key: 'gvchuNhiem', render: (t: string) => t ? <Tag color="purple">{t}</Tag> : <Text type="secondary">Chưa phân công</Text> }
  ];

  const giaoVienColumns = [
    { title: 'Tài Khoản', dataIndex: 'tenDangNhap', key: 'tenDangNhap', render: (text: string) => <b>{text}</b> },
    { title: 'Họ Tên', dataIndex: 'hoTen', key: 'hoTen' },
    { title: 'Nhiệm vụ', dataIndex: 'nhiemVu', key: 'nhiemVu', render: (t: string) => <Tag color="cyan">{t || 'Giáo viên'}</Tag> },
    {
      title: 'Quản trị Tài khoản',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small" 
            type="primary"
            disabled={isLocked}
            onClick={() => {
              setAssignTargetTeacher(record.tenDangNhap);
              setIsAssignModalOpen(true);
            }}>
            Phân công chuyên môn
          </Button>
          <Button 
            size="small" 
            icon={<LockOutlined />} 
            disabled={isLocked}
            onClick={() => {
              setCurrentSelectedUsername(record.tenDangNhap);
              setIsResetPassModalOpen(true);
            }}>
            Reset Pass
          </Button>
          <Button 
            size="small" 
            danger 
            disabled={isLocked}
            onClick={() => handleDeleteAccount(record.tenDangNhap)}>
            Hủy Tài khoản
          </Button>
        </Space>
      )
    }
  ];

  const handleSendReminder = async (maGiaoVien: string, maLop: string, maMon?: string) => {
    if (!maGiaoVien) {
      message.warning('Lớp học này chưa có giáo viên phụ trách!');
      return;
    }
    try {
      const res = await apiClient.post('/KeHoach/nhac-nho-kpi', {
        maGiaoVien: maGiaoVien.trim(),
        maLop: maLop.trim(),
        maMon: maMon ? maMon.trim() : null
      });
      message.success(res.data.message || 'Đã gửi nhắc nhở thành công!');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gửi nhắc nhở.');
    }
  };

  const getTienDoColumns = () => {
    if (progressType === 'gvbm') {
      return [
        { title: 'Lớp', dataIndex: 'tenLop', key: 'tenLop', render: (t: string) => <b>Lớp {t}</b> },
        { title: 'Môn Học', dataIndex: 'monHoc', key: 'monHoc', render: (t: string) => <Tag color="cyan">{t}</Tag> },
        { title: 'Giáo viên bộ môn', dataIndex: 'giaoVien', key: 'giaoVien', render: (t: string) => <Tag color="orange">{t}</Tag> },
        { title: 'Tình trạng', dataIndex: 'trangThai', key: 'trangThai', render: (t: string) => <Tag color={t === 'Đã nộp' ? 'green' : 'red'}>{t}</Tag> },
        { title: 'Kế hoạch gần nhất', dataIndex: 'tieuDeGanNhat', key: 'tieuDeGanNhat', render: (t: string) => <Text type="secondary">{t || '-'}</Text> },
        { title: 'Ngày nộp', dataIndex: 'ngayNopGanNhat', key: 'ngayNopGanNhat', render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : '-' },
        { 
          title: 'Đôn Đốc', 
          key: 'action', 
          render: (_: any, record: any) => !isLocked && record.trangThai !== 'Đã nộp' ? (
            <Button size="small" type="primary" danger icon={<NotificationOutlined />} onClick={() => handleSendReminder(record.maGiaoVien, record.maLop, record.maMon)}>Nhắc nhở</Button>
          ) : null 
        }
      ];
    }

    return [
      { title: 'Lớp', dataIndex: 'tenLop', key: 'tenLop', render: (t: string) => <b>Lớp {t}</b> },
      { title: 'GVCN', dataIndex: 'gvchuNhiem', key: 'gvchuNhiem', render: (t: string) => t ? <Tag color="purple">{t}</Tag> : <Text type="secondary">Chưa có</Text> },
      { title: 'Tình trạng', dataIndex: 'trangThai', key: 'trangThai', render: (t: string) => <Tag color={t === 'Đã nộp' ? 'green' : 'red'}>{t}</Tag> },
      { title: 'Kế hoạch gần nhất', dataIndex: 'tieuDeGanNhat', key: 'tieuDeGanNhat', render: (t: string) => <Text type="secondary">{t || '-'}</Text> },
      { title: 'Ngày nộp', dataIndex: 'ngayNopGanNhat', key: 'ngayNopGanNhat', render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : '-' },
      { 
        title: 'Đôn Đốc', 
        key: 'action', 
        render: (_: any, record: any) => !isLocked && record.trangThai !== 'Đã nộp' ? (
          <Button size="small" type="primary" danger icon={<NotificationOutlined />} onClick={() => handleSendReminder(record.gvchuNhiem, record.maLop)}>Nhắc nhở</Button>
        ) : null 
      }
    ];
  };

  const items = [
    {
      key: '0',
      label: <span><LockOutlined />Cấu hình Tuần tự Hiện Hành</span>,
      children: (
        <Card title="Khóa sổ Điện tử Toàn Trường (Lock Mechanism)" bordered={false}>
          <Alert
            title="Chế độ Tường lửa (Read-only) Áp dụng theo Niên khóa"
            description="Năm học nào được chốt làm Cục diện Hiện Hành thì Giáo viên mới được thao tác Cập nhật. Các dữ liệu thuộc năm học khác (quá khứ) tự động kích hoạt Read-only để chống sửa đổi."
            type="warning"
            showIcon
            className="mb-4"
          />
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div>
              <div className="text-sm font-semibold text-slate-500 mb-2">Năm học Hiện hành đang Mở Khóa:</div>
              {schoolActiveYear ? (
                <Tag color="green" className="text-2xl px-4 py-2 font-bold m-0 border-green-300">{schoolActiveYear}</Tag>
              ) : (
                <Spin />
              )}
            </div>
            <div className="hidden md:block w-px h-16 bg-slate-300"></div>
            <div>
              <div className="text-sm font-semibold text-slate-500 mb-2">Thay đổi Cục diện Niên khóa:</div>
              <Space size="middle">
                <Select 
                  size="large"
                  style={{ width: 200 }} 
                  placeholder="Chọn năm học muốn kích hoạt..." 
                  value={selectedNienKhoaToLock || undefined}
                  onChange={(val) => setSelectedNienKhoaToLock(val)}
                  options={nienKhoaList.map(nk => ({ value: nk, label: nk }))}
                />
                <Button 
                  size="large"
                  type="primary" 
                  danger 
                  icon={<LockOutlined />} 
                  disabled={!selectedNienKhoaToLock || selectedNienKhoaToLock === schoolActiveYear}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Xác nhận Kích hoạt Ổ Khóa Hệ thống',
                      content: `Quyết định này sẽ biến dữ liệu của tât cả năm học không phải ${selectedNienKhoaToLock} thành dạng xem (Read-only). Các giáo viên sẽ mất quyền sửa điểm của các lớp không thuộc năm ${selectedNienKhoaToLock}. Bạn chắc chắn chứ?`,
                      okText: 'Áp dụng Lập tức',
                      okButtonProps: { danger: true },
                      cancelText: 'Quay lại',
                      onOk: () => handleChotNienKhoa(selectedNienKhoaToLock)
                    });
                  }}
                >
                  Áp Dụng Lập Tức Toàn Trường
                </Button>
              </Space>
            </div>
            <div className="hidden md:block w-px h-16 bg-slate-300"></div>
            <div>
              <div className="text-sm font-semibold text-slate-500 mb-2">Tạo Niên khóa mới:</div>
              <Space size="middle">
                <Input 
                  size="large"
                  style={{ width: 180 }}
                  placeholder="Ví dụ: 2026-2027"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                />
                <Button 
                  size="large"
                  type="default"
                  icon={<PlusOutlined />}
                  loading={isAddingYear}
                  onClick={handleAddNewYear}
                >
                  Khởi Tạo Niên Khóa
                </Button>
              </Space>
            </div>
          </div>

          <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span>⚡ Chuyển Khóa Học Sinh Lên Lớp Mới</span>
              <Tag color="cyan">Tự động hóa</Tag>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Hệ thống sẽ tự động chuyển toàn bộ học sinh từ khối N ở niên khóa nguồn lên khối N+1 tương ứng ở niên khóa đích. (Vd: Học sinh lớp 1A năm 2026-2027 sẽ tự động được phân lớp vào lớp 2A năm 2027-2028. Học sinh lớp 5 sẽ đổi trạng thái thành "Đã tốt nghiệp").
            </p>
            <Space size="large" align="center" className="flex flex-wrap">
              <div>
                <span className="text-sm text-slate-600 mr-2">Niên khóa nguồn:</span>
                <Select 
                  style={{ width: 160 }} 
                  placeholder="Chọn niên khóa nguồn" 
                  value={migrationSourceYear || undefined}
                  onChange={(val) => setMigrationSourceYear(val)}
                  options={nienKhoaList.map(nk => ({ value: nk, label: nk }))}
                />
              </div>
              <div>
                <span className="text-sm text-slate-600 mr-2">Niên khóa đích:</span>
                <Select 
                  style={{ width: 160 }} 
                  placeholder="Chọn niên khóa đích" 
                  value={migrationTargetYear || undefined}
                  onChange={(val) => setMigrationTargetYear(val)}
                  options={nienKhoaList.map(nk => ({ value: nk, label: nk }))}
                />
              </div>
              <Button 
                type="primary" 
                loading={isMigrating}
                disabled={!migrationSourceYear || !migrationTargetYear || migrationSourceYear === migrationTargetYear}
                onClick={handleMigration}
              >
                Tiến hành Chuyển khóa học sinh
              </Button>
            </Space>
          </div>
        </Card>
      ),
    },
    {
      key: '1',
      label: <span><AppstoreOutlined />Quản lý Lớp Học</span>,
      children: (
        <Card title="Giao diện theo dõi cấu trúc Lớp" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddClassModalOpen(true)} disabled={isLocked}>Thêm Lớp Mới</Button>}>
          <Table dataSource={lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear)} columns={lopHocColumns} rowKey="maLop" loading={loading} />
        </Card>
      ),
    },
    {
      key: '2',
      label: <span><TeamOutlined />Quản lý Trường & Nhân Sự</span>,
      children: (
        <Card title="Quản trị ban Nghề & Giáo Viên" extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddTeacherModalOpen(true)} disabled={isLocked}>Thêm Giáo viên Mới</Button><Button icon={<ReloadOutlined />} onClick={fetchDashboardData}>Làm mới</Button></Space>}>
           <Alert title="Phân công chuyên môn" description="Việc xếp thời khóa biểu và phân công chủ nhiệm được ủy quyền tại Module 1 (Hồ sơ phân công) để chặn trùng lịch." type="info" showIcon className="mb-4" />
          <Table dataSource={giaoViens} columns={giaoVienColumns} rowKey="tenDangNhap" loading={loading} />
        </Card>
      ),
    },
    {
      key: '3',
      label: <span><UserOutlined />Trạm Tài Khoản (Bảo mật)</span>,
      children: (
        <Card title="Giao diện An ninh Tài khoản">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={10}>
              <Card type="inner" title="1. Query Chéo Phân Công (Kiểm tra Quyền Ngầm)">
                <Form form={crossCheckForm} layout="vertical" onFinish={handleCrossCheck}>
                  <Form.Item name="maGiaoVien" label="Mã Giáo Viên" rules={[{ required: true }]}>
                    <Input placeholder="Nhập mã GV (VD: GVCN1A)" />
                  </Form.Item>
                  <Form.Item name="maLop" label="Mã Lớp Học" rules={[{ required: true }]}>
                    <Input placeholder="Nhập mã lớp (VD: L1A)" />
                  </Form.Item>
                  <Form.Item name="maMon" label="Mã Môn Học (nếu có)">
                    <Select placeholder="Chọn môn học (Để trống nếu hỏi quyền Chủ nhiệm)" allowClear>
                      {monHocs.map(m => <Select.Option key={m.maMon} value={m.maMon}>{m.tenMon} ({m.maMon})</Select.Option>)}
                    </Select>
                  </Form.Item>
                  <Button type="primary" htmlType="submit" className="w-full">
                    Truy vấn dữ liệu Server
                  </Button>
                </Form>
                {crossCheckResult && (
                  <Alert title="Kết quả Query" description={<span className="font-semibold text-slate-800">{crossCheckResult}</span>} type="info" showIcon className="mt-4 bg-slate-50" />
                )}
              </Card>
            </Col>
            
            <Col xs={24} lg={14}>
              <Card type="inner" title="2. Trích Xuất File Tài Khoản Phụ Huynh Theo Lớp">
                <div className="flex gap-2 mb-4 flex-wrap">
                  {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => (
                    <Button key={c.maLop} type={selectedClassForParents === c.maLop ? 'primary' : 'default'} onClick={() => fetchParentsForClass(c.maLop)}>
                      Lớp {c.tenLop}
                    </Button>
                  ))}
                </div>
                <Table 
                  dataSource={parentAccounts} 
                  rowKey="tenDangNhap"
                  loading={loadingParents}
                  size="small"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: 'Tên Đăng Nhập', dataIndex: 'tenDangNhap', key: 'tenDangNhap', render: text => <b>{text}</b> },
                    { title: 'Tên Phụ Huynh', dataIndex: 'hoTen', key: 'hoTen' },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: '4',
      label: <span><BarChartOutlined />Bảng Điểm Toàn Trường</span>,
      children: (() => {
        const countXuatSac = gradeData.filter(r => r.khenThuong === 'Học sinh xuất sắc').length;
        const countTieuBieu = gradeData.filter(r => r.khenThuong && r.khenThuong.startsWith('Học sinh tiêu biểu')).length;

        return (
          <Card title="Theo Dõi Tổng Kết Điểm Đánh Giá Năng Lực (Thông tư 27)">
            <div className="flex flex-wrap items-center gap-6 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Chọn học kỳ / Phân kỳ:</span>
                <Select
                  value={selectedHocKyForGrades}
                  onChange={(val) => {
                    setSelectedHocKyForGrades(val);
                    if (selectedClassForGrades) {
                      fetchGradesForClass(selectedClassForGrades, val);
                    }
                  }}
                  style={{ width: 180 }}
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
                <span className="font-semibold text-slate-700">Chọn lớp cần xem:</span>
                <div className="flex flex-wrap gap-2">
                  {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => (
                    <Button 
                      key={c.maLop} 
                      type={selectedClassForGrades === c.maLop ? 'primary' : 'default'}
                      onClick={() => {
                        setSelectedClassForGrades(c.maLop);
                        fetchGradesForClass(c.maLop, selectedHocKyForGrades);
                      }}>
                      Lớp {c.tenLop}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedClassForGrades && gradeData.length > 0 && (
                <div className="ml-auto">
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
                      exportGradesToExcel(gradeData, selectedClassForGrades, getSemesterName(selectedHocKyForGrades));
                    }}
                  >
                    Xuất Excel Bảng Điểm
                  </Button>
                </div>
              )}
            </div>

            {selectedClassForGrades && gradeData.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ color: '#065f46', fontWeight: 'bold', fontSize: '12px' }}>Học Sinh Xuất Sắc</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', marginTop: '4px' }}>{countXuatSac} em</div>
                </div>
                <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ color: '#78350f', fontWeight: 'bold', fontSize: '12px' }}>Học Sinh Tiêu Biểu</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>{countTieuBieu} em</div>
                </div>
              </div>
            )}

            {selectedClassForGrades ? (
              <Table dataSource={gradeData} columns={getDynamicGradeColumns()} rowKey="maHs" loading={loadingGrades} pagination={{ pageSize: 8 }} />
            ) : (
               <div className="text-center p-12 text-slate-400 border border-dashed rounded-xl border-slate-300">
                 Vui lòng chọn 1 Lớp học ở trên để trích xuất Bảng Điểm Khảo Thí từ SQL.
               </div>
            )}
          </Card>
        );
      })()
    },
    {
      key: '5',
      label: <span><NotificationOutlined />Đôn Đốc Kế Hoạch</span>,
      children: (
        <Card title="Trung tâm Đôn đốc Kế hoạch & Thông báo" extra={<Button icon={<ReloadOutlined />} onClick={fetchDashboardData}>Làm mới</Button>}>
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">Phân loại kế hoạch cần đôn đốc:</span>
            <Select 
              value={progressType} 
              onChange={(val) => setProgressType(val)} 
              style={{ width: 250 }}
              options={[
                { value: 'gvcn', label: 'Kế hoạch chủ nhiệm (GVCN)' },
                { value: 'gvbm', label: 'Kế hoạch môn học (GVBM)' }
              ]} 
            />
          </div>
          <Alert title="Kiểm soát KPI Kế hoạch" description="Kiểm tra kế hoạch giảng dạy của GVCN/GVBM để đôn đốc kịp thời qua mạng Zalo học vụ." type="info" showIcon className="mb-4" />
          <Table 
            dataSource={tienDoKeHoachs} 
            columns={getTienDoColumns()} 
            rowKey={(record: any) => progressType === 'gvbm' ? `${record.maLop}_${record.maMon}_${record.maGiaoVien}` : record.maLop} 
            loading={loading} 
          />
        </Card>
      ),
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <Title level={2} className="text-slate-800 m-0">Trung Tâm Điều Hành (BGH)</Title>
        <Text type="secondary">Tổng quan giám sát toàn diện mảng Học vụ, Cơ cấu tổ chức, và Phân quyền Trường Tiểu học Hàm Chính 2.</Text>
      </div>

      <Tabs defaultActiveKey="1" items={items} type="card" className="bg-white p-4 rounded-xl shadow-sm border border-slate-200" />

      {/* Modal Thêm Lớp */}
      <Modal title="Mở cấu trúc Lớp học mới" open={isAddClassModalOpen} onOk={() => classForm.submit()} onCancel={() => setIsAddClassModalOpen(false)}>
        <Form form={classForm} layout="vertical" onFinish={handleAddClass}>
          <Form.Item name="maLop" label="Mã quy ước (ví dụ: L4A, L5B)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tenLop" label="Tên hiển thị (ví dụ: 4A, 5B)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Thêm GV */}
      <Modal title="Thêm Tài Khoản Giáo Viên Mới" open={isAddTeacherModalOpen} onOk={() => teacherForm.submit()} onCancel={() => setIsAddTeacherModalOpen(false)}>
        <Form form={teacherForm} layout="vertical" onFinish={handleAddTeacher}>
          <Form.Item name="tenDangNhap" label="Tên Đăng Nhập (Mã GV)" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: GV015" />
          </Form.Item>
          <Form.Item name="hoTen" label="Họ và Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="matKhau" label="Mật Khẩu (Để trống sẽ gán mặc định 123456)">
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Phân công */}
      <Modal title={`Phân công chuyên môn - ${assignTargetTeacher}`} open={isAssignModalOpen} onCancel={() => setIsAssignModalOpen(false)} footer={null} destroyOnHidden>
        <Tabs defaultActiveKey="1" items={[
          {
            key: '1',
            label: 'Chủ Nhiệm Lớp',
            children: (
              <Form form={assignHomeroomForm} layout="vertical" onFinish={handleAssignHomeroom}>
                <Form.Item name="maLop" label="Lớp Học" rules={[{ required: true }]}>
                  <Select placeholder="Chọn lớp...">
                    {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => <Select.Option key={c.maLop} value={c.maLop}>{c.tenLop}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Button type="primary" htmlType="submit" className="w-full">Xác nhận phân công Chủ nhiệm</Button>
              </Form>
            )
          },
          {
            key: '2',
            label: 'Nhập Dạy Bộ Môn',
            children: (
              <Form form={assignSubjectForm} layout="vertical" onFinish={handleAssignSubject}>
                <Form.Item name="maLop" label="Học Lớp" rules={[{ required: true }]}>
                  <Select placeholder="Chọn lớp...">
                    {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => <Select.Option key={c.maLop} value={c.maLop}>{c.tenLop}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="maMon" label="Môn Học Phân Công" rules={[{ required: true }]}>
                  <Select placeholder="Mở danh sách để chọn Môn học...">
                    {monHocs.map(m => <Select.Option key={m.maMon} value={m.maMon}>{m.tenMon} ({m.maMon})</Select.Option>)}
                  </Select>
                </Form.Item>
                <Row gutter={8}>
                  <Col span={8}>
                    <Form.Item name="thu" label="Thứ" rules={[{ required: true }]}>
                      <Select>
                        {['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6'].map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="buoi" label="Buổi" rules={[{ required: true }]}>
                      <Select>
                        <Select.Option value="Sáng">Sáng</Select.Option>
                        <Select.Option value="Chiều">Chiều</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="tiet" label="Tiết Số" rules={[{ required: true }]}>
                      <InputNumber min={1} max={5} style={{width: '100%'}} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" className="w-full">Ghi nhận Lịch Phân Công Bộ Môn</Button>
              </Form>
            )
          }
        ]} />
      </Modal>

      {/* Modal Reset Pass */}
      <Modal title="Xác nhận Reset Hệ Sinh Thái Bảo Mật" open={isResetPassModalOpen} onOk={handleResetPassword} onCancel={() => setIsResetPassModalOpen(false)} okButtonProps={{ danger: true }}>
        <p>Bạn có chắc chắn muốn ép buộc hệ thống C# thiết lập lại mật khẩu tài khoản <b>{currentSelectedUsername}</b> về mặc định?</p>
      </Modal>
    </div>
  );
}
