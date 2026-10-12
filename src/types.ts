export interface ChatRow {
  id: string;
  member_a: string;
  member_b: string;
  created_at: Date;
  updated_at: Date;
}
export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
  readBy: string[];
}
