import { ProjectConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';

export interface SavedProject {
  id: string;
  name: string;
  config: ProjectConfig;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'zenmix_projects';
const ACTIVE_PROJECT_KEY = 'zenmix_active_project';

const nowIso = () => new Date().toISOString();

export const projectStorage = {
  getAll(): SavedProject[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.warn('projectStorage: failed to read projects', e);
      return [];
    }
  },

  getById(id: string): SavedProject | null {
    return this.getAll().find(p => p.id === id) || null;
  },

  getActive(): SavedProject | null {
    try {
      const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (!activeId) {
        const all = this.getAll();
        return all.length > 0 ? all[all.length - 1] : null;
      }
      return this.getById(activeId) || null;
    } catch {
      return null;
    }
  },

  setActive(id: string): void {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  },

  save(project: SavedProject): void {
    try {
      const projects = this.getAll();
      const idx = projects.findIndex(p => p.id === project.id);
      if (idx >= 0) {
        projects[idx] = { ...project, updatedAt: nowIso() };
      } else {
        projects.push(project);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      this.setActive(project.id);
    } catch (e) {
      console.error('projectStorage: failed to save project', e);
    }
  },

  create(name: string, config?: Partial<ProjectConfig>): SavedProject {
    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mergedConfig: ProjectConfig = {
      ...DEFAULT_CONFIG,
      ...(config || {}),
      id,
      name: name || 'Nueva Meditación Zen',
    };

    const project: SavedProject = {
      id,
      name: mergedConfig.name,
      config: mergedConfig,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.save(project);
    return project;
  },

  update(id: string, updates: Partial<SavedProject> & { config?: Partial<ProjectConfig> }): SavedProject | null {
    try {
      const projects = this.getAll();
      const idx = projects.findIndex(p => p.id === id);
      if (idx < 0) return null;

      projects[idx] = {
        ...projects[idx],
        ...updates,
        config: updates.config
          ? { ...projects[idx].config, ...updates.config }
          : projects[idx].config,
        updatedAt: nowIso(),
      };

      // Sync name from config
      projects[idx].name = projects[idx].config.name;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return projects[idx];
    } catch (e) {
      console.error('projectStorage: failed to update project', e);
      return null;
    }
  },

  delete(id: string): void {
    try {
      const filtered = this.getAll().filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      if (localStorage.getItem(ACTIVE_PROJECT_KEY) === id) {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch (e) {
      console.error('projectStorage: failed to delete project', e);
    }
  },

  duplicate(id: string): SavedProject | null {
    const original = this.getById(id);
    if (!original) return null;
    const copyName = `${original.name} (copia)`;
    return this.create(copyName, {
      ...original.config,
      name: copyName,
    });
  },

  /** Persist current config snapshot into the active project (debounced save) */
  syncConfig(projectId: string, config: ProjectConfig): void {
    this.update(projectId, { config });
  },
};
