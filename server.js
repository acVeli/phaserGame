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
  { id: 1, name: 'Épée en bois', type: 'weapon', damage: 5, onclick: 'equip', description : 'Une épée en bois basique' },
  { id: 2, name: 'Potion de soin', type: 'potion', heal: 10, onclick: 'consume', description : 'Une potion de soin basique' },
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
    console.log('Un client s\'est connecté');
   
    numberOfPlayers++;
    socket.on('addPlayerToPlayerList', (playerData) => {
        players.set(socket.id, { ...playerData, socketId: socket.id });
        console.log('Joueur ajouté à la liste des joueurs :', playerData);
    });

    console.log(`Un joueur s'est connecté, nombre de joueurs: ${numberOfPlayers}`);

    socket.on('chat message', async (msg, playerName) => {
        try {
            const message = {
                playerName: playerName,
                message: msg,
                timestamp: new Date()
            };
            await db.collection('chatMessages').insertOne(message);
            io.emit('chat message', message);
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du message:', error);
        }
    });

    socket.on('LoggedIn', (playerId, playerName, playerX, playerY, playerLevel) => {
        console.log('LoggedIn', playerId, playerName, playerX, playerY);
        players.set(playerId, {
            id: playerId,
            name: playerName,
            x: playerX,
            y: playerY,
            level: playerLevel,
            socketId: socket.id
        });
        socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY, level: playerLevel });
    });

    socket.on('Registered', (playerId, playerName, playerX, playerY, playerLevel) => {
        console.log('Registered', playerId, playerName, playerX, playerY);
        players.set(playerId, {
            id: playerId,
            name: playerName,
            x: playerX,
            y: playerY,
            level: playerLevel,
            socketId: socket.id
        });
        socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY, level: playerLevel });
    });

    socket.on('requestAllPlayers', () => {
        // Filtrer pour exclure le joueur actuel
        const allPlayers = Array.from(players.values())
            .filter(player => player.socketId !== socket.id)
            .map(player => ({
                id: player.id,
                x: player.x,
                y: player.y,
                name: player.name,
                level: player.level
            }));
        console.log('requestAllPlayers - Envoi des autres joueurs:', allPlayers);
        socket.emit('allPlayers', allPlayers);
    });

    socket.on('getLastMessages', async () => {
        try {
            const messages = await db.collection('chatMessages')
                .find()
                .sort({ timestamp: -1 })
                .limit(50)
                .toArray();
            socket.emit('lastMessages', messages.reverse());
        } catch (error) {
            console.error('Erreur lors de la récupération des messages:', error);
        }
    });

    socket.on('checkNameForRegister'  , async (name) => {
        try {
            const existingPlayer = await db.collection('characters').findOne({ name: name });
            socket.emit('nameCheckedForRegister', !existingPlayer);
        } catch (error) {
            console.error('Erreur lors de la vérification du nom:', error);
            socket.emit('nameCheckedForRegister', false);
        }
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
        // Mettre à jour la position du joueur dans la liste des joueurs en ligne
        if (players.has(playerData.id)) {
            const player = players.get(playerData.id);
            
            // Si nous avons des points de départ et d'arrivée
            if (playerData.startX !== undefined && playerData.startY !== undefined) {
                players.set(playerData.id, {
                    ...player,
                    x: playerData.targetX,
                    y: playerData.targetY,
                    startX: playerData.startX,
                    startY: playerData.startY,
                    targetX: playerData.targetX,
                    targetY: playerData.targetY
                });
            } else {
                // Fallback pour les anciennes mises à jour de position
                players.set(playerData.id, {
                    ...player,
                    x: playerData.x,
                    y: playerData.y
                });
            }
        }

        // Envoyer les nouvelles données du joueur à tous les clients
        socket.broadcast.emit('playerPositionUpdate', playerData);

        // Mettre à jour la position du joueur dans la base de données
        db.collection('playerPositions').updateOne(
            { playerId: playerData.id },
            { $set: { 
                playerId: playerData.id, 
                x: playerData.targetX || playerData.x, 
                y: playerData.targetY || playerData.y 
            }},
            { upsert: true }
        );
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

    socket.on('checkNameForLogin', async (name) => {
        try {
            const character = await getCharacter(name);
            socket.emit('nameCheckedForLogin', character);
        } catch (err) {
            console.error('Erreur lors de la vérification du nom :', err);
            socket.emit('errorMessage', 'Erreur lors de la vérification du nom');
        }
    });

    socket.on('createCharacter', async (characterData) => {
        try {
            const regex = /^[a-zA-Z0-9]{1,16}$/;
            const validName = regex.test(characterData.name);
            if (!characterData.name) {
                socket.emit('errorMessage', 'Le nom du personnage est requis');
                return;
            } else if (characterData.name.length > 16 && !validName) {
                socket.emit('errorMessage', 'Le nom du personnage doit contenir moins de 16 caractères et ne doit pas contenir de caractères spéciaux');
                return;
            }
            const character = await addCharacter(characterData);
            socket.emit('registrationSuccess', character);
            console.log('Nouveau personnage créé avec succès :', characterData.name);
        } catch (err) {
            console.error('Erreur lors de la création du personnage :', err);
            socket.emit('errorMessage', 'Erreur lors de la création du personnage');
        }
    });

    socket.on('getGold', async (characterId) => {
        try {
            const gold = await db.collection('golds').findOne({ playerId: characterId });
            socket.emit('gold', gold);
            console.log('Or récupéré avec succès pour le joueur :', characterId);
        } catch (err) {
            console.error('Erreur lors de la récupération de l\'or :', err);
            socket.emit('errorMessage', 'Erreur lors de la récupération de l\'or');
        }
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
                { id: 1, name: 'Épée en bois', type: 'weapon', damage: 5, onclick: 'equip', description: 'Une épée en bois basique' },
                { id: 2, name: 'Potion de soin', type: 'potion', heal: 10, onclick: 'consume', description: 'Une potion de soin basique' },
            ];
            await db.collection('inventories').insertOne({ playerId: characterId, items: startingItems });
            socket.emit('startingItemsGiven', startingItems);
        } catch (err) {
            console.error('Erreur lors de l\'ajout des objets de départ :', err);
            socket.emit('errorMessage', 'Erreur lors de l\'ajout des objets de départ');
        }
    });

    socket.on('giveStartingGold', async (characterId) => {
        try {
            await db.collection('golds').insertOne({ playerId: characterId, amount: 100 });
            socket.emit('startingGoldGiven', 100);
        } catch (err) {
            console.error('Erreur lors de l\'ajout de l\'or de départ :', err);
            socket.emit('errorMessage', 'Erreur lors de l\'ajout de l\'or de départ');
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
});

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