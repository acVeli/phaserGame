// LOGINSCENE

class LoginScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoginScene' });
    }

    create() {
        this.add.text(640, 200, 'Bienvenue sur Terzawa', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);

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
                socket.emit('checkNameForLogin', name);
                socket.on('nameCheckedForLogin', (isNameValid) => {
                    if (isNameValid) {
                        this.loginCharacter(name);
                    } else {
                        this.add.text(640, 500, 'Personnage non trouvé', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
                        this.add.text('Si vous n\'avez pas de personnage, veuillez en créer un.', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
                        const createButton = this.add.text(640, 550, 'Créer un personnage', { fontSize: '24px', fill: '#0f0' })
                            .setOrigin(0.5)
                            .setInteractive()
                            .on('pointerdown', () => {
                                this.createCharacter(name);
                            });
                    }
                });
            });
    }

    loginCharacter(name) {
        socket.emit('getCharacter', name);
        socket.on('character', (character) => {
            if (character) {
                this.scene.start('MainScene', { playerName: name, characterId: character._id, level: character.level, loggedIn: true });
                console.log('Personnage trouvé', character);
            } 
        });
    }

    createCharacter(name) {

        socket.emit('checkNameForRegister', name);

        socket.on('nameCheckedForRegister', (isNameValid) => {

            if(isNameValid) {
                socket.emit('createCharacter', { name: name });
                socket.on('registrationSuccess', (character) => {
                    if (!character) {
                        console.error('Erreur lors de la création du personnage');
                        this.add.text(640, 500, 'Erreur lors de la création du personnage', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
                        return;
                    }
                    socket.emit('giveStartingItems', character.insertedId);
                    console.log('Personnage créé:', character);
                    this.scene.start('MainScene', { playerName: name, characterId: character.insertedId, level: 1, registered: true });
                });
            } else {
                console.error('Le nom de personnage est déjà utilisé ou invalide');
                this.add.text(640, 500, 'Le nom de personnage est déjà utilisé ou invalide', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
                this.add.text(640, 550, 'Entrez un autre nom et veuillez ne pas utiliser d\'espace ou de caractères spéciaux.', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
                this.add.text(640, 600, 'Le nom doit être composé de 1 à 16 caractères alphanumériques.', { fontSize: '24px', fill: '#f00' }).setOrigin(0.5);
            }
        });
    }
}


//MAINSCENE

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.lastForcedUpdate = 0;
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
        this.registered = data.registered || false;
        this.loggedIn = data.loggedIn || false;
        console.log('MainScene initialized with', data);
        this.playerInventory = [];
        this.isChatActive = false;
        this.isInventoryActive = false;
        this.playerLevel = data.level || 1;
    }

    preload() {
        this.load.image('background', 'assets/img/maps/background.png');
        this.load.image('ground', 'platform.png');
        this.load.image('send-icon', 'assets/img/icons/send_message.png', { frameWidth: 50, frameHeight: 50  });
        this.load.image('scroll-icon', 'scroll.png');
        this.load.spritesheet('dude', 'https://examples.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
        this.loadGameItems();
        this.load.audio('backgroundMusic', [ 'assets/sounds/background.mp3' ]);
    }

    loadGameItems() {
        socket.emit('getGameItems');
        socket.on('gameItems', (gameItems) => {
            console.log('Objets de jeu:', gameItems);
            gameItems.forEach(item => {
                this.load.image('item'+item.id, `assets/img/items/${item.id}.jpg`);
            });
        });
    }

    create() {
        this.add.image(640, 360, 'background');

        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(640, 720, 'ground').setScale(2).refreshBody();

        socket.emit('getPlayerPosition', this.characterId);
        socket.on('playerPosition', (playerPosition) => {
            if (playerPosition) {
                this.initializePlayer(playerPosition.x, playerPosition.y);
            } else {
                this.initializePlayerWithDefaultPosition();
            }
        });
        this.setupChat();
        this.setupInputEvents(); 
        this.setupSocketEvents();
        this.setupPlayerInventory();
        this.playMusic();

        this.cursorText = this.add.text(10, 10, '', { font: '16px Courier', fill: '#000000' });
    }

    playMusic() {
        const music = this.sound.add('backgroundMusic');
        music.play({ loop: true, volume: 0.025 });
    }

    initializePlayer(x, y) {
        this.player = this.physics.add.sprite(x, y, 'dude');
        this.player.x = x;
        this.player.y = y;
        this.player.setCollideWorldBounds(false);
        this.physics.add.collider(this.player, this.platforms);
        this.createPlayerNameContainer();
        socket.emit('addPlayerToPlayerList', {
            id: this.characterId,
            x: this.player.x,
            y: this.player.y,
            name: this.playerName,
            level: this.playerLevel
        });
        this.initializeGameElements(this.player);
    }

    initializePlayerWithDefaultPosition() {
        this.initializePlayer(688, 231);
    }

    createPlayerNameContainer() {
        this.playerNameContainer = this.add.container(this.player.x, this.player.y - 40);
        const textBg = this.add.rectangle(0, 0, 0, 20, 0x333333);
        textBg.setAlpha(0.7);
        this.playerNameText = this.add.text(0, 0, this.playerName +' '+'Lvl: '+this.playerLevel, { 
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

    initializeGameElements(playerData) {
        this.joinGame(playerData);
    }

    setupPlayerInventory() {
        const inventoryContainer = this.add.container(640, 360);
        const inventoryBackground = this.add.rectangle(0, 0, 450, 400, 0x333333);
        inventoryBackground.setAlpha(0.8);
        inventoryContainer.add(inventoryBackground);
        inventoryContainer.setVisible(false);
        inventoryContainer.setDepth(1);
    
        const title = this.add.text(0, -170, 'Inventaire', { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#ffffff' 
        });
        title.setOrigin(0.5);
        inventoryContainer.add(title);
    
        const inventorySlots = [];
        const slotSize = 65;
        const padding = 10;
        const cols = 5;
        const rows = 4;
    
        const startY = -120;
    
        for (let i = 0; i < cols * rows; i++) {
            const x = ((i % cols) - Math.floor(cols/2)) * (slotSize + padding);
            const y = startY + (Math.floor(i / cols)) * (slotSize + padding);
            
            const slot = this.add.rectangle(x, y, slotSize, slotSize, 0x666666);
            slot.setStrokeStyle(2, 0x999999);
            inventoryContainer.add(slot);
            inventorySlots.push(slot);
        }
    
        // Création de la fenêtre modale
        const modalContainer = this.add.container(640, 360);
        modalContainer.setDepth(2);
        modalContainer.setVisible(false);
    
        const modalBackground = this.add.rectangle(0, 0, 200, 100, 0x000000);
        modalBackground.setAlpha(0.8);
        modalContainer.add(modalBackground);
    
        const modalText = this.add.text(0, 0, '', { 
            fontFamily: 'Arial', 
            fontSize: 16, 
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 180 }
        });
        modalText.setOrigin(0.5);
        modalContainer.add(modalText);
    
        socket.emit('getInventory', this.characterId);
        socket.on('inventory', (inventory) => {
            console.log('Inventaire du joueur:', inventory);
            this.playerInventory = inventory;
            this.displayInventoryItems(inventorySlots, inventory, modalContainer, modalText);
        });
    
        this.displayInventoryItems = (slots, items, modalContainer, modalText) => {
            let characterItems = items.items;
            const slotsNeeded = characterItems.length;
            console.log('Affichage des objets de l\'inventaire:', items);
            for(let i = 0; i < slotsNeeded; i++) {
                const item = characterItems[i];
                const slot = slots[i];
                const itemSprite = this.add.image(slot.x, slot.y, 'item' + item.id);
                itemSprite.setDisplaySize(slotSize, slotSize);
                inventoryContainer.add(itemSprite);
    
                // Ajout des interactions pour le survol
                itemSprite.setInteractive();
                itemSprite.on('pointerover', () => {
                    console.log(item);
                    modalText.setText(`${item.name}\n\n${item.description}`);
                    modalContainer.setPosition(itemSprite.x + inventoryContainer.x + 130, itemSprite.y + inventoryContainer.y);
                    modalContainer.setVisible(true);
                });
                itemSprite.on('pointerout', () => {
                    modalContainer.setVisible(false);
                });
            }
        }
    
        this.toggleInventory = () => {
            this.isInventoryActive = !this.isInventoryActive;
            inventoryContainer.setVisible(this.isInventoryActive);
            if (this.isInventoryActive) {
                this.displayInventoryItems(inventorySlots, this.playerInventory, modalContainer, modalText);
            } else {
                inventoryContainer.list.forEach(child => {
                    if (child instanceof Phaser.GameObjects.Image || 
                        (child instanceof Phaser.GameObjects.Text && child !== title && child !== closeButton)) {
                        child.destroy();
                    }
                });
                modalContainer.setVisible(false);
            }
            console.log('état de l\'inventaire:', this.isInventoryActive);
        }
    
        const closeButton = this.add.text(200, -170, 'X', { 
            fontFamily: 'Arial', 
            fontSize: 20, 
            color: '#ffffff' 
        });
        closeButton.setInteractive();
        closeButton.on('pointerdown', this.toggleInventory);
        inventoryContainer.add(closeButton);
    }

    setupChat() {
        const chatBoxWidth = 300;
        const chatBoxHeight = 200;
        const padding = 10;
        const inputHeight = 30;
    
        // Chat box background
        const chatBox = this.add.rectangle(padding, this.game.config.height - padding, chatBoxWidth, chatBoxHeight, 0x333333)
            .setOrigin(0, 1)
            .setAlpha(0.7);
    
        // Messages container
        const messagesContainerHeight = chatBoxHeight - inputHeight - padding * 3;
        const chatMessagesContainer = this.add.container(padding, this.game.config.height - chatBoxHeight - padding);
        const mask = this.add.graphics()
            .fillRect(padding, this.game.config.height - chatBoxHeight - padding, chatBoxWidth - padding * 2, messagesContainerHeight);
        chatMessagesContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, mask));
    
        const chatMessages = this.add.text(0, 0, '', {
            font: '14px Arial',
            fill: '#ffffff',
            wordWrap: { width: chatBoxWidth - padding * 2 },
            padding: { x: 5, y: 5 }
        });
        chatMessagesContainer.add(chatMessages);
    
        // Scroll icon
        const scrollIcon = this.add.image(
            chatBox.x + chatBoxWidth - padding - 15, 
            chatBox.y - padding - 15, // Initialement en bas à droite
            'scroll-icon'
        )
        .setOrigin(0.5)
        .setAlpha(0.7)
        .setScale(0.4)
        .setScrollFactor(0)
        .setVisible(false);

        const updateScrollIconPosition = () => {
            if (chatMessages.height > messagesContainerHeight) {
                const scrollPercentage = Math.abs(chatMessages.y) / (chatMessages.height - messagesContainerHeight);
                const iconY = chatBox.y - chatBoxHeight + padding + 15 + scrollPercentage * (messagesContainerHeight - 30);
                scrollIcon.setPosition(scrollIcon.x, iconY);
            } else {
                scrollIcon.setPosition(scrollIcon.x, chatBox.y - padding - 15);
            }
        };
    
        const updateScrollIconVisibility = () => {
            const isVisible = chatMessages.height > messagesContainerHeight;
            scrollIcon.setVisible(isVisible);
            if (isVisible) {
                updateScrollIconPosition();
            }
        };
    
        // Chat input
        const chatInput = this.add.text(padding, this.game.config.height - inputHeight - padding * 2, '', {
            font: '14px Arial',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 5 },
            fixedWidth: chatBoxWidth - padding * 2 - 30  // Espace pour l'icône d'envoi
        }).setOrigin(0, 0);
    
        let currentInput = '';

        let isChatActive = false;

        const toggleChat = () => {
            this.isChatActive = !this.isChatActive;
            chatInput.setBackgroundColor(this.isChatActive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)');
        };
    
        this.input.keyboard.on('keydown', (event) => {
            if (event.key === 'Enter') {
                if (!this.isChatActive) {
                    toggleChat(); // Activer le chat
                } else {
                    if (currentInput) {
                        this.sendChatMessage(currentInput, this.playerName);
                        currentInput = '';
                        chatInput.setText('');
                    }
                    toggleChat(); // Désactiver le chat après l'envoi
                }

            } else if (this.isChatActive) {
                if (event.key === 'Backspace' && currentInput.length > 0) {
                    currentInput = currentInput.slice(0, -1);
                } else if (event.key.length === 1) {
                    currentInput += event.key;
                }
                chatInput.setText(currentInput);
            } else if (event.key === 'i' && !this.isChatActive) {
                this.toggleInventory();
            }
        });

        const sendIcon = this.add.image(295, 700, 'send-icon')
            .setScale(0.5)
            .setOrigin(0.5, 0.75)
            .setInteractive()
            .on('pointerdown', () => {
                if (currentInput) {
                    this.sendChatMessage(currentInput, this.playerName);
                    currentInput = '';
                    chatInput.setText('');
                    toggleChat();
                }
            });
    
            this.addChatMessage = (message, playerName) => {

            const newMessage = `${playerName}: ${message}\n`;
            const currentMessages = chatMessages.text.split('\n');
            
            if (currentMessages.length >= 20) {
                currentMessages.shift();
            }
            currentMessages.push(newMessage.trim());
            
            chatMessages.setText(currentMessages.join('\n'));
    
            if (chatMessages.height > messagesContainerHeight) {
                chatMessages.y = messagesContainerHeight - chatMessages.height;
            }
    
            updateScrollIconVisibility();
        };
    
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (chatMessages.height > messagesContainerHeight) {
                chatMessages.y -= deltaY;
                chatMessages.y = Phaser.Math.Clamp(chatMessages.y, messagesContainerHeight - chatMessages.height, 0);
                updateScrollIconPosition();
            }
        });
    
    
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
            console.log(`Enregistrement réussi pour ${data.name} avec l'ID de personnage ${data._id}`);
            this.joinGame();
        });

        socket.on('errorMessage', (error) => {
            console.error('Erreur', error);
        });

        socket.on('playerLeft', (characterId) => {
            this.removePlayerFromGame(characterId);
        });

        socket.on('playerMoved', (playerData) => {
            console.log('Player moved:', playerData);
            this.updatePlayerInGame(playerData);
        });

        socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            this.addNewPlayerToGame(playerData);
        });

        socket.emit('requestAllPlayers');

        socket.on('allPlayers', (players) => {
            players.forEach(playerData => {
                if (playerData.id !== this.characterId) {
                    this.addNewPlayerToGame(playerData);
                }
            });
        });
    }
    
    joinGame(playerData) {
        console.log('Rejoindre le jeu');
        if(this.registered) {
            console.log(playerData);
            socket.emit('Registered', this.characterId, this.playerName, this.player.x, this.player.y, this.playerLevel);
            console.log('Enregistrement réussi, rejoindre le jeu');
        } else if(this.loggedIn) {
            console.log(playerData);
            socket.emit('LoggedIn', this.characterId, this.playerName, this.player.x, this.player.y, this.playerLevel);
            console.log('Connexion réussie, rejoindre le jeu');
        }
        console.log(this.playerName + ' a rejoint le jeu');
    }

    addNewPlayerToGame(playerData) {
        console.log('Adding new player:', playerData);
        if (this.players[playerData.id]) {
            console.log('Player already exists, updating instead');
            this.updatePlayerInGame(playerData);
            return;
        }
        const newPlayer = this.physics.add.sprite(playerData.x || 688, playerData.y || 231, 'dude');
        newPlayer.playerId = playerData.id;
        
        const nameContainer = this.createNameContainer(playerData.x, playerData.y, playerData.name, playerData.level);
        
        this.players[playerData.id] = { sprite: newPlayer, nameContainer: nameContainer, playerId: playerData.id };
    
        console.log(`Name container created for ${playerData.name} at (${playerData.x}, ${playerData.y - 40})`);
    }

    createNameContainer(x, y, name, level) {
        const container = this.add.container(x, y - 40);
        const textBg = this.add.rectangle(0, 0, 0, 20, 0x333333);
        textBg.setAlpha(0.7);
        const nameText = this.add.text(0, 0, name +' '+'Lvl: '+ level, { 
            font: '16px Arial', 
            fill: '#ffffff',
            padding: { x: 5, y: 2 }
        });
        nameText.setOrigin(0.5);
        textBg.width = nameText.width + 10; 
        textBg.setOrigin(0.5);
        container.add(textBg);
        container.add(nameText);
        console.log(`Name container for ${name} created with text: ${nameText.text}`);
        return container;
    }

    updatePlayerInGame(playerData) {
        console.log('Updating player:', playerData);
        if (this.players[playerData.id]) {
            const player = this.players[playerData.id];
            player.name = playerData.name;
            player.sprite.setPosition(playerData.x, playerData.y);
            player.nameContainer.setPosition(playerData.x, playerData.y - 40);
        } else {
            console.log('Player not found, adding new player');
            this.addNewPlayerToGame(playerData);
        }
    }

    removePlayerFromGame(characterId) {
        console.log('Removing player:', characterId);
        const playerToRemove = Object.values(this.players).find(player => player.playerId === characterId);
        if (playerToRemove) {
            playerToRemove.sprite.destroy();
            playerToRemove.nameContainer.destroy();
            delete this.players[characterId];
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
            }
            
            if (this.playerNameContainer) {
                this.playerNameContainer.setPosition(this.player.x, this.player.y - 40);
            }
            
            socket.emit('updatePlayer', {
                id: this.characterId,
                x: this.player.x,
                y: this.player.y,
                name: this.playerName
            });
            console.log('Envoi de la position du joueur au serveur');
        }

        if (this.player && (this.player.oldX !== this.player.x || this.player.oldY !== this.player.y)) {
            socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
            this.player.oldX = this.player.x;
            this.player.oldY = this.player.y;
        }

        Object.values(this.players).forEach(player => {
            if (player.nameContainer && player.sprite) {
                player.nameContainer.setPosition(player.sprite.x, player.sprite.y - 40);
            }
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

