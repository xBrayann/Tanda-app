/* ================================================
   MI TANDA - Application Logic
   ================================================ */

// ---- State ----
const MAX_TANDAS = 3;
const MAX_PEOPLE = 30;
let tandas = [];
let currentTandaId = null;
let editingTandaId = null;
let modalAction = null;

// ---- Day names in Spanish ----
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateHeaderDate();

    // Show participants when people count changes
    document.getElementById('tanda-people').addEventListener('input', onPeopleCountChange);

    // Splash screen — fast for low-end phones
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('fade-out');
        document.getElementById('app').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
        }, 500);
    }, 800);

    renderHome();
});

// ---- Data Persistence ----
function loadData() {
    try {
        const stored = localStorage.getItem('mitanda_data');
        if (stored) {
            tandas = JSON.parse(stored);
        }
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
    const day = DAYS_ES[now.getDay()];
    const date = now.getDate();
    const month = MONTHS_FULL[now.getMonth()];
    document.getElementById('header-date').textContent = `${day} ${date} de ${month}`;
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
            case 'weekly':
                d.setDate(start.getDate() + (i * 7));
                break;
            case 'biweekly':
                d.setDate(start.getDate() + (i * 14));
                break;
            case 'monthly':
                d.setMonth(start.getMonth() + i);
                break;
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }
    return dates;
}

function isCurrentOrPastDate(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T12:00:00');
    d.setHours(0, 0, 0, 0);
    return d <= today;
}

function isCurrentWeek(dateStr) {
    const today = new Date();
    const d = new Date(dateStr + 'T12:00:00');
    const diffDays = Math.abs(Math.floor((today - d) / (1000 * 60 * 60 * 24)));
    return diffDays <= 3;
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

    // Update stats
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

        if (tandas.length < MAX_TANDAS) {
            fabAdd.classList.remove('hidden');
        } else {
            fabAdd.classList.add('hidden');
        }

        tandasList.innerHTML = '';
        tandas.forEach((tanda, index) => {
            tandasList.appendChild(createTandaCard(tanda, index));
        });

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
    let totalCells = 0;
    let filledCells = 0;
    tandas.forEach(t => {
        const numDates = t.participants.length;
        t.participants.forEach((p, pi) => {
            for (let di = 0; di < numDates; di++) {
                totalCells++;
                const key = `${pi}-${di}`;
                if (t.status && t.status[key]) filledCells++;
            }
        });
    });
    return totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
}

function calculateTandaProgress(tanda) {
    const numDates = tanda.participants.length;
    let total = numDates * tanda.participants.length;
    let filled = 0;
    tanda.participants.forEach((p, pi) => {
        for (let di = 0; di < numDates; di++) {
            const key = `${pi}-${di}`;
            if (tanda.status && tanda.status[key]) filled++;
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
            <span class="tanda-meta-item"><span class="meta-icon">💵</span> $${tanda.amount.toLocaleString()}</span>
            <span class="tanda-meta-item"><span class="meta-icon">📅</span> ${FREQ_LABELS[tanda.frequency]} · ${startDay}</span>
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    
    // Set default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('tanda-start').value = `${yyyy}-${mm}-${dd}`;

    showScreen('screen-create');
}

function editCurrentTanda() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;

    editingTandaId = tanda.id;
    document.getElementById('create-title').textContent = 'Editar Tanda';
    document.getElementById('btn-save-tanda').innerHTML = '<span class="btn-icon">✓</span> Guardar Cambios';

    document.getElementById('tanda-name').value = tanda.name;
    document.getElementById('tanda-amount').value = tanda.amount;
    document.getElementById('tanda-people').value = tanda.participants.length;
    document.getElementById('tanda-start').value = tanda.startDate;
    
    const freqRadio = document.querySelector(`input[name="frequency"][value="${tanda.frequency}"]`);
    if (freqRadio) freqRadio.checked = true;

    // Build participants list
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

function buildParticipantsList(count, existingNames = []) {
    const section = document.getElementById('participants-section');
    const list = document.getElementById('participants-list');
    section.style.display = 'block';
    list.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'participant-row';
        const name = existingNames[i] || '';
        row.innerHTML = `
            <span class="participant-number">${i + 1}</span>
            <input type="text" class="participant-input" 
                   placeholder="Participante ${i + 1}" 
                   value="${escapeHtml(name)}" 
                   data-index="${i}"
                   maxlength="30">
        `;
        list.appendChild(row);
    }
}

function saveTanda(e) {
    e.preventDefault();

    const name = document.getElementById('tanda-name').value.trim();
    const amount = parseFloat(document.getElementById('tanda-amount').value);
    const peopleCount = parseInt(document.getElementById('tanda-people').value);
    const startDate = document.getElementById('tanda-start').value;
    const frequency = document.querySelector('input[name="frequency"]:checked').value;

    if (!name || !amount || !peopleCount || !startDate) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    if (peopleCount < 2 || peopleCount > MAX_PEOPLE) {
        showToast(`El número de personas debe ser entre 2 y ${MAX_PEOPLE}`, 'error');
        return;
    }

    // Gather participant names
    const participantInputs = document.querySelectorAll('.participant-input');
    const participants = [];
    for (let i = 0; i < peopleCount; i++) {
        const input = participantInputs[i];
        const pName = input ? input.value.trim() : '';
        participants.push(pName || `Persona ${i + 1}`);
    }

    if (editingTandaId) {
        // Update existing
        const tanda = tandas.find(t => t.id === editingTandaId);
        if (tanda) {
            const oldCount = tanda.participants.length;
            tanda.name = name;
            tanda.amount = amount;
            tanda.startDate = startDate;
            tanda.frequency = frequency;
            tanda.participants = participants;

            // Clean up status if participant count changed
            if (oldCount !== peopleCount) {
                const newStatus = {};
                Object.keys(tanda.status || {}).forEach(key => {
                    const [pi, di] = key.split('-').map(Number);
                    if (pi < peopleCount && di < peopleCount) {
                        newStatus[key] = tanda.status[key];
                    }
                });
                tanda.status = newStatus;
            }

            saveData();
            showToast('Tanda actualizada');
            openTandaDetail(tanda.id);
        }
    } else {
        // Create new
        const tanda = {
            id: generateId(),
            name,
            amount,
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
    document.getElementById('detail-amount').textContent = tanda.amount.toLocaleString();
    document.getElementById('detail-frequency').textContent = FREQ_LABELS[tanda.frequency];

    renderGrid(tanda);
    showScreen('screen-detail');
}

function renderGrid(tanda) {
    const dates = calculateDates(tanda.startDate, tanda.participants.length, tanda.frequency);
    const thead = document.getElementById('grid-head');
    const tbody = document.getElementById('grid-body');

    // Build header
    let headerHtml = '<tr><th>#  Participante</th>';
    dates.forEach((date, di) => {
        const isNow = isCurrentWeek(date);
        headerHtml += `<th class="date-header ${isNow ? 'current-week' : ''}">
            ${formatDateShort(date)}
            <span class="date-day">${getDayName(date)}</span>
        </th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Build body
    let bodyHtml = '';
    tanda.participants.forEach((participant, pi) => {
        // The person at index pi receives on date pi (their turn)
        const isReceiver = true; // everyone has a turn
        bodyHtml += `<tr class="${''}" id="row-${pi}">`;
        
        // Participant cell
        bodyHtml += `<td>
            <div class="grid-participant">
                <span class="grid-participant-num">${pi + 1}</span>
                <span class="grid-participant-name" title="${escapeHtml(participant)}">${escapeHtml(participant)}</span>
            </div>
        </td>`;

        // Date cells
        dates.forEach((date, di) => {
            const key = `${pi}-${di}`;
            const status = (tanda.status && tanda.status[key]) || '';
            let cellClass = 'status-cell';
            let cellContent = '';
            let tooltip = 'Pendiente';

            if (status === 'paid') {
                cellClass += ' paid';
                cellContent = '✓';
                tooltip = 'Entregado';
            } else if (status === 'received') {
                cellClass += ' received';
                cellContent = '★';
                tooltip = 'Recibido';
            }

            // Highlight if this person receives on this date
            const isReceiverTurn = (pi === di);

            bodyHtml += `<td${isReceiverTurn ? ' style="position:relative"' : ''}>
                <button class="${cellClass}" 
                        onclick="toggleStatus('${tanda.id}', ${pi}, ${di}, this)"
                        title="${tooltip}">
                    ${cellContent}
                </button>
                ${isReceiverTurn ? '<span class="receiver-badge">Recibe</span>' : ''}
            </td>`;
        });

        bodyHtml += '</tr>';
    });

    tbody.innerHTML = bodyHtml;
}

function toggleStatus(tandaId, participantIndex, dateIndex, btn) {
    const tanda = tandas.find(t => t.id === tandaId);
    if (!tanda) return;

    const key = `${participantIndex}-${dateIndex}`;
    if (!tanda.status) tanda.status = {};

    const current = tanda.status[key] || '';
    let next = '';
    
    // Cycle: empty → paid → received → empty
    if (current === '') {
        next = 'paid';
    } else if (current === 'paid') {
        next = 'received';
    } else {
        next = '';
    }

    if (next) {
        tanda.status[key] = next;
    } else {
        delete tanda.status[key];
    }

    saveData();

    // Update button appearance with animation
    btn.className = 'status-cell';
    btn.textContent = '';
    btn.title = 'Pendiente';

    if (next === 'paid') {
        btn.classList.add('paid', 'pop');
        btn.textContent = '✓';
        btn.title = 'Entregado';
    } else if (next === 'received') {
        btn.classList.add('received', 'pop');
        btn.textContent = '★';
        btn.title = 'Recibido';
    } else {
        btn.classList.add('pop');
    }

    setTimeout(() => btn.classList.remove('pop'), 300);
}

// ---- Delete Tanda ----
function confirmDeleteTanda() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;

    showModal(
        'Eliminar Tanda',
        `¿Estás seguro de que deseas eliminar "${tanda.name}"? Esta acción no se puede deshacer.`,
        'Eliminar',
        () => {
            tandas = tandas.filter(t => t.id !== currentTandaId);
            saveData();
            showToast('Tanda eliminada');
            goHome();
        }
    );
}

// ---- Export Tanda as PNG ----
function exportTandaPNG() {
    const tanda = tandas.find(t => t.id === currentTandaId);
    if (!tanda) return;

    const btn = document.getElementById('btn-export-png');
    btn.classList.add('exporting');
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        Generando...
    `;

    const dates = calculateDates(tanda.startDate, tanda.participants.length, tanda.frequency);
    const captureContainer = document.getElementById('capture-container');
    
    // Build header row
    let tableHeader = '<th>Participante</th>';
    dates.forEach(date => {
        tableHeader += `<th>${formatDateShort(date)}<span class="date-day">${getDayName(date)}</span></th>`;
    });

    // Build body rows
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

    // Only the table, nothing else
    captureContainer.innerHTML = `
        <div class="capture-card">
            <table class="capture-table">
                <thead><tr>${tableHeader}</tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
        </div>
    `;

    // Wait a frame for layout then capture
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
                if (!blob) {
                    showToast('Error al generar imagen', 'error');
                    resetExportBtn();
                    return;
                }

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
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Exportar PNG
    `;
}
