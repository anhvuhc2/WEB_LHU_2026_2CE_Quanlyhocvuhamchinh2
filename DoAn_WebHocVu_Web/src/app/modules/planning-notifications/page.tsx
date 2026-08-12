'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Tag, Form, Input, Select, Button, Space, Typography, Upload, Row, Col, Alert, Badge, Spin, List, Avatar, message, Modal, InputRef, Empty } from 'antd';
import { PushpinOutlined, SendOutlined, FilePdfOutlined, CheckCircleOutlined, MessageOutlined, BellOutlined, LoadingOutlined, UserOutlined, BulbOutlined, NotificationOutlined } from '@ant-design/icons';
import apiClient from '../../../services/apiClient';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface KeHoach {
  maKeHoach?: number;
  maLop: string;
  tieuDe: string;
  noiDung: string;
  fileDinhKem?: string;
  ngayTao?: string;
}

interface TuongTac {
  maTuongTac?: number;
  maKeHoach?: string;
  maHs: string;
  tenDangNhap: string; // Người gửi
  noiDung: string;
  ngayTao?: string;
  nguoiDoc?: string;
  trangThaiText?: string; // "Đã xem", "Chưa xem"
}

// Cú pháp parse token an toàn
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
  } catch {
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

export default function PlanningNotificationsPage() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; displayName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ maLop: string; tenLop: string; gvchuNhiem: string | null }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('L1A');
  const [assocStudentId, setAssocStudentId] = useState<string>('HS01'); // Dành cho phụ huynh liên kết HS

  // States dữ liệu Backend
  const [keHoachs, setKeHoachs] = useState<KeHoach[]>([]);
  const [mailbox, setMailbox] = useState<TuongTac[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  // States phân quyền chuyên biệt
  const [isGVCNForSelectedClass, setIsGVCNForSelectedClass] = useState<boolean>(true);
  const [parentsOfClass, setParentsOfClass] = useState<any[]>([]);
  const [teachersOfClass, setTeachersOfClass] = useState<any[]>([]);

  // Forms
  const [keHoachForm] = Form.useForm();
  const [tuongTacForm] = Form.useForm();
  
  // Tệp đính kèm mô phỏng
  const [attachedFileName, setAttachedFileName] = useState<string>('');

  useEffect(() => {
    const claims = getClaimsFromToken();
    if (claims) {
      setCurrentUser(claims);
      initModule(claims.username, claims.role);
    }
  }, []);

  const initModule = async (username: string, role: string) => {
    setLoading(true);
    try {
      let listClasses = [];
      const savedWorkingYear = localStorage.getItem('working_academic_year') || '2025-2026';

      if (role === 'GiaoVien' || role === 'HieuTruong') {
        const classRes = await apiClient.get('/LopHoc/danh-sach');
        const rawClasses = classRes.data || [];

        // Lọc danh sách lớp học theo niên khóa làm việc toàn cục
        listClasses = rawClasses.filter((c: any) => c.nienKhoa === savedWorkingYear);
        
        if (role === 'GiaoVien') {
          // Lọc danh sách lớp học dạy thực tế của giáo viên dựa trên bảng phân công lich-day
          try {
            const scheduleRes = await apiClient.get(`/TaiKhoan/lich-day/${username}`);
            if (Array.isArray(scheduleRes.data)) {
              const assignedClassIds = Array.from(new Set(scheduleRes.data.map((item: any) => item.maLop?.trim().toUpperCase())));
              listClasses = listClasses.filter((c: any) => assignedClassIds.includes(c.maLop?.trim().toUpperCase()));
            }
          } catch (e) {
            console.error("Lỗi lấy lịch phân công giảng dạy:", e);
          }
        }
        setClasses(listClasses);
      }

      if (role === 'PhuHuynh') {
        // Phụ huynh: Tìm học sinh liên kết
        setAssocStudentId('HS01'); // Mặc định liên kết HS01
        setSelectedClass('L1A'); // Mặc định xem lớp 1A
        await loadParentSection('L1A', 'HS01', username);
      } else {
        // Giáo viên / Hiệu trưởng
        const gvClass = listClasses.find((c: any) => c.gvchuNhiem?.trim().toUpperCase() === username.trim().toUpperCase());
        const defaultClass = gvClass ? gvClass.maLop : (listClasses[0]?.maLop || 'L1A');
        setSelectedClass(defaultClass);
        // Xác định ngay quyền của lớp mặc định
        checkTeacherPermissions(defaultClass, listClasses, username);
        await loadTeacherSection(defaultClass, username);
      }
    } catch (err: any) {
      console.error('Lỗi khi nạp dữ liệu khởi tạo:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkTeacherPermissions = async (maLop: string, clsList: any[], currentUsr: string) => {
    const curClassObj = clsList.find((c: any) => c.maLop === maLop);
    const isGVCN = curClassObj?.gvchuNhiem?.trim().toUpperCase() === currentUsr.trim().toUpperCase();
    setIsGVCNForSelectedClass(isGVCN);

    // Nếu chỉ là GVBM, bắt buộc lấy danh sách phụ huynh của lớp này về để nhắn tin
    if (!isGVCN) {
       try {
         const parentRes = await apiClient.get(`/TaiKhoan/danh-sach-phu-huynh/theo-lop/${maLop}`);
         setParentsOfClass(parentRes.data || []);
       } catch {
         setParentsOfClass([]);
       }
    }
  };

  // Nạp dữ liệu Phụ huynh
  const loadParentSection = async (maLop: string, maHs: string, usr: string) => {
    setLoading(true);
    try {
      try {
        const resGv = await apiClient.get(`/LopHoc/danh-sach-giao-vien/${maLop}`);
        setTeachersOfClass(resGv.data || []);
      } catch {
        setTeachersOfClass([]);
      }

      // Tải kế hoạch lớp
      const resKh = await apiClient.get(`/KeHoach/danh-sach-lop/${maLop}`);
      setKeHoachs(resKh.data || []);

      // Tải danh sách trao đổi liên lạc
      const workingNK = localStorage.getItem('working_academic_year') || '2026-2027';
      const resMail = await apiClient.get(`/TuongTac/hop-thu-ca-nhan/${usr}?nienKhoa=${workingNK}`);
      if (Array.isArray(resMail.data)) {
        setMailbox(resMail.data);
      }
    } catch (err: any) {
      message.error("LỰC LƯỢNG GỠ LỖI - Có lỗi ngầm phá hủy dữ liệu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Nạp dữ liệu Giáo viên
  const loadTeacherSection = async (maLop: string, usr: string) => {
    setLoading(true);
    try {
      const resKh = await apiClient.get(`/KeHoach/danh-sach-lop/${maLop}`);
      setKeHoachs(resKh.data || []);
    } catch (err: any) {
      message.error("LỖI TẢI KẾ HOẠCH: " + err.message);
    }

    try {
      const workingNK = localStorage.getItem('working_academic_year') || '2026-2027';
      const resBell = await apiClient.get(`/TuongTac/thong-bao-chuong?nienKhoa=${workingNK}`);
      setUnreadCount(Number(resBell.data.soThongBaoChuaDoc || 0));
    } catch (err: any) {
      message.error("LỖI TẢI CHUÔNG: " + err.message);
    }

    try {
      const workingNK = localStorage.getItem('working_academic_year') || '2026-2027';
      const resMail = await apiClient.get(`/TuongTac/hop-thu-giao-vien/${usr}?nienKhoa=${workingNK}`);
      setMailbox(Array.isArray(resMail.data) ? resMail.data : []);
    } catch (error: any) {
    }

    try {
      const resHs = await apiClient.get(`/HocSinh/truy-xuat-ho-so/${maLop}`);
      const students = resHs.data || [];
      const parents = students
        .filter((s: any) => s.taiKhoanPhuHuynh)
        .map((s: any) => ({
           tenDangNhap: s.taiKhoanPhuHuynh,
           tenHocSinh: s.hoTen
        }));
      const uniqueParents = Array.from(new Map(parents.map((item: any) => [item.tenDangNhap, item])).values());
      setParentsOfClass(uniqueParents as any[]);
    } catch (e: any) {
      console.error("LỖI TẢI DANH SÁCH PHỤ HUYNH: " + e.message);
      setParentsOfClass([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = async (val: string) => {
    setSelectedClass(val);
    if (currentUser) {
      if (currentUser.role === 'PhuHuynh') {
        await loadParentSection(val, assocStudentId, currentUser.username);
      } else {
        checkTeacherPermissions(val, classes, currentUser.username);
        await loadTeacherSection(val, currentUser.username);
      }
    }
  };

  // Đăng kế hoạch lớp (Chỉ GVCN / BGH)
  const handlePublishKeHoach = async (values: any) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('maLop', selectedClass);
      formData.append('tieuDe', values.tieuDe);
      formData.append('noiDung', values.noiDung);
      formData.append('loaiThongBao', 'Báo kế hoạch');
      if (currentUser) {
        formData.append('nguoiDang', currentUser.username);
      }
      if (values.attachment && values.attachment.length > 0 && values.attachment[0].originFileObj) {
        formData.append('fileDinhKem', values.attachment[0].originFileObj);
      }

      await apiClient.post('/KeHoach/dang-ke-hoach', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Đã tải và đăng kế hoạch học tập của lớp thành công!');
      keHoachForm.resetFields();
      setAttachedFileName('');
      // Làm mới
      if (currentUser) await loadTeacherSection(selectedClass, currentUser.username);
    } catch (err: any) {
      Modal.error({
        title: '🛡️ Từ chối tạo Kế hoạch (ABAC)',
        content: err.response?.data?.message || 'Chỉ Giáo viên chủ nhiệm lớp mới có quyền đăng kế hoạch học tập.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Phụ huynh/Giáo viên gửi tin nhắn hòm thư tương tác
  const handleSendMessage = async (values: any) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let payloadTenDangNhap = currentUser.username;
      if (currentUser.role === 'GiaoVien' && !isGVCNForSelectedClass) {
        if (!values.taiKhoanNhan) {
           message.warning("Vui lòng chỉ định người nhận (Cá nhân hoặc Toàn thể lớp)!");
           setLoading(false);
           return;
        }

        if (values.taiKhoanNhan === 'ALL_PARENTS') {
           // GỬI ĐỒNG LOẠT CHO TOÀN BỘ PHỤ HUYNH
           const promises = parentsOfClass.map(p => {
             return apiClient.post('/TuongTac/gui-tin-nhan', {
                tenDangNhap: p.tenDangNhap,
                noiDung: values.noiDung,
                nguoiGui: 'GiaoVien'
             });
           });
           await Promise.all(promises);
           message.success(`Đã phát thanh tin nhắn đồng loạt đến ${parentsOfClass.length} phụ huynh của lớp!`);
           tuongTacForm.resetFields();
           await loadTeacherSection(selectedClass, currentUser.username);
           setLoading(false);
           return; // Kết thúc chu trình vì đã gửi xong
        } else {
           // Gửi cho một phụ huynh như cũ
           payloadTenDangNhap = values.taiKhoanNhan;
        }
      }

      let finalNoiDung = values.noiDung;

      if (currentUser.role === 'PhuHuynh' && values.taiKhoanNhan && values.taiKhoanNhan !== 'GVCN_DEFAULT') {
          // Gắn thẻ ngầm định tuyến
          finalNoiDung = `[TO:${values.taiKhoanNhan}] ` + finalNoiDung;
      }

      const payload = {
        tenDangNhap: payloadTenDangNhap,
        noiDung: finalNoiDung,
        nguoiGui: currentUser.role
      };
      
      await apiClient.post('/TuongTac/gui-tin-nhan', payload);
      message.success('Đã gửi tin nhắn thành công!');
      tuongTacForm.resetFields();

      // Làm mới dữ liệu
      if (currentUser.role === 'PhuHuynh') {
        await loadParentSection(selectedClass, assocStudentId, currentUser.username);
      } else {
        await loadTeacherSection(selectedClass, currentUser.username);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể truyền gửi tin nhắn!');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý gửi tin nhắn Phản hồi trực tiếp của GVCN
  const handleQuickReply = async (maHs: string, parentAccount: string) => {
    if (!currentUser) return;
    
    Modal.confirm({
      title: `Nhập phản hồi trao đổi phụ huynh (${parentAccount})`,
      content: (
        <TextArea
          id="quickReplyText"
          placeholder="Nhập nội dung tin nhắn đến phụ huynh..."
          rows={4}
          className="mt-2"
        />
      ),
      okText: 'Gửi đi',
      cancelText: 'Quay lại',
      onOk: async () => {
        const textElement = document.getElementById('quickReplyText') as HTMLTextAreaElement;
        const text = textElement?.value;
        if (!text) {
          message.warning('Vui lòng nhập nội dung!');
          return;
        }

        try {
          const payload = {
            tenDangNhap: parentAccount,
            noiDung: text,
            nguoiGui: currentUser.role
          };
          await apiClient.post('/TuongTac/gui-tin-nhan', payload);
          message.success('Đã gửi phản hồi đến phụ huynh thành công!');
          await loadTeacherSection(selectedClass, currentUser.username);
        } catch (err: any) {
          message.error('Gửi tin thất bại: ' + (err.response?.data?.message || err.message));
        }
      }
    });
  };

  // Xử lý gửi tin nhắn Phản hồi nhanh của Phụ huynh
  const handleParentQuickReply = async (recipientName: string) => {
    if (!currentUser) return;
    
    Modal.confirm({
      title: `Nhập phản hồi nhanh đến thầy/cô`,
      content: (
        <TextArea
          id="parentQuickReplyText"
          placeholder={`Gửi phản hồi trao đổi tiếp theo...`}
          rows={4}
          className="mt-2"
        />
      ),
      okText: 'Gửi Giao tiếp',
      cancelText: 'Thoát',
      onOk: async () => {
        const textElement = document.getElementById('parentQuickReplyText') as HTMLTextAreaElement;
        const text = textElement?.value;
        if (!text) {
          message.warning('Vui lòng nhập nội dung trao đổi!');
          return;
        }

        try {
          const payload = {
            tenDangNhap: currentUser.username, 
            noiDung: text,
            nguoiGui: currentUser.role
          };
          await apiClient.post('/TuongTac/gui-tin-nhan', payload);
          message.success('Đã bắn tin phản hồi thành công!');
          await loadParentSection(selectedClass, assocStudentId, currentUser.username);
        } catch (err: any) {
          message.error('Gửi tin thất bại: ' + (err.response?.data?.message || err.message));
        }
      }
    });
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) return e;
    if (e?.fileList && e.fileList.length > 0) {
      setAttachedFileName(e.fileList[0].name);
    }
    return e?.fileList;
  };

  // --- RENDERING CONFIG ---

  const keHoachColumns = [
    { title: 'Chương trình & Tiêu đề', dataIndex: 'tieuDe', key: 'tieuDe', className: 'font-semibold text-slate-800' },
    { 
      title: 'Nội dung kế hoạch', 
      dataIndex: 'noiDung', 
      key: 'noiDung',
      render: (text: string, record: any) => {
        // Thuật toán quét Hòm thư cá nhân cực kỳ xịn sò do Backend thiết kế:
        const personalMsg = mailbox.find(m => m.maKeHoach === record.maKeHoach && m.noiDung?.startsWith('[Thông báo cá nhân]'));
        const isParentGradeView = currentUser?.role === 'PhuHuynh' && record.loaiThongBao === 'Báo điểm';
        
        return (
          <div>
            {!isParentGradeView && text}
            {isParentGradeView && personalMsg && (
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="font-bold text-emerald-800 flex items-center gap-2 mb-1">
                  <NotificationOutlined /> Kết quả học tập cá nhân truy xuất từ Hòm thư:
                </span>
                <div className="text-emerald-700 font-medium whitespace-normal">
                  {personalMsg.noiDung.replace('[Thông báo cá nhân] - ', '')}
                </div>
              </div>
            )}
          </div>
        );
      }
    },
    { 
      title: 'Tài liệu đính kèm', 
      dataIndex: 'fileDinhKem', 
      key: 'fileDinhKem',
      render: (file: string) => {
        const baseUrl = apiClient.defaults.baseURL?.replace('/api', '') || 'http://localhost:5076';
        return file ? (
          <a href={`${baseUrl}${file}`} target="_blank" rel="noopener noreferrer">
            <Tag color="volcano" icon={<FilePdfOutlined />} className="cursor-pointer font-bold transition-all hover:scale-105">
              {file.split('/').pop()}
            </Tag>
          </a>
        ) : <Text type="secondary">-</Text>;
      }
    },
    { 
      title: 'Ngày Đăng', 
      dataIndex: 'ngayTao', 
      key: 'ngayTao',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : 'Hôm nay' 
    }
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={3} className="m-0 text-slate-800">Cổng Thông Tin Kế Hoạch & Trao Đổi Liên Lạc</Title>
          <Paragraph className="text-slate-500 text-xs">Module 3: Số hóa học viện, tương tác song phương trực tiếp Zalo & Web Portal.</Paragraph>
        </div>

        <Space>
          {currentUser?.role === 'PhuHuynh' ? (
            <div>
              <Text className="text-slate-600 font-bold text-xs mr-2">Học sinh liên hợp:</Text>
              <Input
                value={assocStudentId}
                onChange={(e) => setAssocStudentId(e.target.value)}
                style={{ width: 110 }}
                placeholder="Mã Học Sinh"
                className="font-bold text-slate-800 text-center"
              />
              <Button 
                type="primary" 
                size="small" 
                onClick={() => loadParentSection(selectedClass, assocStudentId, currentUser?.username || '')} 
                className="ml-2"
              >
                Đồng bộ
              </Button>
            </div>
          ) : (
            <div>
              {(currentUser?.role === 'HieuTruong' || (currentUser?.role === 'GiaoVien' && classes.length > 1)) ? (
                <>
                  <Text className="text-slate-600 font-bold text-xs mr-2">Chọn lớp học quản lý:</Text>
                  <Select
                    value={selectedClass}
                    onChange={handleClassChange}
                    style={{ width: 170 }}
                    options={classes.map(c => ({ value: c.maLop, label: `Lớp ${c.tenLop} ${((c as any).nienKhoa ? `(${(c as any).nienKhoa})` : '')}` }))}
                    className="font-bold"
                  />
                </>
              ) : (
                currentUser?.role === 'GiaoVien' && classes.length === 1 && (
                  <Text className="text-slate-600 font-bold text-xs">
                    Lớp đang dạy: <b className="text-indigo-600">Lớp {classes[0].tenLop}</b>
                  </Text>
                )
              )}
            </div>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* CỘT TRÁI: KHỞI TẠO KẾ HOẠCH LỚP (CHỈ GIÁO VIÊN) */}
        {currentUser?.role === 'GiaoVien' && (
          <Col xs={24} md={9}>
            <div className="flex flex-col gap-6">
              {/* THƯỢNG TẦNG: ĐĂNG KẾ HOẠCH LỚP (GIÁO VIÊN) */}
              <Card 
                title={<span className="text-slate-800 font-bold text-sm"><PushpinOutlined /> Phát Hành Kế Hoạch Tuần Lớp</span>} 
                className="shadow-sm border border-slate-200 rounded-2xl"
              >
                  <Form form={keHoachForm} layout="vertical" onFinish={handlePublishKeHoach}>
                    <Form.Item name="tieuDe" label="Tiêu đề Kế hoạch học tập" rules={[{ required: true, message: 'Nhập tiêu đề!' }]}>
                      <Input placeholder="Vd: Kế hoạch tuần 32 - Hoạt động Trải nghiệm Lớp" />
                    </Form.Item>

                    <Form.Item name="noiDung" label="Nội dung truyền đạt cụ thể" rules={[{ required: true, message: 'Nhập nội dung!' }]}>
                      <TextArea placeholder="Nội dung chi tiết từng buổi học hoặc thông báo..." rows={4} />
                    </Form.Item>

                    <Form.Item name="attachment" label="Tài liệu chuyên đề đính kèm (.pdf, .docx)" valuePropName="fileList" getValueFromEvent={normFile}>
                      <Upload beforeUpload={() => false} maxCount={1} showUploadList>
                        <Button block icon={<FilePdfOutlined />}>Tải tệp tin</Button>
                      </Upload>
                    </Form.Item>

                    <Form.Item className="mb-0 flex justify-end">
                      <Button type="primary" htmlType="submit" icon={<SendOutlined />} className="bg-indigo-600 border-indigo-600">
                        Ghi nhận Kế Hoạch
                      </Button>
                    </Form.Item>
                  </Form>
              </Card>
              {/* ĐÃ CHUYỂN CHAT TƯƠNG TÁC SANG MODULE 4 THEO BLUEPRINT */}
            </div>
          </Col>
        )}

        {/* CỘT PHẢI: BẢNG DỮ LIỆU KẾ HOẠCH */}
        <Col xs={24} md={(currentUser?.role === 'GiaoVien') ? 15 : 24}>
          <div className="flex flex-col gap-6">
            {/* PHẦN 1: BẢNG KẾ HOẠCH LỚP HỌC (HIỂN THỊ VỚI TẤT CẢ) */}
            {(currentUser?.role === 'HieuTruong' || currentUser?.role === 'PhuHuynh' || currentUser?.role === 'GiaoVien') && (
              <Card
                title={<span className="text-slate-800 font-bold text-sm">{currentUser?.role === 'HieuTruong' ? 'THANH TRA QUẢN TRỊ: NỘI DUNG KẾ HOẠCH LỚP' : 'Chương Trình & Kế Hoạch Lớp'}</span>}
                className="shadow-sm border border-slate-205 rounded-2xl mb-6"
                styles={{ body: { padding: '0px' } }}
              >
                <Spin spinning={loading}>
                  <Table
                    dataSource={keHoachs}
                    columns={keHoachColumns}
                    rowKey={(r) => r.maKeHoach ? String(r.maKeHoach) : Math.random().toString()}
                    pagination={false}
                    locale={{ emptyText: <Empty description="Hiện lớp chưa nhận được kế hoạch học vụ nào." /> }}
                    className="rounded-2xl overflow-hidden"
                  />
                </Spin>
              </Card>
            )}

            {/* ĐÃ CHUYỂN HÒM THƯ SANG MODULE 4 THEO BLUEPRINT */}
          </div>
        </Col>
      </Row>
    </div>
  );
}
