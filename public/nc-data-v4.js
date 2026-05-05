/**
 * NC-DATA-V4.js — ZENMIX Data Layer
 * localStorage wrapper with JSON serialization, schemas, favorites, stats, config, and migration.
 * 
 * @module nc-data-v4
 * @version 4.0.0
 * @description Data persistence layer for ZENMIX hypnosis app
 * 
 * Architecture:
 *   - localStorage wrapper with automatic JSON serialization
 *   - Typed schemas for sessions, stats, favorites, and configuration
 *   - Auto-migration from previous versions
 *   - Export/Import as JSON
 *   - Part of window.ZENMIX namespace
 * 
 * Usage:
 *   import './nc-data-v4.js';
 *   const data = window.ZENMIX.data;
 *   await data.init();
 *   const stats = data.getStats();
 */

'use strict';

(function () {
    const MODULE = /** @type {import('./types').NCDataV4} */ ({});

    // ──────────────────────────────────────────────
    // CONSTANTS
    // ──────────────────────────────────────────────

    /** @type {string} Storage key prefix for ZenMix data */
    const STORE_KEY = 'zenmix_v4';

    /** @type {string} Current data schema version */
    const SCHEMA_VERSION = '4.0.0';

    /** @type {Object<string, import('./types').ZMSchema>} */
    const SCHEMAS = {
        sessions: {
            version: 1,
            default: /** @returns {import('./types').ZMSessionsDB} */ () => ({
                schema: 'sessions',
                version: 1,
                entries: []
            })
        },
        stats: {
            version: 1,
            default: /** @returns {import('./types').ZMStatsDB} */ () => ({
                schema: 'stats',
                version: 1,
                total_sessions: 0,
                total_minutes: 0,
                favorite_preset: null,
                streaks: { current: 0, best: 0 },
                last_session_date: null,
                first_session_date: null,
                presets_used: {},
                weekly_minutes: {}
            })
        },
        favorites: {
            version: 1,
            default: /** @returns {import('./types').ZMFavoritesDB} */ () => ({
                schema: 'favorites',
                version: 1,
                items: []
            })
        },
        config: {
            version: 1,
            default: /** @returns {import('./types').ZMConfigDB} */ () => ({
                schema: 'config',
                version: 1,
                theme: 'dark',
                voicePreference: { lang: 'es-MX', voiceURI: null, rate: 0.85, pitch: 1.0 },
                volumeDefaults: { voice: 0.7, binaural: 0.5, ambient: 0.4, master: 0.8 },
                lastPreset: null,
                onboardingComplete: false,
                reducedMotion: false
            })
        }
    };

    // ──────────────────────────────────────────────
    // CORE STORAGE UTILITIES
    // ──────────────────────────────────────────────

    /**
     * Build a namespaced localStorage key.
     * @param {string} schema - Schema name (sessions, stats, favorites, config)
     * @returns {string} Fully qualified storage key
     * @private
     */
    function storageKey(schema) {
        return `${STORE_KEY}__${schema}`;
    }

    /**
     * Read and parse a JSON value from localStorage with fallback.
     * @template T
     * @param {string} schema - Schema name
     * @param {function(): T} fallbackFn - Factory for default value
     * @returns {T} Parsed value or default
     * @private
     */
    function readJSON(schema, fallbackFn) {
        try {
            const raw = localStorage.getItem(storageKey(schema));
            if (raw === null) return fallbackFn();
            const parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object') return fallbackFn();
            return /** @type {T} */ (parsed);
        } catch (e) {
            console.warn(`[NC-DATA] Failed to read "${schema}" from localStorage. Falling back.`, e);
            return fallbackFn();
        }
    }

    /**
     * Write a value to localStorage as JSON with error handling.
     * @template T
     * @param {string} schema - Schema name
     * @param {T} value - Value to serialize and store
     * @returns {boolean} True if write succeeded
     * @private
     */
    function writeJSON(schema, value) {
        try {
            localStorage.setItem(storageKey(schema), JSON.stringify(value));
            return true;
        } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.error('[NC-DATA] Quota exceeded! Data not saved:', schema);
            } else {
                console.error(`[NC-DATA] Failed to write "${schema}" to localStorage.`, e);
            }
            return false;
        }
    }

    /**
     * Remove a stored value from localStorage.
     * @param {string} schema
     * @private
     */
    function removeJSON(schema) {
        try {
            localStorage.removeItem(storageKey(schema));
        } catch (e) {
            console.warn(`[NC-DATA] Failed to remove "${schema}".`, e);
        }
    }

    // ──────────────────────────────────────────────
    // SCHEMA ACCESSORS (cached in memory)
    // ──────────────────────────────────────────────

    /** @type {Object<string, any>} In-memory cache of loaded schemas */
    const cache = {};

    /**
     * Load a schema from storage (or initialize with defaults), store in cache.
     * @template T
     * @param {string} name - Schema name
     * @returns {T} Loaded schema data
     * @private
     */
    function loadSchema(name) {
        if (cache[name] !== undefined) return cache[name];

        const schemaDef = SCHEMAS[name];
        if (!schemaDef) {
            console.error(`[NC-DATA] Unknown schema: "${name}"`);
            return undefined;
        }

        const stored = readJSON(name, schemaDef.default);

        // Validate and repair if needed
        if (stored.version !== schemaDef.version) {
            stored.version = schemaDef.version;
            writeJSON(name, stored);
        }

        cache[name] = stored;
        return stored;
    }

    /**
     * Persist a cached schema back to localStorage.
     * @param {string} name - Schema name
     * @returns {boolean} True if saved
     * @private
     */
    function saveSchema(name) {
        const data = cache[name];
        if (data === undefined) return false;
        const ok = writeJSON(name, data);
        return ok;
    }

    /**
     * Force reload a schema from localStorage (discard cache).
     * @param {string} name
     * @private
     */
    function reloadSchema(name) {
        delete cache[name];
        return loadSchema(name);
    }

    // ──────────────────────────────────────────────
    // MIGRATION ENGINE
    // ──────────────────────────────────────────────

    /**
     * Detect and migrate data from previous ZENMIX versions.
     * Checks v2 (plain keys) and v3 (zenmix_v3 prefix) formats.
     * @returns {Promise<import('./types').ZMMigrationReport>}
     * @private
     */
    async function migrateFromPrevious() {
        const report = /** @type {import('./types').ZMMigrationReport} */ ({
            fromVersion: null,
            toVersion: SCHEMA_VERSION,
            migrated: false,
            sessions: 0,
            stats: false,
            config: false
        });

        // Check for v3 data
        const v3Keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('zenmix_v3__')) {
                v3Keys.push(key);
            }
        }

        if (v3Keys.length > 0) {
            report.fromVersion = '3.0.0';

            // Migrate each v3 key to v4
            for (const oldKey of v3Keys) {
                try {
                    const raw = localStorage.getItem(oldKey);
                    if (!raw) continue;
                    const data = JSON.parse(raw);
                    const newKey = oldKey.replace('zenmix_v3__', `${STORE_KEY}__`);
                    localStorage.setItem(newKey, JSON.stringify(data));

                    // Check what we got
                    if (oldKey.includes('sessions') && Array.isArray(data?.entries)) {
                        report.sessions = data.entries.length;
                    }
                    if (oldKey.includes('stats')) report.stats = true;
                    if (oldKey.includes('config')) report.config = true;
                    if (oldKey.includes('favorites')) report.favorites = Array.isArray(data?.items) ? data.items.length : 0;
                } catch (e) {
                    console.warn(`[NC-DATA] Migration failed for key: ${oldKey}`, e);
                }
            }

            // Clean up old keys
            for (const key of v3Keys) {
                try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
            }

            report.migrated = true;
            console.info(`[NC-DATA] Migrated from v3: sessions=${report.sessions}, stats=${report.stats}, config=${report.config}`);
        }

        // Check for v2 (bare keys without prefix)
        const v2Checks = ['sessions', 'stats', 'favorites', 'config'];
        let v2Found = false;
        for (const check of v2Checks) {
            const raw = localStorage.getItem(check);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    // Only migrate if it looks like ZenMix data
                    if (data && typeof data === 'object' && (data.schema === 'sessions' || data.schema === 'stats' ||
                        data.schema === 'favorites' || data.schema === 'config' || Array.isArray(data.entries))) {
                        const newKey = storageKey(check);
                        if (!localStorage.getItem(newKey)) {
                            localStorage.setItem(newKey, JSON.stringify(data));
                            v2Found = true;
                            if (report.fromVersion === null) report.fromVersion = '2.0.0';
                            report.migrated = true;
                        }
                    }
                } catch (_) { /* not valid JSON, skip */ }
            }
        }

        if (v2Found) {
            console.info('[NC-DATA] Migrated legacy (v2) data.');
        }

        // Purge cache to force fresh reads post-migration
        for (const k of Object.keys(cache)) delete cache[k];

        return report;
    }

    // ──────────────────────────────────────────────
    // PUBLIC: SESSIONS
    // ──────────────────────────────────────────────

    /**
     * Get all session entries.
     * @returns {import('./types').ZMSession[]}
     */
    function getSessions() {
        const db = loadSchema('sessions');
        return db?.entries ?? [];
    }

    /**
     * Add a new session record.
     * @param {import('./types').ZMSessionInput} input - Session data
     * @returns {import('./types').ZMSession|null} Created session or null on failure
     */
    function addSession(input) {
        const db = loadSchema('sessions');
        if (!db) return null;

        const session = /** @type {import('./types').ZMSession} */ ({
            id: input.id || `zs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            created_at: input.created_at || new Date().toISOString(),
            preset: input.preset || 'custom',
            duration_seconds: input.duration_seconds || 0,
            completed: input.completed ?? false,
            voice_enabled: input.voice_enabled ?? true,
            binaural_type: input.binaural_type || 'alpha',
            ambient_type: input.ambient_type || 'rain',
            notes: input.notes || ''
        });

        db.entries.push(session);

        // Prune old entries if > 500
        if (db.entries.length > 500) {
            db.entries = db.entries.slice(-500);
        }

        saveSchema('sessions');
        return session;
    }

    /**
     * Delete a session by ID.
     * @param {string} id
     * @returns {boolean}
     */
    function deleteSession(id) {
        const db = loadSchema('sessions');
        if (!db) return false;
        const idx = db.entries.findIndex(e => e.id === id);
        if (idx === -1) return false;
        db.entries.splice(idx, 1);
        return saveSchema('sessions');
    }

    /**
     * Get most recent sessions (for home grid).
     * @param {number} limit - Max entries to return (default 6)
     * @returns {import('./types').ZMSession[]}
     */
    function getRecentSessions(limit = 6) {
        const sessions = getSessions();
        return sessions.slice(-limit).reverse();
    }

    // ──────────────────────────────────────────────
    // PUBLIC: STATS
    // ──────────────────────────────────────────────

    /**
     * Get full statistics object.
     * @returns {import('./types').ZMStatsDB}
     */
    function getStats() {
        const db = loadSchema('stats');
        // Ensure all fields exist
        if (db) {
            db.total_sessions = db.total_sessions ?? 0;
            db.total_minutes = db.total_minutes ?? 0;
            db.streaks = db.streaks ?? { current: 0, best: 0 };
            db.presets_used = db.presets_used ?? {};
            db.weekly_minutes = db.weekly_minutes ?? {};
        }
        return /** @type {import('./types').ZMStatsDB} */ (db);
    }

    /**
     * Update stats after a completed session.
     * @param {import('./types').ZMSession} session - The completed session
     * @returns {void}
     */
    function updateStatsAfterSession(session) {
        const stats = loadSchema('stats');
        if (!stats) return;

        stats.total_sessions = (stats.total_sessions ?? 0) + 1;
        stats.total_minutes = (stats.total_minutes ?? 0) + Math.round((session.duration_seconds || 0) / 60);

        // Track preset usage
        const preset = session.preset || 'custom';
        stats.presets_used = stats.presets_used ?? {};
        stats.presets_used[preset] = (stats.presets_used[preset] ?? 0) + 1;

        // Track weekly minutes
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);
        stats.weekly_minutes = stats.weekly_minutes ?? {};
        stats.weekly_minutes[weekKey] = (stats.weekly_minutes[weekKey] ?? 0) +
            Math.round((session.duration_seconds || 0) / 60);

        // Streak logic
        const todayStr = today.toISOString().slice(0, 10);
        const lastDate = stats.last_session_date;
        stats.streaks = stats.streaks ?? { current: 0, best: 0 };

        if (lastDate === todayStr) {
            // Already counted today — no change
        } else if (lastDate) {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);
            if (lastDate === yesterdayStr) {
                stats.streaks.current += 1;
            } else {
                stats.streaks.current = 1; // streak broken, restart
            }
        } else {
            stats.streaks.current = 1; // first session ever
        }

        if (stats.streaks.current > stats.streaks.best) {
            stats.streaks.best = stats.streaks.current;
        }

        stats.last_session_date = todayStr;
        if (!stats.first_session_date) {
            stats.first_session_date = todayStr;
        }

        // Determine favorite preset
        let maxCount = 0;
        let fav = null;
        for (const [presetName, count] of Object.entries(stats.presets_used)) {
            if (count > maxCount) {
                maxCount = count;
                fav = presetName;
            }
        }
        stats.favorite_preset = fav;

        saveSchema('stats');
    }

    /**
     * Reset all stats to zero.
     * @returns {boolean}
     */
    function resetStats() {
        const fresh = SCHEMAS.stats.default();
        cache['stats'] = fresh;
        return writeJSON('stats', fresh);
    }

    // ──────────────────────────────────────────────
    // PUBLIC: FAVORITES
    // ──────────────────────────────────────────────

    /**
     * Get all favorite items.
     * @returns {import('./types').ZMFavoriteItem[]}
     */
    function getFavorites() {
        const db = loadSchema('favorites');
        return db?.items ?? [];
    }

    /**
     * Toggle a favorite item (add if missing, remove if present).
     * @param {import('./types').ZMFavoriteItemInput} item
     * @returns {boolean} True if added, false if removed
     */
    function toggleFavorite(item) {
        const db = loadSchema('favorites');
        if (!db) return false;

        const existingIdx = db.items.findIndex(f => f.id === item.id);
        if (existingIdx !== -1) {
            db.items.splice(existingIdx, 1);
            saveSchema('favorites');
            return false;
        }

        db.items.push(/** @type {import('./types').ZMFavoriteItem} */ ({
            id: item.id,
            type: item.type || 'preset',
            label: item.label || '',
            added_at: new Date().toISOString(),
            meta: item.meta || {}
        }));

        // Prune old favorites > 100
        if (db.items.length > 100) {
            db.items = db.items.slice(-100);
        }

        saveSchema('favorites');
        return true;
    }

    /**
     * Check if an item is favorited.
     * @param {string} id
     * @returns {boolean}
     */
    function isFavorited(id) {
        const db = loadSchema('favorites');
        return db?.items?.some(f => f.id === id) ?? false;
    }

    /**
     * Remove a favorite by ID.
     * @param {string} id
     * @returns {boolean}
     */
    function removeFavorite(id) {
        const db = loadSchema('favorites');
        if (!db) return false;
        const idx = db.items.findIndex(f => f.id === id);
        if (idx === -1) return false;
        db.items.splice(idx, 1);
        return saveSchema('favorites');
    }

    // ──────────────────────────────────────────────
    // PUBLIC: CONFIGURATION
    // ──────────────────────────────────────────────

    /**
     * Get the full configuration object.
     * @returns {import('./types').ZMConfigDB}
     */
    function getConfig() {
        const db = loadSchema('config');
        // Ensure nested structures
        if (db) {
            db.voicePreference = db.voicePreference ?? { lang: 'es-MX', voiceURI: null, rate: 0.85, pitch: 1.0 };
            db.volumeDefaults = db.volumeDefaults ?? { voice: 0.7, binaural: 0.5, ambient: 0.4, master: 0.8 };
        }
        return db;
    }

    /**
     * Update a specific config key (shallow merge at top level).
     * @param {string} key - Config property name
     * @param {*} value - New value (will be deep-merged for objects)
     * @returns {boolean} True if saved
     */
    function updateConfig(key, value) {
        const db = loadSchema('config');
        if (!db) return false;

        if (typeof value === 'object' && value !== null && typeof db[key] === 'object' && db[key] !== null) {
            // Deep merge for nested objects (voicePreference, volumeDefaults)
            db[key] = { ...db[key], ...value };
        } else {
            db[key] = value;
        }

        return saveSchema('config');
    }

    /**
     * Update multiple config keys at once.
     * @param {Object<string, *>} updates
     * @returns {boolean}
     */
    function updateConfigBatch(updates) {
        const db = loadSchema('config');
        if (!db) return false;

        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'object' && value !== null && typeof db[key] === 'object' && db[key] !== null) {
                db[key] = { ...db[key], ...value };
            } else {
                db[key] = value;
            }
        }

        return saveSchema('config');
    }

    // ──────────────────────────────────────────────
    // PUBLIC: EXPORT / IMPORT
    // ──────────────────────────────────────────────

    /**
     * Export all ZENMIX data as a JSON object.
     * @returns {import('./types').ZMExportData}
     */
    function exportData() {
        // Force reload from storage
        for (const k of Object.keys(cache)) delete cache[k];

        return {
            version: SCHEMA_VERSION,
            exported_at: new Date().toISOString(),
            sessions: loadSchema('sessions'),
            stats: loadSchema('stats'),
            favorites: loadSchema('favorites'),
            config: loadSchema('config')
        };
    }

    /**
     * Import data from a JSON export, replacing current data.
     * @param {import('./types').ZMExportData} importData - Previously exported data
     * @returns {Promise<{success: boolean, errors: string[]}>}
     */
    async function importData(importData) {
        /** @type {string[]} */
        const errors = [];

        if (!importData || typeof importData !== 'object') {
            return { success: false, errors: ['Invalid import data: not an object'] };
        }

        const schemas = ['sessions', 'stats', 'favorites', 'config'];

        for (const schema of schemas) {
            if (importData[schema] && typeof importData[schema] === 'object') {
                const ok = writeJSON(schema, importData[schema]);
                if (!ok) errors.push(`Failed to write schema: ${schema}`);
            }
        }

        // Purge cache
        for (const k of Object.keys(cache)) delete cache[k];

        return { success: errors.length === 0, errors };
    }

    /**
     * Wipe all ZENMIX data from localStorage.
     * @returns {boolean}
     */
    function wipeAllData() {
        const schemas = ['sessions', 'stats', 'favorites', 'config'];
        for (const schema of schemas) {
            removeJSON(schema);
            delete cache[schema];
        }
        return true;
    }

    // ──────────────────────────────────────────────
    // PUBLIC: INITIALIZATION
    // ──────────────────────────────────────────────

    /**
     * Initialize the data layer: run migrations, validate schemas, detect reduced motion.
     * Call once at app startup.
     * @returns {Promise<{ready: boolean, migration?: import('./types').ZMMigrationReport}>}
     */
    async function init() {
        console.info(`[NC-DATA] Initializing ZENMIX Data Layer v${SCHEMA_VERSION}`);

        // Run migration
        const migrationReport = await migrateFromPrevious();

        // Ensure all schemas exist
        for (const name of Object.keys(SCHEMAS)) {
            loadSchema(name);
        }

        // Detect reduced motion preference
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) {
            updateConfig('reducedMotion', true);
        }
        motionQuery.addEventListener('change', (e) => {
            updateConfig('reducedMotion', e.matches);
        });

        // Ensure stats schema integrity
        const stats = loadSchema('stats');
        if (stats) {
            stats.total_sessions = stats.total_sessions ?? 0;
            stats.total_minutes = stats.total_minutes ?? 0;
            stats.streaks = stats.streaks ?? { current: 0, best: 0 };
            stats.presets_used = stats.presets_used ?? {};
            stats.weekly_minutes = stats.weekly_minutes ?? {};
        }

        console.info('[NC-DATA] Data layer ready.');
        return { ready: true, migration: migrationReport };
    }

    // ──────────────────────────────────────────────
    // MODULE ASSEMBLY
    // ──────────────────────────────────────────────

    Object.assign(MODULE, {
        // Lifecycle
        init,

        // Sessions
        getSessions,
        addSession,
        deleteSession,
        getRecentSessions,

        // Stats
        getStats,
        updateStatsAfterSession,
        resetStats,

        // Favorites
        getFavorites,
        toggleFavorite,
        isFavorited,
        removeFavorite,

        // Config
        getConfig,
        updateConfig,
        updateConfigBatch,

        // Data management
        exportData,
        importData,
        wipeAllData,

        // Internal (exposed for debugging)
        _reloadSchema: reloadSchema,
        _schemaVersion: SCHEMA_VERSION
    });

    // ──────────────────────────────────────────────
    // NAMESPACE REGISTRATION
    // ──────────────────────────────────────────────

    /** @type {import('./types').ZENMIXNamespace} */
    window.ZENMIX = window.ZENMIX || {};
    window.ZENMIX.data = MODULE;

    console.info('[NC-DATA] Registered at window.ZENMIX.data');
})();
