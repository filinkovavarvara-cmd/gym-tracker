// GymTracker Core Engine - Part 1
const STORAGE_KEYS = {
  PROGRAMS: 'gym_programs_v1',
  CURRENT_PROGRAM_ID: 'gym_current_program_id_v1',
  WORKOUT_LOGS: 'gym_workout_logs_v1',
  ACTIVE_WORKOUT: 'gym_active_workout_v1',
  EXERCISE_NAMES: 'gym_exercise_names_v1',
  LAST_EXPORT: 'gym_last_export_v1'
};

const SEED_PROGRAM_ID = 'prog-seed';
const DEMO_LOG_IDS = ['log-1', 'log-2'];

// Программа по умолчанию пустая: демо-данных в приложении нет
const DEFAULT_PROGRAM = { id: 'prog-1', name: 'Моя программа', days: [] };

class GymApp {
  constructor() {
    this.programs = [];
    this.currentProgramId = null;
    this.workoutLogs = [];
    this.activeWorkout = null;
    this.exerciseInputState = {};
    this.picker = null;
    this.exerciseNames = {};
    this.selectedChartMetric = 'weight';
    this.historyTab = 'logs';
    this.logEdit = null;
    this.dayDraft = null;
    // Режим перестановки (карточки двигаются пальцем: зажать и потянуть)
    this.reorder = { list: false, workout: false, day: false };
    this.reorderDrag = null;
    // Упражнение, выбранное на вкладке графиков
    this.chartExerciseId = null;
    this.chartPickerQuery = '';
    this.confirmAction = null;
    this.confirmCancel = null;
  }

  init() {
    this.loadData();
    document.addEventListener('click', () => this.closeCardMenu());
    this.initReorderDrag();
    this.renderHome();
    this.renderHistory();
    this.initServiceWorker();
    this.renderBackupInfo();
  }

  loadData() {
    try {
      const storedProgs = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (storedProgs) {
        this.programs = JSON.parse(storedProgs);
      } else {
        // Первый запуск: создаём программу с шаблонными тренировками
        const defaultProgram = { ...DEFAULT_PROGRAM, days: this.createDefaultDays() };
        this.programs = [defaultProgram];
        this.savePrograms();
      }

      const curId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROGRAM_ID);
      this.currentProgramId = curId || (this.programs[0] ? this.programs[0].id : null);

      const storedLogs = localStorage.getItem(STORAGE_KEYS.WORKOUT_LOGS);
      this.workoutLogs = storedLogs ? JSON.parse(storedLogs) : [];
      if (!storedLogs) this.saveWorkoutLogs();

      const active = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT);
      if (active) this.activeWorkout = JSON.parse(active);

      const storedNames = localStorage.getItem(STORAGE_KEYS.EXERCISE_NAMES);
      this.exerciseNames = storedNames ? JSON.parse(storedNames) : {};
    } catch (e) {
      console.error('Data load error:', e);
      this.programs = [DEFAULT_PROGRAM];
      this.workoutLogs = [];
    }
  }

  createDefaultDays() {
    return [
      {
        id: 'day-chest',
        name: 'Грудь',
        exercises: [
          { id: 'ex-bp', name: 'Жим штанги лёжа', targetSets: 4, targetReps: '6-8', targetWeight: 0, notes: '' },
          { id: 'ex-bdb', name: 'Разведение гантелей лёжа', targetSets: 3, targetReps: '8-10', targetWeight: 0, notes: '' },
          { id: 'ex-pfd', name: 'Отжимания на брусьях', targetSets: 3, targetReps: '8-12', targetWeight: 0, notes: '' }
        ]
      },
      {
        id: 'day-back',
        name: 'Спина',
        exercises: [
          { id: 'ex-dlt', name: 'Становая тяга', targetSets: 4, targetReps: '4-6', targetWeight: 0, notes: '' },
          { id: 'ex-pdl', name: 'Подтягивания', targetSets: 3, targetReps: '6-10', targetWeight: 0, notes: '' },
          { id: 'ex-grd', name: 'Горизонтальная тяга', targetSets: 3, targetReps: '8-10', targetWeight: 0, notes: '' }
        ]
      },
      {
        id: 'day-legs',
        name: 'Ноги',
        exercises: [
          { id: 'ex-sq', name: 'Приседания со штангой', targetSets: 4, targetReps: '6-8', targetWeight: 0, notes: '' },
          { id: 'ex-leg-press', name: 'Жим ногами', targetSets: 3, targetReps: '8-10', targetWeight: 0, notes: '' },
          { id: 'ex-leg-curl', name: 'Сгибание ног сидя', targetSets: 3, targetReps: '10-12', targetWeight: 0, notes: '' }
        ]
      },
      {
        id: 'day-shoulders',
        name: 'Плечи',
        exercises: [
          { id: 'ex-sh-press', name: 'Жим штанги с плеч', targetSets: 4, targetReps: '6-8', targetWeight: 0, notes: '' },
          { id: 'ex-lat-raise', name: 'Разведение гантелей в стороны', targetSets: 3, targetReps: '10-12', targetWeight: 0, notes: '' },
          { id: 'ex-face-pull', name: 'Тяга к лицу', targetSets: 3, targetReps: '12-15', targetWeight: 0, notes: '' }
        ]
      },
      {
        id: 'day-arms',
        name: 'Руки',
        exercises: [
          { id: 'ex-barbell-curl', name: 'Подъём штанги на бицепс', targetSets: 3, targetReps: '8-10', targetWeight: 0, notes: '' },
          { id: 'ex-tricep-dips', name: 'Отжимания на трицепс', targetSets: 3, targetReps: '8-10', targetWeight: 0, notes: '' },
          { id: 'ex-hammer-curl', name: 'Подъём гантелей молотком', targetSets: 3, targetReps: '10-12', targetWeight: 0, notes: '' }
        ]
      }
    ];
  }


  savePrograms() {
    localStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(this.programs));
    if (this.currentProgramId) localStorage.setItem(STORAGE_KEYS.CURRENT_PROGRAM_ID, this.currentProgramId);
  }

  saveWorkoutLogs() {
    localStorage.setItem(STORAGE_KEYS.WORKOUT_LOGS, JSON.stringify(this.workoutLogs));
  }

  saveExerciseNames() {
    localStorage.setItem(STORAGE_KEYS.EXERCISE_NAMES, JSON.stringify(this.exerciseNames));
  }

  saveActiveWorkout() {
    if (this.activeWorkout) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT, JSON.stringify(this.activeWorkout));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKOUT);
    }
  }

  getCurrentProgram() {
    return this.programs.find(p => p.id === this.currentProgramId) || this.programs[0] || null;
  }

  navigate(viewId) {
    this.resetReorder();
    document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    this.closeCardMenu();

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    // Нижняя навигация по Figma: Главная (журнал), Тренировки (список), Аналитика (графики)
    const navMap = {
      'viewWorkout': 'navItemProgram',
      'viewProgram': 'navItemProgram',
      'viewDayEdit': 'navItemProgram',
      'viewHistory': this.historyTab === 'charts' ? 'navItemAnalytics' : 'navItemHome',
      'viewLogEdit': 'navItemHome',
      'viewSettings': 'navItemHome'
    };
    const activeNavId = navMap[viewId];
    if (activeNavId && document.getElementById(activeNavId)) {
      document.getElementById(activeNavId).classList.add('active');
    }

    if (viewId === 'viewProgram') this.renderHome();
    if (viewId === 'viewHistory') this.renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Кнопки нижней навигации: «Главная» и «Аналитика» пока показывают существующий экран истории
  openHome() {
    this.historyTab = 'logs';
    this.navigate('viewHistory');
    this.switchSubtab('logs');
  }

  openAnalytics() {
    this.historyTab = 'charts';
    this.navigate('viewHistory');
    this.switchSubtab('charts');
  }

  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  }

  // --- HOME SCREEN ---
  renderHome() {
    const prog = this.getCurrentProgram();
    const container = document.getElementById('workoutsList');
    if (!container) return;

    // Текущая тренировка показывается карточкой прямо в списке, её тоже можно перемещать
    const activeId = this.activeWorkout ? this.activeWorkout.dayId : null;
    const activeInList = !!(activeId && prog && prog.days && prog.days.some(d => d.id === activeId));

    if (!prog || !prog.days || prog.days.length === 0) {
      if (!this.activeWorkout) {
        container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Пока нет тренировок</div>
          <div class="empty-state-desc">Нажмите «+», чтобы добавить первую тренировку.</div>
        </div>
      `;
        return;
      }
    }

    const rm = this.reorder.list;
    container.classList.toggle('reorder-on', rm);
    const dragAttrs = (id) => `data-day-id="${id}"`;
    const activeCard = (id, name) => `
        <div class="workout-card active-card" ${dragAttrs(id)}
             onclick="${rm ? '' : 'app.resumeActiveWorkout()'}">
          <div class="active-banner-info">
            <div class="active-banner-label">Идёт тренировка</div>
            <div class="workout-card-title">${this.escapeHtml(name)}</div>
            <div class="workout-card-meta">Начата: ${this.formatDateTime(this.activeWorkout.date)}</div>
          </div>
          <img class="icon" src="./icons/play.svg" alt="">
        </div>
      `;

    let html = '';
    // Если шаблона дня уже нет в программе, карточка текущей тренировки стоит первой
    if (this.activeWorkout && !activeInList) {
      html += activeCard(activeId || '', this.activeWorkout.dayName || 'Текущая тренировка');
    }
    ((prog && prog.days) || []).forEach((day, index) => {
      if (this.activeWorkout && day.id === activeId) {
        html += activeCard(day.id, this.activeWorkout.dayName || day.name);
        return;
      }

      const exCount = day.exercises ? day.exercises.length : 0;
      html += `
        <div class="workout-card" ${dragAttrs(day.id)}
             onclick="${rm ? '' : `app.startWorkout('${day.id}')`}">
          <div class="workout-card-header">
            <div class="workout-card-title">${this.escapeHtml(day.name)}</div>
            ${rm ? '' : `<button class="card-menu-btn" onclick="app.toggleCardMenu(event, '${day.id}')" title="Меню" aria-label="Меню">
              <img class="icon" src="./icons/dots-three.svg" alt="">
            </button>`}
          </div>
          <div class="workout-card-meta">${this.pluralExercises(exCount)}</div>
          <div class="card-menu" id="cardMenu-${day.id}" onclick="event.stopPropagation()">
            <button class="card-menu-item" onclick="app.openDayEdit('${day.id}')">
              <img class="icon icon-20" src="./icons/pencil-simple.svg" alt="">Редактировать
            </button>
            <button class="card-menu-item card-menu-item-danger" onclick="app.deleteDayFromMenu('${day.id}')">
              <img class="icon icon-20" src="./icons/trash.svg" alt="">Удалить
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  pluralExercises(n) {
    const m10 = n % 10;
    const m100 = n % 100;
    let word = 'упражнений';
    if (m10 === 1 && m100 !== 11) word = 'упражнение';
    else if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) word = 'упражнения';
    return `${n} ${word}`;
  }

  // Меню «⋯» на карточке тренировки
  toggleCardMenu(event, dayId) {
    event.stopPropagation();
    const menu = document.getElementById('cardMenu-' + dayId);
    if (!menu) return;
    const wasOpen = menu.classList.contains('open');
    this.closeCardMenu();
    if (!wasOpen) menu.classList.add('open');
  }

  closeCardMenu() {
    document.querySelectorAll('.card-menu.open').forEach(el => el.classList.remove('open'));
  }

  deleteDayFromMenu(dayId) {
    this.closeCardMenu();
    this.deleteDay(dayId);
  }

  deleteDay(dayId) {
    this.openConfirmSheet({
      title: 'Удалить тренировку?',
      text: 'Тренировочный день и все его упражнения будут удалены.',
      okLabel: 'Удалить',
      onOk: () => {
        const prog = this.getCurrentProgram();
        prog.days = prog.days.filter(d => d.id !== dayId);
        this.savePrograms();
        this.renderHome();
        this.showToast('День удален');
      }
    });
  }

  // --- СОЗДАНИЕ И РЕДАКТИРОВАНИЕ ТРЕНИРОВКИ (Figma: Workout/Create, Workout/Edit) ---
  openDayEdit(dayId) {
    this.closeCardMenu();
    const prog = this.getCurrentProgram();
    const day = dayId && prog ? prog.days.find(d => d.id === dayId) : null;
    if (dayId && !day) return;
    this.dayDraft = {
      dayId: day ? day.id : null,
      name: day ? day.name : '',
      exercises: day ? day.exercises.map(ex => {
        const last = this.getLastWorkoutSets(ex.id);
        const weight = ex.targetWeight != null ? ex.targetWeight : (last && last[0] ? last[0].weight : 0);
        return {
          id: ex.id,
          name: ex.name,
          w: String(weight),
          r: String(ex.targetReps || '10'),
          c: String(ex.targetSets || 3),
          n: ex.notes || ''
        };
      }) : []
    };
    this.updateDayEditTitle();
    this.renderDayEdit();
    this.navigate('viewDayEdit');
  }

  renderDayEdit() {
    const st = this.dayDraft;
    if (!st) return;
    const list = document.getElementById('dayEditList');
    const rm = this.reorder.day;
    list.classList.toggle('reorder-on', rm);
    if (st.exercises.length === 0) {
      list.innerHTML = '<div class="de-empty">Пока нет упражнений</div>';
    } else {
      list.innerHTML = st.exercises.map((it, i) => `
        <div class="edit-card" data-day-ex-index="${i}">
          <div class="workout-card-header">
            <div class="workout-card-title">${this.escapeHtml(it.name)}</div>
            ${rm ? '' : `<button class="card-menu-btn" onclick="app.askRemoveDayExercise(${i})" title="Удалить упражнение" aria-label="Удалить упражнение">
              <img class="icon" src="./icons/trash.svg" alt="">
            </button>`}
          </div>
          <div class="metric-group">
            <label class="metric-pill">
              <input class="metric-input" data-idx="${i}" data-field="w" inputmode="decimal" autocomplete="off" value="${this.escapeHtml(it.w)}" oninput="app.onDayEditInput(this)" aria-label="Вес, кг">
              <span>кг</span>
            </label>
            <label class="metric-pill">
              <input class="metric-input" data-idx="${i}" data-field="r" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.r)}" oninput="app.onDayEditInput(this)" aria-label="Повторы">
              <span>раз</span>
            </label>
            <label class="metric-pill">
              <input class="metric-input" data-idx="${i}" data-field="c" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.c)}" oninput="app.onDayEditInput(this)" aria-label="Подходы">
              <span class="metric-sets-label">${this.pluralSets(parseInt(it.c, 10) || 0)}</span>
            </label>
          </div>
          <input class="note-input" type="text" maxlength="300" autocomplete="off" placeholder="Примечание" value="${this.escapeHtml(it.n || '')}" oninput="app.onDayNoteInput(this, ${i})" aria-label="Примечание к упражнению">
        </div>
      `).join('');
      list.querySelectorAll('.metric-input').forEach(inp => this.fitMetricInput(inp));
    }
    this.updateDayEditSave();
  }

  // --- РЕЖИМ ПЕРЕСТАНОВКИ: карточку нужно зажать на ~0,25 с и потянуть пальцем (на десктопе тянется мышью сразу) ---
  initReorderDrag() {
    const zones = [
      { scope: 'list', id: 'workoutsList', item: '.workout-card' },
      { scope: 'workout', id: 'workoutExercisesContainer', item: '.ex-card' },
      { scope: 'day', id: 'dayEditList', item: '.edit-card' }
    ];
    zones.forEach(z => {
      const box = document.getElementById(z.id);
      if (!box) return;
      box.addEventListener('pointerdown', (e) => this.onReorderPointerDown(e, z, box));
      box.addEventListener('contextmenu', (e) => { if (this.reorder[z.scope]) e.preventDefault(); });
      // В режиме перестановки карточки только перемещаются: любой клик внутри блокируется
      box.addEventListener('click', (e) => {
        if (!this.reorder[z.scope]) return;
        e.stopPropagation();
        e.preventDefault();
      }, true);
    });
    // Пока карточка перетаскивается, страница не должна прокручиваться
    document.addEventListener('touchmove', (e) => {
      if (this.reorderDrag && this.reorderDrag.active && e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  onReorderPointerDown(e, zone, box) {
    if (!this.reorder[zone.scope] || this.reorderDrag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('input, textarea')) return;
    const el = e.target.closest(zone.item);
    if (!el || !box.contains(el)) return;
    const d = {
      zone, box, el,
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, y: e.clientY,
      active: false, timer: null, raf: null,
      items: [], from: -1, to: -1
    };
    d.move = (ev) => this.onReorderPointerMove(ev);
    d.up = (ev) => this.endReorderDrag(ev.type === 'pointercancel');
    this.reorderDrag = d;
    if (e.pointerType !== 'mouse') {
      d.timer = setTimeout(() => this.startReorderDrag(), 250);
    }
    document.addEventListener('pointermove', d.move);
    document.addEventListener('pointerup', d.up);
    document.addEventListener('pointercancel', d.up);
  }

  onReorderPointerMove(ev) {
    const d = this.reorderDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    d.y = ev.clientY;
    if (!d.active) {
      const dist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
      if (ev.pointerType === 'mouse') {
        if (dist > 4) this.startReorderDrag();
        else return;
      } else {
        // Палец сдвинулся до долгого нажатия — это обычная прокрутка страницы
        if (dist > 8) this.endReorderDrag(true);
        return;
      }
    }
    this.updateReorderDrag();
  }

  startReorderDrag() {
    const d = this.reorderDrag;
    if (!d || d.active) return;
    clearTimeout(d.timer);
    d.items = Array.from(d.box.querySelectorAll(d.zone.item));
    d.from = d.items.indexOf(d.el);
    if (d.from < 0) { this.endReorderDrag(true); return; }
    d.active = true;
    d.rects = d.items.map(it => {
      const r = it.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });
    d.grab = d.startY - (d.rects[d.from].top - window.scrollY);
    const r0 = d.rects[0];
    d.gap = d.rects.length > 1 ? Math.max(0, d.rects[1].top - (r0.top + r0.height)) : 0;
    d.items.forEach(it => { if (it !== d.el) it.style.transition = 'transform 0.15s ease'; });
    d.el.classList.add('dragging');
    document.body.classList.add('reorder-dragging');
    if (navigator.vibrate) navigator.vibrate(15);
    this.updateReorderDrag();
    const loop = () => {
      const cur = this.reorderDrag;
      if (!cur || !cur.active) return;
      // Автопрокрутка у верхнего и нижнего края экрана
      const edge = 80;
      const vh = window.innerHeight;
      if (cur.y < edge) window.scrollBy(0, -Math.ceil((edge - cur.y) / 5));
      else if (cur.y > vh - edge) window.scrollBy(0, Math.ceil((cur.y - (vh - edge)) / 5));
      this.updateReorderDrag();
      cur.raf = requestAnimationFrame(loop);
    };
    d.raf = requestAnimationFrame(loop);
  }

  updateReorderDrag() {
    const d = this.reorderDrag;
    if (!d || !d.active) return;
    const h = d.rects[d.from].height;
    const desiredTop = d.y + window.scrollY - d.grab;
    const center = desiredTop + h / 2;
    let to = 0;
    d.rects.forEach((r, j) => {
      if (j !== d.from && r.top + r.height / 2 < center) to++;
    });
    d.to = to;
    const shift = h + d.gap;
    d.items.forEach((it, j) => {
      if (j === d.from) {
        it.style.transform = `translateY(${desiredTop - d.rects[d.from].top}px)`;
        return;
      }
      let dy = 0;
      if (d.from < to && j > d.from && j <= to) dy = -shift;
      else if (d.from > to && j >= to && j < d.from) dy = shift;
      it.style.transform = dy ? `translateY(${dy}px)` : '';
    });
  }

  endReorderDrag(cancel) {
    const d = this.reorderDrag;
    if (!d) return;
    clearTimeout(d.timer);
    cancelAnimationFrame(d.raf);
    document.removeEventListener('pointermove', d.move);
    document.removeEventListener('pointerup', d.up);
    document.removeEventListener('pointercancel', d.up);
    this.reorderDrag = null;
    document.body.classList.remove('reorder-dragging');
    if (!d.active) return;
    d.active = false;
    // Отпускание над кнопкой внутри карточки не должно срабатывать как нажатие
    const stopClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', stopClick, true);
    setTimeout(() => document.removeEventListener('click', stopClick, true), 100);
    d.items.forEach(it => {
      it.style.transform = '';
      it.style.transition = '';
      it.classList.remove('dragging');
    });
    if (!cancel && d.to >= 0 && d.to !== d.from) this.applyReorder(d);
  }

  reorderButtonId(scope) {
    return { list: 'btnReorderList', workout: 'btnReorderWorkout', day: 'btnReorderDay' }[scope];
  }

  toggleReorder(scope) {
    this.closeCardMenu();
    this.reorder[scope] = !this.reorder[scope];
    this.applyReorderState(scope);
    this.rerenderReorder(scope);
  }

  applyReorderState(scope) {
    const btn = document.getElementById(this.reorderButtonId(scope));
    if (!btn) return;
    btn.classList.toggle('active', this.reorder[scope]);
    btn.setAttribute('aria-pressed', String(this.reorder[scope]));
  }

  rerenderReorder(scope) {
    if (scope === 'list') this.renderHome();
    else if (scope === 'workout') this.renderWorkoutScreen();
    else if (scope === 'day') this.renderDayEdit();
  }

  // При уходе с экрана режим перестановки выключается
  resetReorder() {
    this.endReorderDrag(true);
    ['list', 'workout', 'day'].forEach(scope => {
      if (this.reorder[scope]) {
        this.reorder[scope] = false;
        this.applyReorderState(scope);
      }
    });
  }

  // Переносит данные в новый порядок после отпускания карточки
  applyReorder(d) {
    const keys = d.items.map(it => {
      if (d.zone.scope === 'list') return it.dataset.dayId;
      if (d.zone.scope === 'workout') return it.dataset.exerciseId;
      return parseInt(it.dataset.dayExIndex, 10);
    });
    const [moved] = keys.splice(d.from, 1);
    keys.splice(d.to, 0, moved);

    if (d.zone.scope === 'list') {
      const prog = this.getCurrentProgram();
      if (!prog) return;
      // Текущая тренировка тоже стоит в списке, поэтому переставляются все дни
      const byId = new Map(prog.days.map(day => [day.id, day]));
      const ordered = keys.map(id => byId.get(id)).filter(Boolean);
      if (ordered.length !== prog.days.length) return;
      prog.days = ordered;
      this.savePrograms();
      this.renderHome();
    } else if (d.zone.scope === 'workout') {
      if (!this.activeWorkout) return;
      const arr = this.getActiveExercises();
      const byId = new Map(arr.map(ex => [ex.id, ex]));
      const ordered = keys.map(id => byId.get(id)).filter(Boolean);
      if (ordered.length !== arr.length) return;
      arr.splice(0, arr.length, ...ordered);
      this.saveActiveWorkout();
      this.renderWorkoutScreen();
    } else {
      if (!this.dayDraft) return;
      const old = this.dayDraft.exercises;
      const ordered = keys.map(i => old[i]).filter(Boolean);
      if (ordered.length !== old.length) return;
      this.dayDraft.exercises = ordered;
      this.renderDayEdit();
    }
  }

  // --- ПРИМЕЧАНИЯ К УПРАЖНЕНИЯМ ---
  onDayNoteInput(inp, index) {
    const it = this.dayDraft && this.dayDraft.exercises[index];
    if (it) it.n = inp.value;
  }

  openExerciseNote(exId) {
    if (!this.activeWorkout) return;
    const ex = this.getActiveExercises().find(e => e.id === exId);
    if (!ex) return;
    document.getElementById('noteExId').value = ex.id;
    document.getElementById('noteExName').textContent = ex.name;
    document.getElementById('noteText').value = ex.notes || '';
    this.openModal('noteModal');
  }

  // Примечание сохраняется в тренировку и в шаблон дня, чтобы появиться и в следующий раз
  saveExerciseNote() {
    if (!this.activeWorkout) return;
    const exId = document.getElementById('noteExId').value;
    const text = document.getElementById('noteText').value.trim();
    const ex = this.getActiveExercises().find(e => e.id === exId);
    if (ex) {
      ex.notes = text;
      this.saveActiveWorkout();
      const prog = this.getCurrentProgram();
      const day = prog && prog.days.find(d => d.id === this.activeWorkout.dayId);
      const tpl = day && day.exercises.find(e => e.id === exId);
      if (tpl) {
        tpl.notes = text;
        this.savePrograms();
      }
    }
    this.closeModal('noteModal');
    this.renderWorkoutScreen();
    this.showToast(text ? 'Примечание сохранено' : 'Примечание удалено');
  }

  // Кнопка внизу неактивна, пока нет названия или упражнений
  updateDayEditSave() {
    const st = this.dayDraft;
    const btn = document.getElementById('dayEditSave');
    if (!st || !btn) return;
    btn.textContent = st.dayId ? 'Сохранить' : 'Создать тренировку';
    btn.disabled = !(st.name.trim() && st.exercises.length > 0);
  }

  // Заголовок экрана — это и есть название: по нажатию оно меняется в шторке
  updateDayEditTitle() {
    const st = this.dayDraft;
    const el = document.getElementById('dayEditTitle');
    if (!st || !el) return;
    const name = st.name.trim();
    el.textContent = name || 'Новая тренировка';
    el.classList.toggle('is-empty', !name);
  }

  openDayNameSheet() {
    if (!this.dayDraft || this.reorder.day) return;
    const inp = document.getElementById('dayNameInput');
    inp.value = this.dayDraft.name;
    this.openModal('dayNameModal');
    setTimeout(() => inp.focus(), 50);
  }

  saveDayName() {
    if (!this.dayDraft) return;
    const name = document.getElementById('dayNameInput').value.trim();
    if (!name) return;
    this.dayDraft.name = name;
    this.updateDayEditTitle();
    this.updateDayEditSave();
    this.closeModal('dayNameModal');
  }

  onDayEditInput(inp) {
    const st = this.dayDraft;
    if (!st) return;
    this.fitMetricInput(inp);
    const it = st.exercises[parseInt(inp.dataset.idx, 10)];
    if (!it) return;
    it[inp.dataset.field] = inp.value;
    if (inp.dataset.field === 'c') {
      const label = inp.parentElement.querySelector('.metric-sets-label');
      if (label) label.textContent = this.pluralSets(parseInt(inp.value, 10) || 0);
    }
  }

  askRemoveDayExercise(index) {
    const st = this.dayDraft;
    if (!st || !st.exercises[index]) return;
    this.openConfirmSheet({
      title: 'Удалить упражнение?',
      text: 'Упражнение будет удалено из этой тренировки.',
      okLabel: 'Удалить',
      onOk: () => {
        if (!this.dayDraft) return;
        this.dayDraft.exercises.splice(index, 1);
        this.renderDayEdit();
      }
    });
  }

  // Упражнения из пикера попадают в черновик; цель берём из последней тренировки, если она была
  addDayExercises(items) {
    const st = this.dayDraft;
    if (!st) return;
    let added = 0;
    items.forEach(item => {
      const key = this.normName(item.name);
      if (st.exercises.some(e => this.normName(e.name) === key)) return;
      const id = item.id || this.findExerciseIdByName(item.name);
      const last = id ? this.getLastWorkoutSets(id) : null;
      st.exercises.push({
        id: id || null,
        name: item.name,
        w: String(last && last[0] ? last[0].weight : 0),
        r: String(last && last[0] ? last[0].reps : 10),
        c: String(last && last.length ? last.length : 3),
        n: ''
      });
      added++;
    });
    this.closeExercisePicker();
    this.renderDayEdit();
    if (added > 0) this.showToast(added > 1 ? `Добавлено упражнений: ${added}` : 'Упражнение добавлено');
  }

  saveDayEdit() {
    const st = this.dayDraft;
    if (!st) return;
    const name = st.name.trim();
    if (!name || st.exercises.length === 0) return;

    // Сначала проверяем все значения, чтобы не сохранить наполовину
    const parsed = [];
    for (const it of st.exercises) {
      const weight = parseFloat(String(it.w).replace(',', '.'));
      const reps = parseInt(it.r, 10);
      const count = parseInt(it.c, 10);
      if (!(weight >= 0) || !(reps >= 1) || !(count >= 1) || count > 50) {
        this.showToast(`Проверьте значения: ${it.name}`);
        return;
      }
      parsed.push({ weight, reps, count });
    }

    let prog = this.getCurrentProgram();
    if (!prog) {
      prog = { id: 'prog-' + Date.now(), name: 'Моя программа', days: [] };
      this.programs.push(prog);
      this.currentProgramId = prog.id;
    }
    const day = st.dayId ? prog.days.find(d => d.id === st.dayId) : null;
    const prev = day ? day.exercises : [];
    const exercises = st.exercises.map((it, i) => {
      const { id, name: exName } = this.resolvePickerItem({ id: it.id, name: it.name }, i);
      const old = prev.find(e => e.id === id);
      return {
        id,
        name: exName,
        targetSets: parsed[i].count,
        targetReps: String(parsed[i].reps),
        targetWeight: parsed[i].weight,
        notes: (it.n || '').trim()
      };
    });

    if (day) {
      day.name = name;
      day.exercises = exercises;
    } else {
      prog.days.push({ id: 'day-' + Date.now(), name, exercises });
    }
    this.savePrograms();
    this.dayDraft = null;
    this.navigate('viewProgram');
    this.showToast(day ? 'Тренировка сохранена' : 'Тренировка создана');
  }

  // Редактирование упражнения из активной тренировки: меняется только снимок тренировки, программа остаётся прежней
  saveExerciseFromModal() {
    const exId = document.getElementById('modalExId').value;
    const sets = parseInt(document.getElementById('modalExSets').value) || 3;
    const reps = document.getElementById('modalExReps').value.trim() || '8-10';
    const notes = document.getElementById('modalExNotes').value.trim();
    if (!this.activeWorkout) return;
    const wex = this.getActiveExercises().find(e => e.id === exId);
    if (wex) {
      wex.targetSets = sets;
      wex.targetReps = reps;
      wex.notes = notes;
      this.saveActiveWorkout();
    }
    this.closeModal('exerciseModal');
    this.renderWorkoutScreen();
    this.showToast('Упражнение обновлено');
  }

  // --- ACTIVE WORKOUT ENGINE ---
  weekdayName(date) {
    const names = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return names[date.getDay()];
  }

  openRenameWorkout() {
    if (!this.activeWorkout) return;
    const prog = this.getCurrentProgram();
    const day = prog && prog.days.find(d => d.id === this.activeWorkout.dayId);
    document.getElementById('modalWorkoutName').value = this.activeWorkout.dayName || (day ? day.name : '');
    this.openModal('renameWorkoutModal');
  }

  saveWorkoutName() {
    if (!this.activeWorkout) return;
    const name = document.getElementById('modalWorkoutName').value.trim();
    if (!name) return;
    // Меняется только название текущей тренировки, шаблон в программе остаётся прежним
    this.activeWorkout.dayName = name;
    this.saveActiveWorkout();
    this.closeModal('renameWorkoutModal');
    this.renderWorkoutScreen();
    this.renderHome();
  }

  startWorkout(dayId) {
    // В режиме перестановки карточки только перемещаются, тренировка не открывается
    if (this.reorder.list) return;
    if (this.activeWorkout && this.activeWorkout.dayId !== dayId) {
      this.openConfirmSheet({
        title: 'Завершить текущую тренировку?',
        text: 'Сейчас идёт другая тренировка. Если продолжить новую, текущая будет завершена и сохранена.',
        okLabel: 'Завершить',
        cancelLabel: 'Отмена',
        onOk: () => {
          const records = this.getWorkoutRecords(this.activeWorkout);
          const workout = this.activeWorkout;
          workout.endedAt = new Date().toISOString();
          this.workoutLogs.push(workout);
          this.saveWorkoutLogs();
          this.activeWorkout = null;
          this.saveActiveWorkout();
          this.stopWorkoutClock();
          this.openWorkoutComplete(workout, records);
          this.startWorkout(dayId);
        },
        onCancel: () => this.resumeActiveWorkout()
      });
      return;
    }
    if (this.activeWorkout && this.activeWorkout.dayId === dayId) {
      this.resumeActiveWorkout();
      return;
    }
    const prog = this.getCurrentProgram();
    const day = prog && prog.days.find(d => d.id === dayId);
    if (!day) return;

    if (this.activeWorkout && this.activeWorkout.dayId !== dayId) {
      this.openConfirmSheet({
        title: 'Начать новую тренировку?',
        text: 'У вас есть незавершённая тренировка. При старте новой она будет удалена.',
        okLabel: 'Начать',
        cancelLabel: 'Отмена',
        onOk: () => {
          this.activeWorkout = null;
          this.startWorkout(dayId);
        },
        onCancel: () => this.resumeActiveWorkout()
      });
      return;
    }

    if (!this.activeWorkout || this.activeWorkout.dayId !== dayId) {
      // Дата и время начала фиксируются автоматически
      this.activeWorkout = {
        id: 'workout-' + Date.now(),
        date: new Date().toISOString(),
        dayId: day.id,
        // Название тренировки по умолчанию — название выбранного шаблона (Вторник / Пятница), можно изменить
        dayName: day.name,
        programId: prog.id,
        exercises: day.exercises.map(ex => ({
          id: ex.id,
          name: ex.name,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          targetWeight: ex.targetWeight,
          notes: ex.notes || ''
        })),
        entries: day.exercises.map(ex => ({
          exerciseId: ex.id,
          sets: []
        }))
      };
      this.saveActiveWorkout();
    }

    this.renderWorkoutScreen();
    this.navigate('viewWorkout');
  }

  resumeActiveWorkout() {
    if (!this.activeWorkout || this.reorder.list) return;
    this.renderWorkoutScreen();
    this.navigate('viewWorkout');
  }

  formatDateTime(isoString, withTime = true) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    if (withTime) {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
    }
    return d.toLocaleString('ru-RU', opts);
  }

  formatSet(s) {
    return s.weight > 0 ? `${s.weight}кг×${s.reps}` : `${s.reps} повт.`;
  }

  // Список упражнений активной тренировки (снимок на момент старта, с учётом замен)
  getActiveExercises() {
    const w = this.activeWorkout;
    if (!w) return [];
    if (!Array.isArray(w.exercises)) {
      const prog = this.getCurrentProgram();
      const day = prog && prog.days.find(d => d.id === w.dayId);
      w.exercises = day ? day.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        notes: ex.notes || ''
      })) : [];
      this.saveActiveWorkout();
    }
    return w.exercises;
  }

  // --- ВЫБОР УПРАЖНЕНИЯ: добавление и замена (Figma: ExercisePicker/SheetOpen-A) ---
  normName(n) {
    return String(n || '').trim().toLowerCase();
  }

  findExerciseIdByName(name) {
    const lower = this.normName(name);
    const found = this.getAllExercisesList().find(e => this.normName(e.name) === lower);
    return found ? found.id : null;
  }

  // Список, с которым сверяется пикер: черновик тренировки (mode 'day') или активная тренировка
  getPickerExercises(mode) {
    if (mode === 'day') return this.dayDraft ? this.dayDraft.exercises : [];
    return this.getActiveExercises();
  }

  // mode: 'add' — добавить в активную тренировку, 'replace' — заменить упражнение exId, 'day' — добавить в создаваемую тренировку
  openExercisePicker(mode, exId) {
    if (mode === 'day' ? !this.dayDraft : !this.activeWorkout) return;
    const exercises = this.getPickerExercises(mode);
    if (mode === 'replace' && !exercises.some(e => e.id === exId)) return;

    const inWorkoutIds = new Set(exercises.map(e => e.id));
    const inWorkoutNames = new Set(exercises.map(e => this.normName(e.name)));
    const seen = new Set();
    const list = [];
    this.getAllExercisesList().forEach(e => {
      const key = this.normName(e.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (inWorkoutIds.has(e.id) || inWorkoutNames.has(key)) return;
      list.push({ id: e.id, name: e.name });
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    this.picker = { mode, exId: exId || null, query: '', list, selected: [] };
    document.getElementById('pickerSearch').value = '';
    document.getElementById('pickerClear').hidden = true;
    this.renderExercisePicker();
    document.getElementById('exercisePicker').classList.add('open');
  }

  closeExercisePicker() {
    this.picker = null;
    document.getElementById('exercisePicker').classList.remove('open');
  }

  renderExercisePicker() {
    const p = this.picker;
    if (!p) return;
    const q = this.normName(p.query);
    const rows = p.list
      .map((it, i) => ({ it, i }))
      .filter(r => !q || this.normName(r.it.name).includes(q));

    let html = '';
    if (rows.length === 0) {
      html = `<div class="pk-empty">${p.query.trim()
        ? 'Ничего не найдено. Нажмите «+», чтобы создать упражнение.'
        : 'Нет упражнений для выбора. Введите название и нажмите «+».'}</div>`;
    } else {
      html = rows.map(({ it, i }) => {
        const sel = p.selected.includes(i);
        return `<div class="pk-row${sel ? ' selected' : ''}" role="checkbox" aria-checked="${sel}" onclick="app.togglePickerItem(${i})">` +
          `<span class="pk-box">${sel ? '<img class="icon" src="./icons/check.svg" alt="">' : ''}</span>` +
          `<span class="pk-name">${this.escapeHtml(it.name)}</span></div>`;
      }).join('');
    }
    document.getElementById('pickerList').innerHTML = html;

    const confirmBtn = document.getElementById('pickerConfirm');
    const n = p.selected.length;
    confirmBtn.hidden = n === 0;
    confirmBtn.textContent = p.mode === 'replace' ? 'Заменить' : (n > 1 ? `Добавить (${n})` : 'Добавить');
  }

  onPickerInput(inp) {
    if (!this.picker) return;
    this.picker.query = inp.value;
    document.getElementById('pickerClear').hidden = inp.value === '';
    this.renderExercisePicker();
  }

  clearPickerSearch() {
    if (!this.picker) return;
    const inp = document.getElementById('pickerSearch');
    inp.value = '';
    this.onPickerInput(inp);
    inp.focus();
  }

  togglePickerItem(i) {
    const p = this.picker;
    if (!p || !p.list[i]) return;
    if (p.mode === 'replace') {
      p.selected = p.selected.includes(i) ? [] : [i];
    } else if (p.selected.includes(i)) {
      p.selected = p.selected.filter(x => x !== i);
    } else {
      p.selected.push(i);
    }
    this.renderExercisePicker();
  }

  // Кнопка «+»: создать своё упражнение с названием из строки поиска
  addCustomPickerExercise() {
    const p = this.picker;
    if (!p) return;
    const inp = document.getElementById('pickerSearch');
    const name = p.query.trim();
    if (!name) {
      this.showToast('Введите название упражнения');
      inp.focus();
      return;
    }
    const key = this.normName(name);
    if (this.getPickerExercises(p.mode).some(e => this.normName(e.name) === key)) {
      this.showToast('Это упражнение уже есть в тренировке');
      return;
    }
    let idx = p.list.findIndex(it => this.normName(it.name) === key);
    if (idx === -1) {
      p.list.unshift({ id: null, name });
      p.selected = p.selected.map(x => x + 1);
      idx = 0;
    }
    if (!p.selected.includes(idx)) {
      if (p.mode === 'replace') p.selected = [idx];
      else p.selected.push(idx);
    }
    inp.value = '';
    this.onPickerInput(inp);
  }

  // Находит или создаёт id упражнения по выбранному пункту списка
  resolvePickerItem(item, salt = 0) {
    let id = item.id || this.findExerciseIdByName(item.name);
    if (!id) {
      id = 'ex-' + (Date.now() + salt);
      this.exerciseNames[id] = item.name;
      this.saveExerciseNames();
    }
    const canonical = this.findExerciseName(id);
    return { id, name: canonical !== 'Упражнение' ? canonical : item.name };
  }

  confirmExercisePicker() {
    const p = this.picker;
    if (!p || (p.mode === 'day' ? !this.dayDraft : !this.activeWorkout) || p.selected.length === 0) return;
    const items = p.selected.map(i => p.list[i]).filter(Boolean);
    if (p.mode === 'replace') this.replaceWorkoutExercise(p.exId, items[0]);
    else if (p.mode === 'day') this.addDayExercises(items);
    else this.addWorkoutExercises(items);
  }

  // Добавляется только в текущую тренировку, программа не меняется
  addWorkoutExercises(items) {
    const exercises = this.getActiveExercises();
    let added = 0;
    items.forEach((item, n) => {
      const { id, name } = this.resolvePickerItem(item, n);
      if (exercises.some(e => e.id === id)) return;
      // Цель подхватываем из последней тренировки с этим упражнением (если она была)
      const last = this.getLastWorkoutSets(id);
      exercises.push({
        id,
        name,
        targetSets: last && last.length ? last.length : 3,
        targetReps: String(last && last[0] ? last[0].reps : '8-10'),
        notes: ''
      });
      if (!this.activeWorkout.entries.some(e => e.exerciseId === id)) {
        this.activeWorkout.entries.push({ exerciseId: id, sets: [] });
      }
      delete this.exerciseInputState[id];
      added++;
    });
    this.saveActiveWorkout();
    this.closeExercisePicker();
    this.renderWorkoutScreen();
    if (added > 0) this.showToast(added > 1 ? `Добавлено упражнений: ${added}` : 'Упражнение добавлено');
  }

  replaceWorkoutExercise(oldId, item) {
    const exercises = this.getActiveExercises();
    if (!item || !exercises.some(e => e.id === oldId)) return;

    const run = () => {
      if (!this.activeWorkout) return;
      const list = this.getActiveExercises();
      const i = list.findIndex(e => e.id === oldId);
      if (i === -1) return;
      const oldEx = list[i];
      const { id: newId, name } = this.resolvePickerItem(item);
      if (newId !== oldId && list.some(e => e.id === newId)) {
        this.showToast('Это упражнение уже есть в тренировке');
        return;
      }
      list[i] = {
        id: newId,
        name,
        targetSets: oldEx.targetSets,
        targetReps: oldEx.targetReps,
        notes: oldEx.notes || ''
      };
      this.activeWorkout.entries = this.activeWorkout.entries.filter(e => e.exerciseId !== oldId);
      this.activeWorkout.entries.push({ exerciseId: newId, sets: [] });
      delete this.exerciseInputState[oldId];
      delete this.exerciseInputState[newId];
      this.saveActiveWorkout();
      this.closeExercisePicker();
      this.renderWorkoutScreen();
      this.showToast(`Заменено: ${oldEx.name} → ${name}`);
    };

    const oldEntry = this.activeWorkout.entries.find(e => e.exerciseId === oldId);
    if (oldEntry && oldEntry.sets.length > 0) {
      this.openConfirmSheet({
        title: 'Заменить упражнение?',
        text: 'Упражнение уже отмечено выполненным. При замене записанные подходы будут удалены.',
        okLabel: 'Заменить',
        onOk: run
      });
    } else {
      run();
    }
  }

  // --- REMOVE EXERCISE DURING WORKOUT ---
  removeWorkoutExercise(exId) {
    if (!this.activeWorkout) return;
    const exercises = this.getActiveExercises();
    const idx = exercises.findIndex(e => e.id === exId);
    if (idx === -1) return;
    const ex = exercises[idx];

    const entry = this.activeWorkout.entries.find(e => e.exerciseId === exId);
    const setsCount = entry && entry.sets ? entry.sets.length : 0;
    const text = setsCount > 0
      ? `«${ex.name}» будет удалено из текущей тренировки. Записанные подходы (${setsCount}) будут потеряны.`
      : `«${ex.name}» будет удалено из текущей тренировки.`;

    this.openConfirmSheet({
      title: 'Удалить упражнение?',
      text,
      okLabel: 'Удалить',
      onOk: () => {
        if (!this.activeWorkout) return;
        const list = this.getActiveExercises();
        const i = list.findIndex(e => e.id === exId);
        if (i === -1) return;
        // Удаляется только из текущей тренировки, программа не меняется
        list.splice(i, 1);
        this.activeWorkout.entries = this.activeWorkout.entries.filter(e => e.exerciseId !== exId);
        delete this.exerciseInputState[exId];

        this.saveActiveWorkout();
        this.renderWorkoutScreen();
        this.showToast('Упражнение удалено из тренировки');
      }
    });
  }

  // --- EXERCISE HISTORY (список всех выполнений упражнения) ---
  openExerciseHistory(exId) {
    const name = this.findExerciseName(exId);
    const norm = (n) => String(n || '').trim().toLowerCase();
    // Одно и то же упражнение может иметь разные id (замены, импорт): сопоставляем ещё и по названию
    const ids = new Set([exId]);
    this.getAllExercisesList().forEach(e => { if (norm(e.name) === norm(name)) ids.add(e.id); });

    const sessions = [];
    this.workoutLogs.forEach(log => {
      (log.entries || []).forEach(en => {
        if (ids.has(en.exerciseId) && en.sets && en.sets.length > 0) {
          sessions.push({ date: log.date, dateOnly: log.dateOnly, dayName: log.dayName, sets: en.sets, current: false });
        }
      });
    });
    // Идущая сейчас тренировка (ещё не в журнале)
    if (this.activeWorkout) {
      (this.activeWorkout.entries || []).forEach(en => {
        if (ids.has(en.exerciseId) && en.sets && en.sets.length > 0) {
          sessions.push({ date: this.activeWorkout.date, dateOnly: false, dayName: this.activeWorkout.dayName, sets: en.sets, current: true });
        }
      });
    }
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('exerciseHistoryTitle').innerText = name;

    let maxWeight = 0;
    sessions.forEach(s => s.sets.forEach(x => { if (x.weight > maxWeight) maxWeight = x.weight; }));

    let html = '';
    if (sessions.length === 0) {
      html = '<div class="empty-state"><div class="empty-state-title">Пока нет записей</div><div class="empty-state-desc">Это упражнение ещё ни разу не выполнялось.</div></div>';
    } else {
      html += `<div class="ex-history-summary">Тренировок: <strong>${sessions.length}</strong>${maxWeight > 0 ? ` · Рекорд веса: <strong>${maxWeight} кг</strong>` : ''}</div>`;
      sessions.forEach(s => {
        const dateStr = this.formatDateTime(s.date, !s.dateOnly && s.current);
        const setsHtml = '<div class="ex-history-sets">' + s.sets.map(x => {
          const isMax = x.weight > 0 && x.weight === maxWeight;
          const label = x.weight > 0 ? `${x.weight} кг × ${x.reps}` : `${x.reps} повт.`;
          return `<span class="chip${isMax ? ' selected' : ''}">${label}${isMax ? '<img class="icon" src="./icons/fire.svg" alt="">' : ''}</span>`;
        }).join('') + '</div>';
        html += `
          <div class="ex-history-item">
            <div class="ex-history-head">
              <span class="ex-history-date">${dateStr}${s.current ? ' · сейчас' : ''}</span>
              <span class="ex-history-day">${s.dayName || ''}</span>
            </div>
            ${setsHtml}
          </div>`;
      });
    }
    document.getElementById('exerciseHistoryBody').innerHTML = html;
    document.getElementById('exerciseHistoryModal').classList.add('open');
  }

  getLastWorkoutSets(exerciseId) {
    // Find in historical logs (excluding currently active)
    for (let i = this.workoutLogs.length - 1; i >= 0; i--) {
      const log = this.workoutLogs[i];
      const entry = log.entries && log.entries.find(e => e.exerciseId === exerciseId);
      if (entry && entry.sets && entry.sets.length > 0) {
        return entry.sets;
      }
    }
    return null;
  }

  getHistoricalMaxWeight(exerciseId) {
    let max = 0;
    this.workoutLogs.forEach(log => {
      const entry = log.entries && log.entries.find(e => e.exerciseId === exerciseId);
      if (entry && entry.sets) {
        entry.sets.forEach(s => {
          if (s.weight > max) max = s.weight;
        });
      }
    });
    return max;
  }

  isNewRecord(exerciseId, weight, reps) {
    if (!weight || weight <= 0) return false;
    const histMax = this.getHistoricalMaxWeight(exerciseId);
    if (histMax === 0) return false; // First time doesn't count as breaking a PR
    if (weight > histMax) return true;
    return false;
  }

  renderWorkoutScreen() {
    if (!this.activeWorkout) return;
    const prog = this.getCurrentProgram();
    const day = prog && prog.days.find(d => d.id === this.activeWorkout.dayId);
    const dayName = this.activeWorkout.dayName || (day ? day.name : 'Тренировка');

    document.getElementById('workoutScreenDayName').textContent = dayName;
    const startDate = new Date(this.activeWorkout.date);
    const validDate = !isNaN(startDate.getTime());
    const pad2 = (n) => String(n).padStart(2, '0');
    document.getElementById('workoutScreenDate').textContent = validDate
      ? `${pad2(startDate.getDate())}.${pad2(startDate.getMonth() + 1)}.${startDate.getFullYear()}`
      : '';
    document.getElementById('workoutScreenWeekday').textContent = validDate ? this.weekdayName(startDate) : '';
    this.startWorkoutClock();

    const container = document.getElementById('workoutExercisesContainer');
    if (!container) return;

    let html = '';
    const esc = (v) => this.escapeHtml(v);
    this.getActiveExercises().forEach((ex) => {
      let entry = this.activeWorkout.entries.find(e => e.exerciseId === ex.id);
      if (!entry) {
        entry = { exerciseId: ex.id, sets: [] };
        this.activeWorkout.entries.push(entry);
      }

      const pastSets = this.getLastWorkoutSets(ex.id);
      let pastResultText = 'Первая тренировка этого упражнения';
      if (pastSets && pastSets.length > 0) {
        pastResultText = pastSets.map(s => this.formatSet(s)).join(', ');
      }

      // Подходы вводятся вручную: вес, повторы и число подходов; отметка «выполнено» записывает их
      if (!this.exerciseInputState[ex.id]) {
        let defWeight = ex.targetWeight != null ? ex.targetWeight : 50;
        let defReps = parseInt(ex.targetReps, 10) || 10;
        let defCount = ex.targetSets || 3;
        if (entry.sets.length > 0) {
          const lastSet = entry.sets[entry.sets.length - 1];
          defWeight = lastSet.weight;
          defReps = lastSet.reps;
          defCount = entry.sets.length;
        } else if (pastSets && pastSets.length > 0) {
          defWeight = pastSets[0].weight;
          defReps = pastSets[0].reps;
        }
        this.exerciseInputState[ex.id] = { weight: defWeight, reps: defReps, count: defCount };
      }

      const cur = this.exerciseInputState[ex.id];
      const histMax = this.getHistoricalMaxWeight(ex.id);
      const isRecordPotential = histMax > 0 && cur.weight > histMax;
      const isDone = entry.sets.length > 0;
      const target = ex.targetSets || 3;

      const goal = `Цель: ${target} × ${esc(ex.targetReps || '8-10')}${histMax > 0 ? ` · Рекорд: ${histMax} кг` : ''}`;
      // Примечание показывается текстом; добавить или изменить его можно через меню «⋯»
      const subHtml = [
        `<div>${goal}</div>`,
        ex.notes ? `<div class="ex-note">${esc(ex.notes)}</div>` : '',
        `<div>Прошлый раз: ${esc(pastResultText)}</div>`
      ].join('');

      const rm = this.reorder.workout;
      const menuOrMove = rm
        ? ''
        : `<button class="card-menu-btn" onclick="app.toggleCardMenu(event, 'w_${ex.id}')" title="Меню" aria-label="Меню">
                <img class="icon" src="./icons/dots-three.svg" alt="">
              </button>`;

      html += `
        <div class="ex-card${isDone ? ' done' : ''}" data-exercise-id="${ex.id}">
          <div class="ex-head">
            <div class="workout-card-header">
              <div class="workout-card-title">${esc(ex.name)}</div>
              ${menuOrMove}
            </div>
            <div class="ex-sub">${subHtml}</div>
          </div>
          <div class="card-menu dd-menu" id="cardMenu-w_${ex.id}" onclick="event.stopPropagation()">
            <button class="card-menu-item" onclick="app.workoutMenuAction('replace', '${ex.id}')"><img class="icon icon-20" src="./icons/arrows-clockwise.svg" alt="">Замена</button>
            <div class="dd-divider"></div>
            <button class="card-menu-item" onclick="app.workoutMenuAction('note', '${ex.id}')"><img class="icon icon-20" src="./icons/chat-teardrop-dots.svg" alt="">Примечание</button>
            <div class="dd-divider"></div>
            <button class="card-menu-item" onclick="app.workoutMenuAction('edit', '${ex.id}')"><img class="icon icon-20" src="./icons/pencil-simple.svg" alt="">Редактировать</button>
            <div class="dd-divider"></div>
            <button class="card-menu-item" onclick="app.workoutMenuAction('history', '${ex.id}')"><img class="icon icon-20" src="./icons/clock-counter-clockwise.svg" alt="">История</button>
            <div class="dd-divider"></div>
            <button class="card-menu-item" onclick="app.workoutMenuAction('remove', '${ex.id}')"><img class="icon icon-20" src="./icons/trash.svg" alt="">Удалить</button>
          </div>
          <div class="ex-metrics">
            <button class="ex-check${isDone ? ' done' : ''}" onclick="app.toggleExerciseDone('${ex.id}')" title="${isDone ? 'Снять отметку' : 'Отметить выполненным'}" aria-label="${isDone ? 'Снять отметку' : 'Отметить выполненным'}" aria-pressed="${isDone}">${isDone ? '<img class="icon" src="./icons/check.svg" alt="">' : ''}</button>
            <div class="metric-group">
              <label class="metric-pill">
                <input class="metric-input" id="inpWeight_${ex.id}" inputmode="decimal" autocomplete="off" value="${cur.weight}" oninput="app.onWorkoutInput(this, '${ex.id}')" aria-label="Вес, кг">
                <span>кг</span>
              </label>
              <label class="metric-pill">
                <input class="metric-input" id="inpReps_${ex.id}" inputmode="numeric" autocomplete="off" value="${cur.reps}" oninput="app.onWorkoutInput(this, '${ex.id}')" aria-label="Повторы">
                <span>раз</span>
              </label>
              <label class="metric-pill">
                <input class="metric-input" id="inpCount_${ex.id}" inputmode="numeric" autocomplete="off" value="${cur.count}" oninput="app.onWorkoutInput(this, '${ex.id}')" aria-label="Подходы">
                <span id="cntLabel_${ex.id}">${this.pluralSets(cur.count)}</span>
              </label>
            </div>
          </div>
          <div id="livePR_${ex.id}" class="ex-live-pr">${isRecordPotential ? '<img class="icon" src="./icons/fire.svg" alt="">Будет новый рекорд по весу!' : ''}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.classList.toggle('reorder-on', this.reorder.workout);
    container.querySelectorAll('.metric-input').forEach(inp => this.fitMetricInput(inp));
  }

  // Таймер тренировки (Figma: Timer/Value) — время с момента старта, переживает перезагрузку
  startWorkoutClock() {
    this.stopWorkoutClock();
    const tick = () => {
      const el = document.getElementById('workoutClock');
      if (!el || !this.activeWorkout) return;
      const start = new Date(this.activeWorkout.date).getTime();
      const sec = isNaN(start) ? 0 : Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      el.textContent = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
    };
    tick();
    this.workoutClockId = setInterval(tick, 1000);
  }

  stopWorkoutClock() {
    if (this.workoutClockId) clearInterval(this.workoutClockId);
    this.workoutClockId = null;
  }

  // Меню «⋯» на карточке упражнения в тренировке (Figma: Dropdown/Menu)
  workoutMenuAction(action, exId) {
    this.closeCardMenu();
    if (action === 'replace') this.openExercisePicker('replace', exId);
    else if (action === 'note') this.openExerciseNote(exId);
    else if (action === 'edit') this.openWorkoutExerciseEdit(exId);
    else if (action === 'history') this.openExerciseHistory(exId);
    else if (action === 'remove') this.removeWorkoutExercise(exId);
  }

  // Редактирование упражнения только в текущей тренировке: цель и заметка, программа не меняется
  openWorkoutExerciseEdit(exId) {
    if (!this.activeWorkout) return;
    const ex = this.getActiveExercises().find(e => e.id === exId);
    if (!ex) return;
    document.getElementById('modalExId').value = ex.id;
    const nameInp = document.getElementById('modalExName');
    nameInp.value = ex.name;
    nameInp.readOnly = true;
    document.getElementById('modalExSets').value = ex.targetSets || 3;
    document.getElementById('modalExReps').value = ex.targetReps || '8-10';
    document.getElementById('modalExNotes').value = ex.notes || '';
    document.getElementById('exerciseModalTitle').innerText = 'Редактировать упражнение';
    this.openModal('exerciseModal');
  }

  onWorkoutInput(inp, exId) {
    this.fitMetricInput(inp);
    this.onInputChange(exId);
  }

  // Читает введённые вес, повторы и число подходов карточки упражнения
  readExerciseInputs(exId) {
    const inpWeight = document.getElementById(`inpWeight_${exId}`);
    const inpReps = document.getElementById(`inpReps_${exId}`);
    const inpCount = document.getElementById(`inpCount_${exId}`);
    if (!inpWeight || !inpReps || !inpCount) return null;
    return {
      weight: parseFloat(String(inpWeight.value).replace(',', '.')) || 0,
      reps: parseInt(inpReps.value, 10) || 0,
      count: parseInt(inpCount.value, 10) || 0
    };
  }

  buildSets(weight, reps, count, timestamp) {
    return Array.from({ length: Math.min(count, 50) }, () => ({ weight, reps, timestamp }));
  }

  onInputChange(exId) {
    const v = this.readExerciseInputs(exId);
    if (!v) return;
    this.exerciseInputState[exId] = v;

    const label = document.getElementById(`cntLabel_${exId}`);
    if (label) label.textContent = this.pluralSets(v.count);

    const histMax = this.getHistoricalMaxWeight(exId);
    const prEl = document.getElementById(`livePR_${exId}`);
    if (prEl) {
      if (histMax > 0 && v.weight > histMax) {
        prEl.innerHTML = `<img class="icon" src="./icons/fire.svg" alt="">Будет новый рекорд! (${v.weight} кг > ${histMax} кг)`;
      } else {
        prEl.innerHTML = '';
      }
    }

    // Если упражнение уже отмечено выполненным, изменения сразу попадают в записанные подходы
    const entry = this.activeWorkout && this.activeWorkout.entries.find(e => e.exerciseId === exId);
    if (entry && entry.sets.length > 0 && v.reps >= 1 && v.count >= 1) {
      entry.sets = this.buildSets(v.weight, v.reps, v.count, entry.sets[0].timestamp || Date.now());
      this.saveActiveWorkout();
    }
  }

  // Отметка «упражнение выполнено»: записывает введённые подходы или снимает отметку
  toggleExerciseDone(exId) {
    if (!this.activeWorkout) return;
    let entry = this.activeWorkout.entries.find(e => e.exerciseId === exId);
    if (!entry) {
      entry = { exerciseId: exId, sets: [] };
      this.activeWorkout.entries.push(entry);
    }

    if (entry.sets.length > 0) {
      entry.sets = [];
      this.saveActiveWorkout();
      this.renderWorkoutScreen();
      return;
    }

    const v = this.readExerciseInputs(exId);
    if (!v) return;
    if (v.reps < 1) {
      this.showToast('Укажите количество повторов');
      return;
    }
    if (v.count < 1 || v.count > 50) {
      this.showToast('Укажите число подходов от 1 до 50');
      return;
    }

    const isPR = this.isNewRecord(exId, v.weight, v.reps);
    this.exerciseInputState[exId] = v;
    entry.sets = this.buildSets(v.weight, v.reps, v.count, Date.now());
    this.saveActiveWorkout();
    this.renderWorkoutScreen();

    if (isPR) {
      this.showToast(`Новый личный рекорд: ${v.weight} кг × ${v.reps} повт.!`);
    } else {
      this.showToast('Упражнение выполнено');
    }
  }

  // --- Завершение тренировки (Figma: Flow/03 Workout/FinishConfirm, Flow/04 Workout/Complete) ---
  pluralWord(n, forms) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  pluralExercises(n) {
    return this.pluralWord(n, ['упражнение', 'упражнения', 'упражнений']);
  }

  formatInt(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  }

  formatDuration(min) {
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }

  // Сводка по тренировке: выполненные упражнения, подходы и тоннаж (вес × повторы)
  getWorkoutStats(w) {
    let exercises = 0;
    let sets = 0;
    let tonnage = 0;
    (w.entries || []).forEach(e => {
      if (!e.sets || e.sets.length === 0) return;
      exercises += 1;
      sets += e.sets.length;
      e.sets.forEach(s => { tonnage += (Number(s.weight) || 0) * (Number(s.reps) || 0); });
    });
    return { exercises, sets, tonnage };
  }

  // Новые рекорды по весу в этой тренировке. Вызывать до добавления тренировки в workoutLogs
  getWorkoutRecords(w) {
    const records = [];
    (w.entries || []).forEach(e => {
      if (!e.sets || e.sets.length === 0) return;
      const best = this.getBestSet(e.sets);
      const weight = Number(best.weight) || 0;
      const reps = Number(best.reps) || 0;
      if (!this.isNewRecord(e.exerciseId, weight, reps)) return;
      const ex = (w.exercises || []).find(x => x.id === e.exerciseId);
      records.push({ name: ex ? ex.name : this.findExerciseName(e.exerciseId), weight, reps });
    });
    return records;
  }

  finishWorkout() {
    if (!this.activeWorkout) return;
    const st = this.getWorkoutStats(this.activeWorkout);
    this.openConfirmSheet({
      title: 'Завершить тренировку?',
      text: st.sets === 0
        ? 'Вы не записали ни одного подхода. Всё равно завершить тренировку?'
        : 'Выполненные подходы и результаты будут сохранены',
      stats: [
        `${st.exercises} ${this.pluralExercises(st.exercises)}`,
        `${st.sets} ${this.pluralSets(st.sets)}`,
        `${this.formatInt(st.tonnage)} кг`
      ],
      okLabel: 'Завершить',
      cancelLabel: 'Отмена',
      onOk: () => this.commitFinishWorkout()
    });
  }

  commitFinishWorkout() {
    if (!this.activeWorkout) return;
    const workout = this.activeWorkout;
    const records = this.getWorkoutRecords(workout);

    // Время окончания сохраняем вместе с тренировкой (date = время начала, проставлено при старте)
    workout.endedAt = new Date().toISOString();
    this.workoutLogs.push(workout);
    this.saveWorkoutLogs();

    this.activeWorkout = null;
    this.saveActiveWorkout();
    this.stopWorkoutClock();

    this.openHome();
    this.openWorkoutComplete(workout, records);
  }

  openWorkoutComplete(w, records) {
    const stats = this.getWorkoutStats(w);
    const start = new Date(w.date);
    const end = new Date(w.endedAt);
    const hasStart = !isNaN(start.getTime());
    const first = hasStart ? start : end;
    const pad2 = (n) => String(n).padStart(2, '0');
    const hm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const minutes = hasStart ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)) : 0;
    const duration = minutes > 0 ? this.formatDuration(minutes) : '—';
    const set = (id, text) => { document.getElementById(id).textContent = text; };

    set('completeDate', `${first.getDate()} ${months[first.getMonth()]} ${first.getFullYear()} • ${this.weekdayName(first)}`);
    set('completeTime', hasStart ? `${hm(start)}–${hm(end)} • ${duration}` : hm(end));
    set('completeExercises', String(stats.exercises));
    set('completeExercisesLbl', this.pluralExercises(stats.exercises));
    set('completeSets', String(stats.sets));
    set('completeSetsLbl', this.pluralSets(stats.sets));
    set('completeTonnage', `${this.formatInt(stats.tonnage)} кг`);
    set('completeDuration', duration);

    const box = document.getElementById('completeRecords');
    box.textContent = '';
    records.forEach(r => {
      const card = document.createElement('div');
      card.className = 'complete-record';
      const badge = document.createElement('div');
      badge.className = 'complete-badge complete-badge-sm';
      const icon = document.createElement('img');
      icon.className = 'icon';
      icon.src = './icons/fire.svg';
      icon.alt = '';
      badge.appendChild(icon);
      const text = document.createElement('div');
      text.className = 'complete-record-text';
      const label = document.createElement('div');
      label.className = 'complete-record-label';
      label.textContent = r.name ? `Новый рекорд · ${r.name}` : 'Новый рекорд';
      const value = document.createElement('div');
      value.className = 'complete-record-value';
      value.textContent = `${r.weight} кг × ${r.reps}`;
      text.appendChild(label);
      text.appendChild(value);
      card.appendChild(badge);
      card.appendChild(text);
      box.appendChild(card);
    });

    const screen = document.getElementById('workoutComplete');
    screen.classList.add('open');
    screen.scrollTop = 0;
  }

  closeWorkoutComplete() {
    document.getElementById('workoutComplete').classList.remove('open');
    window.scrollTo({ top: 0 });
  }

  cancelWorkout() {
    this.openConfirmSheet({
      title: 'Отменить тренировку?',
      text: 'Текущий прогресс будет потерян без возможности восстановления.',
      okLabel: 'Отменить',
      cancelLabel: 'Продолжить',
      onOk: () => {
        this.activeWorkout = null;
        this.saveActiveWorkout();
        this.stopWorkoutClock();
        this.showToast('Тренировка отменена');
        this.navigate('viewProgram');
      }
    });
  }

  // --- HISTORY LOGS ---
  switchSubtab(tab) {
    this.historyTab = tab;
    const titleEl = document.getElementById('historyTitle');
    if (titleEl) titleEl.innerText = tab === 'charts' ? 'График' : 'История';
    const settingsBtn = document.getElementById('btnHistorySettings');
    if (settingsBtn) settingsBtn.style.visibility = tab === 'charts' ? 'hidden' : 'visible';
    const contentLogs = document.getElementById('subtabContentLogs');
    const contentCharts = document.getElementById('subtabContentCharts');

    if (tab === 'logs') {
      contentLogs.style.display = 'block';
      contentCharts.style.display = 'none';
      this.renderHistoryLogs();
    } else {
      contentLogs.style.display = 'none';
      contentCharts.style.display = 'block';
      this.populateExerciseSelect();
      this.renderExerciseChartAndPR();
    }
  }

  renderHistory() {
    this.renderHistoryLogs();
    this.populateExerciseSelect();
  }

  renderHistoryLogs() {
    const container = document.getElementById('logsHistoryList');
    if (!container) return;

    if (this.workoutLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">История пуста</div>
          <div class="empty-state-desc">Завершите свою первую тренировку, чтобы увидеть журнал.</div>
        </div>
      `;
      return;
    }

    const sorted = [...this.workoutLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sorted.forEach((log) => {
      const dayObj = this.programs.reduce((found, p) => found || p.days.find(d => d.id === log.dayId), null);
      const dayName = log.dayName || (dayObj ? dayObj.name : 'Тренировка');

      let totalSets = 0;
      let totalVolume = 0;
      let exercisesDetailsHtml = '';

      if (log.entries) {
        log.entries.forEach(e => {
          if (e.sets && e.sets.length > 0) {
            totalSets += e.sets.length;
            e.sets.forEach(s => { totalVolume += (s.weight * s.reps); });
            const exName = this.findExerciseName(e.exerciseId);
            const logEx = Array.isArray(log.exercises) ? log.exercises.find(x => x.id === e.exerciseId) : null;
            const exNote = logEx && logEx.notes ? `<div class="history-exercise-note">${this.escapeHtml(logEx.notes)}</div>` : '';

            exercisesDetailsHtml += `
              <div class="history-exercise-detail">
                <div class="history-exercise-top">
                  <div class="history-exercise-name">${this.escapeHtml(exName)}</div>
                  <button type="button" class="history-chart-btn" onclick="event.stopPropagation(); app.openExerciseChart('${e.exerciseId}')" title="Посмотреть график" aria-label="Посмотреть график: ${this.escapeHtml(exName)}">
                    <img class="icon icon-20" src="./icons/chart-bar-outline.svg" alt="">
                  </button>
                </div>
                ${exNote}
                <div class="history-sets">${this.groupSetsHtml(e.sets)}</div>
              </div>
            `;
          }
        });
      }
      if (log.note) {
        exercisesDetailsHtml += `<div class="exercise-notes">${this.escapeHtml(log.note)}</div>`;
      }

      html += `
        <div class="history-item">
          <div class="history-date">${this.formatHistoryDate(log.date)}</div>
          <div class="history-card" onclick="app.toggleHistoryDetails('${log.id}')">
            <div class="workout-card-header">
              <div class="workout-card-title">${this.escapeHtml(dayName)}</div>
              <button class="card-menu-btn" onclick="app.toggleCardMenu(event, 'h_${log.id}')" title="Меню" aria-label="Меню">
                <img class="icon" src="./icons/dots-three.svg" alt="">
              </button>
            </div>
            <div class="workout-card-meta">Подходов: ${totalSets}<span class="meta-dot">•</span>Тоннаж: ${Math.round(totalVolume)} кг</div>
            <div class="card-menu" id="cardMenu-h_${log.id}" onclick="event.stopPropagation()">
              <button class="card-menu-item" onclick="app.openLogEdit('${log.id}')">
                <img class="icon icon-20" src="./icons/pencil-simple.svg" alt="">Редактировать
              </button>
              <button class="card-menu-item card-menu-item-danger" onclick="app.deleteLog('${log.id}')">
                <img class="icon icon-20" src="./icons/trash.svg" alt="">Удалить
              </button>
            </div>
            <div id="histDetails_${log.id}" class="history-card-details">
              ${exercisesDetailsHtml || '<p class="history-empty">Нет записанных подходов</p>'}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Подряд идущие одинаковые подходы схлопываются: «60 кг × 8 — 3 подхода»
  groupSetsHtml(sets) {
    const groups = [];
    sets.forEach(s => {
      const last = groups[groups.length - 1];
      if (last && last.weight === s.weight && last.reps === s.reps) last.count++;
      else groups.push({ weight: s.weight, reps: s.reps, count: 1 });
    });
    return groups.map(g => {
      const label = g.weight > 0 ? `${g.weight} кг × ${g.reps}` : `${g.reps} повт.`;
      return `<div class="history-set-row"><span class="history-set-val">${label}</span><span class="history-set-count">${g.count} ${this.pluralSets(g.count)}</span></div>`;
    }).join('');
  }

  // Переход из истории на вкладку аналитики с выбранным упражнением
  openExerciseChart(exId) {
    this.chartExerciseId = exId;
    this.openAnalytics();
  }

  // --- Кастомный выбор упражнения для графика (вместо системного select) ---
  getChartExercises() {
    // В аналитике только упражнения, которые реально выполнялись (есть в истории с подходами)
    const done = new Set();
    this.workoutLogs.forEach(log => (log.entries || []).forEach(en => {
      if (en.sets && en.sets.length > 0) done.add(en.exerciseId);
    }));
    return this.getAllExercisesList().filter(e => done.has(e.id));
  }

  openChartPicker() {
    const exercises = this.getChartExercises();
    const list = document.getElementById('chartPickerList');
    if (exercises.length === 0) {
      list.innerHTML = '<div class="pk-empty">Нет доступных упражнений</div>';
    } else {
      list.innerHTML = exercises.map(e => {
        const sel = e.id === this.chartExerciseId;
        return `<button type="button" class="cp-row${sel ? ' selected' : ''}" role="option" aria-selected="${sel}" onclick="app.selectChartExercise('${e.id}')">` +
          `<span class="cp-name">${this.escapeHtml(e.name)}</span>` +
          `${sel ? '<img class="icon icon-20" src="./icons/check.svg" alt="">' : ''}</button>`;
      }).join('');
    }
    this.openModal('chartPickerSheet');
  }

  selectChartExercise(exId) {
    this.chartExerciseId = exId;
    this.closeModal('chartPickerSheet');
    this.updateChartPickerLabel();
    this.renderExerciseChartAndPR();
  }

  updateChartPickerLabel() {
    const label = document.getElementById('chartExerciseLabel');
    if (!label) return;
    const ex = this.getChartExercises().find(e => e.id === this.chartExerciseId);
    label.textContent = ex ? ex.name : 'Нет доступных упражнений';
  }

  // Пояснения к показателям аналитики
  showInfo(key) {
    const info = {
      maxWeight: ['Макс. вес', 'Самый большой вес, с которым вы сделали хотя бы один подход в этом упражнении, за всё время.'],
      est1rm: ['Оценка 1RM', 'Расчётный максимум на одно повторение по формуле Эпли: вес × (1 + повторы ÷ 30). Берётся лучший подход за всё время. Это оценка, а не проверенный рекорд.'],
      maxVolume: ['Макс. объём', 'Наибольший объём за одну тренировку: сумма «вес × повторы» по всем подходам упражнения.']
    }[key];
    if (!info) return;
    document.getElementById('infoSheetTitle').textContent = info[0];
    document.getElementById('infoSheetText').textContent = info[1];
    this.openModal('infoSheet');
  }

  // «30.09.2026 • Вторник»
  formatHistoryDate(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' });
    return `${dd}.${mm}.${d.getFullYear()}<span class="meta-dot">•</span>${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`;
  }

  toggleHistoryDetails(logId) {
    const el = document.getElementById(`histDetails_${logId}`);
    if (el) el.classList.toggle('open');
  }

  deleteLog(logId) {
    this.closeCardMenu();
    this.openConfirmSheet({
      title: 'Удалить тренировку?',
      text: 'Тренировка и её результаты будут удалены без возможности восстановления.',
      okLabel: 'Удалить',
      onOk: () => {
        this.workoutLogs = this.workoutLogs.filter(l => l.id !== logId);
        this.saveWorkoutLogs();
        this.renderHistory();
        this.showToast('Запись удалена');
      }
    });
  }

  // --- Нижняя шторка подтверждения (Figma: BottomSheet/ConfirmDelete) ---
  openConfirmSheet({ title, text, okLabel, cancelLabel = 'Отмена', stats, onOk, onCancel }) {
    this.confirmAction = onOk;
    this.confirmCancel = onCancel || null;
    document.getElementById('confirmSheetCancel').textContent = cancelLabel;
    document.getElementById('confirmSheetTitle').textContent = title;
    document.getElementById('confirmSheetText').textContent = text;
    document.getElementById('confirmSheetOk').textContent = okLabel;
    const statsEl = document.getElementById('confirmSheetStats');
    statsEl.textContent = '';
    if (Array.isArray(stats) && stats.length > 0) {
      stats.forEach(s => {
        const item = document.createElement('span');
        item.textContent = s;
        statsEl.appendChild(item);
      });
      statsEl.hidden = false;
    } else {
      statsEl.hidden = true;
    }
    document.getElementById('confirmSheet').classList.add('open');
  }

  cancelConfirmSheet() {
    const action = this.confirmCancel;
    this.closeConfirmSheet();
    if (typeof action === 'function') action();
  }

  closeConfirmSheet() {
    this.confirmAction = null;
    this.confirmCancel = null;
    document.getElementById('confirmSheet').classList.remove('open');
  }

  runConfirmSheet() {
    const action = this.confirmAction;
    this.closeConfirmSheet();
    if (typeof action === 'function') action();
  }

  // --- Экран редактирования записи из истории (Figma: Workout/Edit) ---
  getLogDayName(log) {
    const dayObj = this.programs.reduce((found, p) => found || p.days.find(d => d.id === log.dayId), null);
    return log.dayName || (dayObj ? dayObj.name : 'Тренировка');
  }

  pluralSets(n) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'подход';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'подхода';
    return 'подходов';
  }

  // Лучший подход: сначала больший вес, при равенстве — больше повторов
  getBestSet(sets) {
    return sets.reduce((best, s) => {
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      const bw = Number(best.weight) || 0;
      const br = Number(best.reps) || 0;
      return (w > bw || (w === bw && r > br)) ? s : best;
    }, sets[0]);
  }

  openLogEdit(logId) {
    this.closeCardMenu();
    const log = this.workoutLogs.find(l => l.id === logId);
    if (!log) return;
    const items = [];
    (log.entries || []).forEach((entry, entryIndex) => {
      if (!entry.sets || entry.sets.length === 0) return;
      const best = this.getBestSet(entry.sets);
      const weight = Number(best.weight) || 0;
      const reps = Number(best.reps) || 0;
      const count = entry.sets.length;
      items.push({
        entryIndex,
        name: this.findExerciseName(entry.exerciseId),
        w: String(weight),
        r: String(reps),
        c: String(count),
        orig: { weight, reps, count }
      });
    });
    this.logEdit = { logId, title: this.getLogDayName(log), items };
    this.renderLogEdit();
    this.navigate('viewLogEdit');
  }

  renderLogEdit() {
    const st = this.logEdit;
    if (!st) return;
    document.getElementById('logEditTitle').textContent = st.title;
    const list = document.getElementById('logEditList');
    if (st.items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Нет упражнений</div>
          <div class="empty-state-desc">В этой тренировке не осталось упражнений с подходами.</div>
        </div>
      `;
      return;
    }
    list.innerHTML = st.items.map((it, i) => `
      <div class="edit-card">
        <div class="workout-card-header">
          <div class="workout-card-title">${this.escapeHtml(it.name)}</div>
          <button class="card-menu-btn" onclick="app.askRemoveLogExercise(${i})" title="Удалить упражнение" aria-label="Удалить упражнение">
            <img class="icon" src="./icons/trash.svg" alt="">
          </button>
        </div>
        <div class="metric-group">
          <label class="metric-pill">
            <input class="metric-input" data-idx="${i}" data-field="w" inputmode="decimal" autocomplete="off" value="${this.escapeHtml(it.w)}" oninput="app.onLogEditInput(this)" aria-label="Вес, кг">
            <span>кг</span>
          </label>
          <label class="metric-pill">
            <input class="metric-input" data-idx="${i}" data-field="r" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.r)}" oninput="app.onLogEditInput(this)" aria-label="Повторы">
            <span>раз</span>
          </label>
          <label class="metric-pill">
            <input class="metric-input" data-idx="${i}" data-field="c" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.c)}" oninput="app.onLogEditInput(this)" aria-label="Подходы">
            <span class="metric-sets-label">${this.pluralSets(parseInt(it.c, 10) || 0)}</span>
          </label>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.metric-input').forEach(inp => this.fitMetricInput(inp));
  }

  // Ширина поля подгоняется под введённый текст
  fitMetricInput(inp) {
    inp.style.width = Math.max(1, inp.value.length) + 'ch';
  }

  onLogEditInput(inp) {
    this.fitMetricInput(inp);
    if (inp.dataset.field === 'c') {
      const label = inp.parentElement.querySelector('.metric-sets-label');
      if (label) label.textContent = this.pluralSets(parseInt(inp.value, 10) || 0);
    }
  }

  // Забираем значения полей в черновик (до перерисовки и сохранения)
  syncLogEditFromDom() {
    const st = this.logEdit;
    if (!st) return;
    document.querySelectorAll('#logEditList .metric-input').forEach(inp => {
      const it = st.items[parseInt(inp.dataset.idx, 10)];
      if (it) it[inp.dataset.field] = inp.value;
    });
  }

  askRemoveLogExercise(index) {
    const st = this.logEdit;
    if (!st || !st.items[index]) return;
    this.syncLogEditFromDom();
    this.openConfirmSheet({
      title: 'Удалить упражнение?',
      text: 'Упражнение и все его подходы будут удалены из текущей тренировки.',
      okLabel: 'Удалить',
      onOk: () => {
        if (!this.logEdit) return;
        this.logEdit.items.splice(index, 1);
        this.renderLogEdit();
      }
    });
  }

  saveLogEdit() {
    const st = this.logEdit;
    if (!st) return;
    this.syncLogEditFromDom();
    const log = this.workoutLogs.find(l => l.id === st.logId);
    if (!log) { this.navigate('viewHistory'); return; }

    // Сначала проверяем все значения, чтобы не сохранить наполовину
    const parsed = new Map();
    for (const it of st.items) {
      const weight = parseFloat(String(it.w).replace(',', '.'));
      const reps = parseInt(it.r, 10);
      const count = parseInt(it.c, 10);
      if (!(weight >= 0) || !(reps >= 1) || !(count >= 1) || count > 50) {
        this.showToast(`Проверьте значения: ${it.name}`);
        return;
      }
      parsed.set(it.entryIndex, { weight, reps, count, orig: it.orig });
    }

    const now = Date.now();
    log.entries = (log.entries || []).map((entry, idx) => {
      if (!entry.sets || entry.sets.length === 0) return entry;
      const p = parsed.get(idx);
      if (!p) return null; // упражнение удалено
      const unchanged = p.weight === p.orig.weight && p.reps === p.orig.reps && p.count === p.orig.count;
      if (unchanged) return entry; // не трогаем подходы, чтобы не потерять разные веса и повторы
      const ts = entry.sets[0].timestamp || now;
      return Object.assign({}, entry, {
        sets: Array.from({ length: p.count }, () => ({ weight: p.weight, reps: p.reps, timestamp: ts }))
      });
    }).filter(Boolean);

    this.saveWorkoutLogs();
    this.logEdit = null;
    this.navigate('viewHistory');
    this.showToast('Тренировка сохранена');
  }

  findExerciseName(exId) {
    if (this.exerciseNames[exId]) return this.exerciseNames[exId];
    for (let p of this.programs) {
      for (let d of p.days) {
        for (let e of d.exercises) {
          if (e.id === exId) return e.name;
        }
      }
    }
    if (this.activeWorkout && Array.isArray(this.activeWorkout.exercises)) {
      const ae = this.activeWorkout.exercises.find(e => e.id === exId);
      if (ae) return ae.name;
    }
    return 'Упражнение';
  }

  // --- EXERCISE PROGRESS & CANVAS CHART ---
  getAllExercisesList() {
    const list = [];
    const seen = new Set();
    this.programs.forEach(p => {
      p.days.forEach(d => {
        d.exercises.forEach(e => {
          if (!seen.has(e.id)) {
            seen.add(e.id);
            list.push({ id: e.id, name: e.name });
          }
        });
      });
    });
    Object.keys(this.exerciseNames).forEach(id => {
      if (!seen.has(id)) {
        seen.add(id);
        list.push({ id, name: this.exerciseNames[id] });
      }
    });
    return list;
  }

  // --- ИМПОРТ ИСТОРИИ ИЗ ДНЕВНИКА (файл выбирает пользователь вручную, сеть не используется) ---
  applySeed(seed, silent = false) {
    if (!seed || !Array.isArray(seed.workoutLogs)) return 0;

    // Нормализация названий упражнений по meta.merged_names
    const nameMap = {};
    const merged = (seed.meta && seed.meta.merged_names) || {};
    Object.keys(merged).forEach(canon => merged[canon].forEach(alias => { nameMap[alias] = canon; }));
    const canonical = (n) => nameMap[n] || n;

    // Стабильные id упражнений по названию (переиспользуем уже существующие)
    const idByName = {};
    Object.keys(this.exerciseNames).forEach(id => { idByName[this.exerciseNames[id]] = id; });
    let counter = 0;
    const getExId = (name) => {
      if (!idByName[name]) {
        counter++;
        let id = 'seed-ex-' + counter;
        while (this.exerciseNames[id]) { counter++; id = 'seed-ex-' + counter; }
        idByName[name] = id;
        this.exerciseNames[id] = name;
      }
      return idByName[name];
    };

    // Ранее импортированные записи заменяем свежими данными из файла
    this.workoutLogs = this.workoutLogs.filter(l => !String(l.id).startsWith('seed-'));
    const existingIds = new Set(this.workoutLogs.map(l => l.id));
    const newLogs = [];
    // Статистика по каждому шаблону: все упражнения, когда-либо сделанные в этом дне
    const statsByTemplate = {};
    // Как часто каждый шаблон выполнялся в конкретный день недели (для названия шаблона)
    const weekdaysByTemplate = {};
    const templateName = (tpl) => {
      const c = weekdaysByTemplate[tpl] || {};
      const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      return top || ('Тренировка ' + tpl);
    };

    seed.workoutLogs.forEach(sl => {
      const logId = 'seed-' + sl.id;
      const [y, m, d] = String(sl.date).split('-').map(Number);
      const tpl = sl.dayTemplate || 'A';
      const wdName = sl.weekday || this.weekdayName(new Date(y, m - 1, d, 12));
      const wdCount = weekdaysByTemplate[tpl] || (weekdaysByTemplate[tpl] = {});
      wdCount[wdName] = (wdCount[wdName] || 0) + 1;
      const entries = (sl.entries || []).map(en => ({
        exerciseId: getExId(canonical(en.exercise)),
        sets: (en.sets || []).map(s => ({ weight: s.weight, reps: s.reps }))
      }));
      const tplStats = statsByTemplate[tpl] || (statsByTemplate[tpl] = {});
      entries.forEach(en => {
        const st = tplStats[en.exerciseId] || (tplStats[en.exerciseId] = { count: 0, lastDate: '', lastSets: [] });
        st.count++;
        if (String(sl.date) >= st.lastDate && en.sets.length) {
          st.lastDate = String(sl.date);
          st.lastSets = en.sets;
        }
      });
      if (existingIds.has(logId)) return;
      newLogs.push({
        id: logId,
        date: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
        dateOnly: true,
        dayId: 'seed-day-' + tpl,
        dayName: wdName,
        programId: SEED_PROGRAM_ID,
        note: sl.note || '',
        entries
      });
    });

    // Программа с днями A/B: ВСЕ упражнения из истории каждого шаблона (частые сверху)
    const buildDayExercises = (tpl) => Object.keys(statsByTemplate[tpl])
      .sort((a, b) => statsByTemplate[tpl][b].count - statsByTemplate[tpl][a].count)
      .map(exId => {
        const st = statsByTemplate[tpl][exId];
        return {
          id: exId,
          name: this.exerciseNames[exId],
          targetSets: st.lastSets.length || 3,
          targetReps: String((st.lastSets[0] && st.lastSets[0].reps) || 10),
          notes: ''
        };
      });

    const seedProgram = this.programs.find(p => p.id === SEED_PROGRAM_ID);
    if (!seedProgram) {
      const days = Object.keys(statsByTemplate).sort().map(tpl => ({
        id: 'seed-day-' + tpl,
        name: templateName(tpl),
        exercises: buildDayExercises(tpl)
      }));
      this.programs.push({ id: SEED_PROGRAM_ID, name: 'Моя программа (A/B)', days });
      this.currentProgramId = SEED_PROGRAM_ID;
    } else {
      // Уже импортировано ранее: пересобираем дни A/B по актуальным данным файла
      seedProgram.days = Object.keys(statsByTemplate).sort().map(tpl => ({
        id: 'seed-day-' + tpl,
        name: templateName(tpl),
        exercises: buildDayExercises(tpl)
      }));
      this.currentProgramId = SEED_PROGRAM_ID;
    }
    this.savePrograms();

    // Удаляем старые импортированные названия упражнений, которых нигде нет
    const usedIds = new Set();
    this.workoutLogs.forEach(l => (l.entries || []).forEach(en => usedIds.add(en.exerciseId)));
    this.programs.forEach(p => (p.days || []).forEach(d => (d.exercises || []).forEach(e => usedIds.add(e.id))));
    Object.keys(this.exerciseNames).forEach(id => {
      if (id.startsWith('seed-ex-') && !usedIds.has(id)) delete this.exerciseNames[id];
    });

    // Убираем демо-записи и добавляем историю, сортируем по дате
    this.workoutLogs = this.workoutLogs.filter(l => !DEMO_LOG_IDS.includes(l.id));
    this.workoutLogs = this.workoutLogs.concat(newLogs)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    this.saveWorkoutLogs();
    this.saveExerciseNames();

    this.renderHome();
    this.renderHistory();
    if (!silent || newLogs.length > 0) {
      this.showToast(`Импортировано тренировок: ${newLogs.length}`);
    }
    return newLogs.length;
  }

  // Подставляет выбранное упражнение графика (если прежнего нет в списке — берёт первое)
  populateExerciseSelect() {
    const exercises = this.getChartExercises();
    if (!exercises.some(e => e.id === this.chartExerciseId)) {
      this.chartExerciseId = exercises.length ? exercises[0].id : null;
    }
    this.updateChartPickerLabel();
  }

  setChartMetric(metric) {
    this.selectedChartMetric = metric;
    const ids = { weight: 'btnMetricWeight', '1rm': 'btnMetric1RM', volume: 'btnMetricVolume' };
    Object.keys(ids).forEach(key => {
      const btn = document.getElementById(ids[key]);
      if (btn) btn.classList.toggle('active', key === metric);
    });
    this.renderExerciseChartAndPR();
  }

  renderExerciseChartAndPR() {
    const exId = this.chartExerciseId;
    if (!exId) {
      document.getElementById('prMaxWeightVal').textContent = 0;
      document.getElementById('prEst1RMVal').textContent = 0;
      document.getElementById('prMaxVolumeVal').textContent = 0;
      this.drawChart([]);
      return;
    }

    let maxWeight = 0;
    let maxEst1RM = 0;
    let maxVolume = 0;

    const dataPoints = [];

    const sortedLogs = [...this.workoutLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedLogs.forEach(log => {
      const entry = log.entries && log.entries.find(e => e.exerciseId === exId);
      if (entry && entry.sets && entry.sets.length > 0) {
        let sessionMaxWeight = 0;
        let sessionMax1RM = 0;
        let sessionVolume = 0;

        entry.sets.forEach(s => {
          if (s.weight > sessionMaxWeight) sessionMaxWeight = s.weight;
          const epley1RM = s.weight * (1 + s.reps / 30);
          if (epley1RM > sessionMax1RM) sessionMax1RM = epley1RM;
          sessionVolume += (s.weight * s.reps);
        });

        if (sessionMaxWeight > maxWeight) maxWeight = sessionMaxWeight;
        if (sessionMax1RM > maxEst1RM) maxEst1RM = sessionMax1RM;
        if (sessionVolume > maxVolume) maxVolume = sessionVolume;

        let metricVal = sessionMaxWeight;
        if (this.selectedChartMetric === '1rm') metricVal = Math.round(sessionMax1RM * 10) / 10;
        if (this.selectedChartMetric === 'volume') metricVal = Math.round(sessionVolume);

        const d = new Date(log.date);
        dataPoints.push({ ts: d.getTime(), value: metricVal });
      }
    });

    document.getElementById('prMaxWeightVal').textContent = maxWeight;
    document.getElementById('prEst1RMVal').textContent = Math.round(maxEst1RM);
    document.getElementById('prMaxVolumeVal').textContent = Math.round(maxVolume);

    // Подпись величины по вертикали зависит от выбранного показателя
    const yLabels = {
      weight: 'максимальный вес за тренировку, кг',
      '1rm': 'расчётный максимум на 1 повторение, кг',
      volume: 'объём за тренировку (вес × повторы), кг'
    };
    const legendY = document.getElementById('chartLegendY');
    if (legendY) legendY.textContent = yLabels[this.selectedChartMetric] || yLabels.weight;

    this.drawChart(dataPoints);
  }

  drawChart(points) {
    const canvas = document.getElementById('progressChart');
    const emptyMsg = document.getElementById('chartEmptyMessage');
    const legend = document.getElementById('chartLegend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rootStyle = getComputedStyle(document.documentElement);
    const token = (name) => rootStyle.getPropertyValue(name).trim();
    const fontFamily = rootStyle.getPropertyValue('--font-family').trim() || 'sans-serif';

    const width = canvas.parentElement.clientWidth - 32;
    const height = 240;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) {
      canvas.style.display = 'none';
      if (legend) legend.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (legend) legend.style.display = 'flex';
    if (emptyMsg) emptyMsg.style.display = 'none';

    const padding = { top: 25, right: 16, bottom: 40, left: 44 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = points.map(p => p.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (minVal === maxVal) { minVal = Math.max(0, minVal - 10); maxVal = maxVal + 10; }
    const valRange = maxVal - minVal || 1;

    // Подписи дат: «дд.мм», а если данные охватывают несколько лет — «дд.мм.гг»
    const pad2 = (n) => String(n).padStart(2, '0');
    const years = new Set(points.map(p => new Date(p.ts).getFullYear()));
    const fmtDate = (ts) => {
      const d = new Date(ts);
      const base = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
      return years.size > 1 ? `${base}.${String(d.getFullYear()).slice(2)}` : base;
    };

    // Сетка: White/20, подписи осей: White/80
    ctx.strokeStyle = token('--white-20');
    ctx.lineWidth = 0.5;
    ctx.fillStyle = token('--white-80');
    ctx.font = '12px ' + fontFamily;
    ctx.textAlign = 'right';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const yVal = minVal + (valRange / gridSteps) * i;
      const y = padding.top + chartH - (i / gridSteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(Math.round(yVal), padding.left - 8, y + 4);
    }

    const coords = points.map((p, idx) => {
      const x = points.length === 1 ? padding.left + chartW / 2 : padding.left + (idx / (points.length - 1)) * chartW;
      const y = padding.top + chartH - ((p.value - minVal) / valRange) * chartH;
      return { x, y, ts: p.ts, val: p.value };
    });

    // Ось X: подписей столько, сколько помещается по ширине (минимум 5 значений, если точек хватает)
    const labelW = years.size > 1 ? 58 : 46;
    const maxLabels = Math.max(2, Math.floor(chartW / labelW));
    const labelIdx = new Set();
    if (coords.length <= maxLabels) {
      coords.forEach((_, i) => labelIdx.add(i));
    } else {
      const step = (coords.length - 1) / (maxLabels - 1);
      for (let k = 0; k < maxLabels; k++) labelIdx.add(Math.round(k * step));
    }

    // Вертикальные засечки сетки под подписанными датами
    ctx.strokeStyle = token('--white-20');
    ctx.lineWidth = 0.5;
    labelIdx.forEach(i => {
      ctx.beginPath();
      ctx.moveTo(coords[i].x, padding.top);
      ctx.lineTo(coords[i].x, padding.top + chartH);
      ctx.stroke();
    });

    // Линия ряда: White/100
    ctx.beginPath();
    ctx.strokeStyle = token('--white-100');
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    coords.forEach((c, idx) => {
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();

    // Значения над точками: показываем столько, сколько помещается по ширине (~30 px на подпись),
    // у плотного ряда подписи равномерно прореживаются, но максимум и последняя точка остаются всегда
    const maxIdx = values.indexOf(Math.max(...values));
    const valueW = 30;
    const maxValueLabels = Math.max(2, Math.floor(chartW / valueW));
    const valueIdx = new Set();
    if (coords.length <= maxValueLabels) {
      coords.forEach((_, i) => valueIdx.add(i));
    } else {
      const vStep = (coords.length - 1) / (maxValueLabels - 1);
      for (let k = 0; k < maxValueLabels; k++) valueIdx.add(Math.round(k * vStep));
      // Максимум и последняя точка важнее соседних подписей — убираем тех, кто с ними пересекается
      [maxIdx, coords.length - 1].forEach(keep => {
        valueIdx.forEach(i => {
          if (i !== keep && Math.abs(coords[i].x - coords[keep].x) < valueW) valueIdx.delete(i);
        });
        valueIdx.add(keep);
      });
    }

    // Точки: заливка Neutral 800, обводка Neutral 200
    ctx.textAlign = 'center';
    const dotR = coords.length > 30 ? 3 : coords.length > 15 ? 4 : 5;
    coords.forEach((c, idx) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = token('--neutral-800');
      ctx.fill();
      ctx.strokeStyle = token('--neutral-200');
      ctx.lineWidth = 2;
      ctx.stroke();

      if (valueIdx.has(idx)) {
        ctx.fillStyle = token('--white-100');
        ctx.font = '12px ' + fontFamily;
        // Подпись у края не должна обрезаться
        const vText = String(c.val);
        const vHalf = ctx.measureText(vText).width / 2;
        const vx = Math.min(Math.max(c.x, vHalf), width - vHalf);
        ctx.fillText(vText, vx, c.y - dotR - 6);
      }

      if (labelIdx.has(idx)) {
        ctx.fillStyle = token('--white-80');
        ctx.font = '12px ' + fontFamily;
        // Крайние подписи не должны выходить за край холста
        const text = fmtDate(c.ts);
        const half = ctx.measureText(text).width / 2;
        const tx = Math.min(Math.max(c.x, half), width - half);
        ctx.fillText(text, tx, height - 12);
      }
    });
  }

  // --- SETTINGS, BACKUP & PWA ---
  exportDataJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      programs: this.programs,
      currentProgramId: this.currentProgramId,
      workoutLogs: this.workoutLogs,
      exerciseNames: this.exerciseNames
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `gymtracker-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(STORAGE_KEYS.LAST_EXPORT, new Date().toISOString());
    this.renderBackupInfo();
    this.showToast('База успешно экспортирована в JSON');
  }

  importDataJSON(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target.result).replace(/^\uFEFF/, ''));
        const isSeedFormat = !Array.isArray(data.programs) && Array.isArray(data.workoutLogs) &&
          data.workoutLogs.some(l => Array.isArray(l.entries) && l.entries.some(en => typeof en.exercise === 'string'));
        if (isSeedFormat) {
          // Файл истории из дневника (как seed_workouts.json): добавляем тренировки и упражнения
          const added = this.applySeed(data, false);
          if (!added) this.showToast('Новых тренировок нет: все уже импортированы');
        } else if (data.programs && Array.isArray(data.programs) && data.programs.length > 0) {
          this.openConfirmSheet({
            title: 'Заменить данные?',
            text: 'Импорт заменит все текущие данные на устройстве данными из файла.',
            okLabel: 'Заменить',
            onOk: () => this.applyBackupData(data)
          });
        } else {
          this.showToast('Неверный формат JSON файла бэкапа');
        }
      } catch (err) {
        this.showToast('Ошибка при чтении JSON файла: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }


  clearAllData() {
    this.openConfirmSheet({
      title: 'Удалить все данные?',
      text: 'Все программы, история и текущая тренировка будут удалены без возможности восстановления.',
      okLabel: 'Удалить',
      onOk: () => this.wipeAllData()
    });
  }

  applyBackupData(data) {
    this.programs = data.programs;
    this.currentProgramId = data.currentProgramId || data.programs[0].id;
    this.workoutLogs = Array.isArray(data.workoutLogs) ? data.workoutLogs : [];
    this.exerciseNames = (data.exerciseNames && typeof data.exerciseNames === 'object') ? data.exerciseNames : {};
    this.activeWorkout = null;
    this.savePrograms();
    this.saveWorkoutLogs();
    this.saveExerciseNames();
    this.saveActiveWorkout();
    this.populateExerciseSelect();
    this.renderHome();
    this.renderHistory();
    this.showToast('Данные успешно импортированы!');
  }

  wipeAllData() {
    localStorage.clear();
    this.exerciseNames = {};
    this.exerciseInputState = {};
    this.programs = [];
    this.currentProgramId = null;
    this.workoutLogs = [];
    this.activeWorkout = null;
    this.renderHome();
    this.renderHistory();
    this.renderBackupInfo();
    this.showToast('Все данные очищены');
  }

  renderBackupInfo() {
    const el = document.getElementById('backupInfo');
    if (!el) return;
    const last = localStorage.getItem(STORAGE_KEYS.LAST_EXPORT);
    if (!last) {
      el.textContent = 'Резервная копия ещё ни разу не сохранялась. Сделайте экспорт.';
      return;
    }
    const d = new Date(last);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    el.textContent = 'Последний экспорт: ' + d.toLocaleDateString('ru-RU') + (days >= 14 ? ' — прошло больше двух недель, пора сделать новый.' : '.');
  }

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('ServiceWorker registered:', reg.scope))
          .catch(err => console.log('ServiceWorker error:', err));
      });
    }
  }
}

// Global App Instance
const app = new GymApp();
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
