# Office Supplies Request System (ระบบเบิกวัสดุสำนักงาน)

ระบบสำหรับจัดการการเบิกวัสดุสำนักงาน พัฒนาด้วย Google Apps Script และ HTML/JS

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (Vanilla) อยู่ในโฟลเดอร์ `docs/`
  - ใช้ `docs/config.js` ในการตั้งค่า `APPS_SCRIPT_URL`
  - มีหน้าหลักคือ `index.html` และหน้าอื่นๆ เช่น `green_office.html`, `quickselect_add.html`
- **Backend:** Google Apps Script อยู่ใน `backend/Code.gs`
  - จัดการข้อมูลผ่าน Google Sheets
  - มีระบบตรวจสอบสิทธิ์ Admin (Role_2)

## Key Workflows
- **Admin Check:** ฟังก์ชัน `checkAdminRole(employeeName)` ใน `Code.gs` จะตรวจสอบรหัสพนักงานและ Role จาก Sheet
- **Deployment:** เมื่อมีการอัปเดต Apps Script ต้องนำ URL ใหม่มาอัปเดตที่ `docs/config.js`

## Repository
- **GitHub:** https://github.com/KhunPsc/Office_Supplies_Request_System
- **Branch:** main
