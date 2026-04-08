import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPostJson, apiPutJson } from '@/lib/api';

export interface BuilderProjectStats {
  wallsCount: number;
  productsCount: number;
  floorSize: number;
}

export interface BuilderProjectCard {
  _id: string;
  title: string;
  description: string;
  previewImageUrl: string;
  stats: BuilderProjectStats;
  ownerUserId: string | null;
  ownerActorKey: string | null;
  ownerEmailSnapshot: string;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  version: number;
}

export interface BuilderProjectExportPayload {
  schemaVersion: number;
  projectMeta: {
    title: string;
    description: string;
    ownerEmailSnapshot: string;
    createdAt: string;
    updatedAt: string;
  };
  layout: Record<string, unknown>;
}

export interface BuilderProjectListQuery {
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
  deleted?: boolean;
  allUsers?: boolean;
  owner?: string;
}

type ProjectTarget = string | { id: string; allUsers?: boolean };

function resolveTarget(target: ProjectTarget) {
  if (typeof target === 'string') return { id: target, allUsers: false };
  return { id: target.id, allUsers: Boolean(target.allUsers) };
}

function toQueryString(query: BuilderProjectListQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);
  if (query.deleted !== undefined) params.set('deleted', query.deleted ? '1' : '0');
  if (query.allUsers !== undefined) params.set('allUsers', query.allUsers ? '1' : '0');
  if (query.owner) params.set('owner', query.owner);
  return params.toString();
}

export function useBuilderProjectsList(query: BuilderProjectListQuery) {
  const qs = useMemo(() => toQueryString(query), [query]);
  return useQuery({
    queryKey: ['builder-projects', qs],
    queryFn: async () => {
      const path = query.allUsers
        ? `/api/admin/builder/projects${qs ? `?${qs}` : ''}`
        : `/api/builder/projects${qs ? `?${qs}` : ''}`;
      const res = await apiGet<BuilderProjectCard>(path);
      if (!res.ok) throw new Error(res.error || 'Failed to load projects');
      return res as {
        ok: true;
        items: BuilderProjectCard[];
        page: number;
        total: number;
        pages: number;
        limit: number;
      };
    },
    staleTime: 10_000,
  });
}

export function useBuilderProject(projectId: string | null, allUsers = false) {
  return useQuery({
    queryKey: ['builder-project', projectId, allUsers],
    enabled: !!projectId,
    queryFn: async () => {
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiGet<any>(`/api/builder/projects/${projectId}${qs}`);
      if (!res.ok) throw new Error(res.error || 'Failed to load project');
      return res.item as any;
    },
  });
}

export function useBuilderProjectActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['builder-projects'] });
  }, [queryClient]);

  const createProject = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiPostJson<any, Record<string, unknown>>('/api/builder/projects', payload);
      if (!res.ok) throw new Error(res.error || 'Failed to create project');
      return res.item as BuilderProjectCard;
    },
    onSuccess: invalidate,
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, payload, allUsers }: { id: string; payload: Record<string, unknown>; allUsers?: boolean }) => {
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiPutJson<any, Record<string, unknown>>(`/api/builder/projects/${id}${qs}`, payload);
      if (!res.ok) throw new Error(res.error || 'Failed to update project');
      return res.item as BuilderProjectCard;
    },
    onSuccess: async (_data, vars) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['builder-project', vars.id] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiDelete(`/api/builder/projects/${id}${qs}`);
      if (!res.ok) throw new Error(res.error || 'Failed to delete project');
      return res.item as { deleted: boolean; id: string };
    },
    onSuccess: invalidate,
  });

  const restoreProject = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiPostJson<any, {}>(`/api/builder/projects/${id}/restore${qs}`, {});
      if (!res.ok) throw new Error(res.error || 'Failed to restore project');
      return res.item as BuilderProjectCard;
    },
    onSuccess: invalidate,
  });

  const hardDeleteProject = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiDelete(`/api/builder/projects/${id}/hard-delete${qs}`);
      if (!res.ok) throw new Error(res.error || 'Failed to permanently delete project');
      return res.item as { hardDeleted: boolean; id: string };
    },
    onSuccess: invalidate,
  });

  const duplicateProject = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiPostJson<any, {}>(`/api/builder/projects/${id}/duplicate${qs}`, {});
      if (!res.ok) throw new Error(res.error || 'Failed to duplicate project');
      return res.item as BuilderProjectCard;
    },
    onSuccess: invalidate,
  });

  const touchOpen = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiPostJson<any, {}>(`/api/builder/projects/${id}/open${qs}`, {});
      if (!res.ok) throw new Error(res.error || 'Failed to mark project open');
      return res.item as BuilderProjectCard;
    },
  });

  const importProject = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiPostJson<any, Record<string, unknown>>('/api/builder/projects/import', payload);
      if (!res.ok) throw new Error(res.error || 'Failed to import project');
      return res.item as BuilderProjectCard;
    },
    onSuccess: invalidate,
  });

  const exportProject = useMutation({
    mutationFn: async (target: ProjectTarget) => {
      const { id, allUsers } = resolveTarget(target);
      const qs = allUsers ? '?allUsers=1' : '';
      const res = await apiGet<BuilderProjectExportPayload>(`/api/builder/projects/${id}/export${qs}`);
      if (!res.ok) throw new Error(res.error || 'Failed to export project');
      return res.item as BuilderProjectExportPayload;
    },
  });

  return {
    createProject,
    updateProject,
    deleteProject,
    restoreProject,
    hardDeleteProject,
    duplicateProject,
    touchOpen,
    importProject,
    exportProject,
    invalidate,
  };
}
