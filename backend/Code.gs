// =====================================================
// วิธีตั้งค่า:
// 1. ไปที่ Project Settings (ไอคอนเกียร์) → Script Properties
// 2. เพิ่ม property 2 ตัว:
//    Key: SHEET_ID   Value: <Sheet ID>
//    (จาก URL: https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit)
//
//    Key: FOLDER_ID  Value: <Drive Folder ID>
//    (จาก URL: https://drive.google.com/drive/folders/<FOLDER_ID>)
// 3. Deploy → New Deployment → Web App
// =====================================================

const SHEET_TAB_NAME = 'Sheet1';

// Admin users who can use updateStatus
const ADMIN_USERS = ['ssa141'];

const DEPT_MAP = {
  '01': 'ผบส.',
  '02': 'ผสน.',
  '03': 'ผบร.',
  '04': 'ผกส.',
  '05': 'ผปบ.',
  '06': 'ผมต.',
  '07': 'กฟส.ดอยหล่อ',
  '08': 'กฟส.แม่แจ่ม'
};

// =====================================================
// Helper: เปิด Sheet จาก Script Properties
// =====================================================
function getSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script Properties');
  
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(SHEET_TAB_NAME);
  
  // ถ้าหา Sheet1 ไม่เจอ ให้เลือก Sheet แรกสุดที่มีในไฟล์ (ป้องกันการสร้างแผ่นว่างใหม่)
  if (!sheet) {
    sheet = ss.getSheets()[0]; 
  }
  return sheet;
}

// =====================================================
// Helper: เปิด Drive folder จาก Script Properties
// =====================================================
function getFolder() {
  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) {
    throw new Error('ยังไม่ได้ตั้งค่า FOLDER_ID ใน Script Properties');
  }
  return DriveApp.getFolderById(folderId);
}

// =====================================================
// Helper: สร้าง Request ID
// =====================================================
function generateRequestId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return 'REQ-' + dateStr + '-' + rand;
}

// =====================================================
// Helper: JSON Response
// =====================================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// doPost — รับข้อมูลจากหน้าเว็บ
// =====================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'submit';

    if (action === 'submit') {
      return handleSubmit(data);
    } else if (action === 'updateRequest') {
      return handleUpdateRequest(data);
    } else if (action === 'updateStatus') {
      // #15: Only admin can update status
      if (!data.updatedBy || ADMIN_USERS.indexOf(data.updatedBy) === -1) {
        return jsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์เปลี่ยนสถานะ: เฉพาะ Admin เท่านั้น' });
      }
      return handleUpdateStatus(data);
    }
    throw new Error('Unknown action: ' + action);
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// =====================================================
// doGet — ดึงข้อมูลสำหรับ Tracking / History
// =====================================================
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || 'tracking'; 
    const deptCode = params.deptCode || '';
    const role = params.role || 'user';

    const sheet = getSheet();
    const allData = sheet.getDataRange().getValues();
    
    // ถ้าไม่มีข้อมูลเลยนอกจาก Header
    if (allData.length <= 1) {
      return jsonResponse({ status: 'success', data: [] });
    }

    const headers = allData[0];
    const deptCodeColIndex = 2; // Column C index
    
    // 1. กรองสิทธิ์เบื้องต้น (ถ้าไม่ใช่ admin ให้กรองแผนก)
    let filteredRows = allData.slice(1);
    if (role !== 'admin' && deptCode) {
      filteredRows = filteredRows.filter(row => {
        const rowDept = String(row[deptCodeColIndex]).trim();
        const userDept = String(deptCode).trim();
        return rowDept === userDept || parseInt(rowDept) === parseInt(userDept);
      });
    }

    // 2. แปลงเป็น Object Array
    let results = filteredRows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h !== undefined && h !== null && h !== '') {
          const key = String(h).trim();
          obj[key] = row[i];
        }
      });
      return obj;
    });

    // 3. กรองตามประเภทหน้า (Tracking / History)
    if (action === 'tracking') {
      results = results.filter(r => {
        const status = String(r['สถานะ'] || '').trim();
        return status !== ''; // Allow all statuses including 'เสร็จสิ้น'
      });
    } else if (action === 'history') {
      results = results.filter(r => String(r['สถานะ'] || '').trim() === 'เสร็จสิ้น');
    }

    return jsonResponse({ status: 'success', data: results });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// =====================================================
// Handle: ส่งคำขอใหม่
// =====================================================
function handleSubmit(data) {
  // #13: Input validation
  if (!data.employeeName || String(data.employeeName).trim() === '') {
    return jsonResponse({ status: 'error', message: 'กรุณาระบุชื่อผู้ขอ' });
  }
  if (!data.department || String(data.department).trim() === '') {
    return jsonResponse({ status: 'error', message: 'กรุณาระบุรหัสแผนก' });
  }
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return jsonResponse({ status: 'error', message: 'ต้องมีรายการวัสดุอย่างน้อย 1 รายการ' });
  }
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item.itemName || String(item.itemName).trim() === '') {
      return jsonResponse({ status: 'error', message: 'รายการที่ ' + (i+1) + ': ไม่ได้ระบุชื่อวัสดุ' });
    }
    if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return jsonResponse({ status: 'error', message: 'รายการที่ ' + (i+1) + ': จำนวนไม่ถูกต้อง' });
    }
    if (!item.unit || String(item.unit).trim() === '') {
      return jsonResponse({ status: 'error', message: 'รายการที่ ' + (i+1) + ': ไม่ได้ระบุหน่วยนับ' });
    }
  }

  const sheet = getSheet();
  const timestamp = new Date();
  const requestId = generateRequestId();
  const deptName = DEPT_MAP[data.department] || data.department;

  let folder = null;
  const rows = [];

  data.items.forEach((item, index) => {
    let fileUrl = '';
    if (item.file && item.file.data) {
      if (!folder) folder = getFolder();
      const decoded = Utilities.base64Decode(item.file.data);
      const blob = Utilities.newBlob(decoded, item.file.mimeType, requestId + '_' + (index + 1) + '_' + item.file.name);
      const driveFile = folder.createFile(blob);
      fileUrl = 'https://drive.google.com/uc?id=' + driveFile.getId();
    }

    rows.push([
      requestId,               // A
      timestamp,               // B
      data.department,         // C
      deptName,                // D
      data.employeeName,       // E
      index + 1,               // F
      item.itemName,           // G
      item.quantity,           // H
      item.unit,               // I
      item.assetCode || '',    // J
      item.remarks || '',      // K
      fileUrl,                 // L
      'รอจัดซื้อ',              // M
      '',                      // N
      '',                      // O
      '',                      // P
      item.priority || 'ปกติ'  // Q
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return jsonResponse({ status: 'success', requestId: requestId });
}

// =====================================================
// Handle: แก้ไขคำขอ (User)
// =====================================================
function handleUpdateRequest(data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const requestId = data.requestId;
  
  if (!requestId) throw new Error('Request ID is required for updating');

  // Find existing rows for this ID to get original timestamp
  let originalTimestamp = new Date();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === requestId) {
      originalTimestamp = allData[i][1];
      break;
    }
  }

  // Delete old rows with this ID (from bottom up)
  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][0] === requestId) {
      sheet.deleteRow(i + 1);
    }
  }

  const deptName = DEPT_MAP[data.department] || data.department;
  let folder = null;
  const rows = [];

  data.items.forEach((item, index) => {
    let fileUrl = '';
    if (item.file && item.file.data) {
      if (!folder) folder = getFolder();
      const decoded = Utilities.base64Decode(item.file.data);
      const blob = Utilities.newBlob(decoded, item.file.mimeType, requestId + '_' + (index + 1) + '_' + item.file.name);
      const driveFile = folder.createFile(blob);
      fileUrl = 'https://drive.google.com/uc?id=' + driveFile.getId();
    }

    rows.push([
      requestId,               // A
      originalTimestamp,       // B (KEEP OLD)
      data.department,         // C
      deptName,                // D
      data.employeeName,       // E
      index + 1,               // F
      item.itemName,           // G
      item.quantity,           // H
      item.unit,               // I
      item.assetCode || '',    // J
      item.remarks || '',      // K
      fileUrl,                 // L
      'รอจัดซื้อ',              // M
      '',                      // N
      '',                      // O
      '',                      // P
      item.priority || 'ปกติ'  // Q
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return jsonResponse({ status: 'success', requestId: requestId });
}

// =====================================================
// Handle: Admin อัปเดตสถานะ
// =====================================================
function handleUpdateStatus(data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const now = new Date();
  let updated = 0;

  const itemMap = {};
  if (data.items) {
    data.items.forEach(it => {
      // #14: Validate cancel must have note
      if (it.status === 'ยกเลิก' && (!it.note || String(it.note).trim() === '')) {
        throw new Error('ต้องระบุหมายเหตุเมื่อยกเลิกรายการ (ลำดับที่ ' + it.index + ')');
      }
      itemMap[String(it.index)] = it;
    });
  }

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.requestId) {
      const itemIndex = String(allData[i][5]); // Column F (ลำดับรายการ)
      const updateData = itemMap[itemIndex];
      
      if (updateData) {
        sheet.getRange(i + 1, 13).setValue(updateData.status);       // M
        sheet.getRange(i + 1, 14).setValue(updateData.note || '');   // N
        sheet.getRange(i + 1, 15).setValue(data.updatedBy || '');    // O
        sheet.getRange(i + 1, 16).setValue(now);                     // P
        // Update qty and unit if provided
        if (updateData.qty !== undefined) {
            sheet.getRange(i + 1, 8).setValue(updateData.qty);       // H
        }
        if (updateData.unit !== undefined) {
            sheet.getRange(i + 1, 9).setValue(updateData.unit);      // I
        }
        if (updateData.priority !== undefined) {
            sheet.getRange(i + 1, 17).setValue(updateData.priority); // Q
        }
        updated++;
      } else if (data.newStatus) {
        // Fallback for old mechanism
        sheet.getRange(i + 1, 13).setValue(data.newStatus);
        sheet.getRange(i + 1, 14).setValue(data.adminNote || '');
        sheet.getRange(i + 1, 15).setValue(data.updatedBy || '');
        sheet.getRange(i + 1, 16).setValue(now);
        updated++;
      }
    }
  }

  return jsonResponse({
    status: 'success',
    message: 'Updated ' + updated + ' rows for ' + data.requestId
  });
}

// =====================================================
// CORS preflight
// =====================================================
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
