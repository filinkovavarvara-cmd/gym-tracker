// Import preparation is pure: validation and preview never mutate application data.
const GymImport = (() => {
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = message => { throw new Error(message); };
  const requireValue = (ok, message) => { if (!ok) fail(message); };
  const text = (v, label) => requireValue(typeof v === 'string' && v.trim().length > 0, `${label}: требуется непустая строка.`);
  const id = (v, label) => {
    text(v, label);
    requireValue(/^[\p{L}\p{N}_.:-]+$/u.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v), `${label}: недопустимый ID.`);
  };
  const array = (v, label) => requireValue(Array.isArray(v), `${label}: отсутствует или не является списком.`);
  const optionalText = (o, k, label) => { if (own(o, k)) requireValue(typeof o[k] === 'string', `${label}: требуется строка.`); };
  const unique = (items, label) => {
    const seen = new Set();
    items.forEach(v => { requireValue(!seen.has(v), `${label}: повторяющийся ID ${v}.`); seen.add(v); });
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  const stable = v => JSON.stringify(v, (_, value) => object(value)
    ? Object.keys(value).sort().reduce((o, k) => { Object.defineProperty(o, k, { value: value[k], enumerable: true }); return o; }, {}) : value);
  function date(v, label, dateOnly = false) {
    text(v, label);
    const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(v);
    requireValue(!!match, `${label}: неверная дата.`);
    const [, y, m, d, rest] = match;
    const calendar = new Date(`${y}-${m}-${d}T12:00:00Z`);
    requireValue(!isNaN(calendar.getTime()) && calendar.toISOString().slice(0, 10) === `${y}-${m}-${d}` &&
      (dateOnly ? !rest : /^T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(rest)) &&
      !isNaN(new Date(dateOnly ? `${v}T12:00:00Z` : v).getTime()), `${label}: неверная дата.`);
  }
  function sets(value, label) {
    array(value, label);
    value.forEach((s, i) => {
      requireValue(object(s), `${label}, подход ${i + 1}: неверный объект.`);
      requireValue(typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight >= 0,
        `${label}, подход ${i + 1}: вес должен быть неотрицательным числом.`);
      requireValue(Number.isInteger(s.reps) && s.reps >= 1, `${label}, подход ${i + 1}: повторы должны быть целым числом от 1.`);
      if (own(s, 'timestamp')) requireValue(typeof s.timestamp === 'number' && Number.isFinite(s.timestamp) && s.timestamp >= 0 &&
        !isNaN(new Date(s.timestamp).getTime()), `${label}: неверное время подхода.`);
    });
  }
  function exercises(value, label) {
    array(value, label);
    value.forEach(e => {
      requireValue(object(e), `${label}: неверное упражнение.`); id(e.id, `${label}, ID`); text(e.name, `${label}, название`);
      if (own(e, 'targetSets')) requireValue(Number.isInteger(e.targetSets) && e.targetSets >= 1 && e.targetSets <= 50, `${label}: неверная цель подходов.`);
      if (own(e, 'targetWeight')) requireValue(typeof e.targetWeight === 'number' && Number.isFinite(e.targetWeight) && e.targetWeight >= 0, `${label}: неверный целевой вес.`);
      if (own(e, 'targetReps')) requireValue(typeof e.targetReps === 'string' && /^\d+(?:\s*-\s*\d+)?$/.test(e.targetReps) &&
        e.targetReps.split('-').every(n => Number(n) >= 1), `${label}: неверная цель повторов.`);
      optionalText(e, 'notes', label);
    });
    unique(value.map(e => e.id), label);
  }
  function backup(input) {
    requireValue(object(input), 'Корень файла должен быть объектом.');
    if (own(input, 'version')) requireValue(input.version === '1.0', 'Версия резервной копии не поддерживается.');
    if (own(input, 'exportedAt')) date(input.exportedAt, 'Дата экспорта');
    array(input.programs, 'programs'); array(input.workoutLogs, 'workoutLogs');
    const state = clone(input);
    state.exerciseNames = own(input, 'exerciseNames') ? input.exerciseNames : {};
    state.hiddenExercises = own(input, 'hiddenExercises') ? input.hiddenExercises : [];
    requireValue(object(state.exerciseNames), 'exerciseNames: требуется словарь названий.');
    Object.entries(state.exerciseNames).forEach(([key, name]) => { id(key, 'ID в словаре'); text(name, 'Название в словаре'); });
    array(state.hiddenExercises, 'hiddenExercises'); state.hiddenExercises.forEach(n => text(n, 'Скрытое упражнение'));
    const names = new Map(Object.entries(state.exerciseNames));
    const register = e => { if (!names.has(e.id)) names.set(e.id, e.name); };
    const dayIds = [];
    state.programs.forEach(p => {
      requireValue(object(p), 'Неверный объект программы.'); id(p.id, 'ID программы'); text(p.name, 'Название программы'); array(p.days, 'days программы');
      p.days.forEach(d => {
        requireValue(object(d), 'Неверный объект тренировки.'); id(d.id, 'ID шаблона'); dayIds.push(d.id); text(d.name, 'Название шаблона');
        exercises(d.exercises, 'Упражнения шаблона'); d.exercises.forEach(register);
      });
    });
    unique(state.programs.map(p => p.id), 'Программы'); unique(dayIds, 'Шаблоны');
    if (!own(state, 'currentProgramId')) state.currentProgramId = state.programs[0]?.id || null;
    requireValue(state.currentProgramId === null ? state.programs.length === 0 : state.programs.some(p => p.id === state.currentProgramId), 'currentProgramId: программа не найдена.');
    // Historical day/program references may outlive deleted templates. Exercise references must resolve.
    state.workoutLogs.forEach(l => {
      requireValue(object(l), 'Неверный объект записи истории.'); id(l.id, 'ID записи'); date(l.date, 'Дата тренировки');
      for (const k of ['dayId', 'programId']) if (own(l, k)) id(l[k], k);
      for (const k of ['dayName', 'note']) optionalText(l, k, k);
      if (own(l, 'dateOnly')) requireValue(typeof l.dateOnly === 'boolean', 'dateOnly: требуется логическое значение.');
      if (own(l, 'endedAt')) date(l.endedAt, 'Историческое время окончания');
      if (own(l, 'exercises')) { exercises(l.exercises, 'Снимок упражнений'); l.exercises.forEach(register); }
      array(l.entries, 'entries истории');
      l.entries.forEach(e => { requireValue(object(e), 'Неверная запись упражнения.'); id(e.exerciseId, 'exerciseId'); sets(e.sets, 'Подходы истории'); });
      unique(l.entries.map(e => e.exerciseId), 'Упражнения записи');
    });
    unique(state.workoutLogs.map(l => l.id), 'История');
    state.workoutLogs.forEach(l => l.entries.forEach(e => requireValue(names.has(e.exerciseId), `Не найдено название упражнения ${e.exerciseId}.`)));
    // Register historical snapshots too, so imported history remains accessible in analytics.
    state.exerciseNames = Object.fromEntries(names);
    return { programs: state.programs, currentProgramId: state.currentProgramId, workoutLogs: state.workoutLogs,
      exerciseNames: state.exerciseNames, hiddenExercises: state.hiddenExercises, activeWorkout: null };
  }
  function validateDiary(input) {
    requireValue(object(input), 'Корень дневника должен быть объектом.');
    if (own(input, 'version')) requireValue(input.version === '1.0', 'Версия дневника не поддерживается.');
    array(input.workoutLogs, 'workoutLogs дневника');
    if (own(input, 'meta')) {
      requireValue(object(input.meta), 'meta: требуется объект.');
      if (own(input.meta, 'merged_names')) {
        requireValue(object(input.meta.merged_names), 'merged_names: требуется словарь.');
        const aliases = new Map();
        Object.entries(input.meta.merged_names).forEach(([name, values]) => {
          text(name, 'Каноническое имя'); array(values, 'Синонимы');
          values.forEach(v => { text(v, 'Синоним'); requireValue(!aliases.has(v) || aliases.get(v) === name, 'Синоним относится к разным упражнениям.'); aliases.set(v, name); });
        });
      }
    }
    if (own(input, 'templates')) {
      requireValue(object(input.templates), 'templates: требуется объект.');
      Object.entries(input.templates).forEach(([key, t]) => {
        id(key, 'ID шаблона дневника'); requireValue(object(t), 'Неверный шаблон дневника.');
        optionalText(t, 'name', 'Название шаблона'); array(t.exercises, 'Упражнения шаблона дневника'); t.exercises.forEach(n => text(n, 'Название упражнения'));
      });
    }
    input.workoutLogs.forEach(l => {
      requireValue(object(l), 'Неверный объект записи дневника.'); id(l.id, 'ID дневника'); date(l.date, 'Дата тренировки дневника', true);
      if (own(l, 'dayTemplate')) id(l.dayTemplate, 'dayTemplate');
      optionalText(l, 'weekday', 'День недели'); optionalText(l, 'note', 'Заметка');
      array(l.entries, 'entries дневника');
      l.entries.forEach(e => { requireValue(object(e), 'Неверное упражнение дневника.'); text(e.exercise, 'Название упражнения'); sets(e.sets, 'Подходы дневника'); });
    });
    unique(input.workoutLogs.map(l => l.id), 'Дневник');
  }
  function diary(input, current) {
    validateDiary(input);
    const state = clone(current);
    const names = new Map(Object.entries(state.exerciseNames));
    state.programs.forEach(p => p.days.forEach(d => d.exercises.forEach(e => names.set(e.id, e.name))));
    state.workoutLogs.forEach(l => (l.exercises || []).forEach(e => names.set(e.id, e.name)));
    const byName = new Map();
    names.forEach((name, key) => {
      const normalized = name.trim().toLowerCase();
      // A name-only diary cannot identify which of two distinct IDs was intended.
      byName.set(normalized, byName.has(normalized) ? null : key);
    });
    const aliases = new Map();
    Object.entries(input.meta?.merged_names || {}).forEach(([name, values]) => values.forEach(v => aliases.set(v, name)));
    let counter = 1;
    const resolve = raw => {
      const name = aliases.get(raw) || raw;
      const normalized = name.trim().toLowerCase();
      requireValue(!byName.has(normalized) || byName.get(normalized) !== null,
        `Название «${name}» относится к разным ID. Используйте резервную копию с ID упражнений.`);
      let key = byName.get(normalized);
      if (!key) { while (names.has('seed-ex-' + counter)) counter++; key = 'seed-ex-' + counter++; names.set(key, name); byName.set(name.trim().toLowerCase(), key); }
      return key;
    };
    const incoming = input.workoutLogs.map(l => {
      const entries = l.entries.map(e => ({ exerciseId: resolve(e.exercise), sets: clone(e.sets) }));
      unique(entries.map(e => e.exerciseId), 'Упражнения дневника после объединения имён');
      const tpl = l.dayTemplate || 'A';
      return { id: 'seed-' + l.id, date: new Date(l.date + 'T12:00:00').toISOString(), dateOnly: true,
        dayId: 'seed-day-' + tpl, dayName: l.weekday || new Date(l.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long' }),
        programId: 'prog-seed', note: l.note || '',
        exercises: entries.map(e => ({ id: e.exerciseId, name: names.get(e.exerciseId) })), entries };
    });
    const logs = new Map(state.workoutLogs.map(l => [l.id, l]));
    incoming.forEach(l => logs.set(l.id, l));
    state.workoutLogs = [...logs.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
    // Existing templates are never rebuilt or removed by a diary import.
    // For a first diary, offer the same A/B-style program as before.
    if (incoming.length && !state.programs.some(p => p.id === 'prog-seed')) {
      const templates = input.templates || Object.fromEntries([...new Set(input.workoutLogs.map(l => l.dayTemplate || 'A'))].map(k => [k, { exercises: [] }]));
      const days = Object.entries(templates).map(([key, t]) => {
        const history = incoming.filter(l => l.dayId === 'seed-day-' + key);
        const ids = t.exercises.length ? t.exercises.map(resolve) : [...new Set(history.flatMap(l => l.entries.map(e => e.exerciseId)))];
        return { id: 'seed-day-' + key, name: t.name || history[0]?.dayName || 'Тренировка ' + key,
          exercises: [...new Set(ids)].map(exId => {
            const last = [...history].reverse().flatMap(l => l.entries).find(e => e.exerciseId === exId && e.sets.length)?.sets;
            return { id: exId, name: names.get(exId), targetSets: Math.min(50, last?.length || 3), targetReps: String(last?.[0].reps || 10), notes: '' };
          }) };
      });
      // Avoid collisions with unrelated existing templates.
      const existingDays = new Set(state.programs.flatMap(p => p.days.map(d => d.id)));
      days.forEach(d => requireValue(!existingDays.has(d.id), `ID шаблона ${d.id} уже используется.`));
      state.programs.push({ id: 'prog-seed', name: 'Моя программа (A/B)', days });
      state.currentProgramId = 'prog-seed';
    }
    state.exerciseNames = Object.fromEntries(names);
    // Validate the entire resulting state, not just incoming records.
    const checked = backup(state);
    checked.activeWorkout = state.activeWorkout;
    return checked;
  }
  function preview(previous, next) {
    const before = new Map(previous.workoutLogs.map(l => [l.id, l]));
    const after = new Map(next.workoutLogs.map(l => [l.id, l]));
    const counts = { added: 0, updated: 0, deleted: 0, unchanged: 0 };
    after.forEach((l, key) => {
      if (!before.has(key)) counts.added++;
      else if (stable(before.get(key)) === stable(l)) counts.unchanged++;
      else counts.updated++;
    });
    before.forEach((_, key) => { if (!after.has(key)) counts.deleted++; });
    return counts;
  }
  function prepare(input, previous) {
    requireValue(object(input), 'Файл должен содержать объект данных.');
    // A missing programs collection alone is not sufficient to identify a diary.
    const isDiary = !own(input, 'programs') && Array.isArray(input.workoutLogs) &&
      (input.workoutLogs.length ? input.workoutLogs.every(l => object(l) && Array.isArray(l.entries) && l.entries.every(e => object(e) && own(e, 'exercise'))) : own(input, 'templates'));
    const next = isDiary ? diary(input, previous) : backup(input);
    return { kind: isDiary ? 'diary' : 'backup', next, counts: preview(previous, next) };
  }
  return { prepare, backup, stable };
})();