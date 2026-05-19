// =====================================================
// วิธีตั้งค่า:
// 1. ไปที่ Project Settings (ไอคอนเกียร์) → Script Properties
// 2. เพิ่ม property 2 ตัว:
//    Key: SHEET_ID   Value: <Sheet ID>
// 3. Deploy → New Deployment → Web App
// =====================================================

const SHEET_TAB_NAME = 'Sheet1';

function checkAdminRole(employeeName) {
  if (!employeeName) return false;
  const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  const userSheet = ss.getSheetByName('Users_Name');
  if (!userSheet) return false;

  const uData = userSheet.getDataRange().getValues();
  const uHeaders = uData[0].map(h => String(h).trim());
  const codeIdx = uHeaders.indexOf('Code');
  const userIdx = uHeaders.indexOf('User');
  const r1Idx = uHeaders.indexOf('Role_1');
  const r2Idx = uHeaders.indexOf('Role_2');
  const loginValue = String(employeeName).trim();

  for (let i = 1; i < uData.length; i++) {
    const code = codeIdx !== -1 ? String(uData[i][codeIdx]).trim() : '';
    const user = userIdx !== -1 ? String(uData[i][userIdx]).trim() : '';
    if (code === loginValue || user === loginValue) {
      const r1 = String(uData[i][r1Idx] || '').toLowerCase().trim();
      const r2 = String(uData[i][r2Idx] || '').toLowerCase().trim();
      return r1 === 'admin' || r2 === 'admin';
    }
  }
  return false;
}

function getSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script Properties');
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(SHEET_TAB_NAME) || ss.getSheets()[0];
  return sheet;
}

function getFolder() {
  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) throw new Error('ยังไม่ได้ตั้งค่า FOLDER_ID ใน Script Properties');
  return DriveApp.getFolderById(folderId);
}

function generateRequestId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return 'REQ-' + dateStr + '-' + rand;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'submit';

    if (action === 'submit') {
      return handleSubmit(data);
    } else if (action === 'updateRequest') {
      return handleUpdateRequest(data);
    } else if (action === 'updateStatus') {
      if (!data.updatedBy || !checkAdminRole(data.updatedBy)) {
        return jsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์เปลี่ยนสถานะ: เฉพาะ Admin เท่านั้น' });
      }
      return handleUpdateStatus(data);
    } else if (action === 'addQuickSelect') {
      return handleAddQuickSelect(data);
    } else if (action === 'updateGreenOffice') {
      if (!data.updatedBy || !checkAdminRole(data.updatedBy)) {
        return jsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์บันทึกข้อมูล: เฉพาะ Admin เท่านั้น' });
      }
      return handleUpdateGreenOffice(data);
    }
    throw new Error('Unknown action: ' + action);
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || 'tracking'; 
    const userSection = params.deptCode || '';
    const role = params.role || 'user';

    const sheet = getSheet();
    const allData = sheet.getDataRange().getValues();
    if (allData.length <= 1) return jsonResponse({ status: 'success', data: [] });

    const headers = allData[0];
    const deptNameColIndex = 3; 

    let filteredRows = allData.slice(1);
    if (role !== 'admin' && userSection) {
      filteredRows = filteredRows.filter(row => String(row[deptNameColIndex]).trim() === String(userSection).trim());
    }

    let results = filteredRows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[String(h).trim()] = row[i]; });
      return obj;
    });

    if (action === 'login') {
      const code = params.code || '';
      const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
      const ss = SpreadsheetApp.openById(ssId);
      const userSheet = ss.getSheetByName('Users_Name');
      const uData = userSheet.getDataRange().getValues();
      const uHeaders = uData[0].map(h => String(h).trim());
      const codeIdx = uHeaders.indexOf('Code');
      for (let i = 1; i < uData.length; i++) {
        if (String(uData[i][codeIdx]).trim() === String(code).trim()) {
          const userObj = {};
          uHeaders.forEach((h, j) => { userObj[h] = uData[i][j]; });
          return jsonResponse({ status: 'success', user: userObj });
        }
      }
      return jsonResponse({ status: 'error', message: 'ไม่พบรหัสพนักงานนี้ในระบบ' });
    } else if (action === 'tracking') {
      results = results.filter(r => String(r['สถานะ'] || '').trim() !== '');
    } else if (action === 'history') {
      results = results.filter(r => String(r['สถานะ'] || '').trim() === 'เสร็จสิ้น');
    } else if (action === 'quickSelect') {
      return handleQuickSelectAction();
    } else if (action === 'greenOfficeData') {
      return handleGreenOfficeData(params);
    }

    return jsonResponse({ status: 'success', data: results });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

function handleQuickSelectAction() {
  const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  let quickSheet = ss.getSheetByName('QuickSelect') || ss.getSheetByName('วัสดุยอดนิยม');
  if (!quickSheet) return jsonResponse({ status: 'error', message: 'ไม่พบ Sheet QuickSelect' });
  const qData = quickSheet.getDataRange().getValues();
  const qHeaders = qData[0].map(h => String(h).trim());
  const qResults = qData.slice(1).map(row => {
    const obj = {};
    qHeaders.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
  return jsonResponse({ status: 'success', data: qResults });
}

function handleSubmit(data) {
  const sheet = getSheet();
  const timestamp = new Date();
  const requestId = generateRequestId();
  const rows = data.items.map((item, index) => [
    requestId, timestamp, data.department, data.department, data.employeeName,
    index + 1, item.itemName, item.quantity, item.unit, item.assetCode || '',
    item.remarks || '', '', 'รอจัดซื้อ', '', '', '', item.priority || 'ปกติ'
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return jsonResponse({ status: 'success', requestId: requestId });
}

function handleUpdateRequest(data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const requestId = data.requestId;
  let originalTimestamp = new Date();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === requestId) { originalTimestamp = allData[i][1]; break; }
  }
  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][0] === requestId) sheet.deleteRow(i + 1);
  }
  const rows = data.items.map((item, index) => [
    requestId, originalTimestamp, data.department, data.department, data.employeeName,
    index + 1, item.itemName, item.quantity, item.unit, item.assetCode || '',
    item.remarks || '', '', 'รอจัดซื้อ', '', '', '', item.priority || 'ปกติ'
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return jsonResponse({ status: 'success', requestId: requestId });
}

function handleUpdateStatus(data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  if (!data.requestId) {
    return jsonResponse({ status: 'error', message: 'ไม่พบรหัสคำขอสำหรับอัปเดตสถานะ' });
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return jsonResponse({ status: 'error', message: 'ไม่มีรายการสำหรับอัปเดตสถานะ' });
  }

  const headers = allData[0].map(h => String(h).trim());
  const col = (names, fallback) => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return fallback;
  };
  const requestIdCol = col(['รหัสคำขอ', 'requestId', 'ID'], 0);
  const itemIndexCol = col(['ลำดับรายการ', 'index'], 5);
  const qtyCol = col(['จำนวน', 'quantity'], 7);
  const unitCol = col(['หน่วยนับ', 'unit'], 8);
  const statusCol = col(['สถานะ', 'status'], 12);
  const noteCol = col(['หมายเหตุ Admin', 'adminNote'], 13);
  const updatedByCol = col(['ผู้ดำเนินการ', 'updatedBy'], 14);
  const updatedAtCol = col(['วันที่อัปเดตสถานะ', 'updatedAt'], 15);
  const priorityCol = col(['Priority', 'priority', 'Piority', 'ความเร่งด่วน'], 16);

  const now = new Date();
  const itemMap = {};
  data.items.forEach(it => {
    itemMap[String(it.index).trim()] = it;
  });
  let updated = 0;
  let matchedRequest = false;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][requestIdCol]).trim() === String(data.requestId).trim()) {
      matchedRequest = true;
      const it = itemMap[String(allData[i][itemIndexCol]).trim()];
      if (it) {
        sheet.getRange(i + 1, statusCol + 1).setValue(String(it.status || '').trim());
        sheet.getRange(i + 1, noteCol + 1).setValue(it.note || '');
        sheet.getRange(i + 1, updatedByCol + 1).setValue(data.updatedBy || '');
        sheet.getRange(i + 1, updatedAtCol + 1).setValue(now);
        if (it.qty !== undefined) sheet.getRange(i + 1, qtyCol + 1).setValue(it.qty);
        if (it.unit !== undefined) sheet.getRange(i + 1, unitCol + 1).setValue(it.unit);
        if (it.priority !== undefined) sheet.getRange(i + 1, priorityCol + 1).setValue(it.priority);
        updated++;
      }
    }
  }
  if (!matchedRequest) {
    return jsonResponse({ status: 'error', message: 'ไม่พบรหัสคำขอ ' + data.requestId + ' ในชีต' });
  }
  if (updated === 0) {
    return jsonResponse({ status: 'error', message: 'ไม่พบลำดับรายการที่ต้องการอัปเดตในคำขอ ' + data.requestId });
  }
  SpreadsheetApp.flush();
  return jsonResponse({ status: 'success', message: 'Updated ' + updated + ' items', updated: updated });
}

function handleAddQuickSelect(data) {
  const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  let sheet = ss.getSheetByName('QuickSelect') || ss.getSheetByName('วัสดุยอดนิยม');
  if (!sheet) {
    sheet = ss.insertSheet('QuickSelect');
    sheet.appendRow(['ชื่อวัสดุ', 'หน่วยนับ', 'รูปตัวอย่าง', 'เป็นมิตรต่อสิ่งแวดล้อม']);
  }
  sheet.appendRow([data.itemName, data.unit, data.imageUrl, data.isEcoFriendly ? 'ใช่' : 'ไม่']);
  return jsonResponse({ status: 'success', message: 'เพิ่มรายการ QuickSelect สำเร็จ' });
}

function handleGreenOfficeData(params) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).trim());
  const rows = allData.slice(1);

  const dateIdx = headers.indexOf('วันที่-เวลาที่ขอ');
  const itemNameIdx = headers.indexOf('รายละเอียดวัสดุ');
  const qtyIdx = headers.indexOf('จำนวน');
  const unitIdx = headers.indexOf('หน่วยนับ');
  const priceIdx = headers.indexOf('ราคาต่อหน่วย');
  const isEcoIdx = headers.indexOf('เป็นมิตรต่อสิ่งแวดล้อม');

  const selectedMonth = parseInt(params.month);
  const selectedYear = parseInt(params.year) - 543;

  const reportData = {
    summary: { totalItems: 0, greenItems: 0, totalValue: 0, greenValue: 0, totalCount: 0, greenCount: 0 },
    items: [] 
  };

  rows.forEach(row => {
    const date = new Date(row[dateIdx]);
    if (isNaN(date.getTime())) return;
    if (date.getMonth() + 1 !== selectedMonth || date.getFullYear() !== selectedYear) return;
    
    const itemName = String(row[itemNameIdx]).trim();
    const qty = parseFloat(row[qtyIdx]) || 0;
    const unitPrice = priceIdx !== -1 ? (parseFloat(row[priceIdx]) || 0) : 0;
    let isEco = isEcoIdx !== -1 ? (String(row[isEcoIdx]).trim() === 'ใช่') : false;

    reportData.summary.totalItems += qty;
    reportData.summary.totalValue += (qty * unitPrice);
    if (isEco) {
      reportData.summary.greenItems += qty;
      reportData.summary.greenValue += (qty * unitPrice);
    }

    reportData.items.push({
      requestId: row[0],
      index: row[5],
      name: itemName,
      unit: row[unitIdx],
      qty: qty,
      unitPrice: unitPrice,
      isEco: isEco
    });
  });

  return jsonResponse({ status: 'success', data: reportData });
}

function handleUpdateGreenOffice(data) {
  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).trim());
  
  let pIdx = headers.indexOf('ราคาต่อหน่วย');
  let eIdx = headers.indexOf('เป็นมิตรต่อสิ่งแวดล้อม');
  if (pIdx === -1) { pIdx = headers.length; sheet.getRange(1, pIdx + 1).setValue('ราคาต่อหน่วย'); }
  if (eIdx === -1) { eIdx = headers.length + (pIdx === headers.length ? 1 : 0); sheet.getRange(1, eIdx + 1).setValue('เป็นมิตรต่อสิ่งแวดล้อม'); }

  const updateMap = {};
  data.items.forEach(it => { updateMap[it.requestId + '_' + it.index] = it; });

  for (let i = 1; i < allData.length; i++) {
    const key = allData[i][0] + '_' + allData[i][5];
    if (updateMap[key]) {
      const up = updateMap[key];
      sheet.getRange(i + 1, pIdx + 1).setValue(parseFloat(up.unitPrice) || 0);
      sheet.getRange(i + 1, eIdx + 1).setValue(up.isEco ? 'ใช่' : 'ไม่');
    }
  }
  return jsonResponse({ status: 'success', message: 'บันทึกสำเร็จ' });
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
