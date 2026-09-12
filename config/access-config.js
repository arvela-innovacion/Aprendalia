/*
 * ACCESO A APRENDALIA
 * -------------------
 * Cada alumno tiene su propia contraseña y, opcionalmente, dispositivos restringidos.
 * - Si `devices` está vacío, puede entrar desde cualquier dispositivo.
 * - Si `devices` contiene uno o más códigos, sólo puede entrar desde esos dispositivos.
 *
 * Esto permite un periodo inicial de observación antes de activar la restricción.
 *
 * Ejemplo:
 *   maria: {
 *     password: 'Sol39',
 *     devices: ['DEV-AB12-CD34-EF56']
 *   }
 *
 * Cuando la restricción está activa, un navegador nuevo, otro móvil/ordenador o borrar
 * los datos del navegador genera un código distinto y requerirá añadirlo al array.
 *
 * IMPORTANTE: esto es control de acceso práctico para una web estática, no seguridad
 * criptográfica. Las credenciales y dispositivos autorizados pueden inspeccionarse
 * técnicamente en el JavaScript descargado por el navegador.
 */
(function () {
  const STUDENTS = Object.freeze({
    alba: Object.freeze({
      password: 'Alba27',
      devices: Object.freeze([])
    }),
    ana: Object.freeze({
      password: 'Ana42',
      devices: Object.freeze([])
    }),
    sergio: Object.freeze({
      password: 'Sergio58',
      devices: Object.freeze([])
    })
  });

  const PARENT_PASSWORD = 'Padres2026';
  const DEVICE_STORAGE_KEY = 'aprendalia:device-id';

  function normalizeUsername(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function makeDeviceId() {
    let raw = '';
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      raw = window.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    } else if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      raw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    } else {
      raw = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 12);
    }
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(12, '0').slice(0, 12);
    return `DEV-${clean.slice(0,4)}-${clean.slice(4,8)}-${clean.slice(8,12)}`;
  }

  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (!id) {
        id = makeDeviceId();
        localStorage.setItem(DEVICE_STORAGE_KEY, id);
      }
      return id;
    } catch (_) {
      // Si el navegador impide localStorage, el ID sólo dura esta pestaña/sesión.
      if (!window.__aprendaliaDeviceId) window.__aprendaliaDeviceId = makeDeviceId();
      return window.__aprendaliaDeviceId;
    }
  }

  function getDeviceLabel() {
    const ua = navigator.userAgent || '';
    let browser = 'Navegador';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/CriOS\//.test(ua)) browser = 'Chrome iOS';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/FxiOS\//.test(ua)) browser = 'Firefox iOS';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    let device = navigator.platform || 'Dispositivo';
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) device = 'iPad';
    else if (/Android/.test(ua)) device = 'Android';
    else if (/Windows/.test(ua)) device = 'Windows';
    else if (/Macintosh|MacIntel/.test(ua)) device = 'Mac';
    else if (/Linux/.test(ua)) device = 'Linux';

    return `${device} · ${browser}`;
  }

  function authenticateStudent(username, password, deviceId) {
    const normalized = normalizeUsername(username);
    const student = STUDENTS[normalized];
    if (!normalized || !student || student.password !== String(password || '')) {
      return Object.freeze({ ok: false, reason: 'credentials' });
    }

    const currentDevice = String(deviceId || getDeviceId());
    const restrictedByDevice = student.devices.length > 0;
    if (restrictedByDevice && !student.devices.includes(currentDevice)) {
      return Object.freeze({
        ok: false,
        reason: 'device',
        username: normalized,
        deviceId: currentDevice,
        deviceLabel: getDeviceLabel()
      });
    }

    return Object.freeze({
      ok: true,
      username: normalized,
      deviceId: currentDevice,
      deviceLabel: getDeviceLabel()
    });
  }

  function authenticateParent(password) {
    return String(password || '') === PARENT_PASSWORD;
  }

  window.AprendaliaAccess = Object.freeze({
    normalizeUsername,
    authenticateStudent,
    authenticateParent,
    getDeviceId,
    getDeviceLabel
  });
})();
