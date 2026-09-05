"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccessRole, DocumentFilterState, MineDocument } from "../../shared/types/documents";
import {
  addDocumentVersion,
  approveDocument,
  getDocuments,
  rejectDocument,
  updateDocument,
  uploadDocument,
  type UploadDocumentInput,
} from "@/lib/documentsApi";
import { computeDocumentStats } from "@/lib/complianceUtils";

const DEFAULT_FILTERS: DocumentFilterState = {
  searchQuery: "",
  categories: [],
  statuses: [],
  complianceStates: [],
  departments: [],
  issuingAuthorities: [],
  linkedContractorId: null,
  linkedZoneId: null,
  expiringWithinDays: null,
  issueDateFrom: null,
  issueDateTo: null,
  sortBy: "expiryDate",
  sortDirection: "asc",
  page: 1,
  pageSize: 20,
};

type Approver = { approverId: string; approverName: string; approverRole: AccessRole; comment: string | null };

export function useDocuments(initialFilters?: Partial<DocumentFilterState>) {
  const [documents, setDocuments] = useState<MineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "mock">("mock");
  const [filters, setFilters] = useState<DocumentFilterState>({ ...DEFAULT_FILTERS, ...initialFilters });

  const refresh = useCallback(async () => {
    try {
      const result = await getDocuments();
      setDocuments(result.data);
      setSource(result.source);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const stats = useMemo(() => computeDocumentStats(documents), [documents]);

  const filteredDocuments = useMemo(() => {
    let list = documents;
    const q = filters.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.documentNumber ?? "").toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          (d.issuingAuthority ?? "").toLowerCase().includes(q)
      );
    }
    if (filters.categories.length) list = list.filter((d) => filters.categories.includes(d.category));
    if (filters.statuses.length) list = list.filter((d) => filters.statuses.includes(d.status));
    if (filters.complianceStates.length)
      list = list.filter((d) => filters.complianceStates.includes(d.complianceState));
    if (filters.departments.length)
      list = list.filter((d) => d.department && filters.departments.includes(d.department));
    if (filters.issuingAuthorities.length)
      list = list.filter((d) => d.issuingAuthority && filters.issuingAuthorities.includes(d.issuingAuthority));
    if (filters.linkedContractorId)
      list = list.filter((d) => d.linkedContractorId === filters.linkedContractorId);
    if (filters.linkedZoneId) list = list.filter((d) => d.linkedZoneIds.includes(filters.linkedZoneId as string));
    if (filters.expiringWithinDays !== null) {
      const threshold = filters.expiringWithinDays;
      list = list.filter((d) => d.daysUntilExpiry !== null && d.daysUntilExpiry >= 0 && d.daysUntilExpiry <= threshold);
    }
    if (filters.issueDateFrom) list = list.filter((d) => d.issueDate && d.issueDate >= filters.issueDateFrom!);
    if (filters.issueDateTo) list = list.filter((d) => d.issueDate && d.issueDate <= filters.issueDateTo!);

    const dir = filters.sortDirection === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "createdAt":
          return (a.createdAt < b.createdAt ? -1 : 1) * dir;
        case "category":
          return a.category.localeCompare(b.category) * dir;
        case "expiryDate":
        default: {
          const aVal = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
          const bVal = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
          return (aVal - bVal) * dir;
        }
      }
    });
  }, [documents, filters]);

  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / filters.pageSize));
  const pagedDocuments = useMemo(() => {
    const start = (filters.page - 1) * filters.pageSize;
    return filteredDocuments.slice(start, start + filters.pageSize);
  }, [filteredDocuments, filters.page, filters.pageSize]);

  const upload = useCallback(
    async (input: UploadDocumentInput) => {
      const result = await uploadDocument(input);
      await refresh();
      return result.data;
    },
    [refresh]
  );

  const approve = useCallback(
    async (documentId: string, approver: Approver) => {
      await approveDocument(documentId, approver);
      await refresh();
    },
    [refresh]
  );

  const reject = useCallback(
    async (documentId: string, approver: Approver) => {
      await rejectDocument(documentId, approver);
      await refresh();
    },
    [refresh]
  );

  const addVersion = useCallback(
    async (documentId: string, input: Parameters<typeof addDocumentVersion>[1]) => {
      await addDocumentVersion(documentId, input);
      await refresh();
    },
    [refresh]
  );

  const archiveMany = useCallback(
    async (documentIds: string[]) => {
      await Promise.all(documentIds.map((id) => updateDocument(id, { status: "ARCHIVED" })));
      await refresh();
    },
    [refresh]
  );

  return {
    documents: pagedDocuments,
    allFilteredCount: filteredDocuments.length,
    pageCount,
    stats,
    loading,
    error,
    source,
    filters,
    setFilters,
    refresh,
    upload,
    approve,
    reject,
    addVersion,
    archiveMany,
  };
}
