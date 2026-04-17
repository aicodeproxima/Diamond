export enum Activity {
  BIBLE_STUDY = 'bible_study',
  GROUP_ACTIVITY = 'group_activity',
  SPECIAL_VIDEO = 'special_video',
  TEAM_MEETING = 'team_meeting',
  GROUP_MEETING = 'group_meeting',
  FUNCTION_MEETING = 'function_meeting',
  COMMITTEE_MEETING = 'committee_meeting',
  COMMITTEE_MISSION = 'committee_mission',
}

export const ACTIVITY_CONFIG: Record<Activity, { label: string; icon: string }> = {
  [Activity.BIBLE_STUDY]: { label: 'Bible Study', icon: 'BookOpen' },
  [Activity.GROUP_ACTIVITY]: { label: 'Group Activity', icon: 'UsersRound' },
  [Activity.SPECIAL_VIDEO]: { label: 'Special Video', icon: 'Video' },
  [Activity.TEAM_MEETING]: { label: 'Team Meeting', icon: 'Users' },
  [Activity.GROUP_MEETING]: { label: 'Group Meeting', icon: 'Users' },
  [Activity.FUNCTION_MEETING]: { label: 'Function Meeting', icon: 'Briefcase' },
  [Activity.COMMITTEE_MEETING]: { label: 'Committee Meeting', icon: 'ClipboardList' },
  [Activity.COMMITTEE_MISSION]: { label: 'Committee Mission', icon: 'Target' },
};
