import { Router } from 'express';
import * as chatController from '../controllers/chatController.js';

const router = Router();
router.post('/chat/create', chatController.createChat);
router.post('/chat/:chatId/message/send', chatController.sendMessage);
router.get('/chat/:chatId/messages', chatController.getMessages);
router.post('/chat/:chatId/message/:messageId/read', chatController.markMessageRead);
router.post('/chat/:chatId/lastseen', chatController.updateLastSeen);
router.get('/user/:userId/chats', chatController.listUserChats);

export default router;
