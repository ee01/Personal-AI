export interface JiraTicket {
  key: string;
  issuetype: string;
  summary: string;
  status: string;
  assignee: string;
  reporter: string;
  priority: string;
  labels?: string;
  components?: string;
  fixVersions?: string;
  affectsVersions?: string;
  linkedIssues?: string;
  epicLink?: string;
  sprint?: string;
  storyPoints?: string;
  created?: string;
  updated?: string;
  duedate?: string;
  description?: string;
} 