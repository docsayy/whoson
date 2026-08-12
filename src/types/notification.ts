import type { AppPage } from "./page";

export type AppNotificationType =
  | "schedule-published"
  | "assignment-changed"
  | "swap-requested"
  | "swap-accepted"
  | "swap-declined"
  | "swap-approved"
  | "swap-rejected"
  | "system";

export interface AppNotification {
  id: string;
  recipientUid?: string;
  recipientResidentId?: string;
  type: AppNotificationType;
  title: string;
  message: string;
  linkPage?: AppPage;
  relatedId?: string;
  createdAt: string;
  readAt?: string;
}
