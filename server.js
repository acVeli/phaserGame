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
const { MongoClient, ObjectId } = require('mongodb');
const { get } = require('http');

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

const players = new Map();

io.on('connection', (socket) => {
    numberOfPlayers++;
    console.log(`Un joueur s'est connecté, nombre de joueurs: ${numberOfPlayers}`);
    socket.on('newPlayer', async (playerData) => {
      try {
        const characterId = await addCharacter({ name: playerData.name });
        playerData.characterId = characterId;
        players.set(socket.id, playerData);
        socket.broadcast.emit('playerJoined', { id: socket.id, ...playerData });
        
        players.forEach((data, playerId) => {
          if (playerId !== socket.id) {
            socket.emit('playerJoined', { id: playerId, ...data });
          }
        });
      } catch (err) {
        console.error('Erreur lors de la création du personnage :', err);
      }
    });
  
    socket.on('disconnect', () => {
        numberOfPlayers--;
        console.log(`Un joueur s'est déconnecté, nombre de joueurs: ${numberOfPlayers}`);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
  
    socket.on('updatePlayer', (playerData) => {
      const existingPlayer = players.get(socket.id) || {};
      players.set(socket.id, { ...existingPlayer, ...playerData });
      socket.broadcast.emit('playerUpdated', { id: socket.id, ...playerData });
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
    return result.insertedId;
  } catch (err) {
    console.error('Erreur lors de l\'ajout du personnage :', err);
    throw err;
  }
}

app.post('/createCharacter', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).send('Le nom du personnage est requis');
    }
    const characterId = await addCharacter({ name });
    res.status(201).json({ message: 'Personnage créé avec succès', characterId , name });
  } catch (err) {
    res.status(500).send('Erreur lors de la création du personnage');
  }
});

// Endpoint pour sauvegarder la position du joueur
app.post('/savePlayerPosition', async (req, res) => {
    const { x, y, characterId } = req.body;
    try {
        await db.collection('playerPositions').updateOne(
            { playerId: characterId },
            { $set: { x, y } },
            { upsert: true }
        );
        res.send(`Position du joueur sauvegardée avec succès: x=${x}, y=${y}`);
    } catch (err) {
        console.error('Erreur lors de la sauvegarde de la position:', err);
        res.status(500).send('Erreur lors de la sauvegarde de la position');
    }
});

app.get('/getPlayerPosition/:id', async (req, res) => {
    const characterId = req.params.id;
    try {
        const playerPosition = await db.collection('playerPositions').findOne({ playerId: characterId });
        if (!playerPosition) {
            return res.status(404).send('Position du joueur non trouvée');
        }
        res.json(playerPosition);
    } catch (err) {
        console.error('Erreur lors de la récupération de la position du joueur:', err);
        res.status(500).send('Erreur lors de la récupération de la position du joueur');
    }
});

app.get('/getCharacter/:name', async (req, res) => {
    const name = req.params.name;
    try {
        const character = await getCharacter(name);
        if (!character) {
            return res.status(404).send('Personnage non trouvé');
        }
        console.log('Personnage récupéré :', character);
        res.json(character);
    } catch (err) {
        console.error('Erreur lors de la récupération du personnage :', err);
        res.status(500).send('Erreur lors de la récupération du personnage');
    }
});

async function getCharacter(name) {
  try {
    const character = await db.collection('players').findOne({ name });
    return character;
  } catch (err) {
    console.error('Erreur lors de la récupération du personnage :', err);
    throw err;
  }
}

app.get('/checkName/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const character = await db.collection('players').findOne({ name });
    res.json({ exists: !!character });
  } catch (err) {
    res.status(500).send('Erreur lors de la vérification du nom');
  }
});

// Fonction pour démarrer le serveur
async function startServer() {
  try {
    ({ client: mongoClient, db } = await connectToMongo());
    
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