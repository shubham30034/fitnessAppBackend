const { Server } = require('socket.io');
const ChatRoom = require('../Model/paidSessionModel/chatSection/chatRoom');
const Message = require('../Model/paidSessionModel/chatSection/message');
const UserSubscription = require('../Model/paidSessionModel/userBookingCoach');

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join specific chat room (only if user is subscribed)
    socket.on('joinRoom', async ({ userId, coachId }) => {
      const roomId = [userId, coachId].sort().join('-');

      try {
        // Check if user is subscribed to this coach
        const isSubscribed = await UserSubscription.findOne({
          client: userId,
          coach: coachId,
          isActive: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        });

        if (!isSubscribed) {
          return socket.emit('errorMessage', 'Access denied. You are not subscribed to this coach.');
        }

        // Join the chat room
        socket.join(roomId);
        socket.roomId = roomId;

      } catch (err) {
        console.error('joinRoom error:', err);
        socket.emit('errorMessage', 'Failed to join room.');
      }
    });

    // Send message (only if user is subscribed)
    socket.on('sendMessage', async ({ userId, coachId, senderId, message }) => {
      const roomId = [userId, coachId].sort().join('-');

      try {
        // Validate subscription
        const activeSubscription = await UserSubscription.findOne({
          client: userId,
          coach: coachId,
          isActive: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        });

        if (!activeSubscription) {
          return socket.emit('errorMessage', 'You are not subscribed to this coach.');
        }

        // Find or create chat room
        let chatRoom = await ChatRoom.findOne({ user: userId, coach: coachId });
        if (!chatRoom) {
          chatRoom = await ChatRoom.create({ user: userId, coach: coachId });
        }

        // Create message
        const newMessage = await Message.create({
          chatRoom: chatRoom._id,
          sender: senderId,
          message,
        });

        // Emit to both users
        io.to(roomId).emit('newMessage', {
          _id: newMessage._id,
          sender: senderId,
          message,
          createdAt: newMessage.createdAt,
        });

      } catch (err) {
        console.error("sendMessage error:", err);
        socket.emit('errorMessage', 'Failed to send message.');
      }
    });

    // Mark messages as read
    socket.on('markAsRead', async ({ chatRoomId, userId }) => {
      try {
        await Message.updateMany(
          { chatRoom: chatRoomId, sender: { $ne: userId }, read: false },
          { $set: { read: true } }
        );
        io.to(socket.roomId).emit('messagesRead', { chatRoomId });
      } catch (err) {
        console.error('markAsRead error:', err);
        socket.emit('errorMessage', 'Failed to mark messages as read.');
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocket;
