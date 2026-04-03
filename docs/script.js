document.addEventListener('DOMContentLoaded', () => {

    const userMapping = {
        'sra141': { code: '01', name: 'ผบส.', role: 'user' },
        'ssa141': { code: '02', name: 'ผสน.', role: 'admin' },
        'mca141': { code: '03', name: 'ผบร.', role: 'user' },
        'cma141': { code: '04', name: 'ผกส.', role: 'user' },
        'oma141': { code: '05', name: 'ผปบ.', role: 'user' },
        'mta141': { code: '06', name: 'ผมต.', role: 'user' },
        'dla141': { code: '07', name: 'กฟส.ดอยหล่อ', role: 'user' },
        'mja141': { code: '08', name: 'กฟส.แม่แจ่ม', role: 'user' },
    };

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

    const STATUS_MAP = {
        'รอจัดซื้อ': { cls: 'status-waiting', icon: '📦' },
        'อยู่ระหว่างจัดซื้อ': { cls: 'status-processing', icon: '⏳' },
        'ได้รับบางส่วน': { cls: 'status-partial', icon: '🌗' },
        'เสร็จสิ้น': { cls: 'status-done', icon: '✅' },
        'ยกเลิก': { cls: 'status-cancelled', icon: '❌' }
    };

    const loginContainer = document.getElementById('loginContainer');
    const mainAppContainer = document.getElementById('mainAppContainer');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminToggleContainer = document.getElementById('adminToggleContainer');
    const adminModeToggle = document.getElementById('adminModeToggle');
    const deptDisplay = document.getElementById('deptDisplay');

    const sidebar = document.getElementById('appSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const navButtons = document.querySelectorAll('.sidebar-menu-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const breadcrumbText = document.getElementById('breadcrumbText');

    const itemsContainer = document.getElementById('itemsContainer');
    const addItemBtn = document.getElementById('addItemBtn');
    const itemTemplate = document.getElementById('itemTemplate');
    const form = document.getElementById('purchaseRequestForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitSpinner = document.getElementById('submitSpinner');
    const statusMessage = document.getElementById('statusMessage');

    const confirmModal = document.getElementById('confirmModal');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    const confirmSummary = document.getElementById('confirmSummary');

    const imageModal = document.getElementById('imageModal');
    const imagePreview = document.getElementById('imagePreview');
    const pdfPreview = document.getElementById('pdfPreview');
    const previewLoader = document.getElementById('previewLoader');
    const downloadBtn = document.getElementById('downloadBtn');

    const adminStatusModal = document.getElementById('adminStatusModal');
    const adminReqIdSpan = document.getElementById('adminReqId');
    const adminItemsContainer = document.getElementById('adminItemsContainer');
    const saveStatusBtn = document.getElementById('saveStatusBtn');

    let currentDeptCode = '';
    let isAdminMode = false;
    let adminPriorityFilter = 'ทั้งหมด';
    let adminSortState = { key: 'date', direction: 'asc' };
    let editingRequestId = null;
    let currentRequestsData = {};
    let pendingPayload = null;
    let charts = {};
    let sortState = { key: 'date', direction: 'desc' };

    function getAppScriptUrl() {
        if (typeof window.APPS_SCRIPT_URL !== 'undefined' && window.APPS_SCRIPT_URL) return window.APPS_SCRIPT_URL;
        if (typeof APPS_SCRIPT_URL !== 'undefined' && APPS_SCRIPT_URL) return APPS_SCRIPT_URL;
        return '';
    }

    function showStatus(text, type = '') {
        if (!statusMessage) return;
        statusMessage.textContent = text;
        statusMessage.className = `status-message${type ? ` status-${type}` : ''}`;
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (isLoading) {
            submitSpinner?.classList.remove('hide');
            submitBtnText.textContent = editingRequestId ? 'กำลังบันทึก...' : 'กำลังส่งข้อมูล...';
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        } else {
            submitSpinner?.classList.add('hide');
            submitBtnText.textContent = editingRequestId ? '📦 บันทึกการแก้ไข (Save Changes)' : '🚀 ส่งคำขอจัดซื้อ (Submit)';
        }
    }

    function renumberItems() {
        const rows = itemsContainer.querySelectorAll('.item-row');
        rows.forEach((row, i) => {
            const numEl = row.querySelector('.item-number');
            if (numEl) numEl.textContent = i + 1;
        });
    }

    function addNewItem() {
        const clone = itemTemplate.content.cloneNode(true);
        const row = clone.querySelector('.item-row');

        const toggle = row.querySelector('.item-priority-toggle');
        const prioNote = row.querySelector('.priority-note');

        if (toggle && prioNote) {
            toggle.addEventListener('change', () => {
                prioNote.style.display = toggle.checked ? 'inline-block' : 'none';
            });
        }

        itemsContainer.appendChild(clone);
        renumberItems();

        const newInputs = itemsContainer.querySelectorAll('.item-row:last-child input');
        if (newInputs.length > 0 && itemsContainer.children.length > 1) {
            newInputs[0].focus();
        }
    }

    window.removeItem = function (button) {
        const row = button.closest('.item-row');
        const container = document.getElementById('itemsContainer');
        if (container.querySelectorAll('.item-row').length > 1) {
            row.style.opacity = '0';
            row.style.transform = 'scale(0.95)';
            row.style.transition = 'all 0.15s ease';
            setTimeout(() => {
                row.remove();
                renumberItems();
            }, 150);
        } else {
            alert('จำเป็นต้องมีรายการวัสดุอย่างน้อย 1 รายการ');
        }
    };

    async function fetchTrackingData() {
        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) return [];

        const user = sessionStorage.getItem('loggedInUser');
        if (!user || !userMapping[user]) return [];

        const deptCode = userMapping[user].code;
        const role = isAdminMode ? 'admin' : 'user';

        try {
            const url = `${appScriptUrl}?action=tracking&deptCode=${encodeURIComponent(deptCode)}&role=${encodeURIComponent(role)}&t=${Date.now()}`;
            const res = await fetch(url);
            const result = await res.json();
            return result.status === 'success' ? result.data : [];
        } catch (err) {
            console.error('Fetch Error:', err);
            return [];
        }
    }

    function updateHomeView() {
        const purchaseForm = document.getElementById('purchaseRequestForm');
        const adminHome = document.getElementById('adminHomeView');
        if (!purchaseForm || !adminHome) return;

        if (isAdminMode) {
            purchaseForm.classList.add('hide');
            purchaseForm.style.display = 'none';
            adminHome.classList.remove('hide');
            adminHome.style.display = 'block';
            renderAdminHomeSummary();
        } else {
            purchaseForm.classList.remove('hide');
            purchaseForm.style.display = 'block';
            adminHome.classList.add('hide');
            adminHome.style.display = 'none';
        }
    }

    function updateAdminSortIcons() {
        ['date', 'priority'].forEach(k => {
            const el = document.querySelector(`.admin-sort-icon.sort-${k}`);
            if (!el) return;
            if (adminSortState.key === k) {
                el.innerText = adminSortState.direction === 'asc' ? ' ▲' : ' ▼';
                el.style.color = 'var(--primary-main)';
            } else {
                el.innerText = ' ↕';
                el.style.color = '#ccc';
            }
        });
    }

    window.setAdminSort = function (key) {
        if (adminSortState.key === key) {
            adminSortState.direction = adminSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            adminSortState.key = key;
            adminSortState.direction = 'asc';
        }
        renderAdminItemTable(window.currentPendingItemsRaw || []);
    };

    async function saveSingleItemInline(itemKey, btn) {
        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) {
            alert('ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน config.js');
            return;
        }

        const it = (window.currentPendingItemsRaw || []).find(i => `${i['รหัสคำขอ']}_${i['ลำดับรายการ']}` === itemKey);
        if (!it) return;

        const originalBtnHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳';

        try {
            const user = sessionStorage.getItem('loggedInUser') || '';
            const res = await fetch(appScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    requestId: it['รหัสคำขอ'],
                    updatedBy: user,
                    items: [{
                        index: it['ลำดับรายการ'],
                        status: it['สถานะ'],
                        note: it['หมายเหตุ Admin'] || '',
                        qty: it['จำนวน'],
                        unit: it['หน่วยนับ']
                    }]
                })
            });

            const result = await res.json();
            if (result.status === 'success') {
                btn.innerHTML = '✅';
                setTimeout(() => {
                    btn.innerHTML = originalBtnHtml;
                    btn.style.display = 'none';
                    btn.disabled = false;
                }, 1500);
            } else {
                throw new Error(result.message || 'บันทึกไม่สำเร็จ');
            }
        } catch (e) {
            console.error(e);
            btn.innerHTML = '❌';
            btn.disabled = false;
            setTimeout(() => {
                btn.innerHTML = originalBtnHtml;
                btn.style.display = 'inline-block';
            }, 3000);
        }
    }

    function updateAdminToggleUI() {
        if (!adminModeToggle) return;

        adminModeToggle.checked = isAdminMode;
        document.body.classList.toggle('admin-theme', isAdminMode);

        const menuHomeBtn = document.getElementById('menuHomeBtn');
        const analysisMenuBtn = document.getElementById('analysisMenuBtn');

        if (menuHomeBtn) {
            menuHomeBtn.textContent = isAdminMode ? 'Admin Workboard' : 'แบบฟอร์มขอจัดซื้อ';
        }

        if (analysisMenuBtn) {
            if (isAdminMode) {
                analysisMenuBtn.classList.remove('hide');
                analysisMenuBtn.style.display = 'block';
            } else {
                analysisMenuBtn.classList.add('hide');
                analysisMenuBtn.style.display = 'none';
            }
        }

        updateHomeView();
    }

    async function renderAdminHomeSummary() {
        const adminHome = document.getElementById('adminHomeView');
        if (!adminHome) return;

        adminHome.innerHTML = '<div class="card" style="padding:2rem; text-align:center;">⌛ กำลังสรุปงานที่ต้องจัดการ...</div>';

        let rawData;
        try {
            rawData = await fetchTrackingData();
        } catch (err) {
            adminHome.innerHTML = `
                <div class="card" style="padding:3rem; text-align:center;">
                    <div style="font-size:2.5rem; margin-bottom:1rem;">⚠️</div>
                    <h3 style="color:var(--text-main);">ไม่สามารถเชื่อมต่อได้</h3>
                    <p style="color:var(--text-muted); margin-bottom:1rem;">${err.message || 'กรุณาลองอีกครั้ง'}</p>
                    <button class="btn btn-primary" onclick="location.reload()">🔄 ลองใหม่</button>
                </div>
            `;
            return;
        }

        if (!rawData || rawData.length === 0) {
            adminHome.innerHTML = `
                <div class="card" style="padding:3rem; text-align:center;">
                    <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
                    <h2 style="color:var(--accent-color);">ไม่มีงานค้าง!</h2>
                    <p style="color:var(--text-muted);">ขณะนี้ไม่มีคำขอจัดซื้อที่รอการดำเนินการ</p>
                </div>
            `;
            return;
        }

        const pendingItems = rawData.filter(r => r['สถานะ'] === 'รอจัดซื้อ' || r['สถานะ'] === 'อยู่ระหว่างจัดซื้อ');

        if (pendingItems.length === 0) {
            adminHome.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">✅ คำขอทั้งหมดได้รับการจัดการเรียบร้อยแล้ว</div>`;
            return;
        }

        const deptSummary = {};
        pendingItems.forEach(it => {
            const d = it['ชื่อแผนก'] || 'ไม่ระบุ';
            if (!deptSummary[d]) deptSummary[d] = 0;
            deptSummary[d]++;
        });

        const html = `
            <div style="margin-bottom: 2rem;">
                <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">👋 สวัสดีครับ Admin</h1>
                <p style="color: var(--text-muted);">นี่คือภาพรวมงานที่รอคุณจัดการในขณะนี้</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, #E0218A 0%, #CC0000 100%); color: white; border: none; box-shadow: 0 4px 15px rgba(204, 0, 0, 0.2);">
                    <div style="font-size: 0.9rem; opacity: 0.9; font-weight: 500;">งานที่ต้องทำทั้งหมด</div>
                    <div style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px;">${pendingItems.length} <span style="font-size: 1rem; font-weight: 500; opacity: 0.8;">รายการย่อย</span></div>
                </div>
                <div class="card" style="padding: 1.5rem; border-left: 5px solid #f59e0b;">
                    <div style="font-size: 0.9rem; color: var(--text-muted);">สถานะ: รอจัดซื้อ</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #b45309;">${pendingItems.filter(i => i['สถานะ'] === 'รอจัดซื้อ').length}</div>
                </div>
                <div class="card" style="padding: 1.5rem; border-left: 5px solid #3b82f6;">
                    <div style="font-size: 0.9rem; color: var(--text-muted);">สถานะ: อยู่ระหว่างจัดซื้อ</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #1d4ed8;">${pendingItems.filter(i => i['สถานะ'] === 'อยู่ระหว่างจัดซื้อ').length}</div>
                </div>
            </div>

            <div class="card" style="padding: 1.5rem;">
                <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">📊 แยกตามแผนกที่ส่งคำขอ</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${Object.entries(deptSummary).map(([name, count]) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 8px;">
                            <span style="font-weight: 500;">${name}</span>
                            <span class="status-badge" style="background: var(--accent-color); color: white; min-width: 30px; text-align: center;">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card" style="padding: 1.5rem; margin-top: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <h2 style="margin: 0;">🧾 รายการงานที่ต้องทำในขณะนี้</h2>
                        <select id="adminPriorityFilter" class="form-control" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.9rem; border-radius: 6px;">
                            <option value="ทั้งหมด" ${adminPriorityFilter === 'ทั้งหมด' ? 'selected' : ''}>🎯 ทั้งหมด (All Priority)</option>
                            <option value="ด่วน" ${adminPriorityFilter === 'ด่วน' ? 'selected' : ''}>🚀 ด่วน (Urgent)</option>
                            <option value="ปกติ" ${adminPriorityFilter === 'ปกติ' ? 'selected' : ''}>📄 ปกติ (Normal)</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="selectUrgentBtn" class="btn btn-outline" style="font-size: 0.85rem; border-color: #ef4444; color: #ef4444; display: flex; align-items: center; gap: 4px;">
                            🚩 เลือกเฉพาะด่วน
                        </button>
                        <button id="batchUpdateBtn" class="btn btn-outline" disabled style="display: flex; align-items: center; gap: 5px;">
                            แก้ไขสถานะ
                        </button>
                        <button id="procurementBtn" class="btn btn-primary" disabled style="display: flex; align-items: center; gap: 5px;">
                            สร้างใบงาน
                        </button>
                    </div>
                </div>
                <div id="adminWorklistTableContainer"></div>
            </div>
        `;

        adminHome.innerHTML = html;

        const pFilter = document.getElementById('adminPriorityFilter');
        if (pFilter) {
            pFilter.addEventListener('change', (e) => {
                adminPriorityFilter = e.target.value;
                renderAdminItemTable(window.currentPendingItemsRaw || []);
            });
        }

        renderAdminItemTable(pendingItems);
    }

    function renderAdminItemTable(items) {
        const container = document.getElementById('adminWorklistTableContainer');
        if (!container) return;

        window.currentPendingItemsRaw = items;

        let displayItems = [...items];
        if (adminPriorityFilter !== 'ทั้งหมด') {
            displayItems = displayItems.filter(it => {
                const prio = String(it['Priority'] || it['priority'] || it['Piority'] || 'ปกติ').trim();
                return prio === adminPriorityFilter;
            });
        }

        displayItems.sort((a, b) => {
            let vA, vB;
            if (adminSortState.key === 'date') {
                vA = new Date(a['วันที่-เวลาที่ขอ']).getTime();
                vB = new Date(b['วันที่-เวลาที่ขอ']).getTime();
            } else {
                const weights = { 'ด่วน': 1, 'ปกติ': 2 };
                vA = weights[a['Priority'] || a['priority'] || a['Piority']] || 2;
                vB = weights[b['Priority'] || b['priority'] || b['Piority']] || 2;
            }

            if (vA < vB) return adminSortState.direction === 'asc' ? -1 : 1;
            if (vA > vB) return adminSortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 5%; text-align: center;"><input type="checkbox" id="selectAllCheckbox"></th>
                            <th style="width: 25%;">วัสดุ</th>
                            <th style="width: 10%; cursor: pointer;" onclick="setAdminSort('priority')">จำนวน/Priority <span class="admin-sort-icon sort-priority"></span></th>
                            <th style="width: 15%;">สถานะ</th>
                            <th style="width: 15%;">รหัสคำขอ</th>
                            <th style="width: 15%;">แผนก/ผู้ขอ</th>
                            <th style="width: 15%; cursor: pointer;" onclick="setAdminSort('date')">วันที่ขอ <span class="admin-sort-icon sort-date"></span></th>
                        </tr>
                    </thead>
                    <tbody id="adminItemTableBody">
        `;

        displayItems.forEach(item => {
            const prioValue = String(item['Priority'] || item['priority'] || item['Piority'] || 'ปกติ').trim();
            const reqId = item['รหัสคำขอ'];
            const idx = item['ลำดับรายการ'];
            const itemKey = `${reqId}_${idx}`;
            const stClass = STATUS_MAP[item['สถานะ']]?.cls || 'status-waiting';

            let dateStr = item['วันที่-เวลาที่ขอ'];
            try {
                const d = new Date(dateStr);
                if (!isNaN(d)) {
                    dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch (_) { }

            let updateTimeStr = '';
            if (item['วันที่อัปเดตสถานะ']) {
                try {
                    const u = new Date(item['วันที่อัปเดตสถานะ']);
                    if (!isNaN(u)) {
                        updateTimeStr = u.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' +
                            u.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
                    }
                } catch (_) { }
            }

            html += `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="item-checkbox" value="${itemKey}">
                    </td>
                    <td style="font-weight: 500;">
                        ${item['รายละเอียดวัสดุ'] || '-'}
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                            ${item['หมายเหตุ'] ? `หมายเหตุ: ${item['หมายเหตุ']}` : ''}
                        </div>
                        ${item['ไฟล์แนบ URL'] ? `<button onclick="event.stopPropagation(); openImageModal('${item['ไฟล์แนบ URL']}')" class="btn-file-view" style="border:none; background:none; cursor:pointer; font-size:0.75rem; padding: 0;">📂 ดูไฟล์</button>` : ''}
                    </td>
                    <td>
                        <div style="display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;">
                            <input class="form-control inline-qty" data-key="${itemKey}" type="number" step="any" value="${item['จำนวน'] || ''}" style="width:45px; padding:2px; font-size:0.8rem; text-align:center;">
                            <input class="form-control inline-unit" data-key="${itemKey}" type="text" value="${item['หน่วยนับ'] || ''}" style="width:45px; padding:2px; font-size:0.8rem; text-align:center;">
                            <button class="btn-inline-save" data-key="${itemKey}" title="บันทึกการแก้ไขเฉพาะรายการนี้" style="border:none; background:none; cursor:pointer; padding:2px; display:none; color:var(--primary-main); font-size:1.1rem; line-height:1;">💾</button>
                        </div>
                        <div style="margin-top: 4px;">
                            <span class="prio-badge ${prioValue === 'ด่วน' ? 'prio-urgent' : 'prio-normal'}">
                                ${prioValue === 'ด่วน' ? '🚩 ด่วน' : '🏳️ ปกติ'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${stClass}">${item['สถานะ'] || '-'}</span>
                        ${updateTimeStr ? `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; white-space: nowrap;">🕒 ${updateTimeStr}</div>` : ''}
                    </td>
                    <td style="font-size: 0.85rem; color: var(--primary-main);">${reqId}</td>
                    <td style="font-size: 0.85rem;">
                        <div>${item['ชื่อแผนก'] || '-'}</div>
                        <div style="color: var(--text-muted);">${item['ชื่อผู้ขอ'] || '-'}</div>
                    </td>
                    <td style="font-size: 0.85rem;">${dateStr || '-'}</td>
                </tr>
            `;
        });

        if (displayItems.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">ไม่พบรายการที่ตรงกับเงื่อนไขการกรอง</td></tr>`;
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;
        updateAdminSortIcons();

        container.querySelectorAll('.inline-qty, .inline-unit').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const key = inp.dataset.key;
                const it = (window.currentPendingItemsRaw || []).find(i => `${i['รหัสคำขอ']}_${i['ลำดับรายการ']}` === key);
                if (it) {
                    if (inp.classList.contains('inline-qty')) it['จำนวน'] = e.target.value;
                    else it['หน่วยนับ'] = e.target.value;
                }
                const row = inp.closest('tr');
                const sBtn = row.querySelector('.btn-inline-save');
                if (sBtn) sBtn.style.display = 'inline-block';
            });
        });

        container.querySelectorAll('.btn-inline-save').forEach(btn => {
            btn.addEventListener('click', () => saveSingleItemInline(btn.dataset.key, btn));
        });

        const selectAll = document.getElementById('selectAllCheckbox');
        const checkboxes = document.querySelectorAll('.item-checkbox');
        const batchBtn = document.getElementById('batchUpdateBtn');
        const procureBtn = document.getElementById('procurementBtn');
        const selectUrgentBtn = document.getElementById('selectUrgentBtn');

        const updateBatchBtnState = () => {
            const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
            const hasChecked = checkedBoxes.length > 0;
            if (batchBtn) batchBtn.disabled = !hasChecked;
            if (procureBtn) procureBtn.disabled = !hasChecked;
            if (selectAll) selectAll.checked = (checkedBoxes.length === checkboxes.length) && hasChecked;
        };

        selectUrgentBtn?.addEventListener('click', () => {
            checkboxes.forEach(cb => {
                const row = cb.closest('tr');
                const isUrgent = row.querySelector('.prio-urgent');
                cb.checked = !!isUrgent;
            });
            updateBatchBtnState();
        });

        selectAll?.addEventListener('change', (e) => {
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateBatchBtnState();
        });

        checkboxes.forEach(cb => cb.addEventListener('change', updateBatchBtnState));

        const getSelectedItems = () => {
            const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked')).map(cb => cb.value);
            if (checkedBoxes.length === 0) return [];
            return (window.currentPendingItemsRaw || []).filter(it => {
                const key = `${it['รหัสคำขอ']}_${it['ลำดับรายการ']}`;
                return checkedBoxes.includes(key);
            });
        };

        batchBtn?.addEventListener('click', () => {
            const items = getSelectedItems();
            if (items.length && window.openBatchAdminModal) {
                window.openBatchAdminModal(items);
            }
        });

        procureBtn?.addEventListener('click', () => {
            const items = getSelectedItems();
            if (items.length && window.openProcurementPrintModal) {
                window.openProcurementPrintModal(items);
            }
        });
    }

    window.setSort = function (key) {
        if (sortState.key === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.key = key;
            sortState.direction = 'asc';
        }
        renderTrackingTable();
    };

    function updateSortIcons() {
        const keys = ['id', 'date', 'deptName', 'requester', 'itemsCount', 'status'];
        keys.forEach(k => {
            const els = document.querySelectorAll(`.sort-${k}`);
            els.forEach(el => {
                if (sortState.key === k) {
                    el.innerText = sortState.direction === 'asc' ? ' ▲' : ' ▼';
                    el.style.color = 'var(--primary-main)';
                } else {
                    el.innerText = ' ↕';
                    el.style.color = '#ccc';
                }
            });
        });
    }

    async function renderTrackingTable(targetContainerId = 'trackingContainer') {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        container.innerHTML = '<div class="card" style="text-align:center; padding:3rem;"><div class="spinner" style="width:40px; height:40px; border-width:4px; margin:0 auto 1rem; color:var(--primary-main);"></div><div style="color:var(--text-muted); font-size:1.1rem;">กำลังโหลดข้อมูล...</div></div>';

        const rawData = await fetchTrackingData();
        if (!rawData || rawData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">ยังไม่มีรายการคำขอ</p>';
            return;
        }

        const groupsMap = {};
        rawData.forEach(row => {
            const rid = row['รหัสคำขอ'];
            if (!groupsMap[rid]) {
                groupsMap[rid] = {
                    id: rid,
                    date: row['วันที่-เวลาที่ขอ'],
                    requester: row['ชื่อผู้ขอ'],
                    deptName: row['ชื่อแผนก'],
                    deptCode: row['รหัสแผนก'],
                    itemsCount: 0,
                    items: []
                };
            }

            groupsMap[rid].itemsCount++;
            groupsMap[rid].items.push({
                index: row['ลำดับรายการ'],
                name: row['รายละเอียดวัสดุ'],
                qty: row['จำนวน'],
                unit: row['หน่วยนับ'],
                asset: row['รหัสทรัพย์สิน'],
                rem: row['หมายเหตุ'],
                url: row['ไฟล์แนบ URL'],
                status: row['สถานะ'],
                note: row['หมายเหตุ Admin'] || '',
                priority: String(row['Priority'] || row['priority'] || row['Piority'] || 'ปกติ').trim(),
                updateTime: row['วันที่อัปเดตสถานะ']
            });
        });

        Object.values(groupsMap).forEach(group => {
            const allItems = group.items;
            const statusCounts = {
                'รอจัดซื้อ': 0,
                'อยู่ระหว่างจัดซื้อ': 0,
                'ได้รับบางส่วน': 0,
                'เสร็จสิ้น': 0,
                'ยกเลิก': 0
            };

            allItems.forEach(it => {
                if (statusCounts[it.status] !== undefined) statusCounts[it.status]++;
            });

            const total = allItems.length;
            const doneTotal = statusCounts['เสร็จสิ้น'] + statusCounts['ยกเลิก'];

            if (total === 1) {
                group.status = allItems[0].status;
            } else if (statusCounts['รอจัดซื้อ'] === total) {
                group.status = 'รอจัดซื้อ';
            } else if (doneTotal === total && statusCounts['เสร็จสิ้น'] === total) {
                group.status = 'เสร็จสิ้น';
            } else if (doneTotal === total && statusCounts['ยกเลิก'] === total) {
                group.status = 'ยกเลิก';
            } else if (statusCounts['ได้รับบางส่วน'] > 0 || (statusCounts['เสร็จสิ้น'] > 0 && doneTotal < total)) {
                group.status = 'ได้รับบางส่วน';
            } else {
                group.status = 'อยู่ระหว่างจัดซื้อ';
            }

            let latestUpdate = null;
            allItems.forEach(it => {
                if (it.updateTime) {
                    const d = new Date(it.updateTime);
                    if (!isNaN(d)) {
                        if (!latestUpdate || d > latestUpdate) latestUpdate = d;
                    }
                }
            });
            group.latestUpdate = latestUpdate;
        });

        currentRequestsData = groupsMap;

        let groups = Object.values(groupsMap);
        if (targetContainerId === 'adminWorklistTableContainer') {
            groups = groups.filter(g => g.status !== 'เสร็จสิ้น' && g.status !== 'ยกเลิก');
        }

        groups.sort((a, b) => {
            let vA = a[sortState.key];
            let vB = b[sortState.key];

            if (sortState.key === 'date') {
                vA = new Date(a.date).getTime();
                vB = new Date(b.date).getTime();
            }

            if (vA < vB) return sortState.direction === 'asc' ? -1 : 1;
            if (vA > vB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        const statusKeys = ['รอจัดซื้อ', 'อยู่ระหว่างจัดซื้อ', 'ได้รับบางส่วน', 'เสร็จสิ้น', 'ยกเลิก'];
        let html = '';

        statusKeys.forEach(stKey => {
            const reqs = groups.filter(g => g.status === stKey);
            if (reqs.length === 0) return;

            const stMeta = STATUS_MAP[stKey] || { cls: '', icon: '' };

            html += `
                <div class="card" style="margin-bottom: 2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); margin-bottom:1rem; padding-bottom:0.5rem;">
                        <h3 style="color: var(--text-main); margin: 0;">${stMeta.icon} ${stKey} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal; margin-left:0.5rem;">${reqs.length}</span></h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="cursor:pointer; width:18%;" onclick="setSort('id')">รหัสคำขอ <span class="sort-icon sort-id"></span></th>
                                    <th style="cursor:pointer; width:15%;" onclick="setSort('date')">วันที่ขอ <span class="sort-icon sort-date"></span></th>
                                    <th style="cursor:pointer; width:12%;" onclick="setSort('deptName')">แผนก <span class="sort-icon sort-deptName"></span></th>
                                    <th style="cursor:pointer; width:15%;" onclick="setSort('requester')">ผู้ขอ <span class="sort-icon sort-requester"></span></th>
                                    <th style="cursor:pointer; width:12%; text-align:center;" onclick="setSort('itemsCount')">จำนวน <span class="sort-icon sort-itemsCount"></span></th>
                                    <th style="cursor:pointer; width:13%;" onclick="setSort('status')">สถานะ <span class="sort-icon sort-status"></span></th>
                                    <th style="text-align:center; width:15%;">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            reqs.forEach(req => {
                const showManageBtn = isAdminMode;
                const canEdit = req.status === 'รอจัดซื้อ';
                let dateStr = req.date || '-';
                let timeStr = '';

                try {
                    const d = new Date(req.date);
                    if (!isNaN(d)) {
                        dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                        timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (_) { }

                html += `
                    <tr class="tracking-tr" id="req-row-${req.id}" onclick="toggleRequestDetails('${req.id}')">
                        <td style="font-weight:500;"><span class="expand-icon" style="display:inline-block; margin-right:5px;">▶</span>${req.id}</td>
                        <td><div>${dateStr}</div><div class="text-time">${timeStr}</div></td>
                        <td>${req.deptName || '-'}</td>
                        <td>${req.requester || '-'}</td>
                        <td style="text-align:center;">
                            <div style="font-weight:700; color:var(--primary-main);">${req.items.length}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; font-weight:400; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px; margin-left:auto; margin-right:auto;">
                                ${req.items.map(i => i.name).slice(0, 2).join(', ')}${req.items.length > 2 ? '...' : ''}
                            </div>
                        </td>
                        <td><span class="status-badge ${stMeta.cls}">${req.status}</span></td>
                        <td>
                            <div style="display:flex; gap:5px; justify-content:center;">
                                ${showManageBtn ? `<button class="btn btn-primary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="event.stopPropagation(); openAdminModal('${req.id}')">จัดการ</button>` : ''}
                                ${canEdit ? `<button class="btn btn-outline" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="event.stopPropagation(); editRequest('${req.id}')">แก้ไข</button>` : ''}
                                ${canEdit ? `<button class="btn btn-danger" style="font-size:0.75rem; padding:0.25rem 0.5rem; border-color:#ef4444;" onclick="event.stopPropagation(); cancelRequest('${req.id}')">ยกเลิก</button>` : ''}
                            </div>
                        </td>
                    </tr>
                    <tr id="detail-${req.id}" class="detail-row hide" style="display: none;">
                        <td colspan="7" style="padding:0; border:none;">
                            <div class="detail-container">
                                <div class="detail-header" style="margin-bottom:1rem;">
                                    <strong>รายละเอียดวัสดุ</strong>
                                    <span class="text-time" style="font-style:italic;">
                                        ${req.latestUpdate ? new Date(req.latestUpdate).toLocaleString('th-TH') : ''}
                                    </span>
                                </div>
                                <table class="detail-table" style="width:100%;">
                                    <thead>
                                        <tr>
                                            <th style="width:35%;">รายการ</th>
                                            <th style="text-align:center;">จำนวน</th>
                                            <th style="text-align:center;">Priority</th>
                                            <th>Asset</th>
                                            <th>หมายเหตุ Admin</th>
                                            <th style="text-align:right;">ไฟล์</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${req.items.map(it => {
                    const stMetaItem = STATUS_MAP[it.status] || { cls: 'status-waiting' };
                    let itemTime = '';
                    if (it.updateTime) {
                        const idate = new Date(it.updateTime);
                        if (!isNaN(idate.getTime())) {
                            itemTime = idate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                        }
                    }

                    return `
                                                <tr>
                                                    <td style="font-weight:500; color:var(--text-main);">
                                                        ${it.name || '-'}
                                                        <div style="margin-top:0.25rem; display:flex; align-items:center; gap:8px;">
                                                            <span class="status-badge ${stMetaItem.cls}" style="font-size:0.7rem; padding:0.15rem 0.5rem;">${it.status || '-'}</span>
                                                            ${itemTime ? `<span class="text-time" style="font-size:0.75rem;">${itemTime}</span>` : ''}
                                                        </div>
                                                    </td>
                                                    <td style="text-align:center;">${it.qty || '-'} ${it.unit || ''}</td>
                                                    <td style="text-align:center;">
                                                        <span class="prio-badge ${it.priority === 'ด่วน' ? 'prio-urgent' : 'prio-normal'}" style="font-size:0.75rem;">
                                                            ${it.priority === 'ด่วน' ? 'ด่วน' : 'ปกติ'}
                                                        </span>
                                                    </td>
                                                    <td style="font-family:monospace; font-size:0.85rem;">${it.asset || '-'}</td>
                                                    <td style="color:var(--text-muted); font-size:0.85rem;">${it.note || '-'}</td>
                                                    <td style="text-align:right;">
                                                        ${it.url ? `<button onclick="event.stopPropagation(); openImageModal('${it.url}')" class="btn-file-view" style="border:none; background:none; cursor:pointer; font-size:0.85rem;">📂</button>` : '-'}
                                                    </td>
                                                </tr>
                                            `;
                }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div></div>`;
        });

        container.innerHTML = html;
        updateSortIcons();
    }

    window.toggleRequestDetails = function (id) {
        const row = document.getElementById(`req-row-${id}`);
        const detail = document.getElementById(`detail-${id}`);
        if (!row || !detail) return;

        const isHidden = detail.style.display === 'none' || detail.classList.contains('hide');
        if (isHidden) {
            detail.style.display = 'table-row';
            detail.classList.remove('hide');
            row.classList.add('expanded');
        } else {
            detail.style.display = 'none';
            detail.classList.add('hide');
            row.classList.remove('expanded');
        }
    };

    window.openImageModal = function (url) {
        imageModal.classList.remove('hide');
        imageModal.style.display = 'flex';
        imagePreview.style.display = 'none';
        pdfPreview.style.display = 'none';
        previewLoader.style.display = 'block';
        previewLoader.innerText = 'กำลังโหลด...';
        downloadBtn.href = url;

        let previewUrl = url;
        if (url.includes('drive.google.com')) {
            const match = url.match(/[-\w]{25,}/);
            if (match) {
                previewUrl = `https://drive.google.com/file/d/${match[0]}/preview`;
            }
        }

        if (previewUrl.includes('drive.google.com') || url.toLowerCase().includes('.pdf')) {
            pdfPreview.src = previewUrl;
            pdfPreview.style.display = 'block';
            previewLoader.style.display = 'none';
        } else {
            imagePreview.src = url;
            imagePreview.onload = () => {
                imagePreview.style.display = 'block';
                previewLoader.style.display = 'none';
            };
            imagePreview.onerror = () => {
                previewLoader.innerText = 'ไม่สามารถแสดงตัวอย่างไฟล์ได้';
            };
        }
    };

    window.closeImageModal = function () {
        imageModal.classList.add('hide');
        imageModal.style.display = 'none';
        imagePreview.src = '';
        pdfPreview.src = '';
    };

    window.editRequest = function (id) {
        const req = currentRequestsData[id];
        if (!req) return;

        const formBtn = Array.from(navButtons).find(b => b.getAttribute('data-target') === 'formSection');
        if (formBtn) formBtn.click();

        editingRequestId = id;
        submitBtnText.innerText = '📦 บันทึกการแก้ไข (Save Changes)';
        submitBtn.classList.add('btn-edit-mode');

        if (!document.getElementById('cancelEditBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'btn btn-outline';
            cancelBtn.type = 'button';
            cancelBtn.style.marginLeft = '10px';
            cancelBtn.innerText = 'ยกเลิกการแก้ไข';
            cancelBtn.onclick = cancelEdit;
            submitBtn.parentNode.appendChild(cancelBtn);
        }

        document.getElementById('employeeName').value = req.requester || '';

        const dCode = Object.keys(DEPT_MAP).find(k => DEPT_MAP[k] === req.deptName) || req.deptCode;
        if (dCode) {
            currentDeptCode = dCode;
            if (deptDisplay) deptDisplay.innerText = DEPT_MAP[dCode] || dCode;
        }

        itemsContainer.innerHTML = '';
        req.items.forEach((item) => {
            addNewItem();
            const rows = itemsContainer.querySelectorAll('.item-row');
            const currentRow = rows[rows.length - 1];

            currentRow.querySelector('.item-name').value = item.name || '';
            currentRow.querySelector('.item-quantity').value = item.qty || '';
            currentRow.querySelector('.item-unit').value = item.unit || '';
            currentRow.querySelector('.item-asset').value = item.asset || '';
            currentRow.querySelector('.item-remarks').value = item.rem || '';

            const toggle = currentRow.querySelector('.item-priority-toggle');
            const note = currentRow.querySelector('.priority-note');
            if (toggle) {
                const isUrgent = item.priority === 'ด่วน';
                toggle.checked = isUrgent;
                if (note) note.style.display = isUrgent ? 'inline-block' : 'none';
            }
        });

        showStatus(`🔨 คุณกำลังแก้ไขคำขอ: ${id} (ไฟล์แนบเดิมจะหายหากไม่แนบใหม่)`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.cancelEdit = function () {
        editingRequestId = null;
        submitBtnText.innerText = '🚀 ส่งคำขอจัดซื้อ (Submit)';
        submitBtn.classList.remove('btn-edit-mode');
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.remove();
        form.reset();
        itemsContainer.innerHTML = '';
        addNewItem();
        showStatus('ยกเลิกการแก้ไขแล้ว', '');
    };

    window.cancelRequest = async function (id) {
        const req = currentRequestsData[id];
        if (!req) return;

        const confirmMsg = `คุณต้องการยกเลิกคำขอ ${id} ใช่หรือไม่?`;
        if (!confirm(confirmMsg)) return;

        const reason = prompt('กรุณาระบุเหตุผลในการยกเลิก');
        if (!reason) {
            alert('กรุณาระบุเหตุผล');
            return;
        }

        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) return;

        setLoading(true);
        try {
            const user = sessionStorage.getItem('loggedInUser') || '';
            const itemsToUpdate = req.items.map(it => ({
                index: it.index,
                status: 'ยกเลิก',
                note: reason,
                qty: it.qty,
                unit: it.unit
            }));

            const res = await fetch(appScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    requestId: id,
                    updatedBy: user,
                    items: itemsToUpdate
                })
            });

            const result = await res.json();
            if (result.status === 'success') {
                showStatus(`✅ ยกเลิกคำขอ ${id} แล้ว`, 'success');
                renderTrackingTable();
            } else {
                throw new Error(result.message || 'ยกเลิกไม่สำเร็จ');
            }
        } catch (e) {
            console.error(e);
            showStatus(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    window.openAdminModal = function (id) {
        const req = currentRequestsData[id];
        if (!req) return;

        adminReqIdSpan.innerText = id;

        let html = `
            <table class="data-table" style="font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th style="width: 35%;">รายการ</th>
                        <th style="width: 15%; text-align:center;">จำนวน</th>
                        <th style="width: 25%;">สถานะ</th>
                        <th style="width: 25%;">หมายเหตุ Admin</th>
                    </tr>
                </thead>
                <tbody>
        `;

        req.items.forEach(it => {
            html += `
                <tr class="admin-item-row" data-index="${it.index}">
                    <td style="white-space: normal; font-weight:500;">${it.name || '-'}</td>
                    <td style="text-align:center;">
                        <div style="display:flex; gap:5px; align-items:center; justify-content:center;">
                            <input type="number" class="form-control item-qty-input" value="${it.qty || ''}" step="any" style="width: 60px; padding:0.25rem; font-size:0.85rem; text-align:center;">
                            <input type="text" class="form-control item-unit-input" value="${it.unit || ''}" style="width: 60px; padding:0.25rem; font-size:0.85rem; text-align:center;">
                        </div>
                    </td>
                    <td>
                        <select class="form-control item-status-select" style="padding:0.25rem;">
                            <option value="รอจัดซื้อ" ${it.status === 'รอจัดซื้อ' ? 'selected' : ''}>รอจัดซื้อ</option>
                            <option value="อยู่ระหว่างจัดซื้อ" ${it.status === 'อยู่ระหว่างจัดซื้อ' ? 'selected' : ''}>อยู่ระหว่างจัดซื้อ</option>
                            <option value="เสร็จสิ้น" ${it.status === 'เสร็จสิ้น' ? 'selected' : ''}>เสร็จสิ้น</option>
                            <option value="ยกเลิก" ${it.status === 'ยกเลิก' ? 'selected' : ''}>ยกเลิก</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="form-control item-note-input" value="${it.note || ''}" placeholder="หมายเหตุ..." style="padding:0.25rem; font-size:0.85rem; width:100%;">
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        adminItemsContainer.innerHTML = html;
        adminStatusModal.classList.remove('hide');
        adminStatusModal.style.display = 'flex';
    };

    window.closeAdminModal = function () {
        adminStatusModal.classList.add('hide');
        adminStatusModal.style.display = 'none';
    };

    saveStatusBtn?.addEventListener('click', async () => {
        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) return;

        const id = adminReqIdSpan.innerText;
        const user = sessionStorage.getItem('loggedInUser') || '';
        const itemRows = document.querySelectorAll('.admin-item-row');
        const itemsToUpdate = [];
        let isValid = true;

        itemRows.forEach(row => {
            const index = row.getAttribute('data-index');
            const status = row.querySelector('.item-status-select').value;
            const noteInput = row.querySelector('.item-note-input');
            const note = noteInput.value.trim();
            const qty = row.querySelector('.item-qty-input').value.trim();
            const unit = row.querySelector('.item-unit-input').value.trim();

            if (status === 'ยกเลิก' && !note) {
                isValid = false;
                noteInput.style.border = '1px solid red';
            } else {
                noteInput.style.border = '';
            }

            itemsToUpdate.push({ index, status, note, qty, unit });
        });

        if (!isValid) {
            alert('กรุณาระบุหมายเหตุสำหรับรายการที่ยกเลิก');
            return;
        }

        const originalBtnHtml = saveStatusBtn.innerHTML;
        saveStatusBtn.disabled = true;
        saveStatusBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px; border-width:2px;"></span> กำลังบันทึก...';
        setLoading(true);

        try {
            const res = await fetch(appScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    requestId: id,
                    updatedBy: user,
                    items: itemsToUpdate
                })
            });

            const result = await res.json();
            if (result.status === 'success') {
                saveStatusBtn.innerHTML = '✅ บันทึกสำเร็จ';
                saveStatusBtn.style.background = '#10b981';

                setTimeout(() => {
                    showStatus(`✅ อัปเดตสถานะคำขอ ${id} สำเร็จ`, 'success');
                    closeAdminModal();
                    updateHomeView();
                    renderTrackingTable();
                    saveStatusBtn.disabled = false;
                    saveStatusBtn.innerHTML = originalBtnHtml;
                    saveStatusBtn.style.background = '';
                }, 800);
            } else {
                throw new Error(result.message || 'บันทึกไม่สำเร็จ');
            }
        } catch (e) {
            console.error(e);
            showStatus(e.message, 'error');
            saveStatusBtn.disabled = false;
            saveStatusBtn.innerHTML = originalBtnHtml;
        } finally {
            setLoading(false);
        }
    });

    adminStatusModal?.addEventListener('click', (e) => {
        if (e.target === adminStatusModal) closeAdminModal();
    });

    window.openBatchAdminModal = function (selectedItems) {
        const container = document.getElementById('batchAdminItemsContainer');
        const modal = document.getElementById('batchAdminStatusModal');
        if (!container || !modal) return;

        let html = `
            <table class="data-table" style="font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th style="width: 15%;">รหัสคำขอ</th>
                        <th style="width: 30%;">รายการ</th>
                        <th style="width: 20%;">สถานะ</th>
                        <th style="width: 35%;">หมายเหตุ Admin</th>
                    </tr>
                </thead>
                <tbody>
        `;

        selectedItems.forEach(it => {
            const reqId = it['รหัสคำขอ'];
            const idx = it['ลำดับรายการ'];
            const name = it['รายละเอียดวัสดุ'];
            const status = it['สถานะ'];
            const note = it['หมายเหตุ Admin'] || '';

            html += `
                <tr class="batch-admin-item-row" data-req="${reqId}" data-index="${idx}">
                    <td style="font-size: 0.85rem; color: var(--primary-main);">${reqId}</td>
                    <td style="white-space: normal; font-weight:500;">
                        ${name}
                        <div style="display:flex; gap:5px; align-items:center; margin-top:5px;">
                            <input type="number" class="form-control batch-item-qty-input" value="${it['จำนวน'] || ''}" step="any" style="width:65px; padding:0.25rem; font-size:0.8rem; text-align:center;">
                            <input type="text" class="form-control batch-item-unit-input" value="${it['หน่วยนับ'] || ''}" style="width:65px; padding:0.25rem; font-size:0.8rem; text-align:center;">
                        </div>
                    </td>
                    <td>
                        <select class="form-control batch-item-status-select" style="padding:0.25rem;">
                            <option value="รอจัดซื้อ" ${status === 'รอจัดซื้อ' ? 'selected' : ''}>รอจัดซื้อ</option>
                            <option value="อยู่ระหว่างจัดซื้อ" ${status === 'อยู่ระหว่างจัดซื้อ' ? 'selected' : ''}>อยู่ระหว่างจัดซื้อ</option>
                            <option value="เสร็จสิ้น" ${status === 'เสร็จสิ้น' ? 'selected' : ''}>เสร็จสิ้น</option>
                            <option value="ยกเลิก" ${status === 'ยกเลิก' ? 'selected' : ''}>ยกเลิก</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="form-control batch-item-note-input" value="${note}" placeholder="หมายเหตุ..." style="padding:0.25rem; font-size:0.85rem; width:100%;">
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        const batchSelect = document.getElementById('batchStatusSelect');
        if (batchSelect) batchSelect.value = '';

        modal.classList.remove('hide');
        modal.style.display = 'flex';
    };

    window.closeBatchAdminModal = function () {
        const modal = document.getElementById('batchAdminStatusModal');
        if (!modal) return;
        modal.classList.add('hide');
        modal.style.display = 'none';
    };

    document.getElementById('applyBatchStatusBtn')?.addEventListener('click', () => {
        const val = document.getElementById('batchStatusSelect')?.value;
        if (!val) return;
        document.querySelectorAll('.batch-item-status-select').forEach(sel => sel.value = val);
    });

    document.getElementById('saveBatchStatusBtn')?.addEventListener('click', async () => {
        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) return;

        const user = sessionStorage.getItem('loggedInUser') || '';
        const rows = document.querySelectorAll('.batch-admin-item-row');
        const groups = {};
        let isValid = true;

        rows.forEach(row => {
            const reqId = row.getAttribute('data-req');
            const index = row.getAttribute('data-index');
            const status = row.querySelector('.batch-item-status-select').value;
            const noteInput = row.querySelector('.batch-item-note-input');
            const note = noteInput.value.trim();
            const qty = row.querySelector('.batch-item-qty-input').value.trim();
            const unit = row.querySelector('.batch-item-unit-input').value.trim();

            if (status === 'ยกเลิก' && !note) {
                isValid = false;
                noteInput.style.border = '1px solid red';
            } else {
                noteInput.style.border = '';
            }

            if (!groups[reqId]) groups[reqId] = [];
            groups[reqId].push({ index, status, note, qty, unit });
        });

        if (!isValid) {
            alert('กรุณาระบุหมายเหตุสำหรับรายการที่ยกเลิก');
            return;
        }

        // ===== Analysis Dashboard Logic =====
        let charts = {}; // Store chart instances

        window.renderAnalysis = async function () {
            console.log('Starting Analysis Rendering...');

            const stats = {
                total: 0,
                pending: 0,
                urgent: 0,
                completed: 0,
                depts: {},
                statuses: {},
                items: {},
                timeline: {}
            };

            const rawData = await fetchTrackingData();
            console.log('Raw Data for Analysis:', rawData ? rawData.length : 0, 'rows');

            if (!rawData || rawData.length === 0) {
                console.warn('No data returned for analysis.');
                return;
            }

            const uniqueRequests = new Set();
            const today = new Date();
            const last7DaysLabels = [];
            const last7DaysDateStrs = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const dateStrLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                const dateStrKey = d.toLocaleDateString('en-CA');
                last7DaysLabels.push(dateStrLabel);
                last7DaysDateStrs.push(dateStrKey);
                stats.timeline[dateStrKey] = 0;
            }

            rawData.forEach(row => {
                const getVal = (possibleKeys) => {
                    for (const k of possibleKeys) {
                        if (row[k] !== undefined) return row[k];
                        const foundKey = Object.keys(row).find(rk => rk.trim() === k.trim());
                        if (foundKey) return row[foundKey];
                    }
                    return '';
                };

                const rid = getVal(['รหัสคำขอ', 'requestId', 'ID']);
                const itName = getVal(['รายละเอียดวัสดุ', 'itemName', 'Material']);
                const itStatus = String(getVal(['สถานะ', 'status'])).trim();
                const itPrio = String(getVal(['Priority', 'priority', 'ความเร่งด่วน'])).trim();
                const itDept = getVal(['ชื่อแผนก', 'deptName', 'Department']) || 'ไม่ระบุ';
                const rawDate = getVal(['วันที่-เวลาที่ขอ', 'timestamp', 'date']);
                const itDate = rawDate ? new Date(rawDate) : null;

                if (!rid) return;

                uniqueRequests.add(rid);

                if (itStatus === 'รอจัดซื้อ' || itStatus === 'อยู่ระหว่างจัดซื้อ') stats.pending++;
                if (itStatus === 'เสร็จสิ้น') stats.completed++;
                if (itPrio === 'ด่วน') stats.urgent++;

                stats.statuses[itStatus] = (stats.statuses[itStatus] || 0) + 1;
                stats.depts[itDept] = (stats.depts[itDept] || 0) + 1;

                if (itName) stats.items[itName] = (stats.items[itName] || 0) + 1;

                if (itDate && !isNaN(itDate)) {
                    const dKey = itDate.toLocaleDateString('en-CA');
                    if (stats.timeline[dKey] !== undefined) {
                        stats.timeline[dKey]++;
                    }
                }
            });

            stats.total = uniqueRequests.size;

            const updateText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerText = Number(val || 0).toLocaleString();
            };

            updateText('statTotalRequests', stats.total);
            updateText('statPendingRequests', stats.pending);
            updateText('statUrgentItems', stats.urgent);
            updateText('statCompletedItems', stats.completed);

            const createChart = (id, config) => {
                const canvas = document.getElementById(id);
                if (!canvas) return;
                if (charts[id]) charts[id].destroy();
                const ctx = canvas.getContext('2d');
                charts[id] = new Chart(ctx, config);
            };

            const sortedDepts = Object.entries(stats.depts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            createChart('deptChart', {
                type: 'bar',
                data: {
                    labels: sortedDepts.map(d => d[0]),
                    datasets: [{
                        label: 'จำนวนรายการพัสดุ',
                        data: sortedDepts.map(d => d[1]),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        hoverBackgroundColor: '#4f46e5',
                        borderRadius: 8,
                        barThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            const statusColors = {
                'รอจัดซื้อ': '#94a3b8',
                'อยู่ระหว่างจัดซื้อ': '#facc15',
                'ได้รับบางส่วน': '#3b82f6',
                'เสร็จสิ้น': '#10b981',
                'ยกเลิก': '#ef4444'
            };

            const statusLabels = Object.keys(stats.statuses);
            createChart('statusChart', {
                type: 'doughnut',
                data: {
                    labels: statusLabels,
                    datasets: [{
                        data: Object.values(stats.statuses),
                        backgroundColor: statusLabels.map(s => statusColors[s] || '#cbd5e1'),
                        hoverOffset: 12,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { usePointStyle: true, padding: 20, font: { family: 'Prompt', size: 12 } }
                        }
                    }
                }
            });

            const sortedItems = Object.entries(stats.items).sort((a, b) => b[1] - a[1]).slice(0, 5);
            createChart('topItemsChart', {
                type: 'bar',
                indexAxis: 'y',
                data: {
                    labels: sortedItems.map(i => i[0]),
                    datasets: [{
                        label: 'จำนวนครั้งที่ขอ',
                        data: sortedItems.map(i => i[1]),
                        backgroundColor: 'rgba(20, 184, 166, 0.8)',
                        hoverBackgroundColor: '#0d9488',
                        borderRadius: 6,
                        barThickness: 25
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                        y: { grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            createChart('trendChart', {
                type: 'line',
                data: {
                    labels: last7DaysLabels,
                    datasets: [{
                        label: 'จำนวนรายการคำขอ',
                        data: last7DaysDateStrs.map(dStr => stats.timeline[dStr]),
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#fff',
                        pointBorderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        };

        try {
            for (const [reqId, items] of Object.entries(groups)) {
                const res = await fetch(appScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'updateStatus',
                        requestId: reqId,
                        updatedBy: user,
                        items
                    })
                });

                const result = await res.json();
                if (result.status !== 'success') {
                    throw new Error(result.message || `อัปเดต ${reqId} ไม่สำเร็จ`);
                }
            }

            showStatus('✅ บันทึกสถานะหลายรายการสำเร็จ', 'success');
            closeBatchAdminModal();
            updateHomeView();
            renderTrackingTable();
        } catch (e) {
            console.error(e);
            showStatus(e.message, 'error');
        }
    });

    window.openProcurementPrintModal = function (items) {
        const modal = document.getElementById('procurementPrintModal');
        const body = document.getElementById('printWorksheetBody');
        const dateEl = document.getElementById('printDateString');
        if (!modal || !body) return;

        const now = new Date();
        if (dateEl) {
            dateEl.textContent = `วันที่จัดทำ: ${now.toLocaleDateString('th-TH')} เวลา ${now.toLocaleTimeString('th-TH')}`;
        }

        body.innerHTML = items.map((it, idx) => `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>${it['รายละเอียดวัสดุ'] || '-'}</td>
                <td style="text-align:center;">${it['จำนวน'] || '-'} ${it['หน่วยนับ'] || ''}</td>
                <td style="text-align:center;">${it['ชื่อแผนก'] || '-'}<br>${it['ชื่อผู้ขอ'] || '-'}</td>
                <td style="text-align:center; white-space:nowrap;">${it['รหัสคำขอ'] || '-'}</td>
                <td>${it['หมายเหตุ'] || '-'}</td>
            </tr>
        `).join('');

        window.currentProcurementPrintItems = items;
        modal.classList.remove('hide');
        modal.style.display = 'flex';
    };

    window.closeProcurementPrintModal = function () {
        const modal = document.getElementById('procurementPrintModal');
        if (!modal) return;
        modal.classList.add('hide');
        modal.style.display = 'none';
    };

    window.printProcurementWorksheet = async function () {
        const items = window.currentProcurementPrintItems || [];
        const appScriptUrl = getAppScriptUrl();

        if (appScriptUrl && items.length > 0) {
            const grouped = {};
            items.forEach(it => {
                const reqId = it['รหัสคำขอ'];
                if (!grouped[reqId]) grouped[reqId] = [];
                grouped[reqId].push({
                    index: it['ลำดับรายการ'],
                    status: 'อยู่ระหว่างจัดซื้อ',
                    note: it['หมายเหตุ Admin'] || '',
                    qty: it['จำนวน'],
                    unit: it['หน่วยนับ']
                });
            });

            const user = sessionStorage.getItem('loggedInUser') || '';
            try {
                for (const [reqId, reqItems] of Object.entries(grouped)) {
                    await fetch(appScriptUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'updateStatus',
                            requestId: reqId,
                            updatedBy: user,
                            items: reqItems
                        })
                    });
                }
            } catch (e) {
                console.error('Auto update before print failed:', e);
            }
        }

        window.print();
        closeProcurementPrintModal();
        updateHomeView();
        renderTrackingTable();
    };

    window.removeItem = function (button) {
        const row = button.closest('.item-row');
        const container = document.getElementById('itemsContainer');
        if (container.querySelectorAll('.item-row').length > 1) {
            row.style.opacity = '0';
            row.style.transform = 'scale(0.95)';
            row.style.transition = 'all 0.15s ease';
            setTimeout(() => {
                row.remove();
                renumberItems();
            }, 150);
        } else {
            alert('จำเป็นต้องมีรายการวัสดุอย่างน้อย 1 รายการ');
        }
    };

    function checkLogin() {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (loggedInUser && userMapping[loggedInUser]) {
            const userData = userMapping[loggedInUser];

            if (userData.role === 'admin') {
                adminToggleContainer.classList.remove('hide');
                adminToggleContainer.style.display = 'inline-flex';
                isAdminMode = true;
                updateAdminToggleUI();
            } else {
                adminToggleContainer.classList.add('hide');
                adminToggleContainer.style.display = 'none';
                isAdminMode = false;
            }

            loginContainer.style.display = 'none';
            mainAppContainer.classList.remove('hide');
            mainAppContainer.style.display = 'flex';

            currentDeptCode = userData.code;
            if (deptDisplay) deptDisplay.textContent = userData.name;

            const dateSpan = document.getElementById('headerDate');
            if (dateSpan) {
                const today = new Date();
                dateSpan.textContent = '📅 ' + today.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            const sidebarDept = document.getElementById('sidebarUserDept');
            if (sidebarDept) sidebarDept.textContent = userData.name;
        }
    }

    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim().toLowerCase();

        if (userMapping[username]) {
            sessionStorage.setItem('loggedInUser', username);
            const userRole = userMapping[username].role;
            isAdminMode = userRole === 'admin';
            checkLogin();
            renderTrackingTable();
        } else {
            loginError.textContent = '❌ ชื่อผู้ใช้งานไม่ถูกต้อง กรุณาลองใหม่';
            loginError.classList.remove('hide');
            loginError.style.display = 'block';
        }
    });

    adminModeToggle?.addEventListener('change', () => {
        isAdminMode = adminModeToggle.checked;
        updateAdminToggleUI();
        renderTrackingTable();

        const activeBtn = document.querySelector('.sidebar-menu-btn.active');
        if (activeBtn?.getAttribute('data-target') === 'analysisSection') {
            renderAnalysis();
        }
    });

    logoutBtn?.addEventListener('click', () => {
        sessionStorage.removeItem('loggedInUser');
        isAdminMode = false;
        loginContainer.style.display = 'flex';
        mainAppContainer.classList.add('hide');
        mainAppContainer.style.display = 'none';
        document.getElementById('loginUsername').value = '';
        loginError.classList.add('hide');
        loginError.style.display = 'none';
    });

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanes.forEach(pane => {
                pane.classList.add('hide');
                pane.style.display = 'none';
            });

            const targetId = btn.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.remove('hide');
                targetPane.style.display = 'block';
            }

            if (breadcrumbText) {
                breadcrumbText.innerHTML = `หน้าหลัก / <strong>${btn.textContent.trim()}</strong>`;
            }

            if (targetId === 'trackingSection') {
                renderTrackingTable();
            } else if (targetId === 'analysisSection') {
                renderAnalysis();
            } else if (targetId === 'historySection' && window.renderHistoryTable) {
                window.renderHistoryTable();
            }
        });
    });

    addItemBtn?.addEventListener('click', addNewItem);
    addNewItem();

    itemsContainer?.addEventListener('change', (e) => {
        if (e.target.classList.contains('item-file')) {
            const file = e.target.files[0];
            const row = e.target.closest('.item-row');
            const b64 = row.querySelector('.item-file-base64');
            const fname = row.querySelector('.item-file-name');
            const fmime = row.querySelector('.item-file-mime');

            if (file) {
                if (file.size > 10 * 1024 * 1024) {
                    alert('ขนาดไฟล์ใหญ่เกิน 10 MB กรุณาเลือกไฟล์ใหม่');
                    e.target.value = '';
                    b64.value = '';
                    fname.value = '';
                    fmime.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    b64.value = ev.target.result.split(',')[1];
                    fname.value = file.name;
                    fmime.value = file.type;
                };
                reader.readAsDataURL(file);
            } else {
                b64.value = '';
                fname.value = '';
                fmime.value = '';
            }
        }
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();

        const appScriptUrl = getAppScriptUrl();
        if (!appScriptUrl) {
            showStatus('กรุณาตั้งค่า APPS_SCRIPT_URL ในไฟล์ config.js ก่อนใช้งาน', 'error');
            return;
        }

        const empName = document.getElementById('employeeName').value.trim();
        if (!empName) {
            showStatus('กรุณาระบุ "ชื่อผู้ขอ"', 'error');
            return;
        }

        if (!currentDeptCode) {
            showStatus('ไม่พบข้อมูลแผนก กรุณา login ใหม่', 'error');
            return;
        }

        const payload = { employeeName: empName, department: currentDeptCode, items: [] };
        const itemRows = document.querySelectorAll('.item-row');
        let valid = true;

        itemRows.forEach((row) => {
            const name = row.querySelector('.item-name').value.trim();
            const qty = row.querySelector('.item-quantity').value;
            const unit = row.querySelector('.item-unit').value.trim();
            const asset = row.querySelector('.item-asset').value.trim();
            const remarks = row.querySelector('.item-remarks').value.trim();
            const b64 = row.querySelector('.item-file-base64').value;
            const fn = row.querySelector('.item-file-name').value;
            const fm = row.querySelector('.item-file-mime').value;

            const prioToggle = row.querySelector('.item-priority-toggle');
            const prio = (prioToggle && prioToggle.checked) ? 'ด่วน' : 'ปกติ';

            if (name && qty && unit) {
                payload.items.push({
                    itemName: name,
                    quantity: qty,
                    unit: unit,
                    assetCode: asset || '',
                    remarks: remarks || '',
                    priority: prio,
                    file: b64 ? { data: b64, name: fn, mimeType: fm } : null
                });
            } else {
                valid = false;
            }
        });

        if (!valid || payload.items.length === 0) {
            showStatus('กรุณากรอกข้อมูลวัสดุ (รายละเอียด, จำนวน, หน่วย) ให้ครบถ้วน', 'error');
            return;
        }

        pendingPayload = payload;

        let html = '<ul class="confirm-summary-list">';
        html += `<li><span class="item-label">ผู้ขอ</span><span class="item-value">${empName}</span></li>`;
        const u = sessionStorage.getItem('loggedInUser');
        const dn = (u && userMapping[u]) ? userMapping[u].name : '-';
        html += `<li><span class="item-label">แผนก</span><span class="item-value">${dn}</span></li>`;
        html += `<li><span class="item-label">จำนวนรายการ</span><span class="item-value">${payload.items.length} รายการ</span></li>`;
        payload.items.forEach((item, i) => {
            html += `<li><span class="item-label">${i + 1}. ${item.itemName}</span><span class="item-value">${item.quantity} ${item.unit}</span></li>`;
        });
        html += '</ul>';

        confirmSummary.innerHTML = html;
        confirmModal.classList.remove('hide');
        confirmModal.style.display = 'flex';
    });

    confirmEditBtn?.addEventListener('click', () => {
        confirmModal.classList.add('hide');
        confirmModal.style.display = 'none';
        pendingPayload = null;
    });

    confirmSubmitBtn?.addEventListener('click', async () => {
        const appScriptUrl = getAppScriptUrl();

        confirmModal.classList.add('hide');
        confirmModal.style.display = 'none';
        if (!pendingPayload) return;

        if (editingRequestId) {
            pendingPayload.action = 'updateRequest';
            pendingPayload.requestId = editingRequestId;
        }

        setLoading(true);

        try {
            const res = await fetch(appScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(pendingPayload)
            });

            const result = await res.json();
            if (result.status === 'success') {
                const msg = editingRequestId
                    ? `✅ อัปเดตคำขอสำเร็จ! (${editingRequestId})`
                    : `✅ ส่งคำขอสำเร็จ! รหัสคำขอ: ${result.requestId}`;

                showStatus(msg, 'success');

                if (editingRequestId) {
                    cancelEdit();
                } else {
                    form.reset();
                    itemsContainer.innerHTML = '';
                    addNewItem();

                    if (deptDisplay) {
                        const u2 = sessionStorage.getItem('loggedInUser');
                        if (u2 && userMapping[u2]) deptDisplay.textContent = userMapping[u2].name;
                    }
                }

                renderTrackingTable();
                setTimeout(() => {
                    statusMessage.className = 'status-message';
                    statusMessage.textContent = '';
                }, 8000);
            } else {
                throw new Error(result.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
            }
        } catch (err) {
            console.error('Submission Error:', err);
            showStatus('❌ ไม่สามารถส่งข้อมูลได้: ' + (err.message === 'Failed to fetch' ? 'ปัญหาการเชื่อมต่อ หรือ CORS' : err.message), 'error');
        } finally {
            setLoading(false);
            pendingPayload = null;
        }
    });

    confirmModal?.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.classList.add('hide');
            confirmModal.style.display = 'none';
            pendingPayload = null;
        }
    });

    checkLogin();
    if (sessionStorage.getItem('loggedInUser')) {
        renderTrackingTable();
    }
});