# UI Baseline V1 (Perfect Snapshot)

วันที่ล็อกเวอร์ชัน: 6 เมษายน 2026  
โปรเจกต์: `D:\Office_Supplies_Request_System`  
ขอบเขต: โหมดผู้ใช้ + โหมดแอดมิน (ธีม, ฟอร์ม, ตารางติดตาม, ประวัติ, quick select, modal)

## เป้าหมายของไฟล์นี้
- ใช้เป็น baseline อ้างอิงเมื่อมีการแก้ UI/UX แล้วเกิด regression
- ใช้เทียบพฤติกรรมสำคัญที่ตกลงว่า "ใช้งานดีแล้ว"
- ใช้เป็นคู่มือกู้หน้าจอให้กลับสภาพ V1

## Baseline Contract (ต้องคงไว้)
1. User Form
- การ์ดรายการวัสดุไม่ใหญ่เกินไป
- ปุ่มเพิ่มรายการอยู่ล่าง ใกล้ปุ่มส่งคำสั่ง
- ปุ่มลบรายการเป็น `x` ขนาดเล็กประหยัดพื้นที่
- toggle priority จัดวางสวย อ่านง่าย

2. Quick Select
- รูปสินค้าเป็นสัดส่วนสี่เหลี่ยมจัตุรัส (square)
- ความสูงพาเนล quick select ไม่ล้นหน้า
- มี scroll ย่อยใน quick select
- ถ้าเพิ่ม item จาก quick select แล้ว ต้องไม่กดซ้ำรายการเดิมได้
- ถ้าลบ item จากฟอร์ม รายการนั้นต้องกลับมาใน quick select

3. Main Scroll Behavior
- โครงสร้างหน้า form ให้รายการวัสดุ (`itemsContainer`) เป็นแกน scroll หลักของงานกรอก
- quick select มี scroll ภายในของตัวเอง ไม่แย่ง scroll หลัก

4. Admin Mode
- โทนสีต่างจาก user ชัดเจน (blue/steel tone)
- สลับโหมดมี toast แจ้งว่าอยู่มุมมองผู้ใช้/Admin
- กล่องรายการงานที่ต้องทำแสดงได้ครบ (ไม่โดนตัด)
- แถว `จำนวน/PRIORITY` ต้องอยู่แถวเดียวกันและ top-align
- ปุ่ม priority ในแถวงานไม่มี icon

5. Tracking + Detail Table
- หัวตารางในส่วนรายละเอียดมองเห็นชัด (ตัวอักษรสีขาว)
- มีเส้น grid ชัดเจนในตาราง

6. File Preview Modal
- คลิกนอก popup เพื่อปิดได้
- ไม่ใช้ปุ่ม `x` ซ้ำซ้อนด้านบน

7. History
- หน้า "ประวัติ" ต้องไม่ค้างที่ "กำลังโหลดข้อมูลประวัติ..."
- ต้อง render ตารางได้จริง และ filter/search ใช้งานได้

## Source Map (จุดอ้างอิงหลัก)
### CSS
- `docs/style.css:727`  
  `.data-table td > div:not(.table-actions):not(.admin-priority-row)`  
  (กันไม่ให้ rule global บังคับ admin priority row ให้ซ้อนแนวตั้ง)

- `docs/style.css:1404`  
  โทนสี admin theme แยกจาก user

- `docs/style.css:1832` และ `docs/style.css:1849`  
  สีหัวตาราง detail + grid table (user/admin)

- `docs/style.css:1923` และ `docs/style.css:1944`  
  quick select layout + image square

- `docs/style.css:2224` ถึง `docs/style.css:2256`  
  โครง scroll ภายใน form (`form-card-body`, `itemsContainer`, `quick-select-grid`)

- `docs/style.css:2316`  
  style ของ mode toast

- `docs/style.css:1532` ถึง `docs/style.css:1558`  
  ล็อกแถว `admin-priority-row` ให้เป็นแนวนอนและ top-align

### JS
- `docs/script.js:68` ถึง `docs/script.js:163`  
  quick select key + ป้องกันเพิ่มซ้ำ

- `docs/script.js:463` ถึง `docs/script.js:474`  
  ลบรายการจากฟอร์มแล้ว refresh quick select

- `docs/script.js:529` ถึง `docs/script.js:548`  
  toast แจ้งโหมดผู้ใช้/Admin

- `docs/script.js:943` ถึง `docs/script.js:951`  
  markup admin priority cell (row เดียว)

- `docs/script.js:1357` ถึง `docs/script.js:1520`  
  history rendering/filtering (แก้อาการโหลดค้าง)

- `docs/script.js:1549` ถึง `docs/script.js:1601`  
  open/close image modal

- `docs/script.js:2520` ถึง `docs/script.js:2522`  
  click backdrop เพื่อปิด modal

- `docs/script.js:2252` ถึง `docs/script.js:2257`  
  toggle admin mode + toast

## Snippet กู้เร็ว (ถ้าหาย/โดนทับ)
```css
.data-table td > div:not(.table-actions):not(.admin-priority-row) {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.admin-priority-row,
.data-table td > div.admin-priority-row {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    gap: 6px;
    flex-wrap: nowrap !important;
    white-space: nowrap;
}
```

```js
imageModal?.addEventListener('click', (e) => {
    if (e.target === imageModal) closeImageModal();
});
```

## Regression Checklist ก่อนส่งงาน
- [ ] Admin `จำนวน/PRIORITY` เป็นแถวเดียว (ไม่ stack)
- [ ] Quick select มี scroll และรูป square
- [ ] เพิ่มจาก quick select ซ้ำไม่ได้
- [ ] ลบจากฟอร์มแล้ว item กลับเข้า quick select
- [ ] Modal ดูไฟล์คลิกนอกกรอบเพื่อปิดได้
- [ ] History แสดงข้อมูลจริง ไม่ค้างโหลด
- [ ] Tracking/detail table อ่านหัวตารางได้ชัด + มีเส้น grid
- [ ] สลับ user/admin มี toast แจ้งสถานะโหมด

## หมายเหตุการใช้งาน
- ให้ถือไฟล์นี้เป็น baseline ฝั่ง UI/UX สำหรับรอบถัดไป
- หากต้องปรับดีไซน์ครั้งใหญ่ แนะนำสร้างไฟล์ใหม่ เช่น `UI_PERFECT_V2.md` แทนการทับ V1
