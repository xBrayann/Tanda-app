/* ================================================
   GESTOR DE TANDA - Application Logic v2.0
   ================================================ */

// ---- State ----
const MAX_TANDAS = 3;
const MAX_PEOPLE = 30;
let tandas = [];
let currentTandaId = null;
let editingTandaId = null;
let modalAction = null;

// ---- Day / Month names ----
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };

// Status cycle: '' → 'paid' → 'card' → 'received' → ''
const STATUS_CYCLE = ['', 'paid', 'card', 'received'];
const STATUS_CONTENT = { '': '', paid: '✓', card: 'C', received: '★' };
const STATUS_LABEL   = { '': 'Pendiente', paid: 'Entregado', card: 'Tarjeta', received: 'Recibido' };

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateHeaderDate();

    document.getElementById('tanda-people').addEventListener('input', onPeopleCountChange);

    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('fade-out');
        document.getElementById('app').classList.remove('hidden');
        setTimeout(() => { document.getElementById('splash-screen').style.display = 'none'; }, 500);
    }, 800);

    renderHome();
});

// ---- Data Persistence ----
function loadData() {
    try {
        const stored = localStorage.getItem('mitanda_data');
        if (stored) tandas = JSON.parse(stored);
    } catch (e) {
        tandas = [];
    }
}

function saveData() {
    localStorage.setItem('mitanda_data', JSON.stringify(tandas));
}

// ---- Helpers ----
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function updateHeaderDate() {
    const now = new Date();
    document.getElementById('header-date').textContent =
        `${DAYS_ES[now.getDay()]} ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]}`;
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

function formatDateFull(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`;
}

function getDayName(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return DAYS_ES[d.getDay()].substring(0, 3);
}

function calculateDates(startDate, count, frequency) {
    const dates = [];
    const start = new Date(startDate + 'T12:00:00');
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        switch (frequency) {
            case 'weekly':   d.setDate(start.getDate() + i * 7); break;
            case 'biweekly': d.setDate(start.getDate() + i * 14); break;
            case 'monthly':  d.setMonth(start.getMonth() + i); break;
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
    }
    return dates;
}

function isCurrentWeek(dateStr) {
    const today = new Date();
    const d = new Date(dateStr + 'T12:00:00');
    return Math.abs(Math.floor((today - d) / 86400000)) <= 3;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---- Navigation ----
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goHome() {
    editingTandaId = null;
    currentTandaId = null;
    showScreen('screen-home');
    renderHome();
}

// ---- Toast ----
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || '✓'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ---- Modal ----
function showModal(title, message, confirmText, action) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').textContent = confirmText;
    modalAction = action;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    modalAction = null;
}

function modalConfirmAction() {
    if (modalAction) modalAction();
    closeModal();
}

// ---- Home Screen ----
function renderHome() {
    const emptyState = document.getElementById('empty-state');
    const tandasList = document.getElementById('tandas-list');
    const fabAdd = document.getElementById('fab-add');

    const totalPeople = tandas.reduce((sum, t) => sum + t.participants.length, 0);
    const totalProgress = calculateTotalProgress();
    document.getElementById('stat-tandas').textContent = tandas.length;
    document.getElementById('stat-personas').textContent = totalPeople;
    document.getElementById('stat-progreso').textContent = totalProgress + '%';

    if (tandas.length === 0) {
        emptyState.classList.remove('hidden');
        tandasList.classList.add('hidden');
        fabAdd.classList.add('hidden');
        document.getElementById('stats-bar').classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        tandasList.classList.remove('hidden');
        document.getElementById('stats-bar').classList.remove('hidden');
        fabAdd.classList.toggle('hidden', tandas.length >= MAX_TANDAS);

        tandasList.innerHTML = '';
        tandas.forEach((tanda, index) => tandasList.appendChild(createTandaCard(tanda, index)));

        if (tandas.length >= MAX_TANDAS) {
            const warning = document.createElement('div');
            warning.className = 'limit-warning';
            warning.innerHTML = '⚠️ Has alcanzado el máximo de 3 tandas';
            tandasList.appendChild(warning);
        }
    }
}

function calculateTotalProgress() {
    if (tandas.length === 0) return 0;
    let totalCells = 0, filledCells = 0;
    tandas.forEach(t => {
        const n = t.participants.length;
        t.participants.forEach((_, pi) => {
            for (let di = 0; di < n; di++) {
                totalCells++;
                if (t.status && t.status[`${pi}-${di}`]) filledCells++;
            }
        });
    });
    return totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
}

function calculateTandaProgress(tanda) {
    const n = tanda.participants.length;
    let total = n * n, filled = 0;
    tanda.participants.forEach((_, pi) => {
        for (let di = 0; di < n; di++) {
            if (tanda.status && tanda.status[`${pi}-${di}`]) filled++;
        }
    });
    return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function createTandaCard(tanda, index) {
    const card = document.createElement('div');
    card.className = 'tanda-card';
    card.style.animationDelay = `${index * 0.1}s`;
    card.onclick = () => openTandaDetail(tanda.id);

    const progress = calculateTandaProgress(tanda);
    const dates = calculateDates(tanda.startDate, tanda.participants.length, tanda.frequency);
    const startDay = getDayName(tanda.startDate);
    const isComplete = progress === 100;

    card.innerHTML = `
        <div class="tanda-card-header">
            <span class="tanda-card-name">${escapeHtml(tanda.name)}</span>
            <span class="tanda-card-badge ${isComplete ? 'complete' : ''}">${isComplete ? 'Completa' : 'Activa'}</span>
        </div>
        <div class="tanda-card-meta">
            <span class="tanda-meta-item"><span class="meta-icon">👥</span> ${tanda.participants.length} personas</span>
            <span class="tanda-meta-item"><span class="meta-icon">📅</span> Semanal</span>
            <span class="tanda-meta-item"><span class="meta-icon">🗓️</span> ${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}</span>
        </div>
        <div class="tanda-progress-bar">
            <div class="tanda-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="tanda-progress-text">
            <span>${progress}% completado</span>
            <span>${tanda.participants.length} semanas</span>
        </div>
    `;
    return card;
}

// ---- Create / Edit Tanda ----
function showCreateTanda() {
    if (tandas.length >= MAX_TANDAS && !editingTandaId) {
        showToast('Máximo 3 tandas permitidas', 'error');
        return;
    }
    editingTandaId = null;
    document.getElementById('create-title').textContent = 'Nueva Tanda';
    document.getElementById('btn-save-tanda').innerHTML = '<span class="btn-icon">✓</span> Crear Tanda';
    document.getElementById('tanda-form').reset();
    document.getElementById('participants-section').style.display = 'none';

    const today = new Date();
    document.getElementById('tanda-start').value =
        `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    showScreen('screen-create');
}

function editCurrentTanda() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;

    editingTandaId = tanda.id;
    document.getElementById('create-title').textContent = 'Editar Tanda';
    document.getElementById('btn-save-tanda').innerHTML = '<span class="btn-icon">✓</span> Guardar Cambios';

    document.getElementById('tanda-name').value = tanda.name;
    document.getElementById('tanda-people').value = tanda.participants.length;
    document.getElementById('tanda-start').value = tanda.startDate;

    buildParticipantsList(tanda.participants.length, tanda.participants);
    showScreen('screen-create');
}

function onPeopleCountChange(e) {
    const count = parseInt(e.target.value);
    if (count >= 2 && count <= MAX_PEOPLE) {
        buildParticipantsList(count);
    } else {
        document.getElementById('participants-section').style.display = 'none';
    }
}

// ---- Participants List (with add/remove buttons) ----
function buildParticipantsList(count, existingNames = []) {
    const section = document.getElementById('participants-section');
    const list = document.getElementById('participants-list');
    section.style.display = 'block';
    list.innerHTML = '';

    for (let i = 0; i < count; i++) {
        addParticipantRow(list, i, existingNames[i] || '');
    }

    refreshParticipantNumbers();
}

function addParticipantRow(container, index, name) {
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.dataset.index = index;
    row.draggable = true;
    row.innerHTML = `
        <span class="drag-handle" title="Arrastra para cambiar orden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="8" y1="6" x2="16" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="8" y1="18" x2="16" y2="18"/>
            </svg>
        </span>
        <span class="participant-number">${index + 1}</span>
        <input type="text" class="participant-input"
               placeholder="Participante ${index + 1}"
               value="${escapeHtml(name)}"
               maxlength="30">
        <button type="button" class="btn-remove-participant" onclick="removeParticipantRow(this)" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    // ---- Desktop drag events ----
    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend',   onDragEnd);
    row.addEventListener('dragover',  onDragOver);
    row.addEventListener('drop',      onDrop);

    // ---- Touch events (mobile) ----
    const handle = row.querySelector('.drag-handle');
    handle.addEventListener('touchstart', onTouchStart, { passive: false });

    container.appendChild(row);
}

function removeParticipantRow(btn) {
    const list = document.getElementById('participants-list');
    const rows = list.querySelectorAll('.participant-row');
    if (rows.length <= 2) {
        showToast('Mínimo 2 participantes', 'error');
        return;
    }
    btn.closest('.participant-row').remove();
    refreshParticipantNumbers();
    syncCounterField();
}

function addParticipant() {
    const list = document.getElementById('participants-list');
    const rows = list.querySelectorAll('.participant-row');
    if (rows.length >= MAX_PEOPLE) {
        showToast(`Máximo ${MAX_PEOPLE} participantes`, 'error');
        return;
    }
    const newIndex = rows.length;
    addParticipantRow(list, newIndex, '');
    refreshParticipantNumbers();
    syncCounterField();
    // Focus new input
    list.querySelectorAll('.participant-input')[newIndex]?.focus();
}

function refreshParticipantNumbers() {
    const list = document.getElementById('participants-list');
    list.querySelectorAll('.participant-row').forEach((row, i) => {
        row.querySelector('.participant-number').textContent = i + 1;
        row.querySelector('.participant-input').placeholder = `Participante ${i + 1}`;
        row.dataset.index = i;
    });
}

function syncCounterField() {
    const list = document.getElementById('participants-list');
    const count = list.querySelectorAll('.participant-row').length;
    document.getElementById('tanda-people').value = count;
}

// ---- Drag & Drop (Desktop) ----
let _dragSrc = null;

function onDragStart(e) {
    _dragSrc = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
}

function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.participant-row').forEach(r => r.classList.remove('drag-over'));
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.participant-row').forEach(r => r.classList.remove('drag-over'));
    if (this !== _dragSrc) this.classList.add('drag-over');
    return false;
}

function onDrop(e) {
    e.stopPropagation();
    if (_dragSrc && _dragSrc !== this) {
        const list = this.parentNode;
        const rows = [...list.querySelectorAll('.participant-row')];
        const srcIdx  = rows.indexOf(_dragSrc);
        const destIdx = rows.indexOf(this);
        if (srcIdx < destIdx) {
            list.insertBefore(_dragSrc, this.nextSibling);
        } else {
            list.insertBefore(_dragSrc, this);
        }
        refreshParticipantNumbers();
    }
    return false;
}

// ---- Touch Drag (Mobile) ----
let _touchRow = null;
 let _touchClone = null;
let _touchOffsetY = 0;

function onTouchStart(e) {
    const row = this.closest('.participant-row');
    _touchRow = row;
    const touch = e.touches[0];
    const rect = row.getBoundingClientRect();
    _touchOffsetY = touch.clientY - rect.top;

    // Create visual clone
    _touchClone = row.cloneNode(true);
    _touchClone.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        opacity: 0.85;
        pointer-events: none;
        z-index: 9999;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        background: var(--bg-card-hover);
        transition: none;
    `;
    document.body.appendChild(_touchClone);
    row.classList.add('dragging');

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend',  onTouchEnd);
    e.preventDefault();
}

function onTouchMove(e) {
    if (!_touchClone || !_touchRow) return;
    e.preventDefault();
    const touch = e.touches[0];
    const y = touch.clientY - _touchOffsetY;
    _touchClone.style.top = y + 'px';

    // Find the row under the finger
    _touchClone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    _touchClone.style.display = '';
    const target = el?.closest('.participant-row');

    document.querySelectorAll('.participant-row').forEach(r => r.classList.remove('drag-over'));
    if (target && target !== _touchRow) target.classList.add('drag-over');
}

function onTouchEnd(e) {
    if (!_touchRow) return;
    const touch = e.changedTouches[0];

    // Find drop target
    _touchClone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    _touchClone.style.display = '';
    const target = el?.closest('.participant-row');

    if (target && target !== _touchRow) {
        const list = _touchRow.parentNode;
        const rows = [...list.querySelectorAll('.participant-row')];
        const srcIdx  = rows.indexOf(_touchRow);
        const destIdx = rows.indexOf(target);
        if (srcIdx < destIdx) {
            list.insertBefore(_touchRow, target.nextSibling);
        } else {
            list.insertBefore(_touchRow, target);
        }
        refreshParticipantNumbers();
    }

    // Cleanup
    _touchRow.classList.remove('dragging');
    document.querySelectorAll('.participant-row').forEach(r => r.classList.remove('drag-over'));
    _touchClone.remove();
    _touchClone = null;
    _touchRow = null;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend',  onTouchEnd);
}

function saveTanda(e) {
    e.preventDefault();

    const name = document.getElementById('tanda-name').value.trim();
    const startDate = document.getElementById('tanda-start').value;
    const frequency = 'weekly'; // siempre semanal

    // Gather participants from DOM
    const participantInputs = document.querySelectorAll('.participant-input');
    const participants = [];
    participantInputs.forEach((input, i) => {
        participants.push(input.value.trim());
    });

    const peopleCount = participants.length;

    if (!name || !startDate) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    if (peopleCount < 2 || peopleCount > MAX_PEOPLE) {
        showToast(`El número de personas debe ser entre 2 y ${MAX_PEOPLE}`, 'error');
        return;
    }

    if (editingTandaId) {
        const tanda = tandas.find(t => t.id === editingTandaId);
        if (tanda) {
            const oldCount = tanda.participants.length;
            tanda.name = name;
            tanda.amount = 0;
            tanda.startDate = startDate;
            tanda.frequency = frequency;
            tanda.participants = participants;

            // Clean up status if participant count changed
            if (oldCount !== peopleCount) {
                const newStatus = {};
                Object.keys(tanda.status || {}).forEach(key => {
                    const [pi, di] = key.split('-').map(Number);
                    if (pi < peopleCount && di < peopleCount) newStatus[key] = tanda.status[key];
                });
                tanda.status = newStatus;
            }

            saveData();
            showToast('Tanda actualizada');
            openTandaDetail(tanda.id);
        }
    } else {
        const tanda = {
            id: generateId(),
            name,
            amount: 0,
            startDate,
            frequency,
            participants,
            status: {},
            createdAt: new Date().toISOString()
        };
        tandas.push(tanda);
        saveData();
        showToast('¡Tanda creada exitosamente!');
        openTandaDetail(tanda.id);
    }
}

// ---- Tanda Detail ----
function openTandaDetail(tandaId) {
    const tanda = tandas.find(t => t.id === tandaId);
    if (!tanda) return;

    currentTandaId = tandaId;
    document.getElementById('detail-title').textContent = tanda.name;
    document.getElementById('detail-people-count').textContent = tanda.participants.length;

    renderGrid(tanda);
    showScreen('screen-detail');
}

function renderGrid(tanda) {
    const dates = calculateDates(tanda.startDate, tanda.participants.length, tanda.frequency);
    const thead = document.getElementById('grid-head');
    const tbody = document.getElementById('grid-body');

    // Header
    let headerHtml = '<tr><th># Participante</th>';
    dates.forEach((date, di) => {
        const isNow = isCurrentWeek(date);
        headerHtml += `<th class="date-header ${isNow ? 'current-week' : ''}">
            S${di + 1}
            <span class="date-day">${formatDateShort(date)}</span>
        </th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Body
    let bodyHtml = '';
    tanda.participants.forEach((participant, pi) => {
        bodyHtml += `<tr id="row-${pi}">`;
        const receiveDate = dates[pi] ? formatDateShort(dates[pi]) : "";
        const displayName = participant || "";
        bodyHtml += `<td>
            <div class="grid-participant">
                <span class="grid-participant-num">${pi + 1}</span>
                <span class="grid-participant-name" title="${receiveDate} - ${escapeHtml(participant)}">
                    ${escapeHtml(displayName)}
                    <span class="grid-participant-date">${receiveDate}</span>
                </span>
            </div>
        </td>`;

        dates.forEach((date, di) => {
            const key = `${pi}-${di}`;
            const status = (tanda.status && tanda.status[key]) || '';
            const content = STATUS_CONTENT[status] || '';
            const label = STATUS_LABEL[status] || 'Pendiente';
            const isReceiverTurn = (pi === di);

            let cellClass = `status-cell${status ? ' ' + status : ''}`;

            bodyHtml += `<td${isReceiverTurn ? ' style="position:relative"' : ''}>
                <button class="${cellClass}"
                        onclick="toggleStatus('${tanda.id}', ${pi}, ${di}, this)"
                        title="${label}">
                    ${content}
                </button>
                ${isReceiverTurn ? '<span class="receiver-badge">Recibe</span>' : ''}
            </td>`;
        });

        bodyHtml += '</tr>';
    });

    tbody.innerHTML = bodyHtml;
}

// ---- Toggle Status (cycle: '' → paid → card → received → '') ----
function toggleStatus(tandaId, pi, di, btn) {
    const tanda = tandas.find(t => t.id === tandaId);
    if (!tanda) return;

    const key = `${pi}-${di}`;
    if (!tanda.status) tanda.status = {};

    const current = tanda.status[key] || '';
    const currentIdx = STATUS_CYCLE.indexOf(current);
    const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
    const next = STATUS_CYCLE[nextIdx];

    if (next) {
        tanda.status[key] = next;
    } else {
        delete tanda.status[key];
    }

    saveData();

    // Update button
    btn.className = `status-cell${next ? ' ' + next : ''}`;
    btn.textContent = STATUS_CONTENT[next] || '';
    btn.title = STATUS_LABEL[next] || 'Pendiente';
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);
}

// ---- Delete Tanda ----
function confirmDeleteTanda() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;
    showModal(
        'Eliminar Tanda',
        `¿Eliminar "${tanda.name}"? Esta acción no se puede deshacer.`,
        'Eliminar',
        () => {
            tandas = tandas.filter(t => t.id !== currentTandaId);
            saveData();
            showToast('Tanda eliminada');
            goHome();
        }
    );
}

// ---- Export PNG ----
function exportTandaPNG() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;

    const btn = document.getElementById('btn-export-png');
    btn.classList.add('exporting');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Generando...`;

    const dates = calculateDates(tanda.startDate, tanda.participants.length, tanda.frequency);
    const captureContainer = document.getElementById('capture-container');

    let tableHeader = '<th>Participante</th>';
    dates.forEach(date => {
        tableHeader += `<th>${formatDateShort(date)}<span class="date-day">${getDayName(date)}</span></th>`;
    });

    let tableBody = '';
    tanda.participants.forEach((participant, pi) => {
        tableBody += '<tr>';
        tableBody += `<td>
            <div class="capture-participant">
                <span class="capture-participant-num">${pi + 1}</span>
                <span class="capture-participant-name">${escapeHtml(participant)}</span>
            </div>
        </td>`;

        dates.forEach((date, di) => {
            const key = `${pi}-${di}`;
            const status = (tanda.status && tanda.status[key]) || '';
            const isReceiverTurn = (pi === di);

            let statusClass = 'capture-status capture-status-pending';
            let statusContent = '';

            if (status === 'paid') {
                statusClass = 'capture-status capture-status-paid';
                statusContent = '✓';
            } else if (status === 'card') {
                statusClass = 'capture-status capture-status-card';
                statusContent = 'C';
            } else if (status === 'received') {
                statusClass = 'capture-status capture-status-received';
                statusContent = '★';
            }

            tableBody += `<td>
                <div class="${statusClass}">${statusContent}</div>
                ${isReceiverTurn ? '<span class="capture-receiver">Recibe</span>' : ''}
            </td>`;
        });

        tableBody += '</tr>';
    });

    captureContainer.innerHTML = `
        <div class="capture-card">
            <table class="capture-table">
                <thead><tr>${tableHeader}</tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
        </div>
    `;

    requestAnimationFrame(() => {
        const captureEl = captureContainer.querySelector('.capture-card');
        html2canvas(captureEl, {
            backgroundColor: '#0d0f14',
            scale: 2,
            useCORS: true,
            logging: false,
            width: captureEl.scrollWidth,
            height: captureEl.scrollHeight,
        }).then(canvas => {
            canvas.toBlob(blob => {
                if (!blob) { showToast('Error al generar imagen', 'error'); resetExportBtn(); return; }
                downloadBlob(blob, `tanda-${tanda.name.replace(/\s+/g, '-').toLowerCase()}.png`);
                showToast('Imagen descargada ✓', 'info');
                resetExportBtn();
            }, 'image/png');
        }).catch(err => {
            console.error('html2canvas error:', err);
            showToast('Error al generar imagen', 'error');
            resetExportBtn();
        });
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetExportBtn() {
    const btn = document.getElementById('btn-export-png');
    btn.classList.remove('exporting');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Exportar PNG`;
}
