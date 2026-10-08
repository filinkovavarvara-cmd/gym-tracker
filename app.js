// GymTracker Core Engine - Part 1
const STORAGE_KEYS = {
  PROGRAMS: 'gym_programs_v1',
  CURRENT_PROGRAM_ID: 'gym_current_program_id_v1',
  WORKOUT_LOGS: 'gym_workout_logs_v1',
  ACTIVE_WORKOUT: 'gym_active_workout_v1',
  EXERCISE_NAMES: 'gym_exercise_names_v1',
  HIDDEN_EXERCISES: 'gym_hidden_exercises_v1',
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
    // Названия (в нижнем регистре) упражнений, удалённых из списка выбора; история и программы их по-прежнему видят
    this.hiddenExercises = [];
    this.selectedChartMetric = 'weight';
    this.historyTab = 'logs';
    this.logEdit = null;
    this.dayDraft = null;
    // Режим перестановки (карточки двигаются пальцем: зажать и потянуть)
    this.reorder = { list: false, workout: false, day: false, log: false };
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
    this.initSheetSwipe();
    this.initWorkoutBackGuard();
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

      const storedHidden = localStorage.getItem(STORAGE_KEYS.HIDDEN_EXERCISES);
      const hidden = storedHidden ? JSON.parse(storedHidden) : [];
      this.hiddenExercises = Array.isArray(hidden) ? hidden : [];
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

  saveHiddenExercises() {
    localStorage.setItem(STORAGE_KEYS.HIDDEN_EXERCISES, JSON.stringify(this.hiddenExercises));
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
    // Во время тренировки можно свободно ходить по разделам: она остаётся активной и открывается карточкой в списке тренировок
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
      'viewSettings': 'navItemSettings'
    };
    const activeNavId = navMap[viewId];
    if (activeNavId && document.getElementById(activeNavId)) {
      document.getElementById(activeNavId).classList.add('active');
    }

    if (viewId === 'viewProgram') this.renderHome();
    if (viewId === 'viewHistory') this.renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Системная кнопка «назад» во время тренировки не уводит с экрана: вместо этого спрашиваем о завершении
  initWorkoutBackGuard() {
    window.addEventListener('popstate', () => {
      const view = document.getElementById('viewWorkout');
      if (this.activeWorkout && view && view.classList.contains('active')) {
        history.pushState({ workout: true }, '');
        // Системная «назад» равна шеврону на экране: спрашиваем об отмене
        this.cancelWorkout();
      }
    });
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
          <div class="workout-card-meta">${exCount} ${this.pluralExercises(exCount)}</div>
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
            ${this.metricItemHtml(`data-idx="${i}" data-field="w" inputmode="decimal" autocomplete="off" value="${this.escapeHtml(it.w)}" oninput="app.onDayEditInput(this)" aria-label="Вес, кг"`, '<span class="metric-unit">кг</span>')}
            ${this.metricItemHtml(`data-idx="${i}" data-field="r" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.r)}" oninput="app.onDayEditInput(this)" aria-label="Повторы"`, '<span class="metric-unit">раз</span>')}
            ${this.metricItemHtml(`data-idx="${i}" data-field="c" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.c)}" oninput="app.onDayEditInput(this)" aria-label="Подходы"`, `<span class="metric-unit metric-sets-label">${this.pluralSets(parseInt(it.c, 10) || 0)}</span>`)}
          </div>
          <input class="note-input" type="text" maxlength="300" autocomplete="off" placeholder="Примечание" value="${this.escapeHtml(it.n || '')}" oninput="app.onDayNoteInput(this, ${i})" aria-label="Примечание к упражнению">
        </div>
      `).join('');
      list.querySelectorAll('.metric-input').forEach(inp => this.fitMetricInput(inp));
    }
    this.updateDayEditSave();
  }

  // --- СВАЙП ШТОРОК: шторку с «ручкой» сверху можно закрыть, потянув её пальцем вниз ---
  // Закрытие идёт через обычный клик по подложке, поэтому у каждой шторки сохраняется её прежнее поведение при закрытии
  initSheetSwipe() {
    let drag = null;

    // Если внутри шторки прокручен список, жест вниз должен листать его, а не двигать шторку
    const isScrolledInside = (target, sheet) => {
      let el = target;
      while (el) {
        if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) {
          const oy = getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll') return true;
        }
        if (el === sheet) break;
        el = el.parentElement;
      }
      return false;
    };

    const resetStyles = (d) => {
      d.sheet.style.transform = '';
      d.sheet.style.transition = '';
      d.backdrop.style.background = '';
      d.backdrop.style.transition = '';
    };

    document.addEventListener('touchstart', (e) => {
      if (drag && drag.settling) return;
      drag = null;
      if (e.touches.length !== 1 || !e.target.closest) return;
      const sheet = e.target.closest('.sheet');
      if (!sheet || !Array.from(sheet.children).some(c => c.classList.contains('sheet-handle'))) return;
      const backdrop = sheet.parentElement;
      if (!backdrop || !backdrop.classList.contains('sheet-backdrop') || !backdrop.classList.contains('open')) return;
      const t = e.touches[0];
      drag = {
        sheet, backdrop, x: t.clientX, y: t.clientY, t0: 0, dy: 0,
        active: false, settling: false, scrolled: isScrolledInside(e.target, sheet)
      };
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!drag || drag.settling) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.x;
      const dy = t.clientY - drag.y;

      if (!drag.active) {
        // Горизонтальный жест или движение вверх — не наш случай
        if ((Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) || dy < -10) { drag = null; return; }
        if (dy <= 3 || dy <= Math.abs(dx)) return;
        if (drag.scrolled) { drag = null; return; }
        drag.active = true;
        drag.t0 = Date.now();
        drag.y = t.clientY; // шторка начинает двигаться с нуля, без рывка
        drag.sheet.style.transition = 'none';
        drag.backdrop.style.transition = 'none';
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (e.cancelable) e.preventDefault();
      const offset = Math.max(0, t.clientY - drag.y);
      drag.dy = offset;
      drag.sheet.style.transform = `translateY(${offset}px)`;
      const progress = Math.min(1, offset / Math.max(1, drag.sheet.offsetHeight));
      drag.backdrop.style.background = `rgba(0, 0, 0, ${(0.55 * (1 - progress)).toFixed(3)})`;
    }, { passive: false });

    const finishDrag = (e) => {
      const d = drag;
      if (!d) return;
      if (d.settling) return;
      if (!d.active) { drag = null; return; }
      d.settling = true;
      const height = d.sheet.offsetHeight;
      const velocity = d.dy / Math.max(1, Date.now() - d.t0);
      const shouldClose = e.type !== 'touchcancel' && (d.dy > Math.min(120, height * 0.3) || (velocity > 0.5 && d.dy > 40));

      d.sheet.style.transition = 'transform 0.2s ease-out';
      d.backdrop.style.transition = 'background 0.2s ease-out';
      if (shouldClose) {
        d.sheet.style.transform = `translateY(${height}px)`;
        d.backdrop.style.background = 'rgba(0, 0, 0, 0)';
      } else {
        d.sheet.style.transform = 'translateY(0)';
        d.backdrop.style.background = 'rgba(0, 0, 0, 0.55)';
      }
      setTimeout(() => {
        drag = null;
        resetStyles(d);
        if (shouldClose) d.backdrop.click();
      }, 210);
    };
    document.addEventListener('touchend', finishDrag);
    document.addEventListener('touchcancel', finishDrag);
  }

  // --- РЕЖИМ ПЕРЕСТАНОВКИ: карточку нужно зажать на ~0,25 с и потянуть пальцем (на десктопе тянется мышью сразу) ---
  initReorderDrag() {
    const zones = [
      { scope: 'list', id: 'workoutsList', item: '.workout-card' },
      { scope: 'workout', id: 'workoutExercisesContainer', item: '.ex-card' },
      { scope: 'day', id: 'dayEditList', item: '.edit-card' },
      { scope: 'log', id: 'logEditList', item: '.edit-card' }
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
    return { list: 'btnReorderList', workout: 'btnReorderWorkout', day: 'btnReorderDay', log: 'btnReorderLog' }[scope];
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
    else if (scope === 'log') {
      // Введённые, но ещё не сохранённые значения переносим в черновик, чтобы они не пропали при перерисовке
      this.syncLogEditFromDom();
      this.renderLogEdit();
    }
  }

  // При уходе с экрана режим перестановки выключается
  resetReorder() {
    this.endReorderDrag(true);
    ['list', 'workout', 'day', 'log'].forEach(scope => {
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
      if (d.zone.scope === 'log') return parseInt(it.dataset.logExIndex, 10);
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
    } else if (d.zone.scope === 'log') {
      if (!this.logEdit) return;
      this.syncLogEditFromDom();
      const old = this.logEdit.items;
      const ordered = keys.map(i => old[i]).filter(Boolean);
      if (ordered.length !== old.length) return;
      this.logEdit.items = ordered;
      this.renderLogEdit();
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
      const label = inp.closest('.metric-item').querySelector('.metric-sets-label');
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
          const workout = this.activeWorkout;
          this.fillUncheckedEntries(workout);
          const records = this.getWorkoutRecords(workout);
          workout.endedAt = new Date().toISOString();
          this.workoutLogs.push(workout);
          this.saveWorkoutLogs();
          this.activeWorkout = null;
          this.saveActiveWorkout();
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
    history.pushState({ workout: true }, '');
  }

  resumeActiveWorkout() {
    if (!this.activeWorkout || this.reorder.list) return;
    this.renderWorkoutScreen();
    this.navigate('viewWorkout');
    history.pushState({ workout: true }, '');
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

  // Список, с которым сверяется пикер: черновик тренировки (mode 'day'), запись из истории (mode 'log') или активная тренировка
  getPickerExercises(mode) {
    if (mode === 'day') return this.dayDraft ? this.dayDraft.exercises : [];
    if (mode === 'log') return this.logEdit ? this.logEdit.items.map(it => ({ id: it.exerciseId, name: it.name })) : [];
    return this.getActiveExercises();
  }

  // Нет данных, к которым относится пикер (черновик, запись из истории или активная тренировка)
  isPickerContextMissing(mode) {
    if (mode === 'day') return !this.dayDraft;
    if (mode === 'log') return !this.logEdit;
    return !this.activeWorkout;
  }

  // mode: 'add' — добавить в активную тренировку, 'replace' — заменить упражнение exId, 'day' — добавить в создаваемую тренировку, 'log' — добавить в редактируемую запись из истории
  openExercisePicker(mode, exId) {
    if (this.isPickerContextMissing(mode)) return;
    const exercises = this.getPickerExercises(mode);
    if (mode === 'replace' && !exercises.some(e => e.id === exId)) return;

    const inWorkoutIds = new Set(exercises.map(e => e.id));
    const inWorkoutNames = new Set(exercises.map(e => this.normName(e.name)));
    const hidden = new Set(this.hiddenExercises);
    const seen = new Set();
    const list = [];
    this.getAllExercisesList().forEach(e => {
      const key = this.normName(e.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (inWorkoutIds.has(e.id) || inWorkoutNames.has(key) || hidden.has(key)) return;
      list.push({ id: e.id, name: e.name });
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    // Выбор упражнения — единственная открытая шторка: остальные прячем и вернём после закрытия
    const prev = Array.from(document.querySelectorAll('.sheet-backdrop.open'))
      .filter(el => el.id !== 'exercisePicker' && el.id !== 'confirmSheet');
    prev.forEach(el => el.classList.remove('open'));

    this.picker = { mode, exId: exId || null, query: '', list, selected: [], returnTo: prev.map(el => el.id) };
    document.getElementById('pickerSearch').value = '';
    document.getElementById('pickerClear').hidden = true;
    this.renderExercisePicker();
    document.getElementById('exercisePicker').classList.add('open');
  }

  closeExercisePicker() {
    const returnTo = this.picker && this.picker.returnTo ? this.picker.returnTo : [];
    this.picker = null;
    document.getElementById('exercisePicker').classList.remove('open');
    // Возвращаемся к шторке, из которой открывали выбор (её поля остались как были)
    returnTo.forEach(id => this.openModal(id));
  }

  // Временно убирает выбор с экрана (поверх открывается подтверждение), состояние выбора сохраняется
  hidePicker() {
    if (!this.picker) return;
    const list = document.getElementById('pickerList');
    this.picker.scrollTop = list ? list.scrollTop : 0;
    document.getElementById('exercisePicker').classList.remove('open');
  }

  showPicker() {
    if (!this.picker) return;
    document.getElementById('exercisePicker').classList.add('open');
    const list = document.getElementById('pickerList');
    if (list) list.scrollTop = this.picker.scrollTop || 0;
  }

  renderExercisePicker() {
    const p = this.picker;
    if (!p) return;
    const q = this.normName(p.query);
    const rows = p.list
      .map((it, i) => ({ it, i }))
      .filter(r => !q || this.normName(r.it.name).includes(q));

    // Название не найдено ни в списке, ни в самой тренировке: предлагаем создать упражнение
    const typed = p.query.trim();
    const exists = !!q && (p.list.some(it => this.normName(it.name) === q) ||
      this.getPickerExercises(p.mode).some(e => this.normName(e.name) === q));
    let html = '';
    if (typed && !exists) {
      html += `<div class="pk-row pk-create" role="button" onclick="app.addCustomPickerExercise(true)">` +
        `<span class="pk-box"><img class="icon" src="./icons/plus.svg" alt=""></span>` +
        `<span class="pk-name">Добавить «${this.escapeHtml(typed)}»</span></div>`;
    }
    if (rows.length === 0) {
      if (!typed) html += '<div class="pk-empty">Нет упражнений для выбора. Введите название, чтобы создать своё.</div>';
      else if (exists) html += '<div class="pk-empty">Это упражнение уже есть в тренировке.</div>';
    } else {
      html += rows.map(({ it, i }) => {
        const sel = p.selected.includes(i);
        const del = it.id
          ? `<button type="button" class="card-menu-btn pk-del" onclick="event.stopPropagation(); app.askDeletePickerExercise(${i})" title="Удалить из списка" aria-label="Удалить из списка: ${this.escapeHtml(it.name)}"><img class="icon" src="./icons/trash.svg" alt=""></button>`
          : '';
        return `<div class="pk-row${sel ? ' selected' : ''}" role="checkbox" aria-checked="${sel}" onclick="app.togglePickerItem(${i})">` +
          `<span class="pk-box">${sel ? '<img class="icon" src="./icons/check.svg" alt="">' : ''}</span>` +
          `<span class="pk-name">${this.escapeHtml(it.name)}</span>${del}</div>`;
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

  // «Добавить «название»» в списке или кнопка «+»: создать своё упражнение с названием из строки поиска.
  // direct — сразу добавить его (вместе с уже отмеченными) и закрыть выбор
  addCustomPickerExercise(direct = false) {
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
      // Если такое упражнение раньше удаляли из списка, оно снова становится доступным
      if (this.hiddenExercises.includes(key)) {
        this.hiddenExercises = this.hiddenExercises.filter(n => n !== key);
        this.saveHiddenExercises();
      }
    }
    if (!p.selected.includes(idx)) {
      if (p.mode === 'replace') p.selected = [idx];
      else p.selected.push(idx);
    }
    inp.value = '';
    this.onPickerInput(inp);
    if (direct) this.confirmExercisePicker();
  }

  // Удаление упражнения из списка выбора — только после подтверждения
  askDeletePickerExercise(i) {
    const p = this.picker;
    const item = p && p.list[i];
    if (!item) return;
    this.hidePicker();
    this.openConfirmSheet({
      title: 'Удалить упражнение?',
      text: `«${item.name}» будет удалено из списка упражнений. История тренировок и текущие программы останутся без изменений.`,
      okLabel: 'Удалить',
      onOk: () => this.deletePickerExercise(item.name),
      onCancel: () => this.showPicker()
    });
  }

  deletePickerExercise(name) {
    const key = this.normName(name);
    if (key && !this.hiddenExercises.includes(key)) {
      this.hiddenExercises.push(key);
      this.saveHiddenExercises();
    }
    const p = this.picker;
    if (p) {
      const selectedNames = p.selected.map(x => p.list[x] && this.normName(p.list[x].name));
      p.list = p.list.filter(it => this.normName(it.name) !== key);
      p.selected = selectedNames
        .filter(n => n && n !== key)
        .map(n => p.list.findIndex(it => this.normName(it.name) === n))
        .filter(x => x !== -1);
      this.showPicker();
      this.renderExercisePicker();
    }
    this.showToast('Упражнение удалено');
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
    if (!p || this.isPickerContextMissing(p.mode) || p.selected.length === 0) return;
    const items = p.selected.map(i => p.list[i]).filter(Boolean);
    if (p.mode === 'replace') this.replaceWorkoutExercise(p.exId, items[0]);
    else if (p.mode === 'day') this.addDayExercises(items);
    else if (p.mode === 'log') this.addLogExercises(items);
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
      this.clearExerciseInput(id);
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
      this.clearExerciseInput(oldId);
      this.clearExerciseInput(newId);
      this.saveActiveWorkout();
      this.closeExercisePicker();
      this.renderWorkoutScreen();
      this.showToast(`Заменено: ${oldEx.name} → ${name}`);
    };

    const oldEntry = this.activeWorkout.entries.find(e => e.exerciseId === oldId);
    if (oldEntry && oldEntry.sets.length > 0) {
      // Подтверждение показываем вместо выбора, а не поверх него; при отмене выбор возвращается
      this.hidePicker();
      this.openConfirmSheet({
        title: 'Заменить упражнение?',
        text: 'У упражнения уже записаны подходы. При замене они будут удалены.',
        okLabel: 'Заменить',
        onOk: run,
        onCancel: () => this.showPicker()
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
        this.clearExerciseInput(exId);

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

  // Состояние полей карточки упражнения (вес, повторы, подходы); создаётся из цели, прошлой тренировки или записанных подходов
  // Поля пустые (null): пока пользователь ничего не ввёл, в рамках светло-серым показывается подсказка (hint)
  ensureExerciseInputState(ex, entry) {
    if (!this.exerciseInputState[ex.id]) {
      const cur = { weight: null, reps: null, count: null, sets: null, editing: false };
      const saved = this.activeWorkout && this.activeWorkout.inputs && this.activeWorkout.inputs[ex.id];
      if (entry && entry.sets && entry.sets.length > 0) {
        // Подходы, записанные старой версией приложения
        const lastSet = entry.sets[entry.sets.length - 1];
        cur.weight = lastSet.weight;
        cur.reps = lastSet.reps;
        cur.count = entry.sets.length;
        // Подходы с разными весами или повторами показываем по отдельности
        if (this.areSetsMixed(entry.sets)) {
          cur.sets = entry.sets.map(s => ({ weight: s.weight, reps: s.reps }));
        }
      } else if (saved) {
        // Ввод, сохранённый в тренировке (переживает перезапуск приложения)
        const num = (v) => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
        cur.weight = num(saved.weight);
        cur.reps = num(saved.reps);
        cur.count = num(saved.count);
        if (Array.isArray(saved.sets) && saved.sets.length > 0) {
          cur.sets = saved.sets.map(s => ({ weight: num(s.weight), reps: num(s.reps) }));
        }
      }
      this.exerciseInputState[ex.id] = cur;
    }
    const state = this.exerciseInputState[ex.id];
    state.hint = this.getInputHints(ex);
    return state;
  }

  // Подсказки для пустых полей: прошлая тренировка, затем цель упражнения
  getInputHints(ex) {
    const pastSets = this.getLastWorkoutSets(ex.id);
    const hasPast = pastSets && pastSets.length > 0;
    return {
      weight: hasPast ? pastSets[0].weight : (ex.targetWeight != null ? ex.targetWeight : 50),
      reps: hasPast ? pastSets[0].reps : (parseInt(ex.targetReps, 10) || 10),
      count: ex.targetSets || 3
    };
  }

  // Сохраняет введённые значения упражнения в активную тренировку, чтобы они не пропали при перезапуске
  persistExerciseInput(exId) {
    const cur = this.exerciseInputState[exId];
    if (!this.activeWorkout || !cur) return;
    if (!this.activeWorkout.inputs) this.activeWorkout.inputs = {};
    this.activeWorkout.inputs[exId] = {
      weight: cur.weight,
      reps: cur.reps,
      count: cur.count,
      sets: cur.sets ? cur.sets.map(s => ({ weight: s.weight, reps: s.reps })) : null
    };
    this.saveActiveWorkout();
  }

  clearExerciseInput(exId) {
    delete this.exerciseInputState[exId];
    if (this.activeWorkout && this.activeWorkout.inputs) delete this.activeWorkout.inputs[exId];
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

      // Подходы вводятся вручную: вес, повторы и число подходов; при завершении тренировки они записываются
      const cur = this.ensureExerciseInputState(ex, entry);
      const pastSets = this.getLastWorkoutSets(ex.id);
      let pastResultText = 'Первая тренировка этого упражнения';
      if (pastSets && pastSets.length > 0) {
        pastResultText = pastSets.map(s => this.formatSet(s)).join(', ');
      }

      const histMax = this.getHistoricalMaxWeight(ex.id);
      const isRecordPotential = histMax > 0 && this.getInputMaxWeight(cur) > histMax;
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
        <div class="ex-card" data-exercise-id="${ex.id}">
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
            ${this.renderMetricsHtml(ex.id, cur)}
            <button class="ex-edit-btn${cur.editing ? ' active' : ''}" onclick="app.toggleSetsEditor('${ex.id}')" title="Подходы по отдельности" aria-label="Редактировать каждый подход" aria-pressed="${cur.editing}">
              <img class="icon icon-20" src="./icons/pencil-simple.svg" alt="">
            </button>
          </div>
          ${cur.editing ? this.renderSetsEditorHtml(ex.id, cur) : ''}
          <div id="livePR_${ex.id}" class="ex-live-pr">${isRecordPotential ? '<img class="icon" src="./icons/fire.svg" alt="">Будет новый рекорд по весу!' : ''}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.classList.toggle('reorder-on', this.reorder.workout);
    container.querySelectorAll('.metric-input').forEach(inp => this.fitMetricInput(inp));
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

  // Читает вес, повторы и число подходов карточки упражнения из состояния (значения вводятся через цифровую шторку)
  readExerciseInputs(exId) {
    const cur = this.exerciseInputState[exId];
    if (!cur) return null;
    return {
      weight: Number(cur.weight) || 0,
      reps: parseInt(cur.reps, 10) || 0,
      count: parseInt(cur.count, 10) || 0
    };
  }

  buildSets(weight, reps, count, timestamp) {
    return Array.from({ length: Math.min(count, 50) }, () => ({ weight, reps, timestamp }));
  }

  // Блок «вес / повторы / подходы»: цифра в рамке, подпись снаружи рамки
  metricItemHtml(inputAttrs, unitHtml) {
    return `<div class="metric-item"><label class="metric-pill"><input class="metric-input" ${inputAttrs}></label>${unitHtml}</div>`;
  }

  // Подходы разные, если у какого-то из них вес или повторы отличаются от первого
  areSetsMixed(sets) {
    if (!sets || sets.length < 2) return false;
    const w = Number(sets[0].weight) || 0;
    const r = Number(sets[0].reps) || 0;
    return sets.some(s => (Number(s.weight) || 0) !== w || (Number(s.reps) || 0) !== r);
  }

  // Наибольший вес среди введённых подходов (для подсказки о рекорде)
  // Читает введённые значения; null = поле не заполнено
  getInputMaxWeight(cur) {
    if (cur.sets && cur.sets.length > 0) {
      return cur.sets.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0);
    }
    return Number(cur.weight) || 0;
  }

  // Короткая запись разных подходов: «60 кг × 10 (×2) · 65 кг × 8»
  summarizeSets(sets) {
    const parts = [];
    sets.forEach(s => {
      const last = parts[parts.length - 1];
      if (last && last.weight === s.weight && last.reps === s.reps) last.n += 1;
      else parts.push({ weight: s.weight, reps: s.reps, n: 1 });
    });
    return parts.map(p => {
      const base = p.weight > 0 ? `${p.weight} кг × ${p.reps}` : `${p.reps} раз`;
      return p.n > 1 ? `${base} (×${p.n})` : base;
    }).join(' · ');
  }

  renderMetricsHtml(exId, cur) {
    const h = cur.hint || { weight: 0, reps: 0, count: 0 };
    if (cur.sets && cur.sets.some(s => Number(s.reps) > 0)) {
      return `<div class="metric-group"><div class="sets-summary" id="setsSummary_${exId}">${this.escapeHtml(this.summarizeSets(cur.sets.filter(s => Number(s.reps) > 0)))}</div></div>`;
    }
    if (cur.sets) {
      // Подходы по отдельности ещё не заполнены: серая подсказка
      return `<div class="metric-group"><div class="sets-summary is-empty" id="setsSummary_${exId}">${this.escapeHtml(`${h.weight} кг × ${h.reps} раз`)}</div></div>`;
    }
    return `<div class="metric-group">
              ${this.metricButtonHtml(exId, 'weight', null, cur.weight, h.weight, 'кг', 'Вес, кг')}
              ${this.metricButtonHtml(exId, 'reps', null, cur.reps, h.reps, 'раз', 'Повторы')}
              ${this.metricButtonHtml(exId, 'count', null, cur.count, h.count, 'подх.', 'Подходы')}
            </div>`;
  }

  // Рамка-кнопка «50 кг»: если значение не введено (null), внутри светло-серая подсказка; значение меняется через цифровую шторку
  metricButtonHtml(exId, field, index, value, hint, unit, label) {
    const idx = index == null ? 'null' : index;
    const empty = value == null;
    const text = `${empty ? hint : value} ${unit}`;
    const aria = empty ? `${label}: не заполнено, например ${text}` : `${label}: ${text}`;
    return `<button type="button" class="metric-pill metric-btn${empty ? ' is-empty' : ''}" onclick="app.openNumpad('${exId}', '${field}', ${idx})" aria-label="${this.escapeHtml(aria)}">${this.escapeHtml(text)}</button>`;
  }

  // Редактор «каждый подход отдельно»
  renderSetsEditorHtml(exId, cur) {
    const h = cur.hint || { weight: 0, reps: 0, count: 0 };
    const rows = cur.sets.map((s, i) => `
            <div class="set-row">
              <span class="set-num">${i + 1}</span>
              ${this.metricButtonHtml(exId, 'weight', i, s.weight, h.weight, 'кг', `Подход ${i + 1}, вес, кг`)}
              ${this.metricButtonHtml(exId, 'reps', i, s.reps, h.reps, 'раз', `Подход ${i + 1}, повторы`)}
              <button class="set-remove" onclick="app.removeSetRow('${exId}', ${i})" title="Удалить подход" aria-label="Удалить подход ${i + 1}">
                <img class="icon icon-20" src="./icons/x.svg" alt="">
              </button>
            </div>`).join('');
    return `
          <div class="sets-editor">${rows}
            <button class="btn-pill set-add" onclick="app.addSetRow('${exId}')"><img class="icon icon-20" src="./icons/plus.svg" alt="">Добавить подход</button>
          </div>`;
  }

  // Карандаш: открыть/закрыть редактор подходов
  toggleSetsEditor(exId) {
    const cur = this.exerciseInputState[exId];
    if (!cur) return;
    if (cur.editing) {
      if (cur.sets && cur.sets.every(s => s.weight == null && s.reps == null)) {
        // Ничего не введено: возвращаемся к обычным пустым полям
        cur.sets = null;
      } else if (cur.sets && cur.sets.length > 0) {
        // Если после правок все подходы одинаковые, возвращаемся к обычным полям
        const last = cur.sets[cur.sets.length - 1];
        cur.count = cur.sets.length;
        cur.weight = last.weight;
        cur.reps = last.reps;
        if (!this.areSetsMixed(cur.sets)) cur.sets = null;
      }
      cur.editing = false;
    } else {
      if (!cur.sets) {
        const n = Math.min(50, Math.max(1, parseInt(cur.count, 10) || (cur.hint && cur.hint.count) || 1));
        cur.sets = Array.from({ length: n }, () => ({ weight: cur.weight, reps: cur.reps }));
      }
      cur.editing = true;
    }
    this.persistExerciseInput(exId);
    this.renderWorkoutScreen();
  }

  // --- Цифровая шторка ввода: нажали на рамку «50 кг» — снизу открывается большое число, − / + и клавиатура ---
  openNumpad(exId, field, index) {
    const cur = this.exerciseInputState[exId];
    if (!cur) return;
    const sets = index != null ? cur.sets : null;
    if (index != null && (!sets || !sets[index])) return;
    const value = index != null ? sets[index][field] : cur[field];
    const hint = cur.hint && cur.hint[field] != null ? Number(cur.hint[field]) : 0;
    // Пустое значение (null) — text '': на шторке серая подсказка, шаги − / + отсчитываются от неё
    this.numpad = { exId, field, index, hint, text: value == null ? '' : String(Number(value) || 0) };
    this.renderNumpad();
    this.openModal('numpadSheet');
  }

  closeNumpad() {
    this.numpad = null;
    this.closeModal('numpadSheet');
  }

  getNumpadLimit(field) {
    return field === 'count' ? 50 : 999;
  }

  getNumpadStep(field) {
    return field === 'weight' ? 0.5 : 1;
  }

  formatNumpadNumber(n) {
    return String(Number(n.toFixed(2)));
  }

  renderNumpad() {
    const np = this.numpad;
    if (!np) return;
    const captions = { weight: 'Вес, кг', reps: 'Повторы', count: 'Подходы' };
    const empty = np.text === '';
    // Пока ничего не введено, показываем светло-серую подсказку и отсчитываем шаги от неё
    const value = empty ? (Number(np.hint) || 0) : (parseFloat(np.text) || 0);
    const step = this.getNumpadStep(np.field);
    const max = this.getNumpadLimit(np.field);
    document.getElementById('numpadCaption').textContent = captions[np.field] || '';
    const valueEl = document.getElementById('numpadValue');
    valueEl.textContent = empty ? this.formatNumpadNumber(value) : np.text;
    valueEl.classList.toggle('is-empty', empty);
    document.getElementById('numpadPrev').textContent = value - step >= 0 ? this.formatNumpadNumber(value - step) : '';
    document.getElementById('numpadNext').textContent = value + step <= max ? this.formatNumpadNumber(value + step) : '';
    document.getElementById('numpadDot').disabled = np.field !== 'weight';
  }

  // Кнопки клавиатуры: цифры, точка и стирание
  numpadKey(k) {
    const np = this.numpad;
    if (!np) return;
    let t = np.text;
    if (k === 'back') {
      t = t.slice(0, -1);
    } else if (k === '.') {
      if (np.field !== 'weight' || t.includes('.')) return;
      t = (t === '' ? '0' : t) + '.';
    } else {
      t = (t === '0' || t === '') ? k : t + k;
    }
    if (t.includes('.') && t.split('.')[1].length > 2) return;
    // Пустая строка — поле снова не заполнено (null)
    const v = t === '' ? null : (parseFloat(t) || 0);
    if (v != null && v > this.getNumpadLimit(np.field)) return;
    np.text = t;
    this.applyNumpadValue(v);
  }

  // Кнопки − и +: шаг 0,5 кг для веса и 1 для повторов и подходов
  numpadStep(dir) {
    const np = this.numpad;
    if (!np) return;
    const step = this.getNumpadStep(np.field);
    const base = np.text === '' ? (Number(np.hint) || 0) : (parseFloat(np.text) || 0);
    const v = Math.min(this.getNumpadLimit(np.field), Math.max(0, base + dir * step));
    np.text = this.formatNumpadNumber(v);
    this.applyNumpadValue(v);
  }

  // Записывает значение (или null для пустого поля) в карточку и обновляет подсказку о рекорде
  applyNumpadValue(v) {
    const np = this.numpad;
    const cur = np && this.exerciseInputState[np.exId];
    if (!cur) return;
    const val = v == null ? null : (np.field === 'weight' ? v : Math.round(v));
    if (np.index != null) {
      if (!cur.sets || !cur.sets[np.index]) return;
      cur.sets[np.index][np.field] = val;
    } else {
      cur[np.field] = val;
    }
    this.renderNumpad();
    this.updateLivePR(np.exId);
    this.syncEntryFromInput(np.exId);
    this.renderWorkoutScreen();
  }

  addSetRow(exId) {
    const cur = this.exerciseInputState[exId];
    if (!cur || !cur.sets) return;
    if (cur.sets.length >= 50) {
      this.showToast('Не больше 50 подходов');
      return;
    }
    const last = cur.sets[cur.sets.length - 1] || { weight: cur.weight, reps: cur.reps };
    cur.sets.push({ weight: last.weight, reps: last.reps });
    cur.count = cur.sets.length;
    this.syncEntryFromInput(exId);
    this.renderWorkoutScreen();
  }

  removeSetRow(exId, index) {
    const cur = this.exerciseInputState[exId];
    if (!cur || !cur.sets || !cur.sets[index]) return;
    if (cur.sets.length <= 1) {
      this.showToast('Должен остаться хотя бы один подход');
      return;
    }
    cur.sets.splice(index, 1);
    cur.count = cur.sets.length;
    this.syncEntryFromInput(exId);
    this.renderWorkoutScreen();
  }

  // Подсказка «Будет новый рекорд» по введённым значениям
  updateLivePR(exId) {
    const cur = this.exerciseInputState[exId];
    const prEl = document.getElementById(`livePR_${exId}`);
    if (!cur || !prEl) return;
    const histMax = this.getHistoricalMaxWeight(exId);
    const maxW = this.getInputMaxWeight(cur);
    if (histMax > 0 && maxW > histMax) {
      prEl.innerHTML = `<img class="icon" src="./icons/fire.svg" alt="">Будет новый рекорд! (${maxW} кг > ${histMax} кг)`;
    } else {
      prEl.innerHTML = '';
    }
  }

  // Сохраняет ввод в активную тренировку; подходы, записанные старой версией приложения, обновляются вместе с вводом
  syncEntryFromInput(exId) {
    const cur = this.exerciseInputState[exId];
    if (!cur) return;
    this.persistExerciseInput(exId);
    const entry = this.activeWorkout && this.activeWorkout.entries.find(e => e.exerciseId === exId);
    if (!entry || entry.sets.length === 0) return;
    const ts = entry.sets[0].timestamp || Date.now();
    if (cur.sets) {
      const rows = cur.sets.filter(s => Number(s.reps) >= 1);
      if (rows.length >= 1) {
        entry.sets = rows.map(s => ({ weight: Number(s.weight) || 0, reps: s.reps, timestamp: ts }));
        this.saveActiveWorkout();
      }
    } else if (cur.reps >= 1 && cur.count >= 1) {
      entry.sets = this.buildSets(Number(cur.weight) || 0, cur.reps, cur.count, ts);
      this.saveActiveWorkout();
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
  // Перед сохранением подходы собираются из введённых значений карточек. Упражнение записывается,
  // только если указаны повторы: пустой вес считается 0 (свой вес), пустое число подходов — одним подходом.
  // Упражнения без повторов не сохраняются. Уже записанные подходы не меняются.
  fillUncheckedEntries(w) {
    const exercises = Array.isArray(w.exercises) ? w.exercises : [];
    if (!Array.isArray(w.entries)) w.entries = [];
    const now = Date.now();
    exercises.forEach(ex => {
      let entry = w.entries.find(e => e.exerciseId === ex.id);
      if (!entry) {
        entry = { exerciseId: ex.id, sets: [] };
        w.entries.push(entry);
      }
      if (entry.sets && entry.sets.length > 0) return;
      const cur = this.ensureExerciseInputState(ex, entry);
      const toSet = (weight, reps) => ({
        weight: Math.max(0, Number(weight) || 0),
        reps: Math.max(1, parseInt(reps, 10) || 1),
        timestamp: now
      });
      if (cur.sets && cur.sets.length > 0) {
        entry.sets = cur.sets.slice(0, 50).filter(s => (parseInt(s.reps, 10) || 0) >= 1).map(s => toSet(s.weight, s.reps));
      } else if ((parseInt(cur.reps, 10) || 0) >= 1) {
        const count = Math.min(50, Math.max(1, parseInt(cur.count, 10) || 1));
        entry.sets = Array.from({ length: count }, () => toSet(cur.weight, cur.reps));
      }
    });
    return w;
  }

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
    // В сводке считаем и упражнения без отметки: они тоже будут сохранены
    const st = this.getWorkoutStats(this.fillUncheckedEntries(JSON.parse(JSON.stringify(this.activeWorkout))));
    const skipped = (this.activeWorkout.exercises || []).length - st.exercises;
    let text = 'Все упражнения и их подходы будут сохранены';
    if (st.sets === 0) text = 'Вы не записали ни одного подхода. Всё равно завершить тренировку?';
    else if (skipped > 0) text = `Не будут сохранены упражнения без повторов: ${skipped}`;
    this.openConfirmSheet({
      title: 'Завершить тренировку?',
      text,
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
    this.fillUncheckedEntries(workout);
    const records = this.getWorkoutRecords(workout);

    // Время окончания сохраняем вместе с тренировкой (date = время начала, проставлено при старте)
    workout.endedAt = new Date().toISOString();
    // Черновик ввода нужен только во время тренировки
    delete workout.inputs;
    this.workoutLogs.push(workout);
    this.saveWorkoutLogs();

    this.activeWorkout = null;
    this.saveActiveWorkout();

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
    if (!this.activeWorkout) return;
    this.openConfirmSheet({
      title: 'Отменить тренировку?',
      text: 'Текущий прогресс будет потерян без возможности восстановления.',
      okLabel: 'Отменить',
      cancelLabel: 'Продолжить',
      onOk: () => {
        this.activeWorkout = null;
        this.saveActiveWorkout();
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

      let exercisesDetailsHtml = '';

      if (log.entries) {
        log.entries.forEach(e => {
          if (e.sets && e.sets.length > 0) {
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
          <div class="history-card">
            <div class="workout-card-header">
              <div class="workout-card-title history-workout-title">${this.escapeHtml(dayName)}</div>
              <button class="card-menu-btn" onclick="app.toggleCardMenu(event, 'h_${log.id}')" title="Меню" aria-label="Меню">
                <img class="icon" src="./icons/dots-three.svg" alt="">
              </button>
            </div>
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

  // Подряд идущие одинаковые подходы схлопываются в одну строку слева: «60 кг x 3 по 10»
  groupSetsHtml(sets) {
    const groups = [];
    sets.forEach(s => {
      const last = groups[groups.length - 1];
      if (last && last.weight === s.weight && last.reps === s.reps) last.count++;
      else groups.push({ weight: s.weight, reps: s.reps, count: 1 });
    });
    return groups.map(g => {
      const base = `${g.count} по ${g.reps}`;
      const label = Number(g.weight) > 0 ? `${g.weight} кг x ${base}` : base;
      return `<div class="history-set-row">${label}</div>`;
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
        exerciseId: entry.exerciseId,
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
    const rm = this.reorder.log;
    list.classList.toggle('reorder-on', rm);
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
      <div class="edit-card" data-log-ex-index="${i}">
        <div class="workout-card-header">
          <div class="workout-card-title">${this.escapeHtml(it.name)}</div>
          ${rm ? '' : `<button class="card-menu-btn" onclick="app.askRemoveLogExercise(${i})" title="Удалить упражнение" aria-label="Удалить упражнение">
            <img class="icon" src="./icons/trash.svg" alt="">
          </button>`}
        </div>
        <div class="metric-group">
          ${this.metricItemHtml(`data-idx="${i}" data-field="w" inputmode="decimal" autocomplete="off" value="${this.escapeHtml(it.w)}" oninput="app.onLogEditInput(this)" aria-label="Вес, кг"`, '<span class="metric-unit">кг</span>')}
          ${this.metricItemHtml(`data-idx="${i}" data-field="r" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.r)}" oninput="app.onLogEditInput(this)" aria-label="Повторы"`, '<span class="metric-unit">раз</span>')}
          ${this.metricItemHtml(`data-idx="${i}" data-field="c" inputmode="numeric" autocomplete="off" value="${this.escapeHtml(it.c)}" oninput="app.onLogEditInput(this)" aria-label="Подходы"`, `<span class="metric-unit metric-sets-label">${this.pluralSets(parseInt(it.c, 10) || 0)}</span>`)}
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
      const label = inp.closest('.metric-item').querySelector('.metric-sets-label');
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

  // Упражнения из пикера добавляются в редактируемую запись; значения берём из последней тренировки с ними
  addLogExercises(items) {
    const st = this.logEdit;
    if (!st) return;
    this.syncLogEditFromDom();
    let added = 0;
    items.forEach((item, n) => {
      const { id, name } = this.resolvePickerItem(item, n);
      if (st.items.some(it => it.exerciseId === id)) return;
      const last = this.getLastWorkoutSets(id);
      st.items.push({
        entryIndex: null,
        exerciseId: id,
        name,
        w: String(last && last[0] ? last[0].weight : 0),
        r: String(last && last[0] ? last[0].reps : 10),
        c: String(last && last.length ? last.length : 3),
        orig: null
      });
      added++;
    });
    this.closeExercisePicker();
    this.renderLogEdit();
    if (added > 0) this.showToast(added > 1 ? `Добавлено упражнений: ${added}` : 'Упражнение добавлено');
  }

  saveLogEdit() {
    const st = this.logEdit;
    if (!st) return;
    this.syncLogEditFromDom();
    const log = this.workoutLogs.find(l => l.id === st.logId);
    if (!log) { this.navigate('viewHistory'); return; }

    // Сначала проверяем все значения, чтобы не сохранить наполовину
    const parsed = new Map();
    const added = [];
    for (const it of st.items) {
      const weight = parseFloat(String(it.w).replace(',', '.'));
      const reps = parseInt(it.r, 10);
      const count = parseInt(it.c, 10);
      if (!(weight >= 0) || !(reps >= 1) || !(count >= 1) || count > 50) {
        this.showToast(`Проверьте значения: ${it.name}`);
        return;
      }
      if (it.entryIndex == null) added.push({ exerciseId: it.exerciseId, name: it.name, weight, reps, count });
      else parsed.set(it.entryIndex, { weight, reps, count, orig: it.orig });
    }

    const now = Date.now();
    const entries = log.entries || [];
    const used = new Set();
    const result = [];

    // Записи собираются в том порядке, в котором карточки стоят на экране
    st.items.forEach(it => {
      const p = parsed.get(it.entryIndex);
      if (it.entryIndex != null) {
        const entry = entries[it.entryIndex];
        if (!entry || !p) return;
        used.add(it.entryIndex);
        const unchanged = p.weight === p.orig.weight && p.reps === p.orig.reps && p.count === p.orig.count;
        if (unchanged) { result.push(entry); return; } // не трогаем подходы, чтобы не потерять разные веса и повторы
        const ts = entry.sets[0].timestamp || now;
        result.push(Object.assign({}, entry, {
          sets: Array.from({ length: p.count }, () => ({ weight: p.weight, reps: p.reps, timestamp: ts }))
        }));
        return;
      }
      // Новое упражнение: если в записи уже есть пустая отметка этого упражнения, заполняем её, иначе добавляем новую
      const a = added.find(x => x.exerciseId === it.exerciseId);
      if (!a) return;
      const sets = Array.from({ length: a.count }, () => ({ weight: a.weight, reps: a.reps, timestamp: now }));
      const emptyIdx = entries.findIndex((e, idx) => !used.has(idx) && e.exerciseId === a.exerciseId && (!e.sets || e.sets.length === 0));
      if (emptyIdx >= 0) {
        used.add(emptyIdx);
        result.push(Object.assign({}, entries[emptyIdx], { sets }));
      } else {
        result.push({ exerciseId: a.exerciseId, sets });
      }
      if (Array.isArray(log.exercises) && !log.exercises.some(x => x.id === a.exerciseId)) {
        log.exercises.push({ id: a.exerciseId, name: a.name, targetSets: a.count, targetReps: String(a.reps), notes: '' });
      }
    });

    // Пустые отметки без подходов в редактор не попадают; оставляем их в конце, ничего не теряя
    entries.forEach((entry, idx) => {
      if (used.has(idx)) return;
      if (!entry.sets || entry.sets.length === 0) result.push(entry);
    });
    log.entries = result;

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

    // Необязательный блок templates: { A: { name, exercises: [названия] }, ... } — состав дней задаётся явно
    const tplDefs = (seed.templates && typeof seed.templates === 'object') ? seed.templates : null;
    const hasTplDef = (tpl) => !!(tplDefs && tplDefs[tpl] && Array.isArray(tplDefs[tpl].exercises));
    const dayKeys = () => (tplDefs ? Object.keys(tplDefs).filter(hasTplDef) : Object.keys(statsByTemplate)).sort();
    const dayTitle = (tpl) => (hasTplDef(tpl) && tplDefs[tpl].name) ? tplDefs[tpl].name : templateName(tpl);
    const makeDayExercise = (exId, st) => ({
      id: exId,
      name: this.exerciseNames[exId],
      targetSets: (st && st.lastSets.length) || 3,
      targetReps: String((st && st.lastSets[0] && st.lastSets[0].reps) || 10),
      notes: ''
    });

    // Программа с днями A/B: по templates, а без него — ВСЕ упражнения из истории шаблона (частые сверху)
    const buildDayExercises = (tpl) => {
      const stats = statsByTemplate[tpl] || {};
      if (hasTplDef(tpl)) {
        const seen = new Set();
        const list = [];
        tplDefs[tpl].exercises.forEach(rawName => {
          const exId = getExId(canonical(rawName));
          if (seen.has(exId)) return;
          seen.add(exId);
          list.push(makeDayExercise(exId, stats[exId]));
        });
        return list;
      }
      return Object.keys(stats)
        .sort((a, b) => stats[b].count - stats[a].count)
        .map(exId => makeDayExercise(exId, stats[exId]));
    };

    const seedDays = () => dayKeys().map(tpl => ({
      id: 'seed-day-' + tpl,
      name: dayTitle(tpl),
      exercises: buildDayExercises(tpl)
    }));

    const seedProgram = this.programs.find(p => p.id === SEED_PROGRAM_ID);
    if (!seedProgram) {
      this.programs.push({ id: SEED_PROGRAM_ID, name: 'Моя программа (A/B)', days: seedDays() });
      this.currentProgramId = SEED_PROGRAM_ID;
    } else {
      // Уже импортировано ранее: пересобираем дни A/B по актуальным данным файла
      seedProgram.days = seedDays();
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
      exerciseNames: this.exerciseNames,
      hiddenExercises: this.hiddenExercises
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
    this.hiddenExercises = Array.isArray(data.hiddenExercises) ? data.hiddenExercises : [];
    this.activeWorkout = null;
    this.savePrograms();
    this.saveWorkoutLogs();
    this.saveExerciseNames();
    this.saveHiddenExercises();
    this.saveActiveWorkout();
    this.populateExerciseSelect();
    this.renderHome();
    this.renderHistory();
    this.showToast('Данные успешно импортированы!');
  }

  wipeAllData() {
    localStorage.clear();
    this.exerciseNames = {};
    this.hiddenExercises = [];
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
