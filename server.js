const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').createServer(app);
const cors = require('cors');
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  },
});
const { MongoClient } = require('mongodb');

// Connexion à la base de données
const dbUri = 'mongodb://localhost:27017/'; // URL de connexion à MongoDB
const dbName = 'phaserGame'; // Nom de ta base de données

app.use(cors());
app.use(bodyParser.json());

let numberOfPlayers = 0;

const players = new Map();

io.on('connection', (socket) => {
    numberOfPlayers++;
    console.log(`Un joueur s'est connecté, nombre de joueurs: ${numberOfPlayers}`);
    socket.on('newPlayer', (playerData) => {
      players.set(socket.id, playerData);
      socket.broadcast.emit('playerJoined', { id: socket.id, ...playerData });
      
      Object.keys(players).forEach(playerId => {
        if (playerId !== socket.id) {
          socket.emit('playerJoined', { id: playerId, ...players[playerId] });
        }
      });
    });
  
    socket.on('disconnect', () => {
        numberOfPlayers--;
        console.log(`Un joueur s'est déconnecté, nombre de joueurs: ${numberOfPlayers}`);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
        socket.broadcast.emit('playerLeft', socket.id);
    });
  
    socket.on('updatePlayer', (playerData) => {
      players[socket.id] = { ...players[socket.id], ...playerData };
      socket.broadcast.emit('playerUpdated', { id: socket.id, ...playerData });
    });
    
  });


// Variable pour stocker la position du joueur (exemple simplifié)
let savedPosition = { x: 0, y: 0 };

// Endpoint pour sauvegarder la position du joueur
app.post('/savePlayerPosition', (req, res) => {
    const { x, y } = req.body;
    savedPosition = { x, y };
    res.send(`Position du joueur sauvegardée avec succès: x=${x}, y=${y}`);
});

const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});