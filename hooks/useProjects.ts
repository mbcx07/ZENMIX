import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectConfig } from '../types';
import { projectStorage, SavedProject } from '../services/projectStorage';

const SYNC_DEBOUNCE_MS = 800;

export function useProjects(initialConfig: ProjectConfig) {
  const [project, setProject] = useState<SavedProject>(() => {
    const active = projectStorage.getActive();
    if (active) return active;

    // No saved project → create one from defaults
    return projectStorage.create(initialConfig.name, initialConfig);
  });

  const [projects, setProjects] = useState<SavedProject[]>(() =>
    projectStorage.getAll(),
  );

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConfigRef = useRef(project.config);

  // Sync changes to localStorage (debounced)
  const setConfig = useCallback(
    (updater: ProjectConfig | ((prev: ProjectConfig) => ProjectConfig)) => {
      setProject((prev) => {
        const newConfig =
          typeof updater === 'function' ? updater(prev.config) : updater;

        // Debounce writes
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          projectStorage.syncConfig(prev.id, newConfig);
        }, SYNC_DEBOUNCE_MS);

        lastConfigRef.current = newConfig;
        return { ...prev, config: newConfig, name: newConfig.name, updatedAt: new Date().toISOString() };
      });
    },
    [],
  );

  // Flush pending sync on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        projectStorage.syncConfig(project.id, lastConfigRef.current);
      }
    };
  }, [project.id]);

  const refreshProjects = useCallback(() => {
    setProjects(projectStorage.getAll());
  }, []);

  const saveNewProject = useCallback(
    (name: string, config?: Partial<ProjectConfig>) => {
      const p = projectStorage.create(name, config);
      setProject(p);
      refreshProjects();
      return p;
    },
    [refreshProjects],
  );

  const loadProject = useCallback((id: string) => {
    const p = projectStorage.getById(id);
    if (p) {
      setProject(p);
      lastConfigRef.current = p.config;
      return p;
    }
    return null;
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      projectStorage.delete(id);
      refreshProjects();
      if (project.id === id) {
        const remaining = projectStorage.getAll();
        if (remaining.length > 0) {
          setProject(remaining[0]);
          lastConfigRef.current = remaining[0].config;
        } else {
          const fresh = projectStorage.create('Nueva Meditación Zen');
          setProject(fresh);
          lastConfigRef.current = fresh.config;
        }
      }
    },
    [project.id, refreshProjects],
  );

  const duplicateProject = useCallback(
    (id: string) => {
      const dup = projectStorage.duplicate(id);
      if (dup) {
        setProject(dup);
        lastConfigRef.current = dup.config;
        refreshProjects();
        return dup;
      }
      return null;
    },
    [refreshProjects],
  );

  return {
    project,
    projects,
    config: project.config,
    setConfig,
    saveNewProject,
    loadProject,
    deleteProject,
    duplicateProject,
    refreshProjects,
  };
}
