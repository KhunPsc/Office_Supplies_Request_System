# 🔍 Code Review — ระบบแจ้งคำขอซื้อวัสดุสำนักงาน

> รีวิวจากไฟล์ทั้งหมด: `index.html`, `script.js`, `style.css`, `config.js`, `Code.gs`

---

## 🔴 Priority 1: Bugs / ความเสี่ยงที่ควรแก้ทันที

### 1. `setLoading()` ทำให้ข้อความปุ่ม Submit ผิดเมื่ออยู่ใน Edit Mode
- **ไฟล์:** [script.js](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/frontend/script.js#L1087-L1098)
- **ปัญหา:** เมื่ออยู่ในโหมดแก้ไขคำขอ (editRequest) ปุ่มจะแสดง "📦 บันทึกการแก้ไข" แต่พอ `setLoading(false)` ทำงาน กลับรีเซตเป็น "ส่งคำขอจัดซื้อ" เสมอ
- **แก้ไข:** ตรวจ `editingRequestId` ก่อนตั้งค่าข้อความ

### 2. Menu Name ไม่เปลี่ยนตาม Admin Mode
- **ไฟล์:** [script.js](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/frontend/script.js#L50-L61)
- **ปัญหา:** เมื่อเปิดโหมดผู้ดูแลระบบ เมนู Sidebar ยังคงแสดง "แบบฟอร์มขอจัดซื้อ" แทนที่จะเป็น "แบบฟอร์มขอจัดซื้อ" → "Admin Workboard" หรือชื่อที่เหมาะสม
- **แก้ไข:** อัปเดตชื่อเมนูเมื่อ toggle admin mode

### 3. HTML Structure ผิดปกติ — `<template>` และ `<script>` อยู่นอก `<div class="page-content">`
- **ไฟล์:** [index.html](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/frontend/index.html#L423-L491)
- **ปัญหา:** `<template>` tag (L423-487) และ `<script>` tags (L489-490) อยู่**หลัง** closing `</div>` ของ app-shell แต่**ก่อน** `</body>` ซึ่ง valid แต่ไม่เป็นระเบียบ ทำให้สับสนว่าอยู่ scope ไหน
- **แก้ไข:** เลื่อน `<template>` ขึ้นไปอยู่ใน form section ที่เกี่ยวข้อง

---

## 🟡 Priority 2: UX Improvements ที่จะทำให้ดีขึ้นมาก

### 4. ไม่มี Loading Indicator ระหว่างสลับแท็บ
- **ปัญหา:** เมื่อกดไปแท็บ "ติดตามสถานะ" หรือ "ประวัติ" จะ fetch ข้อมูลใหม่ทุกครั้ง ผู้ใช้จะเห็นหน้าจอว่างชั่วขณะ
- **แก้ไข:** เพิ่ม skeleton loading หรือ spinner card ที่สวยงามแทนข้อความ "กำลังโหลด..."

### 5. ไม่มี Pagination / Virtual Scroll
- **ปัญหา:** ถ้าข้อมูลเยอะ (เช่น > 100 รายการ) ตาราง Tracking และ History จะ render ทั้งหมดในครั้งเดียว ทำให้หน้าช้า
- **แก้ไข:** เพิ่ม pagination (หน้าละ 20-30 rows) หรือ "Load More" button

### 6. ไม่มี Feedback เมื่อ API Error ในหน้า Admin Home
- **ไฟล์:** [script.js](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/frontend/script.js#L82-L97)
- **ปัญหา:** `renderAdminHomeSummary()` ถ้า fetch ล้มเหลว จะแสดง "ไม่มีงานค้าง" ซึ่งให้ข้อมูลผิด
- **แก้ไข:** แยก error state ออกจาก empty state — แสดงข้อความว่า "ไม่สามารถเชื่อมต่อได้" พร้อมปุ่ม retry

### 7. ช่อง Search ในหน้าประวัติ ไม่มีปุ่มล้างค่า (Clear)
- **แก้ไข:** เพิ่มปุ่ม ✕ เล็กๆ ข้างในช่อง input เพื่อล้างคำค้นหา

### 8. Admin ไม่สามารถแก้ไขจำนวน/หน่วยจากหน้า Worklist ได้ตรงๆ
- **ปัญหา:** ตอนนี้ Admin ต้องเปิด Modal "แก้ไขสถานะ" เพียงเพื่อแก้ตัวเลขจำนวน ควรมีทางลัดที่สะดวกกว่า
- **แก้ไข:** ทำให้ช่องจำนวนในตาราง worklist เป็น inline-editable ได้เลย (double-click to edit)

---

## 🟢 Priority 3: Code Quality & Maintainability

### 9. statusMap ถูกประกาศซ้ำหลายที่
- **ปัญหา:** มี `statusMap` ที่แตกต่างกันอยู่ใน:
  - `renderAdminItemTable()` (L182)
  - `renderTrackingTable()` (L813)
  - `historyStatusMap` (L1537)
- **แก้ไข:** ย้ายออกมาเป็น constant เดียวที่ top-level scope

### 10. HTML Template ยาวเกินไปใน JS
- **ปัญหา:** ฟังก์ชันอย่าง `renderTrackingTable`, `renderAdminHomeSummary` มี HTML string ยาวมาก ทำให้อ่านยากและ debug ลำบาก
- **แก้ไข:** พิจารณาใช้ `<template>` elements ใน HTML แล้ว clone ใน JS (เหมือนที่ทำกับ `itemTemplate`)

### 11. ไม่มี Error Boundary / Global Error Handler
- **ปัญหา:** ถ้า fetch ล้มเหลวขณะอัปเดตหลายรายการ (batch) จะหยุดทันทีและไม่บอกว่ารายการไหนสำเร็จแล้ว
- **แก้ไข:** ใส่ try-catch ต่อรายการ แล้วรายงานสรุปว่า "สำเร็จ X, ล้มเหลว Y รายการ"

### 12. ไฟล์ script.js ยาวเกินไป (~1,700 บรรทัด)
- **แก้ไข:** พิจารณาแบ่งเป็น modules:
  - `auth.js` — Login/logout/role management
  - `admin.js` — Admin workboard, batch modals
  - `tracking.js` — Tracking table rendering
  - `history.js` — History tab
  - `form.js` — Request form logic

---

## 🔒 Priority 4: Security & Robustness (Backend)

### 13. ไม่มี Input Validation ฝั่ง Backend
- **ไฟล์:** [Code.gs](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/backend/Code.gs#L150-L194)
- **ปัญหา:** `handleSubmit` ไม่ validate ว่า itemName, quantity, unit ต้องไม่ว่าง, quantity ต้องเป็นตัวเลข ฯลฯ
- **ความเสี่ยง:** ข้อมูลเสียหายในชีต
- **แก้ไข:** เพิ่ม validation:
```javascript
if (!data.items || data.items.length === 0) throw new Error('ต้องมีรายการอย่างน้อย 1 รายการ');
data.items.forEach(item => {
  if (!item.itemName) throw new Error('ชื่อวัสดุไม่ได้ระบุ');
  if (!item.quantity || isNaN(item.quantity)) throw new Error('จำนวนไม่ถูกต้อง');
});
```

### 14. "ยกเลิก" ต้องมีหมายเหตุ — validate ฝั่ง Backend ด้วย
- **ไฟล์:** [Code.gs](file:///d:/%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/backend/Code.gs#L266-L305)
- **ปัญหา:** ตอนนี้ validate เฉพาะ client-side, คนที่ส่ง POST ตรงๆ สามารถข้ามได้
- **แก้ไข:** เพิ่มเช็คใน `handleUpdateStatus`:
```javascript
if (updateData.status === 'ยกเลิก' && !updateData.note) {
  throw new Error('ต้องระบุหมายเหตุเมื่อยกเลิกรายการ');
}
```

### 15. ไม่มี Role Verification ใน doPost
- **ปัญหา:** ทุกคนสามารถส่ง `updateStatus` POST ได้ ไม่ว่าจะ login เป็น user ธรรมดา
- **แก้ไข:** ส่ง `role` มากับ payload แล้ว validate ฝั่ง backend (หรือดีกว่าคือเช็ค `updatedBy` กับ admin list)

---

## 📊 สรุปภาพรวม

| หมวด | จำนวน | ความเร่งด่วน |
|------|--------|-------------|
| 🔴 Bugs/Risks | 3 | แก้เร็ว, ใช้เวลาน้อย |
| 🟡 UX Improvements | 5 | ปรับเมื่อพร้อม |
| 🟢 Code Quality | 4 | Refactor เมื่อมีเวลา |
| 🔒 Security | 3 | **ควรทำก่อน go-live** |

> [!TIP]
> ระบบโดยรวมทำงานได้ดีแล้ว — สิ่งที่ **แนะนำให้ทำเป็นอันดับแรก** คือแก้ Bug #1 (setLoading) เพราะมีความเสี่ยงว่าผู้ใช้จะสับสน และ Security #13-14 (Backend Validation) เพราะเป็นจุดอ่อนที่ควรปิดก่อนใช้งานจริง
