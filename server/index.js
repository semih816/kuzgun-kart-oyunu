const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const allowedOrigins = [
  "http://localhost:5173",
  "https://senin-site-adin.netlify.app" // Netlify linkin
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ["GET", "POST"] } });
const PORT = 3001;

// --- OYUN VERİLERİ ---
const rooms = {};
const CARD_TYPES = ['Döner', 'İnek', 'Eşek', 'Pide', 'Kebap'];

// --- YARDIMCI FONKSİYONLAR ---
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function createDeck() {
  const deck = [];
  for (let i = 0; i < 13; i++) deck.push('Döner');
  for (let i = 0; i < 13; i++) deck.push('İnek');
  for (let i = 0; i < 13; i++) deck.push('Eşek');
  for (let i = 0; i < 13; i++) deck.push('Pide');
  for (let i = 0; i < 12; i++) deck.push('Kebap');
  return shuffle(deck);
}

function handleMatchResult(roomId) {
    const room = rooms[roomId];
    if (!room || !room.matchState || !room.matchState.active) return;
  
    let loserId = null;
    const responded = room.matchState.respondedPlayers;
    const allPlayers = room.players.map(p => p.id);
    const nonResponders = allPlayers.filter(id => !responded.includes(id));
  
    if (nonResponders.length > 0) loserId = nonResponders[0];
    else if (responded.length > 0) loserId = responded[responded.length - 1];
    
    const loser = room.players.find(p => p.id === loserId);
    const winnerId = responded.length > 0 ? responded[0] : null;
    const cardsToTake = [...room.playedCards];
  
    if (loser) {
      loser.hand.push(...cardsToTake);
      room.playedCards = [];
      room.turn = loser.id;
    }
    
    room.matchState = { active: false };
    let gameWinner = room.players.find(p => p.hand.length === 0) || null;
  
    io.to(roomId).emit('matchResult', {
      loser: { id: loserId, username: loser ? loser.username : 'Bilinmiyor' },
      fastest: winnerId ? { id: winnerId, username: room.players.find(p => p.id === winnerId)?.username } : null,
      cardsTakenCount: cardsToTake.length,
      turn: room.turn,
      playedCards: room.playedCards,
      players: room.players.map(p => ({ id: p.id, username: p.username, cardCount: p.hand.length })),
      gameWinner: gameWinner
    });
}

// --- SOCKET.IO BAĞLANTI MANTIĞI ---
io.on('connection', (socket) => {
  console.log(`Bir kullanıcı bağlandı: ${socket.id}`);

  socket.on('createRoom', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 7);
    rooms[roomId] = { roomId, players: [{ id: socket.id, username: `Oyuncu-${Math.floor(Math.random() * 1000)}`, hand: [] }], gameStarted: false };
    socket.join(roomId);
    io.to(socket.id).emit('updateRoom', rooms[roomId]);
    callback(roomId);
  });

  socket.on('joinRoom', ({ roomId }, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ error: true, message: 'Oda bulunamadı.' });
    if (room.players.length >= 4) return callback({ error: true, message: 'Oda dolu.' });
    socket.join(roomId);
    room.players.push({ id: socket.id, username: `Oyuncu-${Math.floor(Math.random() * 1000)}`, hand: [] });
    io.to(roomId).emit('updateRoom', room);
    callback({ success: true });
  });

  socket.on('setUsername', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const sanitizedUsername = username.trim().slice(0, 15);
    if (sanitizedUsername.length >= 2) {
        player.username = sanitizedUsername;
        io.to(roomId).emit('updateRoom', room);
    }
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.players[0].id !== socket.id) return;
    const deck = createDeck();
    const cardsPerPlayer = 8;
    room.players.forEach(player => player.hand = deck.splice(0, cardsPerPlayer));
    room.gameStarted = true;
    room.turn = room.players[0].id;
    room.playedCards = [];
    
    room.players.forEach(player => {
      io.to(player.id).emit('gameStarted', {
        roomId: room.roomId,
        turn: room.turn,
        players: room.players.map(p => ({ id: p.id, username: p.username, cardCount: p.hand.length })),
        myCardCount: player.hand.length,
      });
    });
  });

  socket.on('playCard', ({ roomId, selectedCardIndex, selectedWord }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || socket.id !== room.turn || (room.matchState && room.matchState.active)) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || selectedCardIndex >= player.hand.length) return;

    const playedCard = player.hand.splice(selectedCardIndex, 1)[0];
    room.playedCards.push(playedCard);
    const isMatch = (playedCard === selectedWord);
    
    const currentPlayerIndex = room.players.findIndex(p => p.id === room.turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
    room.turn = room.players[nextPlayerIndex].id;
    
    io.to(roomId).emit('updateGameState', {
      turn: room.turn,
      playedCards: room.playedCards,
      lastPlayed: {
        playerId: player.id,
        username: player.username,
        word: selectedWord,
        card: playedCard,
      },
      players: room.players.map(p => ({ id: p.id, username: p.username, cardCount: p.hand.length })),
      isMatch: isMatch,
    });
    
    if (isMatch) {
      room.matchState = { active: true, respondedPlayers: [], timer: null };
      io.to(roomId).emit('matchOccurred');
      room.matchState.timer = setTimeout(() => handleMatchResult(roomId), 5000);
    }
  });
  
  socket.on('playerReacted', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.matchState || !room.matchState.active || room.matchState.respondedPlayers.includes(socket.id)) return;
    
    room.matchState.respondedPlayers.push(socket.id);
    
    if (room.matchState.respondedPlayers.length === room.players.length) {
      clearTimeout(room.matchState.timer);
      handleMatchResult(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Kullanıcı ayrıldı: ${socket.id}`);
  });
});

server.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`));