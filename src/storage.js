(function(global){
  'use strict';

  const VERSION = 3;
  const PREFIX = `aprendalia:v${VERSION}:`;
  const LEGACY_PREFIXES = ['aprendalia:v2:'];
  const MIGRATION_FLAG = 'aprendalia:migrated:v3';

  function safeParse(value, fallback){
    try { return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }

  function migrateLegacy(){
    try {
      if (localStorage.getItem(MIGRATION_FLAG)) return;
      const copies = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const prefix = LEGACY_PREFIXES.find(p => key && key.startsWith(p));
        if (!prefix) continue;
        const suffix = key.slice(prefix.length);
        const target = PREFIX + suffix;
        if (localStorage.getItem(target) == null) copies.push([target, localStorage.getItem(key)]);
      }
      copies.forEach(([key,value]) => localStorage.setItem(key,value));
      localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
    } catch (_) {}
  }

  migrateLegacy();

  function get(key, fallback = null){
    try { return safeParse(localStorage.getItem(PREFIX + key), fallback); }
    catch (_) { return fallback; }
  }

  function set(key, value){
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function remove(key){
    try { localStorage.removeItem(PREFIX + key); }
    catch (_) {}
  }

  function keys(){
    const out=[];
    try {
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
      }
    } catch (_) {}
    return out;
  }

  global.AprendaliaStorage = { VERSION, PREFIX, get, set, remove, keys };
})(window);
