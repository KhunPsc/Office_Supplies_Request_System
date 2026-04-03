document.addEventListener('DOMContentLoaded', () => {

    const userMapping = {
        'csa141': { code: '01', name: 'ผบส.', role: 'user' },
        'ssa141': { code: '02', name: 'ผสน.', role: 'admin' },
        'mca141': { code: '03', name: 'ผบร.', role: 'user' },
        'cma141': { code: '04', name: 'ผกส.', role: 'user' },
        'oma141': { code: '05', name: 'ผปบ.', role: 'user' },
        'mta141': { code: '06', name: 'ผมต.', role: 'user' },
        'dla141': { code: '07', name: 'กฟส.ดอยหล่อ', role: 'user' },
        'mja141': { code: '08', name: 'กฟส.แม่แจ่ม', role: 'user' },
    };

    const DEPT_MAP = {
        '01': 'ผบส.', '02': 'ผสน.', '03': 'ผบร.', '04': 'ผกส.',
        '05': 'ผปบ.', '06': 'ผมต.', '07': 'กฟส.ดอยหล่อ', '08': 'กฟส.แม่แจ่ม'
    };

    // #9: Consolidated status map — single source of truth
    const STATUS_MAP = {
        'รอจัดซื้อ': { cls: 'status-waiting', icon: '📦' },
        'อยู่ระหว่างจัดซื้อ': { cls: 'status-processing', icon: '⏳' },
        'ได้รับบางส่วน': { cls: 'status-partial', icon: '🌗' },
        'เสร็จสิ้น': { cls: 'status-done', icon: '✅' },
        'ยกเลิก': { cls: 'status-cancelled', icon: '❌' }
    };

    // ===== DOM =====
    const loginContainer = document.getElementById('loginContainer');
    const mainAppContainer = document.getElementById('mainAppContainer');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminToggleContainer = document.getElementById('adminToggleContainer');
    const adminModeToggle = document.getElementById('adminModeToggle');
    const deptDisplay = document.getElementById('deptDisplay');

    let currentDeptCode = '';
    let isAdminMode = false; // Toggle state for admin users
    let adminPriorityFilter = 'ทั้งหมด'; // NEW: Filter state for admin workboard
    let adminSortState = { key: 'date', direction: 'asc' }; // NEW: Sort state for admin workboard

    checkLogin();

    // ===== Login =====
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim().toLowerCase();
        if (userMapping[username]) {
            sessionStorage.setItem('loggedInUser', username);
            const userRole = userMapping[username].role;
            isAdminMode = (userRole === 'admin'); 
            checkLogin();
        } else {
            loginError.textContent = '❌ ชื่อผู้ใช้งานไม่ถูกต้อง กรุณาลองใหม่';
            loginError.classList.remove('hide');
            loginError.style.display = 'block';
        }
    });

    // ===== Admin View Toggle (Switch) =====
    if (adminModeToggle) {
        adminModeToggle.addEventListener('change', () => {
            isAdminMode = adminModeToggle.checked;
            document.body.classList.toggle('admin-theme', isAdminMode);
            
            // #2: Update menu name based on mode
            const menuHomeBtn = document.getElementById('menuHomeBtn');
            if (menuHomeBtn) {
                menuHomeBtn.textContent = isAdminMode ? 'Admin Workboard' : 'แบบฟอร์มขอจัดซื้อ';
            }
            
            // Toggle Main Home View between Form and Admin Summary
            updateHomeView();
            
            renderTrackingTable();
        });
    }

    function updateHomeView() {
        const form = document.getElementById('purchaseRequestForm');
        const adminHome = document.getElementById('adminHomeView');
        if (!form || !adminHome) return;

        if (isAdminMode) {
            form.classList.add('hide');
            form.style.display = 'none';
            adminHome.classList.remove('hide');
            adminHome.style.display = 'block';
            renderAdminHomeSummary();
        } else {
            form.classList.remove('hide');
            form.style.display = 'block';
            adminHome.classList.add('hide');
            adminHome.style.display = 'none';
        }
    }

    async function renderAdminHomeSummary() {
        const adminHome = document.getElementById('adminHomeView');
        adminHome.innerHTML = '<div class="card" style="padding:2rem; text-align:center;">⌛ กำลังสรุปงานที่ต้องจัดการ...</div>';

        let rawData;
        try {
            rawData = await fetchTrackingData();
        } catch (err) {
            // #6: Show error state with retry button
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

        // Group only PENDING or PROCESSING (The real work for admin)
        const pendingItems = rawData.filter(r => r['สถานะ'] === 'รอจัดซื้อ' || r['สถานะ'] === 'อยู่ระหว่างจัดซื้อ');
        
        if (pendingItems.length === 0) {
            adminHome.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">✅ คำขอทั้งหมดได้รับการจัดการเรียบร้อยแล้ว (เหลือเพียงรายการที่เสร็จสิ้นหรือยกเลิก)</div>`;
            return;
        }

        // Summary by Department
        const deptSummary = {};
        pendingItems.forEach(it => {
            const d = it['ชื่อแผนก'] || 'ไม่ระบุ';
            if (!deptSummary[d]) deptSummary[d] = 0;
            deptSummary[d]++;
        });

        let html = `
            <div style="margin-bottom: 2rem;">
                <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">👋 สวัสดีครับ Admin</h1>
                <p style="color: var(--text-muted);">นี่คือภาพรวมงานที่รอคุณจัดการในขณะนี้</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <!-- Pantone Red Gradient for Total Tasks -->
                <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, #E0218A 0%, #CC0000 100%); color: white; border: none; box-shadow: 0 4px 15px rgba(204, 0, 0, 0.2);">
                    <div style="font-size: 0.9rem; opacity: 0.9; font-weight: 500;">งานที่ต้องทำทั้งหมด</div>
                    <div style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px;">${pendingItems.length} <span style="font-size: 1rem; font-weight: 500; opacity: 0.8;">รายการย่อย</span></div>
                </div>
                <div class="card" style="padding: 1.5rem; border-left: 5px solid #f59e0b;">
                    <div style="font-size: 0.9rem; color: var(--text-muted);">สถานะ: รอจัดซื้อ</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #b45309;">${pendingItems.filter(i=>i['สถานะ']==='รอจัดซื้อ').length}</div>
                </div>
                <div class="card" style="padding: 1.5rem; border-left: 5px solid #3b82f6;">
                    <div style="font-size: 0.9rem; color: var(--text-muted);">สถานะ: อยู่ระหว่างจัดซื้อ</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #1d4ed8;">${pendingItems.filter(i=>i['สถานะ']==='อยู่ระหว่างจัดซื้อ').length}</div>
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
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            สร้างใบงาน
                        </button>
                    </div>
                </div>
                <div id="adminWorklistTableContainer">
                    <!-- This will be filled by the item-level table -->
                </div>
            </div>
        `;

        adminHome.innerHTML = html;
        
        // Setup Filter Listener
        const pFilter = document.getElementById('adminPriorityFilter');
        if (pFilter) {
            pFilter.addEventListener('change', (e) => {
                adminPriorityFilter = e.target.value;
                renderAdminItemTable(window.currentPendingItemsRaw);
            });
        }
        
        renderAdminItemTable(pendingItems);
    }

    function renderAdminItemTable(items) {
        const container = document.getElementById('adminWorklistTableContainer');
        if (!container) return;

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

        // Cache for batch
        window.currentPendingItemsRaw = items;

        // Apply Filter
        let displayItems = [...items];
        if (adminPriorityFilter !== 'ทั้งหมด') {
            displayItems = displayItems.filter(it => {
                const prio = String(it['Priority'] || it['priority'] || it['Piority'] || 'ปกติ').trim();
                return prio === adminPriorityFilter;
            });
        }

        // Apply Sorting
        displayItems.sort((a, b) => {
            let vA, vB;
            if (adminSortState.key === 'date') {
                vA = new Date(a['วันที่-เวลาที่ขอ']).getTime();
                vB = new Date(b['วันที่-เวลาที่ขอ']).getTime();
            } else if (adminSortState.key === 'priority') {
                // Priority Weight: 'ด่วน' = 1, 'ปกติ' = 2
                const weights = { 'ด่วน': 1, 'ปกติ': 2 };
                vA = weights[a['Priority'] || a['priority'] || a['Piority']] || 2;
                vB = weights[b['Priority'] || b['priority'] || b['Piority']] || 2;
            }
            
            if (vA < vB) return adminSortState.direction === 'asc' ? -1 : 1;
            if (vA > vB) return adminSortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

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
            } catch (e) { }

            let updateTimeStr = '';
            if (item['วันที่อัปเดตสถานะ']) {
                try {
                    const u = new Date(item['วันที่อัปเดตสถานะ']);
                    if (!isNaN(u)) {
                        updateTimeStr = u.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + 
                                        u.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
                    }
                } catch(e){}
            }

            html += `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="item-checkbox" value="${itemKey}">
                    </td>
                    <td style="font-weight: 500;">
                        ${item['รายละเอียดวัสดุ']}
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                            ${item['หมายเหตุ'] ? `หมายเหตุ: ${item['หมายเหตุ']}` : ''}
                        </div>
                        ${item['ไฟล์แนบ URL'] ? `<button onclick="event.stopPropagation(); openImageModal('${item['ไฟล์แนบ URL']}')" class="btn-file-view" style="border:none; background:none; cursor:pointer; font-size:0.75rem; padding: 0;">📂 ดูไฟล์</button>` : ''}
                    </td>
                    <td>
                        <div style="display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;">
                            <input class="form-control inline-qty" data-key="${itemKey}" type="number" step="any" value="${item['จำนวน']}" style="width:45px; padding:2px; font-size:0.8rem; text-align:center;">
                            <input class="form-control inline-unit" data-key="${itemKey}" type="text" value="${item['หน่วยนับ']}" style="width:45px; padding:2px; font-size:0.8rem; text-align:center;">
                            <button class="btn-inline-save" data-key="${itemKey}" title="บันทึกการแก้ไขเฉพาะรายการนี้" style="border:none; background:none; cursor:pointer; padding:2px; display:none; color:var(--primary-main); font-size:1.1rem; line-height:1;">💾</button>
                        </div>
                        <div style="margin-top: 4px;">
                            <span class="prio-badge ${prioValue === 'ด่วน' ? 'prio-urgent' : 'prio-normal'}">
                                ${prioValue === 'ด่วน' ? '🚩 ด่วน' : '🏳️ ปกติ'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${stClass}">${item['สถานะ']}</span>
                        ${updateTimeStr ? `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; white-space: nowrap;">🕒 ${updateTimeStr}</div>` : ''}
                    </td>
                    <td style="font-size: 0.85rem; color: var(--primary-main);">${reqId}</td>
                    <td style="font-size: 0.85rem;">
                        <div>${item['ชื่อแผนก']}</div>
                        <div style="color: var(--text-muted);">${item['ชื่อผู้ขอ']}</div>
                    </td>
                    <td style="font-size: 0.85rem;">${dateStr}</td>
                </tr>
            `;
        });

        if (displayItems.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">ไม่พบรายการที่ตรงกับเงื่อนไขการกรอง</td></tr>`;
        }
        html += `</tbody></table></div>`;
        container.innerHTML = html;
        updateAdminSortIcons();

        // Catch inline edits so they reflect in Batch Modal and Save
        container.querySelectorAll('.inline-qty, .inline-unit').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const key = inp.dataset.key;
                const it = window.currentPendingItemsRaw.find(i => `${i['รหัสคำขอ']}_${i['ลำดับรายการ']}` === key);
                if (it) {
                    if (inp.classList.contains('inline-qty')) it['จำนวน'] = e.target.value;
                    else it['หน่วยนับ'] = e.target.value;
                }
                // Show the save button for this row
                const row = inp.closest('tr');
                const sBtn = row.querySelector('.btn-inline-save');
                if (sBtn) sBtn.style.display = 'inline-block';
            });
        });

        container.querySelectorAll('.btn-inline-save').forEach(btn => {
            btn.addEventListener('click', () => saveSingleItemInline(btn.dataset.key, btn));
        });

        // Checkbox listeners
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

        checkboxes.forEach(cb => {
            cb.addEventListener('change', updateBatchBtnState);
        });

        // Get selected items helper
        const getSelectedItems = () => {
            const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked')).map(cb => cb.value);
            if (checkedBoxes.length === 0) return [];
            return window.currentPendingItemsRaw.filter(it => {
                const key = `${it['รหัสคำขอ']}_${it['ลำดับรายการ']}`;
                return checkedBoxes.includes(key);
            });
        };

        // Batch Update Button Event
        batchBtn?.addEventListener('click', () => {
            const items = getSelectedItems();
            if (items.length && window.openBatchAdminModal) {
                window.openBatchAdminModal(items);
            }
        });

        // Procurement PDF Button Event
        procureBtn?.addEventListener('click', () => {
            const items = getSelectedItems();
            if (items.length && window.openProcurementPrintModal) {
                window.openProcurementPrintModal(items);
            }
        });
    }

    window.setAdminSort = function(key) {
        if (adminSortState.key === key) {
            adminSortState.direction = adminSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            adminSortState.key = key;
            adminSortState.direction = 'asc';
        }
        renderAdminItemTable(window.currentPendingItemsRaw);
    };

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

    function updateAdminToggleUI() {
        if (adminModeToggle) {
            adminModeToggle.checked = isAdminMode;
            document.body.classList.toggle('admin-theme', isAdminMode);
            updateHomeView();
        }
    }


    // ===== Logout =====
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('loggedInUser');
        isAdminMode = false;
        loginContainer.style.display = 'flex';
        mainAppContainer.classList.add('hide');
        mainAppContainer.style.display = 'none';
        document.getElementById('loginUsername').value = '';
        loginError.classList.add('hide');
        loginError.style.display = 'none';
    });

    function checkLogin() {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (loggedInUser && userMapping[loggedInUser]) {
            const userData = userMapping[loggedInUser];

            // Show admin toggle if user is admin
            if (userData.role === 'admin') {
                adminToggleContainer.classList.remove('hide');
                adminToggleContainer.style.display = 'inline-flex';
                updateAdminToggleUI();
            } else {
                adminToggleContainer.classList.add('hide');
                adminToggleContainer.style.display = 'none';
            }

            loginContainer.style.display = 'none';
            mainAppContainer.classList.remove('hide');
            mainAppContainer.style.display = 'flex';

            currentDeptCode = userData.code;
            if (deptDisplay) deptDisplay.textContent = userData.name;

            const dateSpan = document.getElementById('headerDate');
            if (dateSpan) {
                const today = new Date();
                dateSpan.textContent = '📅 ' + today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            }

            const sidebarDept = document.getElementById('sidebarUserDept');
            if (sidebarDept) sidebarDept.textContent = userData.name;
        }
    }

    // ===== Sidebar Toggle =====
    const sidebar = document.getElementById('appSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // ===== Tab Navigation =====
    const navButtons = document.querySelectorAll('.sidebar-menu-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const breadcrumbText = document.getElementById('breadcrumbText');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabPanes.forEach(pane => { pane.classList.add('hide'); pane.style.display = 'none'; });
            const targetPane = document.getElementById(btn.getAttribute('data-target'));
            if (targetPane) { targetPane.classList.remove('hide'); targetPane.style.display = 'block'; }
            if (breadcrumbText) { breadcrumbText.innerHTML = `หน้าหลัก / <strong>${btn.textContent}</strong>`; }
        });
    });

    // ===== Form Logic =====
    const itemsContainer = document.getElementById('itemsContainer');
    const addItemBtn = document.getElementById('addItemBtn');
    const itemTemplate = document.getElementById('itemTemplate');
    const form = document.getElementById('purchaseRequestForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitSpinner = document.getElementById('submitSpinner');
    const statusMessage = document.getElementById('statusMessage');

    let editingRequestId = null; // Track if we are in Edit Mode
    let currentRequestsData = {}; // Cache tracking data for easy lookup

    addNewItem();
    addItemBtn.addEventListener('click', addNewItem);

    // Edit logic: Enter edit mode
    window.editRequest = function (id) {
        const req = currentRequestsData[id];
        if (!req) return;

        // 1. Switch to Form tab
        const formBtn = Array.from(navButtons).find(b => b.getAttribute('data-target') === 'formSection');
        if (formBtn) formBtn.click();

        // 2. Set editing mode
        editingRequestId = id;
        submitBtnText.innerText = '📦 บันทึกการแก้ไข (Save Changes)';
        submitBtn.classList.add('btn-edit-mode'); // Should add CSS for this
        
        // Add cancel button if not exists
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

        // 3. Populate form
        document.getElementById('employeeName').value = req.requester;
        
        // Find dCode from Name
        const dCode = Object.keys(DEPT_MAP).find(k => DEPT_MAP[k] === req.deptName) || req.deptCode;
        if (dCode) {
            currentDeptCode = dCode; // Update global state
            if (deptDisplay) deptDisplay.innerText = DEPT_MAP[dCode] || dCode;
        }

        // Clear and refill items
        itemsContainer.innerHTML = '';
        req.items.forEach((item, idx) => {
            addNewItem();
            const rows = itemsContainer.querySelectorAll('.item-row');
            const currentRow = rows[rows.length - 1];
            
            currentRow.querySelector('.item-name').value = item.name;
            currentRow.querySelector('.item-quantity').value = item.qty;
            currentRow.querySelector('.item-unit').value = item.unit;
            currentRow.querySelector('.item-asset').value = item.asset;
            currentRow.querySelector('.item-remarks').value = item.rem;
            if (currentRow.querySelector('.item-priority-toggle')) {
                const isUrgent = (item.priority === 'ด่วน');
                currentRow.querySelector('.item-priority-toggle').checked = isUrgent;
                const prioNote = currentRow.querySelector('.priority-note');
                if (prioNote) prioNote.style.display = isUrgent ? 'inline-block' : 'none';
            }
        });
        
        showStatus(`🔨 คุณกำลังแก้ไขคำขอ: ${id} (รายการไฟล์แนบเดิมจะหายไปหากไม่แนบใหม่)`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.cancelEdit = function() {
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

    // File → Base64
    itemsContainer.addEventListener('change', (e) => {
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
                    b64.value = fname.value = fmime.value = '';
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
                b64.value = fname.value = fmime.value = '';
            }
        }
    });

    // ===== Confirmation Modal =====
    const confirmModal = document.getElementById('confirmModal');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    const confirmSummary = document.getElementById('confirmSummary');
    let pendingPayload = null;

    // Form submit → validate → show confirmation popup
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!APPS_SCRIPT_URL) {
            showStatus('กรุณานำ URL จาก Google Apps Script (Deploy as Web App) มาใส่ในไฟล์ script.js ก่อนใช้งาน', 'error');
            return;
        }

        const empName = document.getElementById('employeeName').value.trim();
        if (!empName) { showStatus('กรุณาระบุ "ชื่อผู้ขอ"', 'error'); return; }
        if (!currentDeptCode) { showStatus('ไม่พบข้อมูลแผนก กรุณา login ใหม่', 'error'); return; }

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
                    itemName: name, quantity: qty, unit: unit,
                    assetCode: asset || '', remarks: remarks || '',
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

        // Build summary for confirmation popup
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

        // Show modal
        confirmModal.classList.remove('hide');
        confirmModal.style.display = 'flex';
    });

    // "แก้ไข" — close modal, go back to form
    confirmEditBtn.addEventListener('click', () => {
        confirmModal.classList.add('hide');
        confirmModal.style.display = 'none';
        pendingPayload = null;
    });

    // "ยืนยัน" — actually send data
    confirmSubmitBtn.addEventListener('click', async () => {
        confirmModal.classList.add('hide');
        confirmModal.style.display = 'none';
        if (!pendingPayload) return;

        // Add edit context if applicable
        if (editingRequestId) {
            pendingPayload.action = 'updateRequest';
            pendingPayload.requestId = editingRequestId;
        }

        setLoading(true);
        try {
            const res = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(pendingPayload)
            });
            const result = await res.json();
            if (result.status === 'success') {
                const msg = editingRequestId ? `✅ อัปเดตคำขอสำเร็จ! (${editingRequestId})` : `✅ ส่งคำขอสำเร็จ! รหัสคำขอ: ${result.requestId}`;
                showStatus(msg, 'success');
                
                if (editingRequestId) {
                    cancelEdit(); // Reset edit mode
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
                setTimeout(() => { statusMessage.className = 'status-message'; statusMessage.textContent = ''; }, 8000);
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

    // Close modal on overlay click
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.classList.add('hide');
            confirmModal.style.display = 'none';
            pendingPayload = null;
        }
    });

    // ===== Tracking Table =====
    const trackingTableBody = document.getElementById('trackingTableBody');
    const trackingEmpty = document.getElementById('trackingEmpty');

    async function fetchTrackingData() {
        if (!APPS_SCRIPT_URL) return [];
        const user = sessionStorage.getItem('loggedInUser');
        if (!user || !userMapping[user]) return [];

        const deptCode = userMapping[user].code;
        
        // Pass 'admin' role only if Toggle is in Admin View
        const role = isAdminMode ? 'admin' : 'user';

        try {
            const url = `${APPS_SCRIPT_URL}?action=tracking&deptCode=${deptCode}&role=${role}&t=${Date.now()}`;
            const res = await fetch(url);
            const result = await res.json();
            return result.status === 'success' ? result.data : [];
        } catch (err) {
            console.error('Fetch Error:', err);
            return [];
        }
    }

    // Global Sort State
    let sortState = { key: 'date', direction: 'desc' };

    window.setSort = function(key) {
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

        // Group rows by requestId
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
                updateTime: row['วันที่อัปเดตสถานะ'] // Matched with user's sheet screenshot column P
            });
        });

        // Compute overall request status based on item statuses
        Object.values(groupsMap).forEach(group => {
            const allItems = group.items;
            const statusCounts = {
                'รอจัดซื้อ': 0,
                'อยู่ระหว่างจัดซื้อ': 0,
                'เสร็จสิ้น': 0,
                'ยกเลิก': 0
            };
            
            allItems.forEach(it => {
                if(statusCounts[it.status] !== undefined) {
                    statusCounts[it.status]++;
                } else {
                    // Fallback
                    statusCounts['รอจัดซื้อ']++;
                }
            });

            const total = allItems.length;
            const doneTotal = statusCounts['เสร็จสิ้น'] + statusCounts['ยกเลิก'];

            if (total === 1) {
                // If only 1 item, overall status is that item's status
                group.status = allItems[0].status;
            } else if (statusCounts['รอจัดซื้อ'] === total) {
                group.status = 'รอจัดซื้อ';
            } else if (doneTotal === total) {
                group.status = 'เสร็จสิ้น';
            } else if (statusCounts['อยู่ระหว่างจัดซื้อ'] === total) {
                group.status = 'อยู่ระหว่างจัดซื้อ';
            } else {
                group.status = 'ได้รับบางส่วน';
            }

            // Also keep the latest update time from items
            let latestUpdate = null;
            allItems.forEach(it => {
                if (it.updateTime) {
                    const d = new Date(it.updateTime);
                    if (!latestUpdate || d > latestUpdate) latestUpdate = d;
                }
            });
            group.latestUpdate = latestUpdate;
        });

        currentRequestsData = groupsMap; 

        // Convert to Array and Sort globally
        let groups = Object.values(groupsMap);
        
        // --- Filter for Workboard (Home) ---
        if (targetContainerId === 'adminWorklistTableContainer') {
            groups = groups.filter(g => g.status !== 'เสร็จสิ้น' && g.status !== 'ยกเลิก');
        }

        groups.sort((a, b) => {
            let vA = a[sortState.key];
            let vB = b[sortState.key];
            if (sortState.key === 'date') {
                vA = new Date(vA).getTime();
                vB = new Date(vB).getTime();
            }
            if (vA < vB) return sortState.direction === 'asc' ? -1 : 1;
            if (vA > vB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });


        const statusKeys = ['รอจัดซื้อ', 'อยู่ระหว่างจัดซื้อ', 'ได้รับบางส่วน', 'เสร็จสิ้น', 'ยกเลิก'];

        let html = '';

        statusKeys.forEach(stKey => {
            const reqs = groups.filter(g => g.status === stKey);
            if (reqs.length === 0) return; // Hide empty boxes

            const stMeta = STATUS_MAP[stKey] || { cls: '', icon: '📌' };
            
            // Map status text to card CSS class
            const cardClassMap = {
                'รอจัดซื้อ': 'card-waiting',
                'อยู่ระหว่างจัดซื้อ': 'card-processing',
                'ได้รับบางส่วน': 'card-partial',
                'เสร็จสิ้น': 'card-done',
                'ยกเลิก': 'card-cancelled'
            };
            const cardCls = cardClassMap[stKey] || '';

            html += `
            <div class="card ${cardCls}" style="margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); margin-bottom: 1rem; padding-bottom: 0.5rem;">
                    <h3 style="color: var(--text-main); margin: 0;">
                        ${stMeta.icon} ${stKey} 
                        <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal; margin-left: 0.5rem;">(${reqs.length} รายการ)</span>
                    </h3>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="cursor:pointer; width:18%;" onclick="setSort('id')">รหัสคำขอ <span class="sort-icon sort-id"></span></th>
                                <th style="cursor:pointer; width:15%;" onclick="setSort('date')">วันที่ขอ <span class="sort-icon sort-date"></span></th>
                                <th style="cursor:pointer; width:12%;" onclick="setSort('deptName')">แผนก <span class="sort-icon sort-deptName"></span></th>
                                <th style="cursor:pointer; width:15%;" onclick="setSort('requester')">ผู้ขอ <span class="sort-icon sort-requester"></span></th>
                                <th style="cursor:pointer; width:12%; text-align:center;" onclick="setSort('itemsCount')">รายการ <span class="sort-icon sort-itemsCount"></span></th>
                                <th style="cursor:pointer; width:13%;" onclick="setSort('status')">สถานะ <span class="sort-icon sort-status"></span></th>
                                <th style="text-align:center; width:15%;">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            reqs.forEach((req) => {
                const showManageBtn = isAdminMode;
                const canEdit = req.status === 'รอจัดซื้อ';

                // Format Date & Time
                let dateStr = req.date;
                let timeStr = '';
                try {
                    const d = new Date(req.date);
                    if (!isNaN(d)) {
                        dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                        timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) { }

                html += `
                    <tr class="tracking-tr" id="req-row-${req.id}" onclick="toggleRequestDetails('${req.id}')">
                        <td style="font-weight:500;">
                            <span class="expand-icon" style="display:inline-block; margin-right:5px;">▶</span>
                            ${req.id}
                        </td>
                        <td>
                            <div>${dateStr}</div>
                            <div class="text-time">${timeStr} น.</div>
                        </td>
                        <td>${req.deptName || '-'}</td>
                        <td>${req.requester}</td>
                        <td style="text-align:center;">
                            <div style="font-weight:700; color:var(--primary-main);">${req.items.length} รายการ</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; font-weight:400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; margin-left: auto; margin-right: auto;">
                                ${req.items.map(i => i.name).slice(0, 2).join(', ')}${req.items.length > 2 ? '...' : ''}
                            </div>
                        </td>
                        <td><span class="status-badge ${stMeta.cls}">${req.status}</span></td>
                        <td>
                            <div style="display:flex; gap:5px; justify-content:center;">
                                ${showManageBtn ? `<button class="btn btn-primary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="event.stopPropagation(); openAdminModal('${req.id}')">จัดการ</button>` : ''}
                                ${canEdit ? `<button class="btn btn-outline" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="event.stopPropagation(); editRequest('${req.id}')">แก้ไข</button>` : (showManageBtn ? '' : '-')}
                            </div>
                        </td>
                    </tr>
                    <tr id="detail-${req.id}" class="detail-row hide" style="display: none;">
                        <td colspan="7" style="padding:0; border:none;">
                            <div class="detail-container">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                                    <div class="detail-header" style="margin-bottom:0;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                                        รายการวัสดุในคำขอนี้
                                    </div>
                                    <div class="text-time" style="font-style:italic;">
                                        ${req.latestUpdate ? `อัปเดตล่าสุด: ${new Date(req.latestUpdate).toLocaleString('th-TH')}` : ''}
                                    </div>
                                </div>
                                <table class="detail-table" style="width:100%;">
                                    <thead>
                                        <tr>
                                            <th style="width:35%;">วัสดุ</th>
                                            <th style="text-align:center;">จำนวน/หน่วย</th>
                                            <th style="text-align:center;">Priority</th>
                                            <th>รหัสทรัพย์สิน</th>
                                            <th>หมายเหตุ Admin</th>
                                            <th style="text-align:right;">ไฟล์แนบ</th>
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
                                                    ${it.name}
                                                    <div style="margin-top: 0.25rem; display:flex; align-items:center; gap:8px;">
                                                        <span class="status-badge ${stMetaItem.cls}" style="font-size:0.7rem; padding:0.15rem 0.5rem;">${it.status}</span>
                                                        ${itemTime ? `<span class="text-time" style="font-size:0.75rem;">เมื่อ ${itemTime} น.</span>` : ''}
                                                    </div>
                                                </td>
                                                <td style="text-align:center;">${it.qty} ${it.unit}</td>
                                                <td style="text-align:center;">
                                                    <span class="prio-badge ${it.priority === 'ด่วน' ? 'prio-urgent' : 'prio-normal'}" style="font-size:0.75rem;">
                                                        ${it.priority === 'ด่วน' ? '🚩 ด่วน' : '🏳️ ปกติ'}
                                                    </span>
                                                </td>
                                                <td style="font-family:monospace; font-size:0.85rem;">${it.asset || '-'}</td>
                                                <td style="color:var(--text-muted); font-size:0.85rem;">${it.note || '-'}</td>
                                                <td style="text-align:right;">
                                                    ${it.url ? `<button onclick="event.stopPropagation(); openImageModal('${it.url}')" class="btn-file-view" style="border:none; background:none; cursor:pointer; font-size:0.85rem;">📂 ดูไฟล์</button>` : '-'}
                                                </td>
                                            </tr>
                                            `
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
        updateSortIcons();
    }


    // ===== Image/File Modal Logic =====
    const imageModal = document.getElementById('imageModal');
    const imagePreview = document.getElementById('imagePreview');
    const pdfPreview = document.getElementById('pdfPreview');
    const previewLoader = document.getElementById('previewLoader');
    const downloadBtn = document.getElementById('downloadBtn');

    window.openImageModal = function (url) {
        imageModal.classList.remove('hide');
        imageModal.style.display = 'flex';

        imagePreview.style.display = 'none';
        pdfPreview.style.display = 'none';
        previewLoader.style.display = 'block';
        downloadBtn.href = url;

        // Drive URL Transformation for better preview (file/d/ID/preview)
        let previewUrl = url;
        if (url.includes('drive.google.com')) {
            const match = url.match(/id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                // Using /preview is much more reliable for Drive files in an iframe
                previewUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
            }
        }

        // For Drive files, the preview URL works best in iframe
        if (previewUrl.includes('drive.google.com')) {
            pdfPreview.src = previewUrl;
            pdfPreview.style.display = 'block';
            previewLoader.style.display = 'none';
        } else {
            // Non-drive fallback
            const isPdf = url.toLowerCase().includes('.pdf');
            if (isPdf) {
                pdfPreview.src = url;
                pdfPreview.style.display = 'block';
                previewLoader.style.display = 'none';
            } else {
                imagePreview.src = url;
                imagePreview.onload = () => {
                    imagePreview.style.display = 'block';
                    previewLoader.style.display = 'none';
                };
                imagePreview.onerror = () => {
                    previewLoader.innerText = 'ไม่สามารถแสดงพรีวิวได้ กรุณาใช้ปุ่มดาวน์โหลด';
                };
            }
        }
    };

    window.closeImageModal = function () {
        imageModal.classList.add('hide');
        imageModal.style.display = 'none';
        imagePreview.src = '';
        pdfPreview.src = '';
    };

    // Toggle expansion
    window.toggleRequestDetails = function (id) {
        const row = document.getElementById(`req-row-${id}`);
        const detail = document.getElementById(`detail-${id}`);
        if (!row || !detail) return;

        const isHidden = detail.style.display === 'none';
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

    // Initial render
    renderTrackingTable();

    // Call render when switching tabs
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-target') === 'trackingSection') {
                renderTrackingTable();
            } else if (btn.getAttribute('data-target') === 'historySection') {
                if (window.renderHistoryTable) window.renderHistoryTable();
            }
        });
    });

    // ===== Helpers =====
    function addNewItem() {
        const clone = itemTemplate.content.cloneNode(true);
        const row = clone.querySelector('.item-row');

        // Priority Toggle behavior
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

    function renumberItems() {
        const rows = itemsContainer.querySelectorAll('.item-row');
        rows.forEach((row, i) => {
            const numEl = row.querySelector('.item-number');
            if (numEl) numEl.textContent = i + 1;
        });
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        if (isLoading) {
            submitSpinner.classList.remove('hide');
            submitBtnText.textContent = 'กำลังส่งข้อมูล...';
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        } else {
            submitSpinner.classList.add('hide');
            // #1: Preserve button text when in edit mode
            submitBtnText.textContent = editingRequestId 
                ? '📦 บันทึกการแก้ไข (Save Changes)' 
                : '🚀 ส่งคำขอจัดซื้อ (Submit)';
        }
    }

    function showStatus(text, type) {
        statusMessage.textContent = text;
        statusMessage.className = `status-message status-${type}`;
    }

    // ===== Admin Status Management Logic =====
    const adminStatusModal = document.getElementById('adminStatusModal');
    const adminReqIdSpan = document.getElementById('adminReqId');
    const adminItemsContainer = document.getElementById('adminItemsContainer');
    const saveStatusBtn = document.getElementById('saveStatusBtn');

    window.openAdminModal = function(id) {
        const req = currentRequestsData[id];
        if(!req) return;
        adminReqIdSpan.innerText = id;
        
        let html = `
            <table class="data-table" style="font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th style="width: 35%">วัสดุ</th>
                        <th style="width: 15%; text-align:center;">จำนวน</th>
                        <th style="width: 25%">สถานะ</th>
                        <th style="width: 25%">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody>
        `;

        req.items.forEach(it => {
            html += `
                <tr class="admin-item-row" data-index="${it.index}">
                    <td style="white-space: normal; font-weight:500;">${it.name}</td>
                    <td style="text-align:center;">
                        <div style="display:flex; gap:5px; align-items:center; justify-content:center;">
                            <input type="number" class="form-control item-qty-input" value="${it.qty}" step="any" style="width: 60px; padding:0.25rem; font-size: 0.85rem; text-align:center;">
                            <input type="text" class="form-control item-unit-input" value="${it.unit}" style="width: 60px; padding:0.25rem; font-size: 0.85rem; text-align:center;">
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
                        <input type="text" class="form-control item-note-input" value="${it.note || ''}" placeholder="หมายเหตุ..." style="padding:0.25rem; font-size: 0.85rem; width:100%;">
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        if (adminItemsContainer) adminItemsContainer.innerHTML = html;

        adminStatusModal.classList.remove('hide');
        adminStatusModal.style.display = 'flex';
    };

    window.closeAdminModal = function() {
        adminStatusModal.classList.add('hide');
        adminStatusModal.style.display = 'none';
    };

    if(saveStatusBtn) {
        saveStatusBtn.addEventListener('click', async () => {
            const id = adminReqIdSpan.innerText;
            const user = sessionStorage.getItem('loggedInUser');

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
                
                if (status === 'ยกเลิก' && note === '') {
                    isValid = false;
                    noteInput.style.border = '1px solid red';
                } else {
                    noteInput.style.border = '';
                }

                itemsToUpdate.push({ index, status, note, qty, unit });
            });

            if (!isValid) {
                alert('กรุณาระบุหมายเหตุสำหรับรายการที่เลือกสถานะเป็น "ยกเลิก"');
                return;
            }

            // Immediate feedback: Disable button and show loading logic
            const originalBtnHtml = saveStatusBtn.innerHTML;
            saveStatusBtn.disabled = true;
            saveStatusBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px; border-width:2px;"></span> กำลังบันทึก...';

            setLoading(true);
            try {
                const res = await fetch(APPS_SCRIPT_URL, {
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
                if(result.status === 'success') {
                    // Show a quick success alert before closing (optional but helpful)
                    saveStatusBtn.innerHTML = '✅ บันทึกสำเร็จ!';
                    saveStatusBtn.style.background = '#10b981';
                    
                    setTimeout(() => {
                        showStatus(`✅ อัปเดตสถานะ ${id} เรียบร้อยแล้ว`, 'success');
                        closeAdminModal();
                        updateHomeView(); // Refresh admin home item list
                        renderTrackingTable(); // Refresh tracking table
                        // Reset button style
                        saveStatusBtn.disabled = false;
                        saveStatusBtn.innerHTML = originalBtnHtml;
                        saveStatusBtn.style.background = '';
                    }, 800);
                } else {
                    throw new Error(result.message);
                }
            } catch(e) {
                console.error(e);
                showStatus('❌ ไม่สามารถอัปเดตสถานะได้: ' + e.message, 'error');
                saveStatusBtn.disabled = false;
                saveStatusBtn.innerHTML = originalBtnHtml;
            } finally {
                setLoading(false);
            }
        });
    }

    // Close admin modal on overlay click
    adminStatusModal?.addEventListener('click', (e) => {
        if (e.target === adminStatusModal) closeAdminModal();
    });

    // ===== BATCH Admin Status Management Logic =====
    window.openBatchAdminModal = function(selectedItems) {
        let html = `
            <table class="data-table" style="font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th style="width: 15%">รหัสคำขอ</th>
                        <th style="width: 30%">วัสดุ</th>
                        <th style="width: 20%">สถานะ</th>
                        <th style="width: 35%">หมายเหตุ Admin</th>
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
            const qtyStr = `${it['จำนวน']} ${it['หน่วยนับ']}`;

            html += `
                <tr class="batch-admin-item-row" data-req="${reqId}" data-index="${idx}">
                    <td style="font-size: 0.85rem; color: var(--primary-main);">${reqId}</td>
                    <td style="white-space: normal; font-weight:500;">
                        ${name}
                        <div style="display:flex; gap:5px; align-items:center; margin-top:5px;">
                            <input type="number" class="form-control batch-item-qty-input" value="${it['จำนวน']}" step="any" style="width: 65px; padding:0.25rem; font-size: 0.8rem; text-align:center;">
                            <input type="text" class="form-control batch-item-unit-input" value="${it['หน่วยนับ']}" style="width: 65px; padding:0.25rem; font-size: 0.8rem; text-align:center;">
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
                        <input type="text" class="form-control batch-item-note-input" value="${note}" placeholder="หมายเหตุ..." style="padding:0.25rem; font-size: 0.85rem; width:100%;">
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        const container = document.getElementById('batchAdminItemsContainer');
        if (container) container.innerHTML = html;

        // Reset global batch status selector
        const batchSelect = document.getElementById('batchStatusSelect');
        if (batchSelect) batchSelect.value = '';

        const modal = document.getElementById('batchAdminStatusModal');
        if (modal) {
            modal.classList.remove('hide');
            modal.style.display = 'flex';
        }
    };

    window.closeBatchAdminModal = function() {
        const modal = document.getElementById('batchAdminStatusModal');
        if (modal) {
            modal.classList.add('hide');
            modal.style.display = 'none';
        }
    };

    // applied globally
    document.getElementById('applyBatchStatusBtn')?.addEventListener('click', () => {
        const val = document.getElementById('batchStatusSelect').value;
        if (!val) return;
        document.querySelectorAll('.batch-item-status-select').forEach(sel => sel.value = val);
    });

    document.getElementById('saveBatchStatusBtn')?.addEventListener('click', async () => {
        const user = sessionStorage.getItem('loggedInUser');
        const rows = document.querySelectorAll('.batch-admin-item-row');
        const groups = {}; // group by reqId
        let isValid = true;
        
        rows.forEach(row => {
            const reqId = row.getAttribute('data-req');
            const index = row.getAttribute('data-index');
            const status = row.querySelector('.batch-item-status-select').value;
            const noteInput = row.querySelector('.batch-item-note-input');
            const note = noteInput.value.trim();
            const qty = row.querySelector('.batch-item-qty-input').value.trim();
            const unit = row.querySelector('.batch-item-unit-input').value.trim();
            
            if (status === 'ยกเลิก' && note === '') {
                isValid = false;
                noteInput.style.border = '1px solid red';
            } else {
                noteInput.style.border = '';
            }
            
            if(!groups[reqId]) groups[reqId] = [];
            groups[reqId].push({ index, status, note, qty, unit });
        });

        if (!isValid) {
            alert('กรุณาระบุหมายเหตุสำหรับรายการที่เลือกเปลี่ยนสถานะเป็น "ยกเลิก"');
            return;
        }

        const btn = document.getElementById('saveBatchStatusBtn');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:5px;"></span> กำลังบันทึก...';
        setLoading(true);

        try {
            // Need to send a request for each reqId sequentially
            let successCount = 0;
            let failCount = 0;
            
            for (const [reqId, items] of Object.entries(groups)) {
                try {
                    const res = await fetch(APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'updateStatus',
                            requestId: reqId,
                            updatedBy: user,
                            items: items // Array of changes
                        })
                    });
                    const result = await res.json();
                    if (result.status !== 'success') {
                        throw new Error(`อัปเดต ${reqId} ไม่สำเร็จ: ` + result.message);
                    }
                    successCount++;
                } catch(reqErr) {
                    console.error(reqErr);
                    failCount++;
                }
            }

            if (failCount === 0) {
                btn.innerHTML = '✅ บันทึกสำเร็จ!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    showStatus(`✅ อัปเดตสถานะสำเร็จทั้งหมด`, 'success');
                    closeBatchAdminModal();
                    updateHomeView();
                    renderTrackingTable();
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    btn.style.background = '';
                }, 1000);
            } else {
                btn.innerHTML = `✅ สำเร็จ ${successCount}, ❌ ล้มเหลว ${failCount}`;
                btn.style.background = '#f59e0b';
                setTimeout(() => {
                    showStatus(`อัปเดตสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`, 'error');
                    closeBatchAdminModal();
                    updateHomeView();
                    renderTrackingTable();
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    btn.style.background = '';
                }, 2500);
            }
            
        } catch (e) {
            console.error(e);
            showStatus('❌ ข้อผิดพลาด: ' + e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        } finally {
            setLoading(false);
        }
    });

    const batchModal = document.getElementById('batchAdminStatusModal');
    batchModal?.addEventListener('click', (e) => {
        if (e.target === batchModal) closeBatchAdminModal();
    });

    // ===== Procurement PDF Print Logic =====
    let currentProcurementItems = [];

    window.openProcurementPrintModal = function(selectedItems) {
        currentProcurementItems = selectedItems;
        const modal = document.getElementById('procurementPrintModal');
        const tbody = document.getElementById('printWorksheetBody');
        const dateStr = document.getElementById('printDateString');
        
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        if (dateStr) {
            dateStr.innerText = `พิมพ์เมื่อ: ${now.toLocaleDateString('th-TH', options)} น.`;
        }

        let html = '';
        selectedItems.forEach((it, idx) => {
            html += `
                <tr>
                    <td style="text-align: center; padding: 8px;">${idx + 1}</td>
                    <td style="padding: 8px; font-weight: 500;">
                        ${it['รายละเอียดวัสดุ']}
                    </td>
                    <td style="text-align: center; padding: 8px; white-space: nowrap;">${it['จำนวน']} ${it['หน่วยนับ']}</td>
                    <td style="text-align: center; padding: 8px;">
                        <div>${it['ชื่อแผนก']}</div>
                        <div style="font-size: 0.8rem; color: #555;">${it['ชื่อผู้ขอ']}</div>
                    </td>
                    <td style="text-align: center; padding: 8px; font-size: 0.8rem; white-space: nowrap;">${it['รหัสคำขอ']}</td>
                    <td style="text-align: center; padding: 8px; font-size: 0.85rem;">${it['หมายเหตุ'] || '-'}</td>
                </tr>
            `;
        });

        if (tbody) tbody.innerHTML = html;
        if (modal) {
            modal.classList.remove('hide');
            modal.style.display = 'flex';
        }
    };

    window.closeProcurementPrintModal = function() {
        const modal = document.getElementById('procurementPrintModal');
        if (modal) {
            modal.classList.add('hide');
            modal.style.display = 'none';
        }
        currentProcurementItems = [];
    };

    window.printProcurementWorksheet = async function() {
        // Open Print Dialog
        window.print();
        
        // Auto-update to processing if needed
        if (!currentProcurementItems.length) return;
        
        const user = sessionStorage.getItem('loggedInUser');
        const groups = {};
        let needsUpdate = false;
        
        currentProcurementItems.forEach(it => {
            if (it['สถานะ'] !== 'อยู่ระหว่างจัดซื้อ' && it['สถานะ'] !== 'เสร็จสิ้น') {
                const reqId = it['รหัสคำขอ'];
                if (!groups[reqId]) groups[reqId] = [];
                groups[reqId].push({
                    index: it['ลำดับรายการ'],
                    status: 'อยู่ระหว่างจัดซื้อ',
                    note: 'อัปเดตอัตโนมัติ (ดึงเข้าตารางพิมพ์)'
                });
                needsUpdate = true;
            }
        });

        if (!needsUpdate) return; // All already processing or completed

        // Indicate loading (optional but good for UX if they stay on page)
        const btn = document.getElementById('finalPrintPdfBtn');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'กำลังเปลี่ยนสถานะอัตโนมัติ...';
        }

        try {
            for (const [reqId, items] of Object.entries(groups)) {
                const res = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'updateStatus',
                        requestId: reqId,
                        updatedBy: user,
                        items: items
                    })
                });
                const result = await res.json();
                if (result.status !== 'success') throw new Error(`อัปเดต ${reqId} ไม่สำเร็จ`);
            }
            
            updateHomeView();
            renderTrackingTable();
            if (btn) {
                btn.innerHTML = '✅ อัปเดตสถานะสำเร็จ';
                setTimeout(() => {
                    closeProcurementPrintModal();
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }, 1000);
            }
            
        } catch (e) {
            console.error(e);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // ===== History Rendering Logic =====
    window.renderHistoryTable = async function() {
        const container = document.getElementById('historyTableContainer');
        if (!container) return;

        container.innerHTML = '<div class="card" style="text-align:center; padding:3rem;"><div class="spinner" style="width:40px; height:40px; border-width:4px; margin:0 auto 1rem; color:var(--primary-main);"></div><div style="color:var(--text-muted); font-size:1.1rem;">กำลังโหลดข้อมูลประวัติ...</div></div>';
        
        // Fetch data independently
        const rawData = await fetchTrackingData();

        if (!rawData || rawData.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">ไม่พบข้อมูลหรือคุณยังไม่เคยทำรายการใดๆ</div>';
            return;
        }

        // Filter only completed/cancelled items
        let allItems = rawData.filter(row => {
            const st = String(row['สถานะ'] || '').trim();
            return st === 'เสร็จสิ้น' || st === 'ยกเลิก';
        }).map(row => ({
            reqId: row['รหัสคำขอ'],
            name: row['รายละเอียดวัสดุ'],
            qty: row['จำนวน'],
            unit: row['หน่วยนับ'],
            status: row['สถานะ'],
            department: row['ชื่อแผนก'],
            requester: row['ชื่อผู้ขอ'],
            rem: row['หมายเหตุ'] || '',
            priority: row['Priority'] || 'ปกติ',
            note: row['หมายเหตุ Admin'] || '',
            url: row['ไฟล์แนบ URL'] || '',
            updateTime: row['วันที่อัปเดตสถานะ'] || '',
            requestDate: row['วันที่-เวลาที่ขอ']
        }));

        // Apply Filters
        const searchInput = document.getElementById('historySearchInput');
        const filterSelect = document.getElementById('historyFilterSelect');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterStatus = filterSelect ? filterSelect.value : 'ทั้งหมด';
        
        if (filterStatus !== 'ทั้งหมด') {
            allItems = allItems.filter(it => it.status === filterStatus);
        }
        if (searchTerm) {
            allItems = allItems.filter(it => 
                it.reqId.toLowerCase().includes(searchTerm) || 
                it.name.toLowerCase().includes(searchTerm) ||
                (it.department || '').toLowerCase().includes(searchTerm) ||
                (it.requester || '').toLowerCase().includes(searchTerm)
            );
        }

        // Sort descending by update time (newest first)
        allItems.sort((a, b) => {
            const tA = a.updateTime ? new Date(a.updateTime).getTime() : 0;
            const tB = b.updateTime ? new Date(b.updateTime).getTime() : 0;
            return tB - tA;
        });

        if (allItems.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted); background: white; border-radius: 8px;">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:0.5; margin-bottom:10px;"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <div style="font-size: 1rem;">ไม่พบข้อมูลประวัติที่ตรงกับเงื่อนไข</div>
            </div>`;
            return;
        }

        let html = `
            <table class="data-table" style="font-size: 0.9rem; min-width: 800px; background: white;">
                <thead>
                    <tr>
                        <th style="width: 15%;">รหัสคำขอ</th>
                        <th style="width: 15%;">วันที่อัปเดต</th>
                        <th style="width: 25%;">วัสดุ</th>
                        <th style="width: 10%; text-align:center;">จำนวน</th>
                        <th style="width: 15%;">สถานะ/ความเร่งด่วน</th>
                        <th style="width: 20%;">หมายเหตุ/หมายเหตุ Admin</th>
                    </tr>
                </thead>
                <tbody>
        `;

        allItems.forEach(it => {
            const stMeta = STATUS_MAP[it.status] || { cls: 'status-waiting' };
            let updateStr = '-';
            if (it.updateTime) {
                try {
                    const u = new Date(it.updateTime);
                    if (!isNaN(u)) updateStr = u.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + u.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
                } catch(e){}
            }

            let combinedNotes = [];
            if (it.rem) combinedNotes.push('ผู้ขอ: ' + it.rem);
            if (it.note) combinedNotes.push('Admin: ' + it.note);

            html += `
                <tr>
                    <td style="color: var(--primary-main); font-weight: 500;">
                        ${it.reqId}
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${it.department}</div>
                    </td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${updateStr}</td>
                    <td style="font-weight: 500;">
                        ${it.name}
                        ${it.url ? `<p style="margin:4px 0 0;"><button onclick="event.preventDefault(); window.openImageModal('${it.url}')" style="font-size: 0.75rem; color: var(--primary-light); background:none; border:none; padding:0; cursor:pointer;">📂 ดูไฟล์แนบ</button></p>` : ''}
                    </td>
                    <td style="text-align: center;">${it.qty} ${it.unit}</td>
                    <td>
                        <span class="status-badge ${stMeta.cls}">${it.status}</span>
                        <div style="font-size: 0.75rem; margin-top: 4px; color:${it.priority === 'ด่วน' ? '#ef4444' : 'var(--text-muted)'}; font-weight:${it.priority === 'ด่วน' ? 'bold' : 'normal'};">ความเร่งด่วน: ${it.priority}</div>
                    </td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${combinedNotes.join('<br>')}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    };

    let historyDebounce = null;
    const debouncedHistoryRender = () => {
        clearTimeout(historyDebounce);
        historyDebounce = setTimeout(() => window.renderHistoryTable(), 300);
    };
    
    const hSearchInput = document.getElementById('historySearchInput');
    const hClearBtn = document.getElementById('clearHistorySearchBtn');
    if (hSearchInput) {
        hSearchInput.addEventListener('input', (e) => {
            if (hClearBtn) hClearBtn.style.display = e.target.value ? 'block' : 'none';
            debouncedHistoryRender();
        });
    }
    if (hClearBtn) {
        hClearBtn.addEventListener('click', () => {
            if (hSearchInput) hSearchInput.value = '';
            hClearBtn.style.display = 'none';
            debouncedHistoryRender();
        });
    }
    
    document.getElementById('historyFilterSelect')?.addEventListener('change', () => window.renderHistoryTable());

    async function saveSingleItemInline(itemKey, btn) {
        const it = window.currentPendingItemsRaw.find(i => `${i['รหัสคำขอ']}_${i['ลำดับรายการ']}` === itemKey);
        if (!it) return;

        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '⌛'; 
        btn.disabled = true;

        const user = sessionStorage.getItem('loggedInUser');

        try {
            const res = await fetch(APPS_SCRIPT_URL, {
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
                throw new Error(result.message);
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

});

// Global: remove item row
window.removeItem = function (button) {
    const row = button.closest('.item-row');
    const container = document.getElementById('itemsContainer');
    if (container.querySelectorAll('.item-row').length > 1) {
        row.style.opacity = '0';
        row.style.transform = 'scale(0.95)';
        row.style.transition = 'all 0.15s ease';
        setTimeout(() => {
            row.remove();
            const rows = container.querySelectorAll('.item-row');
            rows.forEach((r, i) => {
                const n = r.querySelector('.item-number');
                if (n) n.textContent = i + 1;
            });
        }, 150);
    } else {
        alert('จำเป็นต้องมีรายการวัสดุอย่างน้อย 1 รายการ');
    }
}
