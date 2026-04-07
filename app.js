/* ═══════════════════════════════════════════════════════════
   TRAZABILIDAD DE ENFERMERÍA — app.js v2
   Lógica principal corregida completamente
═══════════════════════════════════════════════════════════ */

const APP = {
  view:        'camas',
  filter:      'todos',
  histFilter:  '',
  zoneId:      'all',
  _timerIv:    null,
  _clockIv:    null,
  _confirmShiftClose: null,

  /* ══════════════════════════════════════════════════ BOOT */
  init() {
    initData();
    this.zoneId = getCfg().zoneId || 'all';
    this.startClock();
    const user = getUser();
    if (!user) { renderLogin(); return; }
    this.boot();
  },

  boot() {
    document.getElementById('login-screen').classList.add('hidden');
    this.updateTopbar();
    this.render();
    this.startTimers();
    this.bindEvents();
    window.addEventListener('resize', () => { if (window.innerWidth > 1100) this.closeSidebar(); });
  },

  /* ══════════════════════════════════════════════════ LOGIN */
  doLogin() {
    const name = (document.getElementById('li-name')?.value || '').trim();
    const role = document.getElementById('li-role')?.value || ROLES[0];
    const zone = document.getElementById('li-zone')?.value || HOSPITAL_ZONES[1]?.id || 'all';
    if (!name) { alert('Por favor ingresa tu nombre completo.'); return; }
    const user = { name, role, zone };
    setUser(user);
    const cfg = getCfg();
    cfg.currentShift = detectShift();
    cfg.shiftStart   = fmtTime(new Date());
    cfg.zoneId       = zone;
    saveCfg(cfg);
    this.zoneId = zone;
    this.boot();
  },

  logout() {
    if (!confirm('¿Cerrar sesión? Se perderá el acceso hasta que vuelvas a ingresar.')) return;
    clearUser();
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('sidebar').innerHTML   = '';
    document.getElementById('main-content').innerHTML = '';
    renderLogin();
  },

  /* ══════════════════════════════════════════════ TOPBAR */
  updateTopbar() {
    const cfg  = getCfg();
    const user = getUser() || { name: '--', role: '--' };
    const btn  = document.getElementById('shift-btn');
    const icon = document.getElementById('shift-icon');
    const lbl  = document.getElementById('shift-label');
    const chip = document.getElementById('user-chip-name');
    const crole= document.getElementById('user-chip-role');
    const svc  = document.getElementById('service-name-display');

    if (cfg.currentShift === 'DIA') {
      icon.textContent = '☀'; lbl.textContent  = 'Turno Día  08:00 – 20:00';
      btn.classList.remove('noche');
    } else {
      icon.textContent = '🌙'; lbl.textContent = 'Turno Noche  20:00 – 08:00';
      btn.classList.add('noche');
    }
    if (chip)  chip.textContent  = user.name;
    if (crole) crole.textContent = user.role;
    const zone = HOSPITAL_ZONES.find(z => z.id === (cfg.zoneId || 'all'));
    if (svc)   svc.textContent   = zone ? zone.name : 'Todas las zonas';
  },

  /* ══════════════════════════════════════════════════ CLOCK */
  startClock() {
    const tick = () => {
      const now = new Date();
      const cl = document.getElementById('clock');
      const dl = document.getElementById('date-display');
      if (cl) cl.textContent = now.toLocaleTimeString('es-CL');
      if (dl) dl.textContent = now.toLocaleDateString('es-CL', { weekday:'short', day:'numeric', month:'short' });
    };
    tick();
    if (this._clockIv) clearInterval(this._clockIv);
    this._clockIv = setInterval(tick, 1000);
  },

  /* ══════════════════════════════════════════════════ TIMERS */
  startTimers() {
    if (this._timerIv) clearInterval(this._timerIv);
    this._timerIv = setInterval(() => {
      document.querySelectorAll('.timer-val').forEach(el => {
        const iso = el.dataset.iso;
        if (iso) el.textContent = calcElapsed(iso) || '--';
      });
    }, 60000);
  },

  /* ══════════════════════════════════════════════════ RENDER */
  render() {
    this.renderSidebar();
    this.renderMain();
    this.updateTopbar();
  },

  renderSidebar() {
    document.getElementById('sidebar').innerHTML =
      renderSidebar(this.view, this.filter, this.zoneId);
  },

  renderMain() {
    const m = document.getElementById('main-content');
    switch (this.view) {
      case 'camas':       m.innerHTML = renderBedsView(this.filter, this.zoneId); break;
      case 'pendientes':  m.innerHTML = renderPendientesView(); break;
      case 'evoluciones': m.innerHTML = renderEvolucionesView(); break;
      case 'historico':   m.innerHTML = renderHistoricoView(this.histFilter); break;
    }
  },

  /* ══════════════════════════════════════════════════ VIEWS */
  setView(v) {
    this.view = v;
    this.filter = 'todos';
    this.closeSidebar();
    this.render();
  },

  setFilter(f) {
    this.filter = f;
    if (this.view !== 'camas') this.view = 'camas';
    this.renderSidebar();
    this.renderMain();
  },

  setZone(zoneId) {
    this.zoneId = zoneId;
    const cfg = getCfg(); cfg.zoneId = zoneId; saveCfg(cfg);
    this.updateTopbar();
    this.renderMain();
  },

  setHistFilter(cama) {
    this.histFilter = cama;
    this.renderMain();
  },

  /* ══════════════════════════════════════════ PATIENT MODAL */
  openPatient(cama) {
    const p = getPatientByCama(cama) || emptyPatient(cama);
    document.getElementById('modal-content').innerHTML = renderPatientModal(p);
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  reopenTab(cama, tabId) {
    this.openPatient(cama);
    // Wait for DOM then switch tab
    requestAnimationFrame(() => this.switchTab(tabId || 'datos'));
  },

  switchTab(tabId) {
    document.querySelectorAll('.modal-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'tp-' + tabId));
  },

  /* ══════════════════════════════════════════════ SAVE PATIENT
     Usa IDs únicos f-{field}-{cama} para lectura confiable     */
  savePatient(cama) {
    const p = getPatientByCama(cama) || emptyPatient(cama);
    const fields = ['nombre','rut','edad','fechaNac','dx','medico','prevision',
                    'alergias','estado','ingreso_datetime','motivo',
                    'antecedentes','medicacion_previa'];
    fields.forEach(field => {
      const el = document.getElementById(`f-${field}-${cama}`);
      if (!el) return;
      if (el.tagName === 'SELECT')       p[field] = el.value;
      else if (el.type === 'number')     p[field] = el.value ? Number(el.value) : null;
      else if (el.type === 'datetime-local') p[field] = el.value ? new Date(el.value).toISOString() : null;
      else                               p[field] = el.value.trim();
    });
    // Auto-activar cama al asignar paciente
    if (p.estado === 'libre' && p.nombre) p.estado = 'ok';
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'datos');
    toast('Guardado correctamente ✓');
  },

  /* ══════════════════════════════════════════════ ALTA */
  dischargePatient(cama) {
    if (!confirm(`¿Confirmar alta del paciente de la cama ${cama}?`)) return;
    const fresh = emptyPatient(cama);
    updatePatient(fresh);
    this.closeModal();
    this.render();
    toast(`Cama ${cama} liberada`);
  },

  /* ══════════════════════════════════════════ EVOLUCIONES */
  showEvolForm(cama) {
    const f = document.getElementById(`ef-${cama}`);
    if (f) { f.style.display = 'block'; document.getElementById(`et-${cama}`)?.focus(); }
  },

  setFmt(btn, fmt, cama) {
    btn.closest('.fmt-toggle').querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const ta = document.getElementById(`et-${cama}`);
    if (!ta) return;
    if (fmt === 'SOAP') {
      ta.value = 'S: (Subjetivo — qué refiere el paciente)\n\nO: (Objetivo — signos vitales, hallazgos)\n\nA: (Análisis — evaluación clínica)\n\nP: (Plan — intervenciones y próximos pasos)';
      ta.focus();
    } else {
      if (ta.value.startsWith('S:')) ta.value = '';
    }
  },

  saveEvol(cama) {
    const ta = document.getElementById(`et-${cama}`);
    const text = ta ? ta.value.trim() : '';
    if (!text) { toast('Escriba el texto de la evolución', 'warn'); return; }
    const cfg  = getCfg();
    const user = getUser() || { name: 'Profesional', role: '' };
    const now  = new Date();
    const evol = {
      id: uid(), fechaRaw: now.toISOString(),
      turno: cfg.currentShift, fecha: fmtDT(now),
      formato: 'narrativo', texto: text,
      autor: `${user.name}${user.role ? ' · ' + user.role : ''}`
    };
    const p = getPatientByCama(cama);
    if (!p) return;
    p.evoluciones = [evol, ...(p.evoluciones || [])];
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'evoluciones');
    toast('Evolución guardada ✓');
  },

  delEvol(cama, id) {
    if (!confirm('¿Eliminar esta evolución?')) return;
    const p = getPatientByCama(cama); if (!p) return;
    p.evoluciones = (p.evoluciones || []).filter(e => e.id !== id);
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'evoluciones');
    toast('Evolución eliminada', 'warn');
  },

  /* ══════════════════════════════════════════════ EXÁMENES */
  addExam(cama) {
    const tipo = prompt('Tipo de examen:'); if (!tipo) return;
    const resultado = prompt('Resultado:') || 'Pendiente resultado';
    const estado = prompt('Estado:\n  pendiente\n  resultado\n  critico', 'resultado') || 'resultado';
    const validEstados = ['pendiente','resultado','critico'];
    const p = getPatientByCama(cama); if (!p) return;
    p.examenes = [{ id: uid(), tipo, resultado, fecha: fmtDate(new Date()),
      estado: validEstados.includes(estado) ? estado : 'pendiente' },
      ...(p.examenes || [])];
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'examenes');
    toast('Examen agregado');
  },

  delExam(cama, id) {
    const p = getPatientByCama(cama); if (!p) return;
    p.examenes = (p.examenes || []).filter(e => e.id !== id);
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'examenes');
  },

  /* ══════════════════════════════════════════ PROCEDIMIENTOS */
  addProc(cama) {
    const nombre = prompt('Nombre del procedimiento:'); if (!nombre) return;
    const indicadoPor = prompt('Indicado por:', 'Médico tratante') || '';
    const p = getPatientByCama(cama); if (!p) return;
    p.procedimientos = [...(p.procedimientos || []),
      { id: uid(), nombre, indicadoPor, fecha: fmtDate(new Date()), done: false, hora: '' }];
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'procedimientos');
    toast('Procedimiento agregado');
  },

  toggleProc(cama, id) {
    const p = getPatientByCama(cama); if (!p) return;
    const pr = (p.procedimientos || []).find(x => x.id === id); if (!pr) return;
    pr.done = !pr.done;
    pr.hora = pr.done ? fmtTime(new Date()) : '';
    updatePatient(p);
    // Si estamos en vista global de pendientes, solo re-render main
    if (this.view === 'pendientes') { this.renderMain(); return; }
    this.render();
    this.reopenTab(cama, 'procedimientos');
  },

  delProc(cama, id) {
    const p = getPatientByCama(cama); if (!p) return;
    p.procedimientos = (p.procedimientos || []).filter(x => x.id !== id);
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'procedimientos');
  },

  /* ══════════════════════════════════════════════ PENDIENTES */
  addPend(cama) {
    const texto = prompt('Descripción del pendiente:'); if (!texto) return;
    const p = getPatientByCama(cama); if (!p) return;
    p.pendientes = [...(p.pendientes || []), { id: uid(), texto }];
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'pendientes');
    toast('Pendiente agregado');
  },

  delPend(cama, id) {
    const p = getPatientByCama(cama); if (!p) return;
    p.pendientes = (p.pendientes || []).filter(x => x.id !== id);
    updatePatient(p);
    this.render();
    this.reopenTab(cama, 'pendientes');
  },

  /* ══════════════════════════════════════════════ TURNO
     Cambio manual con confirmación + snapshot automático.
     El sistema NO cambia turno automáticamente — requiere
     acción explícita de la enfermera al inicio de su turno.  */
  toggleShift() {
    renderShiftDialog((obs, inc) => {
      const cfg  = getCfg();
      const user = getUser() || { name: 'Sistema', role: '' };
      const snap = buildSnapshot(user, cfg.currentShift, cfg.shiftStart, obs, inc);
      addHistory(snap);
      cfg.currentShift = cfg.currentShift === 'DIA' ? 'NOCHE' : 'DIA';
      cfg.shiftStart   = fmtTime(new Date());
      saveCfg(cfg);
      this.render();
      toast(`Turno cerrado. Iniciando ${cfg.currentShift === 'DIA' ? 'Turno Día' : 'Turno Noche'}`);
    });
  },

  closeShift() { this.toggleShift(); },

  /* ══════════════════════════════════════════════ HISTORIAL */
  toggleHist(idx) {
    const body = document.getElementById(`hb-${idx}`);
    const hdr  = document.getElementById(`hh-${idx}`);
    if (!body) return;
    const open = body.classList.contains('show');
    body.classList.toggle('show', !open);
    hdr && hdr.classList.toggle('open', !open);
  },

  viewLastShift() {
    this.view = 'historico';
    this.render();
    setTimeout(() => this.toggleHist(0), 120);
  },

  /* ══════════════════════════════════════════════ SIDEBAR MOBILE */
  toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (s.classList.contains('open')) this.closeSidebar();
    else { s.classList.add('open'); o.classList.add('vis'); }
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('vis');
  },

  /* ══════════════════════════════════════════════ SEARCH */
  handleSearch(q) {
    if (!q.trim()) { this.renderMain(); return; }
    const ql = q.toLowerCase();
    const pts = getPatients().filter(p =>
      p.nombre.toLowerCase().includes(ql) ||
      p.rut.includes(ql) ||
      p.cama.includes(ql) ||
      (p.dx || '').toLowerCase().includes(ql)
    );
    document.getElementById('main-content').innerHTML = `
      <div class="view-hdr">
        <div><div class="view-title">Búsqueda: "${q}"</div>
        <div class="view-sub">${pts.length} resultado${pts.length !== 1 ? 's' : ''}</div></div>
      </div>
      <div class="beds-grid">${pts.map(renderBedCard).join('') ||
        '<div class="empty-st"><p>Sin resultados</p></div>'}</div>`;
  },

  /* ══════════════════════════════════════════ EXPORT / IMPORT */
  exportData() {
    const data = { patients: getPatients(), history: getHistory(),
                   config: getCfg(), at: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `trazabilidad_${fmtDate(new Date()).replace(/\//g, '-')}.json`;
    a.click();
    toast('Datos exportados');
  },

  importData() { document.getElementById('import-file').click(); },

  handleImport(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.patients) savePatients(d.patients);
        if (d.history)  saveHistory(d.history);
        if (d.config)   saveCfg({ ...getCfg(), ...d.config });
        this.zoneId = getCfg().zoneId || 'all';
        this.render();
        toast('Datos importados correctamente');
      } catch { toast('Archivo inválido', 'error'); }
    };
    r.readAsText(file);
  },

  /* ══════════════════════════════════════════════════ PRINT */
  printShift() {
    const tpl = document.getElementById('print-template');
    tpl.innerHTML = renderPrint();
    tpl.style.display = 'block';
    window.print();
    tpl.style.display = 'none';
    tpl.innerHTML = '';
  },

  /* ══════════════════════════════════════════════ DIALOG */
  closeDialog() {
    document.getElementById('dialog-overlay').classList.add('hidden');
  },

  /* ══════════════════════════════════════════════ EVENTS
     Todos los eventos van aquí. El modal NO usa event delegation
     para evitar el bug donde el select no se puede clickear.    */
  bindEvents() {
    // Search
    let st;
    document.getElementById('search-input')?.addEventListener('input', e => {
      clearTimeout(st); st = setTimeout(() => this.handleSearch(e.target.value), 280);
    });

    // Import file
    document.getElementById('import-file')?.addEventListener('change', e => {
      this.handleImport(e.target.files[0]); e.target.value = '';
    });

    // ESC cierra modal
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModal(); });

    // Modal backdrop click (solo el overlay, no el container)
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    });

    // Overlay del sidebar mobile
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => this.closeSidebar());

    // Topbar buttons via data-action (solo los del topbar, NO el modal)
    document.getElementById('topbar')?.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'toggle-shift':  this.toggleShift(); break;
        case 'export-data':   this.exportData(); break;
        case 'import-data':   this.importData(); break;
        case 'print-shift':   this.printShift(); break;
      }
    });
  },
};

/* ──────────────────────────────────────────────────── BOOT */
document.addEventListener('DOMContentLoaded', () => APP.init());
