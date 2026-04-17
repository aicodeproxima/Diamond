import { BookingType } from './booking';

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CONVERTED = 'converted',
}

export enum PipelineStage {
  FIRST_STUDY = 'first_study',
  REGULAR_STUDY = 'regular_study',
  PROGRESSING = 'progressing',
  BAPTISM_READY = 'baptism_ready',
  BAPTIZED = 'baptized',
}

export const PIPELINE_STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; order: number }> = {
  [PipelineStage.FIRST_STUDY]: { label: 'First Study', color: 'bg-blue-400', order: 0 },
  [PipelineStage.REGULAR_STUDY]: { label: 'Regular Study', color: 'bg-indigo-400', order: 1 },
  [PipelineStage.PROGRESSING]: { label: 'Progressing', color: 'bg-purple-400', order: 2 },
  [PipelineStage.BAPTISM_READY]: { label: 'Baptism Ready', color: 'bg-amber-400', order: 3 },
  [PipelineStage.BAPTIZED]: { label: 'Baptized', color: 'bg-green-400', order: 4 },
};

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  /** User-facing group/branch name this contact belongs to (e.g. "ODU", "Branch 1") */
  groupName?: string;
  type: BookingType;
  status: ContactStatus;
  pipelineStage: PipelineStage;
  assignedTeacherId?: string;
  /** Up to 3 brothers/sisters who preached with this contact. Stores teacher/user IDs. */
  preachingPartnerIds?: (string | null)[];
  notes?: string;
  totalSessions: number;
  lastSessionDate?: string;
  currentlyStudying?: boolean;
  currentStep?: number;
  currentSubject?: string;
  /** List of subject titles this contact has studied. */
  subjectsStudied?: string[];
  convertedToUserId?: string;
  /** Chronological history of interactions and stage changes. */
  timeline?: TimelineEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  date: string;
  action: 'created' | 'stage_change' | 'session' | 'partner_change' | 'note' | 'updated';
  details: string;
  userId: string;
  userName: string;
}
