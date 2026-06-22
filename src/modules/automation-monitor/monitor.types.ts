export type LogStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface MonitorLogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface IExecutionLog {
  id: string;
  sessionId: string;
  jobId: string;
  state: string;
  city: string;
  area: string;
  businessType: string;
  sources: string[];
  status: LogStatus;
  totalLeads: number;
  sourceResults: Array<{
    source: string;
    totalStored: number;
    totalExtracted: number;
    success: boolean;
  }>;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  workerId: string;
  logs: MonitorLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionLiveStatus {
  sessionId: string;
  status: string;
  currentJob: {
    id: string;
    area: string;
    city: string;
    businessType: string;
    progress: string;
    startedAt: string | null;
    elapsed: number;
  } | null;
  queueLength: number;
  processed: number;
  total: number;
  leadsFound: number;
  startedAt: string | null;
  uptime: number;
}

export interface MonitorStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  totalLeads: number;
  totalDuration: number;
  avgJobDuration: number;
  leadsBySource: Record<string, number>;
  errorsByArea: Array<{ area: string; city: string; error: string; count: number }>;
}
