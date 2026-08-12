'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, List, Tag, Badge, Avatar, Row, Col, Typography, Space, Alert, Tooltip, message, Modal, Spin, Form, Select } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, BellOutlined, ExclamationCircleOutlined, InfoCircleOutlined, BookOutlined } from '@ant-design/icons';
import apiClient from '../../../services/apiClient';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  maTuongTac?: number;
  tenDangNhap: string;
  noiDung: string;
  trangThai: string; // "AI đã trả lời", "Chờ GV xử lý", "Giáo viên trả lời", "Hệ thống trả lời"
  thoiGian?: string;
  maKeHoach?: number;
}

export default function AIAssistantPage() {
  const [role, setRole] = useState<string>('GiaoVien');
  const [currentUser, setCurrentUser] = useState<string>('GVCN1A');
  const [loading, setLoading] = useState<boolean>(true);

  // States dữ liệu
  const [mailbox, setMailbox] = useState<ChatMessage[]>([]);
  const [unreadAlarms, setUnreadAlarms] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [teachers, setTeachers] = useState<{ tenDangNhap: string; hoTen: string; chucVu: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>('2026-2027');
  const [workingNK, setWorkingNK] = useState<string>('2026-2027');
  const isLockedByYear = workingNK !== activeAcademicYear && workingNK !== '';

  // Form trả lời của Giáo viên
  const [replyText, setReplyText] = useState('');
  const [selectedAlarm, setSelectedAlarm] = useState<ChatMessage | null>(null);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

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
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // 0. Quét dọn bộ nhớ chống tràn State (State Leakage Fix)
    setMailbox([]);
    setUnreadAlarms([]);

    const currentNK = localStorage.getItem('working_academic_year') || '2026-2027';
    setWorkingNK(currentNK);

    apiClient.get('/QuanLyTruong/nien-khoa-hien-tai')
      .then(res => {
        if (res.data?.activeAcademicYear) {
          setActiveAcademicYear(res.data.activeAcademicYear);
        }
      })
      .catch(e => console.error("Lỗi lấy niên khóa hiện hành:", e));

    // 1. Cố gắng lấy Role từ hệ thống mô phỏng của MainLayout trước
    const savedRole = localStorage.getItem('user_role');
    const savedUsername = localStorage.getItem('user_username');
    
    let userRole = savedRole || 'GiaoVien';
    let username = savedUsername || 'GVCN1A';

    // 2. Chấm bù nếu có Token thật
    const token = localStorage.getItem('token');
    if (token && !savedRole) {
      const decoded = parseJwt(token);
      if (decoded) {
        username = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || decoded.sub || username;
        userRole = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"] || 
                   decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || 
                   decoded.role || 
                   userRole;
      }
    }
    
    setRole(userRole);
    setCurrentUser(username);

    const init = async () => {
      await refreshMailbox(userRole, username);
      if (userRole === 'PhuHuynh') {
        try {
          const tRes = await apiClient.get('/LopHoc/danh-sach-giao-vien/my_class');
          setTeachers(tRes.data || []);
          const gvcn = tRes.data?.find((t: any) => t.chucVu.includes("Chủ nhiệm"));
          if (gvcn) {
            setSelectedTeacher(gvcn.tenDangNhap);
          } else if (tRes.data?.length > 0) {
            setSelectedTeacher(tRes.data[0].tenDangNhap);
          }
        } catch (err) {
          console.error("Lỗi tải danh sách giáo viên:", err);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const refreshMailbox = async (overrideRole?: string, overrideUser?: string) => {
    const activeRole = overrideRole || role;
    const activeUser = overrideUser || currentUser;
    const workingNK = localStorage.getItem('working_academic_year') || '2026-2027';

    try {
      if (activeRole === 'PhuHuynh') {
        // Phụ huynh: Lấy hộp thư cá nhân của mình
        const res = await apiClient.get(`/TuongTac/hop-thu-ca-nhan/${activeUser}?nienKhoa=${workingNK}`);
        if (Array.isArray(res.data)) {
          setMailbox(res.data.reverse()); // Đảo thứ tự để hiển thị dòng chat từ trên xuống dưới
        } else {
          setMailbox([]); // XÓA STATE CŨ NẾU API TRẢ VỀ ĐỐI TƯỢNG RỖNG (TRÁNH LỘ LỌT TIN NHẮN TỪ ROLE TRƯỚC)
        }
      } else {
        // Giáo viên: Lấy danh sách hộp thư liên lạc bằng endpoint chuẩn
        const res = await apiClient.get(`/TuongTac/hop-thu-giao-vien/${activeUser}?nienKhoa=${workingNK}`);
        if (Array.isArray(res.data)) {
          setMailbox(res.data);
          
          // Lọc ra các thắc mắc phức tạp đang "Chờ GV xử lý" để đẩy về cảnh báo chuông GVCN
          const alarms = res.data.filter((item: ChatMessage) => item.trangThai === 'Chờ GV xử lý');
          setUnreadAlarms(alarms);
        } else {
          setMailbox([]);
          setUnreadAlarms([]);
        }
      }
    } catch (err: any) {
      console.error('Không thể nạp dữ liệu hộp thư:', err);
      setMailbox([]); // BẮT BUỘC DỌN SẠCH CHAT NẾU LỖI 404/400
    }
  };

  // Phụ huynh gõ chat và gửi trực tiếp đi
  const handleSendTextMessage = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      if (role === 'PhuHuynh') {
        // Phụ huynh: chuyển tiếp webhook "gui-phan-hoi" để AI phân tích trực tiếp ngay lập tức
        const res = await apiClient.post('/TuongTac/gui-phan-hoi', {
          tenDangNhap: currentUser,
          noiDung: text,
          trangThai: 'Chưa xem',
          maGiaoVien: selectedTeacher
        });
        
        message.success(res.data.message || 'Tin nhắn của bạn đã được gửi!');
      }
      
      setInputVal('');
      await refreshMailbox();
    } catch (err: any) {
      console.error('Lỗi chi tiết gửi tin AI:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.title || err.message || 'Có lỗi xảy ra khi truyền tin!';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Giáo viên nhấn nút "Can thiệp xử lý" tin nhắn chờ duyệt
  const handleOpenReplyModal = (alarm: ChatMessage) => {
    const isBghReminder = alarm.noiDung && (
      alarm.noiDung.toUpperCase().includes('BGH') || 
      alarm.noiDung.toUpperCase().includes('ĐÔN ĐỐC') ||
      alarm.noiDung.toUpperCase().includes('DON DOC')
    );
    if (isBghReminder) {
      // Điều hướng thẳng sang Module 3: Kế hoạch & Thông báo
      window.location.href = '/modules/planning-notifications';
      return;
    }
    setSelectedAlarm(alarm);
    setReplyText('');
    setIsReplyModalOpen(true);
  };

  const handleSubmitReply = async () => {
    if (!selectedAlarm || !selectedAlarm.maTuongTac) return;
    if (!replyText.trim()) {
      message.warning('Vui lòng điền nội dung câu trả lời!');
      return;
    }

    setLoading(true);
    try {
      // Gọi API trả lời thắc mắc của phụ huynh
      const res = await apiClient.post('/TuongTac/giao-vien-tra-loi', {
        maTuongTacGoc: selectedAlarm.maTuongTac,
        noiDungTraLoi: replyText
      });

      message.success(res.data.message || 'Đã gửi phản hồi chính thức cho phụ huynh. Chuông báo đã ẩn!');
      setIsReplyModalOpen(false);
      await refreshMailbox();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gặp sự cố giải quyết báo động!');
    } finally {
      setLoading(false);
    }
  };

  // Nạp kịch bản giả lập phụ huynh nhắn tin phản hồi
  const handleInjectScenario = async (noiDung: string) => {
    setLoading(true);
    try {
      // 1. Gọi trực tiếp API phản hồi để mô phỏng Zalo/App phụ huynh bắn data lên Backend C#
      const res = await apiClient.post('/TuongTac/gui-phan-hoi', {
        tenDangNhap: role === 'PhuHuynh' ? currentUser : 'PH_HS01', // Nếu vai trò giả lập không hợp lệ, dùng tk phụ huynh mẫu
        noiDung: noiDung,
        trangThai: 'Chưa xem'
      });

      Modal.info({
        title: '🤖 Phản hồi của Trình phân tích AI C#',
        content: (
          <div className="mt-2 text-xs">
            <p className="font-bold text-emerald-700">Trạng thái ghi nhận trong DB: {res.data.trangThai}</p>
            <p className="font-semibold text-slate-800 mt-2">Trợ lý ảo đối thoại:</p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 max-h-[150px] overflow-y-auto italic">
              {res.data.noiDungPhanHoi || 'AI không tự phản hồi mà chuyển tiếp trực tiếp cảnh báo về GVCN.'}
            </div>
          </div>
        )
      });

      await refreshMailbox();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi mô phỏng kịch bản!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={3} className="m-0 text-slate-800">Tương tác Phản hồi & Trợ lý ảo AI</Title>
          <Paragraph className="text-slate-500 text-xs">Module 4: Kiểm duyệt kịch bản thông minh, phản ứng trước biến động học vụ lớp.</Paragraph>
        </div>
      </div>

      {isLockedByYear && (
        <Alert
          title="Năm Học Đã Khóa Sổ (Archived)"
          description="Dữ liệu tương tác và phản hồi của năm học cũ đã được niêm phong vĩnh viễn. Mọi chức năng trả lời và can thiệp đã bị khóa để đảm bảo tính toàn vẹn dữ liệu."
          type="warning"
          showIcon
          className="mb-6 rounded-2xl"
        />
      )}

      {role !== 'PhuHuynh' && !isLockedByYear && unreadAlarms.length > 0 && (
        <Alert
          title={
            <Space>
              <BellOutlined className="animate-bounce text-red-500 text-lg" />
              <b className="text-red-700">Bộ phận giáo vụ AI: Phát hiện có {unreadAlarms.length} khiếu nại báo động đỏ đang chờ GVCN xử lý!</b>
            </Space>
          }
          type="warning"
          showIcon={false}
          className="mb-6 rounded-2xl border-rose-200 bg-rose-50/50"
        />
      )}

      <Alert
        title="Trình diễn Cơ chế AI Gác Cổng (Thông tư 27 & Xác nhận Sự kiện)"
        description="Khi phụ huynh gửi tin nhắn (Zalo/Web Portal), hệ thống AI của C# Backend tự động quét nội dung. Nếu liên quan đến giải thích xếp loại (T/H/C) theo Thông tư 27 hoặc đồng ý kế hoạch dã ngoại, AI sẽ lập tức trả lời đối chứng pháp lý tự động. Những thắc mắc mang tính chất khiếu nại chi phí hoặc phức tạp khác sẽ được đẩy về trạng thái 'Chờ GV xử lý' để rung chuông cảnh báo GVCN vào can thiệp."
        type="info"
        showIcon
        className="mb-6 rounded-2xl"
      />

      <Row gutter={[16, 16]}>
        {/* KHUNG TRÁI: KHUNG ĐỐI THOẠI CHAT (Chỉ dành cho Phụ huynh) */}
        {role === 'PhuHuynh' && (
        <Col xs={24} md={24}>
          <Card 
            title={
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  <RobotOutlined className="text-emerald-500" />
                  <span>Kênh nhắn tin trực tiếp với Trợ lý học vụ AI</span>
                </span>
                <Tag color="cyan">Gemini Core Active</Tag>
              </div>
            }
            className="shadow-sm border border-slate-200 flex flex-col rounded-2xl"
            styles={{ body: { padding: '0px', display: 'flex', flexDirection: 'column', height: '520px' } }}
          >
            {/* Vùng chat */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 flex flex-col gap-4" style={{ height: '430px', overflowY: 'auto' }}>
              {(() => {
                const filteredMailbox = mailbox.filter(msg => {
                  if (!selectedTeacher) return true;
                  const rawContent = msg.noiDung || '';
                  const matchesSelectedTeacher = 
                    rawContent.includes(`[TO:${selectedTeacher}]`) || 
                    rawContent.includes(`[FROM:${selectedTeacher}]`);
                  
                  const selectedTeacherObj = teachers.find(t => t.tenDangNhap === selectedTeacher);
                  const isSelectedGVCN = selectedTeacherObj?.chucVu?.includes("Chủ nhiệm");

                  if (isSelectedGVCN) {
                    const isMessageForAnotherTeacher = teachers.some(t => 
                      t.tenDangNhap !== selectedTeacher && 
                      (rawContent.includes(`[TO:${t.tenDangNhap}]`) || rawContent.includes(`[FROM:${t.tenDangNhap}]`))
                    );
                    return matchesSelectedTeacher || !isMessageForAnotherTeacher;
                  } else {
                    return matchesSelectedTeacher;
                  }
                });

                if (filteredMailbox.length === 0) {
                  return (
                    <div className="text-center p-12 text-slate-400">
                      <InfoCircleOutlined className="text-2xl mb-2" />
                      <p>Hộp thoại rỗng. Hãy gửi câu hỏi đầu tiên của bạn.</p>
                    </div>
                  );
                }

                return filteredMailbox.map((msg, index) => {
                  const rawContent = msg.noiDung || '';
                  const rawTrangThai = msg.trangThai || '';
                  
                  // Xác định xem tin nhắn là của Ai (Giáo viên / Hệ thống AI / Phụ huynh)
                  const isAI = rawTrangThai === 'AI đã trả lời' || rawTrangThai === 'Hệ thống trả lời' || rawContent.startsWith('Trợ lý ảo');
                  const isTeacherOrSystem = rawContent.startsWith('[FROM:') || rawContent.startsWith('[Thông báo') || 
                                            rawContent.startsWith('Giáo viên') || isAI || 
                                            rawTrangThai === 'Giáo viên trả lời';
                  
                  let isMe = false;
                  if (role === 'PhuHuynh') {
                      isMe = !isTeacherOrSystem; // PH là Me nếu KHÔNG phải GV/Hệ thống
                  } else {
                      // Với GV, họ là Me nếu là GV/Hệ thống
                      isMe = isTeacherOrSystem; 
                  }

                  // Trích xuất Tên Người Gửi
                  let senderName = msg.tenDangNhap || 'Phụ huynh';
                  if (isAI) senderName = '🤖 Trợ lý AI Hệ thống';
                  else if (rawContent.startsWith('Giáo viên chủ nhiệm:') || rawContent.startsWith('Giáo viên:')) senderName = '👩‍🏫 Giáo viên';
                  else if (rawContent.startsWith('[Thông báo')) senderName = '🏫 Hệ thống Trường';
                  else if (rawContent.startsWith('[FROM:')) {
                    const match = rawContent.match(/\[FROM:(.*?)\]/);
                    senderName = match ? `Giáo viên (${match[1]})` : 'Giáo viên';
                  }

                  // Cắt bỏ tiền tố trong lời nhắn
                  let displayNoiDung = rawContent;
                  displayNoiDung = displayNoiDung.replace(/\[(?:FROM|TO|LOP):.*?\]\s*/g, '');
                  
                  if (displayNoiDung.startsWith('Giáo viên chủ nhiệm:')) displayNoiDung = displayNoiDung.replace(/^Giáo viên chủ nhiệm:\s*/, '');
                  else if (displayNoiDung.startsWith('Giáo viên:')) displayNoiDung = displayNoiDung.replace(/^Giáo viên:\s*/, '');
                  else if (displayNoiDung.startsWith('Trợ lý ảo:')) displayNoiDung = displayNoiDung.replace(/^Trợ lý ảo:\s*/, '');

                  // Parse [Tài Liệu Mở Rộng: /path/to/file] thành nút bấm tải file
                  const baseHost = apiClient.defaults.baseURL?.replace('/api', '') || 'http://localhost:5076';
                  let parsedHtmlContent = displayNoiDung.replace(/\n/g, '<br/>');
                  parsedHtmlContent = parsedHtmlContent.replace(
                    /\[Tài Liệu Mở Rộng:\s*([^[\]]+)\]/g,
                    `<a href="${baseHost}$1" target="_blank" class="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[11px] font-semibold transition-colors no-underline">
                       <svg viewBox="64 64 896 896" focusable="false" data-icon="download" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"></path></svg>
                       Tải tài liệu đính kèm TT27
                     </a>`
                  );

                  return (
                    <div 
                      key={msg.maTuongTac || index} 
                      className={`flex gap-3 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
                    >
                      <Avatar 
                        icon={isAI ? <RobotOutlined /> : <UserOutlined />} 
                        className={isAI ? 'bg-emerald-500 text-white' : isTeacherOrSystem ? 'bg-indigo-600 text-white' : 'bg-orange-500 text-white'} 
                      />
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`text-[10px] text-gray-500 mb-1`}>
                          <span className="font-bold text-slate-700">{senderName}</span> • {msg.trangThai}
                        </div>
                        <div className={`p-3 rounded-2xl shadow-sm leading-relaxed text-xs inline-block ${
                          isAI 
                            ? 'bg-emerald-50 text-emerald-800 rounded-tl-none border border-emerald-100'
                            : isMe
                              ? 'bg-indigo-60 text-indigo-900 rounded-tr-none'
                              : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                        }`}>
                          <div dangerouslySetInnerHTML={{ __html: parsedHtmlContent }} />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Ô nhập chat */}
            {/* Nút gửi tin nhắn (Chỉ Áp Dụng Cho Phụ Huynh Để Ngăn GV Gửi Tin Vô Định Hướng) */}
            {role === 'PhuHuynh' && (
            <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 w-full relative">
              {teachers.length > 0 && (
                <div style={{ marginBottom: '12px' }} className="flex items-center gap-2">
                  <Text type="secondary" style={{ fontSize: '11px', fontWeight: 'bold' }}>Gửi câu hỏi tới:</Text>
                  <Select
                    value={selectedTeacher}
                    onChange={val => setSelectedTeacher(val)}
                    style={{ width: 280 }}
                    size="small"
                    options={teachers.map(t => ({
                      value: t.tenDangNhap,
                      label: `${t.hoTen} (${t.chucVu})`
                    }))}
                  />
                </div>
              )}
              <Space.Compact className="w-full">
                  <Input 
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onPressEnter={() => handleSendTextMessage(inputVal)}
                    placeholder={isLockedByYear ? "Năm học đã khóa sổ. Không thể trao đổi." : "Mời Quý phụ huynh nhập nội dung trao đổi trực tiếp với Trợ lý AI..."} 
                    className="py-2"
                    disabled={loading || isLockedByYear}
                    allowClear
                  />
                  <Button 
                    type="primary" 
                    className="bg-emerald-600 h-auto px-6 font-semibold"
                    icon={<SendOutlined />}
                    onClick={() => handleSendTextMessage(inputVal)}
                    loading={loading}
                    disabled={isLockedByYear}
                  >
                    Gửi tin
                  </Button>
              </Space.Compact>
            </div>
            )}
          </Card>
        </Col>
        )}
        {/* KHUNG PHẢI: PHÒNG CẢNH BÁO GVCN (Dành riêng cho Giáo viên) */}
        {role !== 'PhuHuynh' && (
        <Col xs={24} md={24}>
          <div className="flex flex-col gap-6">
              <Card 
                title={
                  <div className="flex items-center justify-between w-full">
                    <span className="text-slate-800 font-bold text-xs flex items-center gap-1">
                      <BellOutlined className="text-red-500" /> Bảng Cảnh Báo GVCN
                    </span>
                    <Badge count={isLockedByYear ? 0 : unreadAlarms.length} />
                  </div>
                }
                className="shadow-sm border border-slate-200 rounded-2xl"
                styles={{ body: { padding: '8px' } }}
              >
                {isLockedByYear || unreadAlarms.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-[11px]">
                    {isLockedByYear 
                      ? "Năm học đã khóa sổ (Archived). Toàn bộ cảnh báo đã được lưu trữ." 
                      : "Không có cảnh báo khẩn nào. AI đã xử lý tự động toàn bộ tin nhắn."}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {unreadAlarms.map((item, i) => (
                      <div key={item.maTuongTac || i} className="p-3 border border-red-100 bg-red-50/20 rounded-xl mb-2 flex flex-col items-start gap-1">
                        <div className="flex items-center justify-between w-full text-[10px]">
                          <span className="font-bold text-red-600 flex items-center gap-1">
                            <ExclamationCircleOutlined /> Phản hồi cần GVCN xử lý
                          </span>
                          <span className="text-slate-400">{item.tenDangNhap}</span>
                        </div>
                        <div className="text-[11px] text-slate-700 italic font-medium">"{item.noiDung}"</div>
                        <Button 
                          type="primary" 
                          size="small" 
                          className="bg-red-500 text-[10px] h-6 font-semibold mt-1" 
                          onClick={() => handleOpenReplyModal(item)}
                          disabled={isLockedByYear}
                        >
                          Giáo viên can thiệp
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
          </div>
        </Col>
        )}
      </Row>

      {/* Modal Giáo viên nhập phản hồi */}
      <Modal
        title="GVCN Trả Lời Liên Lạc Phụ Huynh Mức Độ Cảnh Báo"
        open={isReplyModalOpen}
        onCancel={() => setIsReplyModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {selectedAlarm && (
          <div>
            <div className="mb-4 p-3 bg-red-50/30 border border-red-100 rounded-lg text-xs">
              <p className="font-bold text-red-600">Ý kiến phụ huynh {selectedAlarm.tenDangNhap}:</p>
              <p className="italic text-slate-700">"{selectedAlarm.noiDung}"</p>
            </div>

            <Form layout="vertical" onFinish={handleSubmitReply}>
              <Form.Item label="Nhập nội dung phản hồi chính thức">
                <TextArea
                  placeholder="Nhập câu trả lời chính thức để giải đáp thắc mắc và gửi tin nhắn trực tiếp đến phụ huynh..."
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </Form.Item>

              <Form.Item className="mb-0 flex justify-end">
                <Space>
                  <Button onClick={() => setIsReplyModalOpen(false)}>Quay lại</Button>
                  <Button type="primary" htmlType="submit" className="bg-indigo-600 border-indigo-600">
                    Phản Hồi & Trừ Cảnh Báo
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
