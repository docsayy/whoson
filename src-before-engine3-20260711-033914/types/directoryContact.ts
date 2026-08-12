export type DirectoryTab = "contacts" | "pager" | "nursing-home";

export interface DirectoryContact {
  id: string;
  sourceKey?: string;
  tab: DirectoryTab;
  category: string;
  name: string;
  phoneNumbers: string[];
  extensions: string[];
  pagerNumbers: string[];
  faxNumbers: string[];
  notes: string;
  usualAdmittingAttendings: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DirectoryContactInput = Omit<
  DirectoryContact,
  "id" | "createdAt" | "updatedAt"
>;
