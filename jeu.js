const port = 3000;

let numberOfPlayers = 1;
let players = {};

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update,
    }
};

const game = new Phaser.Game(config);

let player;
let targetX, targetY;
let moving = false;
const speed = 160; // Vitesse du personnage

const socket = io('http://localhost:' + port);

socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
});

socket.on("connect", () => {
    console.log('Connecté au serveur');
});

function preload() {
    this.load.image('background', 'background.png');
    this.load.image('ground', 'https://examples.phaser.io/assets/sprites/platform.png');
    this.load.image('star', 'https://examples.phaser.io/assets/sprites/star.png');
    this.load.spritesheet('dude', 'https://examples.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create() {

    // Ajoute l'image de fond
    this.add.image(640, 360, 'background');

    const platforms = this.physics.add.staticGroup(); // Crée un groupe de plateformes statiques
    // Créer une plateforme non traversable
    platforms.create(640, 720, 'ground').setScale(2).refreshBody();

    player = this.physics.add.sprite(688, 231, 'dude');
    socket.emit('newPlayer', {
        x: 688,
        y: 231,
        // autres données du personnage
    });

    player.setCollideWorldBounds(false); // Désactive la collision avec les bords du monde
    this.physics.add.collider(player, platforms); // Active la collision entre le joueur et les plateformes

    this.input.on('pointerdown', function (pointer) {
        targetX = pointer.x;
        targetY = pointer.y;
        moving = true;
    });

    cursorText = this.add.text(10, 10, '', { font: '16px Courier', fill: '#000000' });

    // Quand un nouveau joueur rejoint
    socket.on('playerJoined', (playerData) => {
        numberOfPlayers++;
        this.addNewPlayerToGame(playerData);
    });

    // Quand un joueur quitte
    socket.on('playerLeft', (playerId) => {
        this.removePlayerFromGame(playerId);
    });

    // Quand un joueur est mis à jour
    socket.on('playerUpdated', (playerData) => {
        this.updatePlayerInGame(playerData);
        if (players[playerData.id]) {
            players[playerData.id].setPosition(playerData.x, playerData.y);
        }
    });
}

function update() {
    const pointer = this.input.activePointer;
    cursorText.setText(`X: ${pointer.worldX} Y: ${pointer.worldY}`);

    if (moving) {
        const distanceX = targetX - player.x;
        const distanceY = targetY - player.y;

        const angle = Math.atan2(distanceY, distanceX);
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;

        player.setVelocity(velocityX, velocityY);

        if (Math.abs(distanceX) < 4 && Math.abs(distanceY) < 4) {
            player.setVelocity(0, 0);
            player.x = targetX;
            player.y = targetY;
            moving = false;

            // Sauvegarde de la position du joueur vers le backend
            fetch('http://localhost:' + port + '/savePlayerPosition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ x: player.x, y: player.y }),
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erreur lors de la sauvegarde de la position du joueur');
                    }
                    return response.text();
                })
                .then(data => {
                    console.log('Position du joueur sauvegardée avec succès:', data);
                })
                .catch(error => {
                    console.error('Erreur:', error);
                });
        }

        socket.emit('updatePlayer', {
            id: player.playerId,
            x: player.x,
            y: player.y
        });

    }
}

Phaser.Scene.prototype.addNewPlayerToGame = function (playerData) {
    // Create a new player sprite
    const newPlayer = this.physics.add.sprite(playerData.x, playerData.y, 'dude');
    console.log(players);
    // Set the player's properties based on playerData
    newPlayer.setTint(playerData.color);
    newPlayer.playerId = playerData.id;

    // Add the new player to the players object
    players[playerData.id] = newPlayer;
};

Phaser.Scene.prototype.removePlayerFromGame = function (playerId) {
    if (players[playerId]) {
        players[playerId].destroy();
        delete players[playerId];
    }
};

Phaser.Scene.prototype.updatePlayerInGame = function (playerData) {
    if (players[playerData.id]) {
        players[playerData.id].x = playerData.x;
        players[playerData.id].y = playerData.y;
    }
};

