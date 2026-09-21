import { useEffect, useState } from "react";
import { employeeApi, workforceApi } from "./api-client";

export function useLiveWorkspace() {
  const [employee, setEmployee] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([employeeApi.getMine(), workforceApi.listActivityLogs({ limit: 100 })])
      .then(([employeeResult, logResult]) => {
        if (cancelled) return;
        setEmployee(employeeResult?.employee || null);
        setLogs(Array.isArray(logResult?.logs) ? logResult.logs : []);
      })
      .catch((cause) => { if (!cancelled) setError(cause?.message || "Unable to load workspace data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { employee, logs, loading, error };
}

export const employeeName = (record: any) => record?.name || "your Employee";
