import type { RequestHandler } from 'express';
import * as chatService from '../services/chatService.js';

export const createChat: RequestHandler = async (req, res) => {
  const chat = await chatService.createOrGetChat(
    req.body?.userAId,
    req.body?.userBId,
  );

  res.status(201).json({ chatId: chat.id });
};

export const sendMessage: RequestHandler = async (req, res) => {
  const message = await chatService.sendMessage(
    req.params.chatId,
    req.body?.senderId,
    req.body?.text,
  );

  res.status(201).json(message);
};

export const getMessages: RequestHandler = async (req, res) => {
  const messages = await chatService.getMessages(
    req.params.chatId,
    req.query.userId,
    req.query.limit,
  );

  res.json({ messages });
};

export const markMessageRead: RequestHandler = async (req, res) => {
  const result = await chatService.markMessageRead(
    req.params.chatId,
    req.params.messageId,
    req.body?.userId,
  );

  res.json(result);
};

export const updateLastSeen: RequestHandler = async (req, res) => {
  const result = await chatService.updateLastSeen(
    req.params.chatId,
    req.body?.userId,
    req.body?.messageId,
  );

  res.json(result);
};

export const listUserChats: RequestHandler = async (req, res) => {
  const chats = await chatService.listUserChats(req.params.userId);
  res.json({ chats });
};
