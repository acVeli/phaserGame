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
// Vos routes Express ici
app.use(cors());
app.use(bodyParser.json());

let numberOfPlayers = 0;

const players = new Map();

io.on('connection', (socket) => {
    numberOfPlayers++;
    console.log(`Un joueur s'est connecté, nombre de joueurs: ${numberOfPlayers}`);
    // Quand un nouveau joueur se connecte
    socket.on('newPlayer', (playerData) => {
      // Stockez les données du joueur (vous pouvez utiliser une Map ou un objet)
      players.set(socket.id, playerData);
      
      // Envoyez les données de ce nouveau joueur à tous les autres
      socket.broadcast.emit('playerJoined', { id: socket.id, ...playerData });
      
      // Envoyez les données de tous les joueurs existants au nouveau joueur
      Object.keys(players).forEach(playerId => {
        if (playerId !== socket.id) {
          socket.emit('playerJoined', { id: playerId, ...players[playerId] });
        }
      });
    });
  
    // Quand un joueur se déconnecte
    socket.on('disconnect', () => {
        numberOfPlayers--;
        console.log(`Un joueur s'est déconnecté, nombre de joueurs: ${numberOfPlayers}`);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
  
    // Quand un joueur met à jour sa position ou d'autres données
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

// Endpoint pour charger la dernière position du joueur
app.get('/getPlayerPosition', (req, res) => {
    res.json(savedPosition);
});

const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});