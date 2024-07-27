// LOGINSCENE

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


//MAINSCENE

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
        this.playerNameText = null;
        this.platforms = null;
    }

    preload() {
        this.load.image('background', 'background.png');
        this.load.image('ground', 'https://examples.phaser.io/assets/sprites/platform.png');
        this.load.image('send-icon', 'path/to/your/send-icon.png');
        this.load.spritesheet('dude', 'https://examples.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        this.add.image(640, 360, 'background');

        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(640, 720, 'ground').setScale(2).refreshBody();

        this.loadPlayerPosition()
            .then(() => {
                this.initializeGameElements();
            })
            .catch(error => {
                console.error('Erreur lors du chargement de la position du joueur:', error);
                this.initializePlayerWithDefaultPosition();
            });

        this.setupChat();
        this.setupInputEvents();
        this.setupSocketEvents();

        this.cursorText = this.add.text(10, 10, '', { font: '16px Courier', fill: '#000000' });
    }

    loadPlayerPosition() {
        return fetch(`http://localhost:3000/getPlayerPosition/${this.characterId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.x !== undefined && data.y !== undefined) {
                this.initializePlayer(data.x, data.y);
            } else {
                this.initializePlayerWithDefaultPosition();
            }
        });
    }

    initializePlayer(x, y) {
        this.player = this.physics.add.sprite(x, y, 'dude');
        this.player.setCollideWorldBounds(false);
        this.physics.add.collider(this.player, this.platforms);
        this.createPlayerNameContainer();
    }

    initializePlayerWithDefaultPosition() {
        this.initializePlayer(688, 231);
    }

    createPlayerNameContainer() {
        this.playerNameContainer = this.add.container(this.player.x, this.player.y - 40);
        const textBg = this.add.rectangle(0, 0, 0, 20, 0x333333);
        textBg.setAlpha(0.7);
        this.playerNameText = this.add.text(0, 0, this.playerName, { 
            font: '16px Arial', 
            fill: '#ffffff',
            padding: { x: 5, y: 2 }
        });
        this.playerNameText.setOrigin(0.5);

        textBg.width = this.playerNameText.width + 10; 
        textBg.setOrigin(0.5);

        this.playerNameContainer.add(textBg);
        this.playerNameContainer.add(this.playerNameText);
    }

    initializeGameElements() {
        this.joinGame();
    }


    setupChat() {
        const chatBox = this.add.rectangle(10, 710, 300, 200, 0x333333);
        chatBox.setAlpha(0.7);
        chatBox.setOrigin(0, 1);

        const chatInput = this.add.text(15, 685, '', {
            font: '14px Arial',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 5 },
            fixedWidth: 270
        }).setOrigin(0, 0);

        let currentInput = '';
        let isChatActive = false;

        const toggleChat = () => {
            isChatActive = !isChatActive;
            chatInput.setBackgroundColor(isChatActive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)');
        };

        this.input.keyboard.on('keydown', (event) => {
            if (event.keyCode === 13) { // Touche Entrée
                if (!isChatActive) {
                    toggleChat(); // Activer le chat
                } else {
                    if (currentInput) {
                        this.sendChatMessage(currentInput, this.playerName);
                        currentInput = '';
                        chatInput.setText('');
                    }
                    toggleChat(); // Désactiver le chat après l'envoi
                }
            } else if (isChatActive) {
                if (event.keyCode === 8 && currentInput.length > 0) {
                    // Backspace - supprimer le dernier caractère
                    currentInput = currentInput.slice(0, -1);
                } else if (event.key.length === 1) {
                    // Ajouter le caractère tapé
                    currentInput += event.key;
                }
                
                // Mettre à jour le texte affiché
                chatInput.setText(currentInput);
            }
        });

        const sendIcon = this.add.image(285, 700, 'send-icon')
            .setScale(0.5)
            .setInteractive()
            .on('pointerdown', () => {
                if (currentInput) {
                    this.sendChatMessage(currentInput, this.playerName);
                    currentInput = '';
                    chatInput.setText('');
                    toggleChat(); // Désactiver le chat après l'envoi
                }
            });

        const chatMessages = this.add.text(15, 520, '', {
            font: '14px Arial',
            fill: '#ffffff',
            wordWrap: { width: 280 },
            padding: { x: 5, y: 5 }
        });

        this.addChatMessage = (message, playerName) => {
            chatMessages.text += `${playerName}: ${message}\n`;
            // Faire défiler vers le bas si nécessaire
        };

        socket.on('chat message', (msg, playerName) => {
            console.log('Message reçu:', msg + ' de ' + playerName);
            this.addChatMessage(msg, playerName);
        });
    }

    sendChatMessage(message, playerName) {
        socket.emit('chat message', message, playerName);
    }

    setupInputEvents() {
        this.input.on('pointerdown', (pointer) => {
            this.targetX = pointer.x;
            this.targetY = pointer.y;
            this.moving = true;
        });
    }

    setupSocketEvents() {
        socket.on('registrationSuccess', (data) => {
            console.log(`Enregistrement réussi pour ${data.name} avec l'ID de personnage ${data.characterId}`);
            this.joinGame();
        });

        socket.on('registrationError', (error) => {
            console.error('Erreur lors de l\'enregistrement:', error.message);
        });

        socket.on('currentPlayers', (players) => {
            console.log('Received current players:', players);
            Object.values(players).forEach((playerData) => {
                if (playerData.id !== socket.id) {
                    this.addNewPlayerToGame(playerData);
                }
            });
        });

        socket.on('playerJoined', (playerData) => {
            console.log('New player joined:', playerData);
            this.addNewPlayerToGame(playerData);
        });

        socket.on('playerLeft', (playerId) => {
            this.removePlayerFromGame(playerId);
        });

        socket.on('playerUpdated', (playerData) => {
            console.log('Player updated:', playerData);
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
        socket.emit('getCurrentPlayers');
    }

    addNewPlayerToGame(playerData) {
        console.log('Adding new player:', playerData);
        if (this.players[playerData.id]) {
            console.log('Player already exists, updating instead');
            this.updatePlayerInGame(playerData);
            return;
        }
        const newPlayer = this.physics.add.sprite(playerData.x, playerData.y, 'dude');
        newPlayer.playerId = playerData.id;
        
        const nameContainer = this.createNameContainer(playerData.x, playerData.y, playerData.name);
        
        this.players[playerData.id] = { sprite: newPlayer, nameContainer: nameContainer };
    }

    createNameContainer(x, y, name) {
        const container = this.add.container(x, y - 40);
        const textBg = this.add.rectangle(0, 0, 0, 20, 0x333333);
        textBg.setAlpha(0.7);
        const nameText = this.add.text(0, 0, name, { 
            font: '16px Arial', 
            fill: '#ffffff',
            padding: { x: 5, y: 2 }
        });
        nameText.setOrigin(0.5);
        textBg.width = nameText.width + 10; 
        textBg.setOrigin(0.5);
        container.add(textBg);
        container.add(nameText);
        return container;
    }

    updatePlayerInGame(playerData) {
        console.log('Updating player:', playerData);
        if (this.players[playerData.id]) {
            const player = this.players[playerData.id];
            player.sprite.setPosition(playerData.x, playerData.y);
            player.nameContainer.setPosition(playerData.x, playerData.y - 40);
        } else {
            console.log('Player not found, adding new player');
            this.addNewPlayerToGame(playerData);
        }
    }

    removePlayerFromGame(playerId) {
        console.log('Removing player:', playerId);
        if (this.players[playerId]) {
            this.players[playerId].sprite.destroy();
            this.players[playerId].nameContainer.destroy();
            delete this.players[playerId];
            socket.emit('playerLeft', playerId);
        }
    }

    update() {
        if (this.cursorText) {
            const pointer = this.input.activePointer;
            this.cursorText.setText(`X: ${pointer.worldX} Y: ${pointer.worldY}`);
        }

        if (this.moving && this.player) {
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
                
                this.savePlayerPosition();
            }
            
            if (this.playerNameContainer) {
                this.playerNameContainer.setPosition(this.player.x, this.player.y - 40);
            }
            
            socket.emit('updatePlayer', {
                id: socket.id,
                x: this.player.x,
                y: this.player.y
            });
        }

        if (this.player && (this.player.oldX !== this.player.x || this.player.oldY !== this.player.y)) {
            socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
            this.player.oldX = this.player.x;
            this.player.oldY = this.player.y;
        }
    }

    savePlayerPosition() {
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
}




//CONFIGURATION DU JEU

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

