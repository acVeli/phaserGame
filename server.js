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
const { on } = require('events');

let mongoClient, db;

// Connexion à la base de données MongoDB
async function connectToMongo() {
  const dbUri = 'mongodb://127.0.0.1:27017/';
  const dbName = 'phaserGame';
  const client = new MongoClient(dbUri);

  try {
    await client.connect();
    console.log('Connexion à MongoDB réussie !');

    const db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log("Ping à la base de données réussi !");
    return { client, db };

  } catch (err) {
    console.error('Erreur de connexion à MongoDB:', err);
    throw err;
  }
}


app.use(cors());
app.use(bodyParser.json());

let numberOfPlayers = 0;

const gameItems = [
  { id: 1, name: 'Épée en bois', type: 'weapon', damage: 5, onclick: 'equip' },
  { id: 2, name: 'Potion de soin', type: 'potion', heal: 10, onclick: 'consume' },
];

async function insertGameItems(gameItems) {
  const items = await db.collection('gameItems').find().toArray();
  if (items.length === 0) {
    await db.collection('gameItems').insertMany(gameItems);
  } else {
    await db.collection('gameItems').deleteMany({});
    await db.collection('gameItems').insertMany(gameItems);
  }
}

const players = new Map();

io.on('connection', (socket) => {
  
  numberOfPlayers++;
  socket.on('addPlayerToPlayerList', (playerData) => {
    players.set(socket.id, { ...playerData, socketId: socket.id });
    console.log('Joueur ajouté à la liste des joueurs :', playerData);
  });

    console.log(`Un joueur s'est connecté, nombre de joueurs: ${numberOfPlayers}`);

    socket.on('chat message', async (msg, playerName) => {
      console.log('Chat de', playerName, ':', msg);
      try {
          await db.collection('messages').insertOne({
              message: msg,
              playerName: playerName,
              timestamp: new Date()
          });
          io.emit('chat message', msg, playerName); // Envoie le message à tous les clients connectés
      } catch (err) {
          console.error('Erreur lors de l\'enregistrement du message:', err);
      }
    });

    socket.on('LoggedIn', (playerId, playerName, playerX, playerY ) => {
      console.log('LoggedIn', playerId, playerName, playerX, playerY);
      socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY });
    });

    socket.on('Registered', (playerId, playerName, playerX, playerY) => {
      console.log('Registered', playerId, playerName, playerX, playerY);
      socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY });
    });

    socket.on('requestAllPlayers', () => {
      const allPlayers = Array.from(players.values()).map(player => ({
          id: player.id,
          x: player.x,
          y: player.y,
          name: player.name
      }));
      socket.emit('allPlayers', allPlayers);
    });

    socket.on('disconnect', () => {
        numberOfPlayers--;
        console.log(`Un joueur s'est déconnecté ${socket.id}, nombre de joueurs: ${numberOfPlayers}`);
        const playerData = players.get(socket.id);
        if (playerData) {
            const characterId = playerData.id;
            players.delete(socket.id);
            io.emit('playerLeft', characterId);
        }
    });
  
    socket.on('updatePlayer', (playerData) => {
        console.log('updatePlayer', playerData);
        
        //envoyer les nouvelles données du joueur à tous les clients
        socket.broadcast.emit('playerMoved', { id: socket.id, ...playerData });
        
        //mettre à jour la position du joueur dans la base de données
        db.collection('playerPositions').updateOne(
            { playerId: playerData.id },
            { $set: { playerId: playerData.id, x: playerData.x, y: playerData.y } },
            { upsert: true }
        );
    });

    socket.on('getInventory', async (characterId) => {
      try {
        const inventory = await db.collection('inventories').findOne({ playerId: characterId });
        socket.emit('inventory', inventory);
        console.log('Inventaire récupéré avec succès pour le joueur :', characterId);
      } catch (err) {
        console.error('Erreur lors de la récupération de l\'inventaire :', err);
        socket.emit('errorMessage', 'Erreur lors de la récupération de l\'inventaire');
      }
    });

    socket.on('createCharacter', async (characterData) => {
      try {
        const character = await addCharacter(characterData);
        socket.emit('registrationSuccess', character);
        console.log('Nouveau personnage créé avec succès :', characterData.name);
      } catch (err) {
        console.error('Erreur lors de la création du personnage :', err);
        socket.emit('errorMessage', 'Erreur lors de la création du personnage');
      }
  });

  socket.on('getGameItems', async () => {
    try {
      const gameItems = await db.collection('gameItems').find().toArray();
      socket.emit('gameItems', gameItems);
    } catch (err) {
      console.error('Erreur lors de la récupération des objets de jeu :', err);
      socket.emit('errorMessage', 'Erreur lors de la récupération des objets de jeu');
    }
  });

  socket.on('giveStartingItems', async (characterId) => {
    try {
      const startingItems = [
        { id: 1, name: 'Épée en bois', type: 'weapon', damage: 5, onclick: 'equip'},
        { id: 2,name: 'Potion de soin', type: 'potion', heal: 10, onclick: 'consume' },
      ];
      await db.collection('inventories').insertOne({ playerId: characterId, items: startingItems });
      socket.emit('startingItemsGiven', startingItems);
    } catch (err) {
      console.error('Erreur lors de l\'ajout des objets de départ :', err);
      socket.emit('errorMessage', 'Erreur lors de l\'ajout des objets de départ');
    }
  });

  socket.on('getPlayerPosition', async (characterId) => {
    try {
      const playerPosition = await db.collection('playerPositions').findOne({ playerId: characterId });
      socket.emit('playerPosition', playerPosition);
    } catch (err) {
      console.error('Erreur lors de la récupération de la position du joueur :', err);
      socket.emit('errorMessage', 'Erreur lors de la récupération de la position du joueur');
    }
  });

  socket.on('getCharacter', async (name) => {
    try {
      const character = await getCharacter(name);
      socket.emit('character', character);
    } catch (err) {
      console.error('Erreur lors de la récupération du personnage :', err);
      socket.emit('errorMessage', 'Erreur lors de la récupération du personnage');
    }
  });

  socket.on('checkName', async (name) => {
    try {
      const character = await getCharacter(name);
      socket.emit('nameChecked', !!character);
    } catch (err) {
      console.error('Erreur lors de la vérification du nom :', err);
      socket.emit('errorMessage', 'Erreur lors de la vérification du nom');
    }
  });

});

//console.log de players tous les 5 secondes
setInterval(() => {
  console.log(players);
}, 5000);

async function addCharacter(characterData) {
  try {
    const result = await db.collection('players').insertOne({
      name: characterData.name,
      level: 1,  // On commence au niveau 1 par défaut
      createdAt: new Date()
    });
    console.log(`Nouveau personnage ajouté avec l'ID : ${result.insertedId} et le nom : ${characterData.name}`);
    return result;
  } catch (err) {
    console.error('Erreur lors de l\'ajout du personnage :', err);
    throw err;
  }
}

async function getCharacter(name) {
  try {
    const character = await db.collection('players').findOne({ name });
    return character;
  } catch (err) {
    console.error('Erreur lors de la récupération du personnage :', err);
    throw err;
  }
}

// Fonction pour démarrer le serveur
async function startServer() {
  try {
    ({ client: mongoClient, db } = await connectToMongo());
    await insertGameItems(gameItems);
    
    http.listen(PORT, () => {
      console.log(`Serveur en écoute sur le port ${PORT}`);
    });
  } catch (err) {
    console.error("Impossible de démarrer le serveur:", err);
    process.exit(1);
  }
}

// Gestionnaire pour fermer proprement la connexion MongoDB
process.on('SIGINT', async () => {
  console.log('Arrêt du serveur...');
  if (mongoClient) {
    await mongoClient.close();
    console.log('Connexion MongoDB fermée.');
  }
  process.exit(0);
});

const PORT = 3000;
startServer();