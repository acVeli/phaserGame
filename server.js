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
  { id: 1, name: 'Épée en bois', type: 'weapon', damage: 5, onclick: 'equip', description : 'Une épée en bois basique'},
  { id: 2, name: 'Parchemin premium de tirage', type: 'draw', draw: 1, onclick: null, description : 'Un parchemin de tirage permettant de recruter un équipier de plus pour livrer bataille sur Terzawa'},
];

const gameRaces = [
  { id: 1, name: 'Teros'},
  { id: 2, name: 'Zaabo' },
  { id: 3, name: 'Wabocel' }
];

const gameRacesBaseStats = [
  //Teros
  { id: 1, raceId: 1, statId: 1, value: 10 }, //Force
  { id: 2, raceId: 1, statId: 2, value: 5 }, //Agilité
  { id: 3, raceId: 1, statId: 3, value: 5 }, //Spiritualité
  { id: 4, raceId: 1, statId: 4, value: 8 }, //Endurance
  { id: 5, raceId: 1, statId: 5, value: 5 }, //Vitesse
  //total 33
  //Zaabo
  { id: 6, raceId: 2, statId: 1, value: 5 }, //Force
  { id: 7, raceId: 2, statId: 2, value: 8 }, //Agilité
  { id: 8, raceId: 2, statId: 3, value: 8 }, //Spiritualité
  { id: 9, raceId: 2, statId: 4, value: 5 }, //Endurance
  { id: 10, raceId: 2, statId: 5, value: 7 }, //Vitesse
  //total 33
  //Wabocel
  { id: 11, raceId: 3, statId: 1, value: 8 }, //Force
  { id: 12, raceId: 3, statId: 2, value: 4 }, //Agilité
  { id: 13, raceId: 3, statId: 3, value: 8 },  //Spiritualité
  { id: 14, raceId: 3, statId: 4, value: 8 },  //Endurance
  { id: 15, raceId: 3, statId: 5, value: 5 }, //Vitesse
  //total 33
];

const gameCharacterStats = [
  { id: 1, name: 'Force' }, // augmente les degats physiques et l'armure physique
  { id: 2, name: 'Agilité'}, // augmente le vol de vie et la chance de coup critique
  { id: 3, name: 'Spiritualité' }, // augmente les dégats magiques et la résistance magique
  { id: 4, name: 'Endurance' }, // augmente les points de vie et l'apport d'hp par les soins
  { id: 5, name: 'Vitesse' }, // augmente la rapidité de coup et l'augmentation de la jauge de compétence
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

async function insertRaces(gameRaces){
  const races = await db.collection('races').find().toArray();
  if(races.length === 0){
    await db.collection('races').insertMany(gameRaces);
  }else{
    await db.collection('races').deleteMany({});
    await db.collection('races').insertMany(gameRaces);
  }
}

async function insertRacesBaseStats(gameRacesBaseStats){
  const baseStats = await db.collection('racesBaseStats').find().toArray();
  if(baseStats.length === 0){
    await db.collection('racesBaseStats').insertMany(gameRacesBaseStats);
  }else{
    await db.collection('racesBaseStats').deleteMany({});
    await db.collection('racesBaseStats').insertMany(gameRacesBaseStats);
  }
}

async function insertCharacterStats(gameCharacterStats){
  const stats = await db.collection('gameStats').find().toArray();
  if(stats.length === 0){
    await db.collection('gameStats').insertMany(gameCharacterStats);
  }else{
    await db.collection('gameStats').deleteMany({});
    await db.collection('gameStats').insertMany(gameCharacterStats);
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

    socket.on('LoggedIn', (playerId, playerName, playerX, playerY, playerRace, playerLevel ) => {
      console.log('LoggedIn', playerId, playerName, playerX, playerY);
      socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY, race: playerRace, level: playerLevel });
    });

    socket.on('Registered', (playerId, playerName, playerX, playerY, playerRace, playerLevel) => {
      console.log('Registered', playerId, playerName, playerX, playerY, playerRace, playerLevel);
      socket.broadcast.emit('playerJoined', { id: playerId, name: playerName, x: playerX, y: playerY, race: playerRace, level: playerLevel });
    });

    socket.on('requestAllPlayers', () => {
      const allPlayers = Array.from(players.values()).map(player => ({
          id: player.id,
          x: player.x,
          y: player.y,
          name: player.name,
          race: player.race,
          level: player.level
      }));
      console.log('requestAllPlayers', allPlayers);
      socket.emit('allPlayers', allPlayers);
    });

    socket.on('getLastMessages', async () => {
      try {
          const messages = await db.collection('messages').find().sort({ timestamp: -1 }).limit(10).toArray();
          socket.emit('lastMessages', messages.reverse());
      } catch (err) {
          console.error('Erreur lors de la récupération des derniers messages :', err);
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
        
        //envoyer les nouvelles données du joueur à tous les clients
        socket.broadcast.emit('playerMoved', { id: socket.id, ...playerData });

        //mettre à jour les données du joueur dans le serveur
        players.set(socket.id, { ...players.get(socket.id), ...playerData });
        
        //mettre à jour la position du joueur dans la base de données
        db.collection('playerPositions').updateOne(
            { playerId: playerData.id },
            { $set: { playerId: playerData.id, x: playerData.x, y: playerData.y } },
            { upsert: true }
        );
    });

    socket.on('checkNameForRegister'  , async (name) => {
      // Vérifier si le nom est déjà utilisé
      const character = await getCharacter(name);
      // Vérifier si le nom rentre dans le regex ^[a-zA-Z0-9]{1,16}$
      const regex = /^[a-zA-Z0-9]{1,16}$/;
      const validName = regex.test(name);
      if(!character && validName) {
        socket.emit('nameCheckedForRegister', true);
      } else {
        socket.emit('nameCheckedForRegister', false);
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

    socket.on('createCharacter', async (characterData) => {
      try {
        const regex = /^[a-zA-Z0-9]{1,16}$/;
        const validName = regex.test(characterData.name);
        //const race doit donner l'id de la race dans la collection raceGame en fonction du name
        const race = await db.collection('races').findOne({ name: characterData.race });
        characterData.race = race.id;
        if (!characterData.name) {
          socket.emit('errorMessage', 'Le nom du personnage est requis');
          return;
        }else if(characterData.name.length > 16 && !validName){
          socket.emit('errorMessage', 'Le nom du personnage doit contenir moins de 16 caractères et ne doit pas contenir de caractères spéciaux');
          return;
        }else if (!characterData.race) {
          socket.emit('errorMessage', 'La race du personnage est requise');
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
        { id: 2,name: 'Potion de soin', type: 'potion', heal: 10, onclick: 'consume', description: 'Une potion de soin basique' },
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

});

async function addCharacter(characterData) {
  try {
    const newCharacter = {
      name: characterData.name,
      raceId: characterData.race,
      level: 1, // On commence au niveau 1 par défaut
      createdAt: new Date()
    };
    
    const result = await db.collection('players').insertOne(newCharacter);
    
    console.log(`Nouveau personnage ajouté avec l'ID : ${result.insertedId} et le nom : ${characterData.name}`);
    
    // Retourner l'objet complet du personnage, y compris l'ID généré
    return { ...newCharacter, _id: result.insertedId };
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
    await insertRaces(gameRaces);
    await insertRacesBaseStats(gameRacesBaseStats);
    await insertCharacterStats(gameCharacterStats);
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