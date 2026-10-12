import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { pool } from '../db.js';
import { firestore } from '../firebase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { ChatRow, Message } from '../types.js';

function getId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return value.trim();
}

async function findChat(chatId: string, userId?: string): Promise<ChatRow> {
  const result = await pool.query<ChatRow>(
    `SELECT id, member_a, member_b, created_at, updated_at
     FROM chats
     WHERE id = $1`,
    [chatId],
  );

  const chat = result.rows[0];
  if (!chat) {
    throw new HttpError(404, 'Chat not found');
  }

  if (userId && chat.member_a !== userId && chat.member_b !== userId) {
    throw new HttpError(403, 'User is not a member of this chat');
  }

  return chat;
}

export async function createOrGetChat(userAId: unknown, userBId: unknown): Promise<ChatRow> {
  const firstUserId = getId(userAId, 'userAId');
  const secondUserId = getId(userBId, 'userBId');

  if (firstUserId === secondUserId) {
    throw new HttpError(400, 'A 1:1 chat needs two different users');
  }

  // Store the pair in a consistent order so the same chat is found either way.
  const [memberA, memberB] = [firstUserId, secondUserId].sort();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id)
       VALUES ($1), ($2)
       ON CONFLICT (id) DO NOTHING`,
      [memberA, memberB],
    );

    const result = await client.query<ChatRow>(
      `INSERT INTO chats (member_a, member_b)
       VALUES ($1, $2)
       ON CONFLICT (member_a, member_b)
       DO UPDATE SET updated_at = chats.updated_at
       RETURNING id, member_a, member_b, created_at, updated_at`,
      [memberA, memberB],
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function sendMessage(
  chatIdValue: unknown,
  senderIdValue: unknown,
  textValue: unknown,
): Promise<Message> {
  const chatId = getId(chatIdValue, 'chatId');
  const senderId = getId(senderIdValue, 'senderId');

  if (typeof textValue !== 'string' || textValue.trim().length === 0 || textValue.length > 10_000) {
    throw new HttpError(400, 'text must be a non-empty string of at most 10000 characters');
  }

  await findChat(chatId, senderId);

  const sentAt = Timestamp.now();
  const messageId = randomUUID();
  const message: Message = {
    messageId,
    chatId,
    senderId,
    text: textValue.trim(),
    timestamp: sentAt.toDate().toISOString(),
    readBy: [senderId],
  };

  await firestore
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .doc(messageId)
    .create({
      ...message,
      timestamp: sentAt,
      createdAt: FieldValue.serverTimestamp(),
    });

  await pool.query(
    'UPDATE chats SET updated_at = $2 WHERE id = $1',
    [chatId, sentAt.toDate()],
  );

  return message;
}

export async function getMessages(
  chatIdValue: unknown,
  userIdValue: unknown,
  limitValue: unknown,
): Promise<Message[]> {
  const chatId = getId(chatIdValue, 'chatId');
  const userId = userIdValue === undefined ? undefined : getId(userIdValue, 'userId');
  await findChat(chatId, userId);

  const limit = limitValue === undefined ? 50 : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'limit must be an integer between 1 and 100');
  }

  const snapshot = await firestore
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  // Read newest messages first for the limit, then return them oldest to newest.
  return snapshot.docs.map((document) => {
    const data = document.data();
    const timestamp = data.timestamp instanceof Timestamp
      ? data.timestamp.toDate().toISOString()
      : data.timestamp;

    return {
      messageId: document.id,
      chatId,
      senderId: data.senderId,
      text: data.text,
      timestamp,
      readBy: Array.isArray(data.readBy) ? data.readBy : [],
    };
  }).reverse();
}

export async function markMessageRead(
  chatIdValue: unknown,
  messageIdValue: unknown,
  userIdValue: unknown,
) {
  const chatId = getId(chatIdValue, 'chatId');
  const messageId = getId(messageIdValue, 'messageId');
  const userId = getId(userIdValue, 'userId');
  await findChat(chatId, userId);

  const messageRef = firestore
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .doc(messageId);

  await firestore.runTransaction(async (transaction) => {
    const message = await transaction.get(messageRef);
    if (!message.exists) {
      throw new HttpError(404, 'Message not found');
    }

    transaction.update(messageRef, {
      readBy: FieldValue.arrayUnion(userId),
    });
  });

  return { chatId, messageId, userId, read: true };
}

export async function updateLastSeen(
  chatIdValue: unknown,
  userIdValue: unknown,
  messageIdValue: unknown,
) {
  const chatId = getId(chatIdValue, 'chatId');
  const userId = getId(userIdValue, 'userId');
  const messageId = getId(messageIdValue, 'messageId');
  await findChat(chatId, userId);

  const chatRef = firestore.collection('chats').doc(chatId);
  const messageRef = chatRef.collection('messages').doc(messageId);
  const memberRef = chatRef.collection('members').doc(userId);
  const seenAt = Timestamp.now();

  await firestore.runTransaction(async (transaction) => {
    const message = await transaction.get(messageRef);
    if (!message.exists) {
      throw new HttpError(404, 'Message not found');
    }

    transaction.set(memberRef, {
      lastSeenMessageId: messageId,
      lastSeenAt: seenAt,
    }, { merge: true });
    transaction.update(messageRef, {
      readBy: FieldValue.arrayUnion(userId),
    });
  });

  return {
    chatId,
    userId,
    lastSeenMessageId: messageId,
    lastSeenAt: seenAt.toDate().toISOString(),
  };
}

export async function listUserChats(userIdValue: unknown) {
  const userId = getId(userIdValue, 'userId');
  const result = await pool.query<ChatRow>(
    `SELECT id, member_a, member_b, created_at, updated_at
     FROM chats
     WHERE member_a = $1 OR member_b = $1
     ORDER BY updated_at DESC`,
    [userId],
  );

  return result.rows.map((chat) => ({
    chatId: chat.id,
    memberIds: [chat.member_a, chat.member_b],
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  }));
}
