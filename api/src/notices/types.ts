/** A notice as stored: a broadcast the office wrote for every student (UI-POLISH-SPEC decision 1). */
export interface NoticeRecord {
  noticeId: number;
  title: string;
  message: string;
  instructions: string | null;
  /** YYYY-MM-DD (Asia/Manila calendar day), or null for a notice that does not expire. */
  expiresOn: string | null;
  /** The staff member's name. */
  createdBy: string;
  dateCreated: Date;
  dateUpdated: Date;
  /** How many students received it. */
  recipients: number;
}

export interface NewNotice {
  title: string;
  message: string;
  instructions: string | null;
  expiresOn: string | null;
  employeeId: string;
  date: Date;
  /** What each student's inbox shows: the message, plus the instructions when there are any. */
  inboxMessage: string;
}

export interface NoticePatch {
  title: string;
  message: string;
  instructions: string | null;
  expiresOn: string | null;
  date: Date;
  inboxMessage: string;
}

/**
 * Everything the notice workflow reads and writes. `create` and `update` also write the notifications, in the
 * same transaction, so a notice and its inbox rows can never disagree.
 */
export interface NoticeStore {
  /** Inserts the notice and one `notice` notification per active student. */
  create(input: NewNotice): Promise<{ noticeId: number; recipients: number }>;
  /** Updates the notice and the title and text of the notifications already sent for it. False when missing. */
  update(noticeId: number, patch: NoticePatch): Promise<boolean>;
  /** Deletes the notice and the notifications written for it. False when missing. */
  remove(noticeId: number): Promise<boolean>;
  /** Newest first. */
  list(): Promise<NoticeRecord[]>;
}
