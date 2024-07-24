class LoginScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoginScene' });
    }

    create() {
        this.add.text(640, 200, 'Bienvenue', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);

        const nameInput = this.add.dom(640, 300, 'input', {
            type: 'text',
            placeholder: 'Entrez votre nom',
            style: 'width: 200px; padding: 10px;'
        }).setOrigin(0.5);

        const playButton = this.add.text(640, 400, 'Jouer', { fontSize: '24px', fill: '#0f0' })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => {
                const name = nameInput.node.value;
                if (name) {
                    // check si le nom est déjà utilisé
                    fetch('http://localhost:3000/checkName/'+name, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }).then(response => {
                        if (!response.ok) {
                            throw new Error('Erreur lors de la vérification du nom');
                        }
                        return response.json();
                    }).then(data => {
                        if (data.exists) {
                            this.loginCharacter(name);
                        }
                        else {
                            this.createCharacter(name);
                        }
                    }).catch(error => {
                        console.error('Erreur:', error);
                        this.add.text(640, 450, 'Erreur: Impossible de vérifier le nom', { fontSize: '16px', fill: '#f00' }).setOrigin(0.5);
                    });

                } else {
                    this.add.text(640, 450, 'Veuillez entrer un nom', { fontSize: '16px', fill: '#f00' }).setOrigin(0.5);
                }
            });
    }

    loginCharacter(name) {
        fetch('http://localhost:3000/getCharacter/'+name, { method: 'GET' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du personnage');
            }
            return response.json();
        }).then(data => {
            console.log('Personnage récupéré:', data);
            this.scene.start('MainScene', { playerName: name, characterId: data._id });
        }).catch(error => {
            console.error('Erreur:', error);
            this.add.text(640, 450, 'Erreur: Impossible de récupérer le personnage', { fontSize: '16px', fill: '#f00' }).setOrigin(0.5);
        });
    }

    createCharacter(name) {
        fetch('http://localhost:3000/createCharacter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        }).then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors de la création du personnage');
            }
            return response.json();
        }).then(data => {
            this.scene.start('MainScene', { playerName: name, characterId: data.characterId });
        }).catch(error => {
            console.error('Erreur:', error);
            this.add.text(640, 450, 'Erreur: Impossible de créer le personnage', { fontSize: '16px', fill: '#f00' }).setOrigin(0.5);
        });
    }
}


class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    init(data) {
        this.playerName = data.playerName;
        this.characterId = data.characterId;
        this.player = null;
        this.targetX = 0;
        this.targetY = 0;
        this.moving = false;
        this.speed = 160;
        this.players = {};
        this.cursorText = null;
    }

    preload() {
        this.load.image('background', 'background.png');
        this.load.image('ground', 'https://examples.phaser.io/assets/sprites/platform.png');
        this.load.image('star', 'https://examples.phaser.io/assets/sprites/star.png');
        this.load.spritesheet('dude', 'https://examples.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        this.add.image(640, 360, 'background');

        const platforms = this.physics.add.staticGroup();
        platforms.create(640, 720, 'ground').setScale(2).refreshBody();

        //logique de vérification si x et y existent pour le joueur afin de charger son précedent emplacement sinon on charge les coordonnées par défaut
        fetch('http://localhost:3000/getPlayerPosition/'+this.characterId, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                this.player = this.physics.add.sprite(688, 231, 'dude');
                throw new Error('Erreur lors de la récupération de la position du joueur');
            }
            return response.json();
        })
        .then(data => {
            this.player = this.physics.add.sprite(data.x || 688, data.y || 231, 'dude');
            this.player.setCollideWorldBounds(false);
            this.physics.add.collider(this.player, platforms);
        });

        this.input.on('pointerdown', (pointer) => {
            this.targetX = pointer.x;
            this.targetY = pointer.y;
            this.moving = true;
        });

        this.cursorText = this.add.text(10, 10, '', { font: '16px Courier', fill: '#000000' });

        socket.emit('register', { name: this.playerName });

        socket.on('registrationSuccess', (data) => {
            console.log(`Enregistrement réussi pour ${data.name} avec l'ID de personnage ${data.characterId}`);
            this.joinGame();
        });

        socket.on('registrationError', (error) => {
            console.error('Erreur lors de l\'enregistrement:', error.message);
        });

        socket.on('playerJoined', (playerData) => {
            this.addNewPlayerToGame(playerData);
        });

        socket.on('playerLeft', (playerId) => {
            this.removePlayerFromGame(playerId);
        });

        socket.on('playerUpdated', (playerData) => {
            this.updatePlayerInGame(playerData);
        });
    }

    joinGame() {
        socket.emit('joinGame');
        socket.emit('newPlayer', {
            x: this.player.x,
            y: this.player.y,
            name: this.playerName
        });
    }

    update() {
        const pointer = this.input.activePointer;
        this.cursorText.setText(`X: ${pointer.worldX} Y: ${pointer.worldY}`);

        if (this.moving) {
            const distanceX = this.targetX - this.player.x;
            const distanceY = this.targetY - this.player.y;

            const angle = Math.atan2(distanceY, distanceX);
            const velocityX = Math.cos(angle) * this.speed;
            const velocityY = Math.sin(angle) * this.speed;

            this.player.setVelocity(velocityX, velocityY);

            if (Math.abs(distanceX) < 4 && Math.abs(distanceY) < 4) {
                this.player.setVelocity(0, 0);
                this.player.x = this.targetX;
                this.player.y = this.targetY;
                this.moving = false;

                this.savePlayerPosition(socket.id);
            }

            socket.emit('updatePlayer', {
                id: socket.id,
                x: this.player.x,
                y: this.player.y
            });
        }
    }

    savePlayerPosition(characterId) {
        fetch('http://localhost:3000/savePlayerPosition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ characterId: this.characterId, x: this.player.x, y: this.player.y }),
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

    addNewPlayerToGame(playerData) {
        const newPlayer = this.physics.add.sprite(playerData.x, playerData.y, 'dude');
        newPlayer.setTint(playerData.color);
        newPlayer.playerId = playerData.id;
        this.players[playerData.id] = newPlayer;
    }

    removePlayerFromGame(playerId) {
        if (this.players[playerId]) {
            this.players[playerId].destroy();
            delete this.players[playerId];
        }
    }

    updatePlayerInGame(playerData) {
        if (this.players[playerData.id]) {
            this.players[playerData.id].setPosition(playerData.x, playerData.y);
        }
    }
}


const port = 3000;

let numberOfPlayers = 0;
let players = {};

const socket = io('http://localhost:' + port);

socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
});

socket.on("connect", () => {
    console.log('Connecté au serveur');
    numberOfPlayers++;
});


const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    dom: {
        createContainer: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true
        }
    },
    scene: [LoginScene, MainScene]
};

const game = new Phaser.Game(config);

