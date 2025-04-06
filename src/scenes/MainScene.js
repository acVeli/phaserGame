import BaseScene from './BaseScene';
import Chat from '../components/Chat';
import Inventory from '../components/Inventory';
import PlayerNameContainer from '../components/PlayerNameContainer';
import SocketService from '../services/SocketService';
import { PLAYER_CONFIG, UI_CONFIG } from '../config/gameConfig';

class MainScene extends BaseScene {
    constructor() {
        super({ key: 'MainScene' });
        this.lastForcedUpdate = 0;
        this.players = {};
    }

    init(data) {
        this.playerName = data.playerName;
        this.characterId = data.characterId;
        this.playerLevel = data.level || 1;
        this.registered = data.registered || false;
        this.loggedIn = data.loggedIn || false;
        this.playerGold = 0;
        this.moving = false;
        this.targetX = 0;
        this.targetY = 0;
        this.speed = PLAYER_CONFIG.speed;
    }

    preload() {
        this.loadAssets();
    }

    create() {
        this.initSocket();
        this.createWorld();
        this.setupPlayer();
        this.setupUI();
        this.setupSocketListeners();
        this.setupInputEvents();
        this.playMusic();
    }

    loadAssets() {
        this.load.image('background', 'assets/img/maps/background.png');
        this.load.image('ground', 'platform.png');
        this.load.image('send-icon', 'assets/img/icons/send_message.png');
        this.load.image('scroll-icon', 'assets/img/icons/scroll.png');
        this.load.image('gold_pouch', 'assets/img/icons/gold_pouch.png');
        this.load.spritesheet('dude', 'https://examples.phaser.io/assets/sprites/dude.png', {
            frameWidth: 32,
            frameHeight: 48
        });
        this.load.audio('backgroundMusic', ['assets/sounds/background.mp3']);
        this.loadGameItems();
    }

    loadGameItems() {
        SocketService.socket.emit('getGameItems');
        SocketService.socket.on('gameItems', (gameItems) => {
            gameItems.forEach(item => {
                this.load.image('item'+item.id, `assets/img/items/${item.id}.jpg`);
            });
        });
    }

    createWorld() {
        this.add.image(640, 360, 'background');
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(640, 720, 'ground').setScale(2).refreshBody();
    }

    setupPlayer() {
        SocketService.socket.emit('getPlayerPosition', this.characterId);
        SocketService.socket.on('playerPosition', (playerPosition) => {
            if (playerPosition) {
                this.initializePlayer(playerPosition.x, playerPosition.y);
            } else {
                this.initializePlayer(PLAYER_CONFIG.startPosition.x, PLAYER_CONFIG.startPosition.y);
            }
        });
    }

    setupUI() {
        this.chat = new Chat(this, UI_CONFIG.chat);
        this.inventory = new Inventory(this, this.characterId);
        this.cursorText = this.add.text(10, 10, '', {
            font: '16px Courier',
            fill: '#000000'
        });
    }

    setupSocketListeners() {
        SocketService.onPlayerJoined(playerData => this.addNewPlayerToGame(playerData));
        SocketService.onPlayerLeft(characterId => this.removePlayerFromGame(characterId));
        SocketService.socket.on('gold', gold => {
            this.playerGold = gold.amount;
            if (this.inventory.isActive) {
                this.inventory.updateGoldDisplay();
            }
        });

        SocketService.socket.emit('requestAllPlayers');
        SocketService.socket.emit('getLastMessages');
        SocketService.socket.emit('getGold', this.characterId);

        SocketService.socket.on('allPlayers', players => {
            players.forEach(playerData => {
                if (playerData.id !== this.characterId) {
                    this.addNewPlayerToGame(playerData);
                }
            });
        });
    }

    setupInputEvents() {
        this.input.on('pointerdown', (pointer) => {
            this.targetX = pointer.x;
            this.targetY = pointer.y;
            this.moving = true;
        });
    }

    initializePlayer(x, y) {
        this.player = this.physics.add.sprite(x, y, 'dude');
        this.player.setCollideWorldBounds(false);
        this.physics.add.collider(this.player, this.platforms);
        
        this.playerNameContainer = new PlayerNameContainer(
            this,
            x,
            y,
            this.playerName,
            this.playerLevel
        );

        if (this.registered) {
            SocketService.socket.emit('Registered', this.characterId, this.playerName, x, y, this.playerLevel);
        } else if (this.loggedIn) {
            SocketService.socket.emit('LoggedIn', this.characterId, this.playerName, x, y, this.playerLevel);
        }
    }

    addNewPlayerToGame(playerData) {
        if (this.players[playerData.id]) {
            this.updatePlayerInGame(playerData);
            return;
        }

        const sprite = this.physics.add.sprite(
            playerData.x || PLAYER_CONFIG.startPosition.x,
            playerData.y || PLAYER_CONFIG.startPosition.y,
            'dude'
        );
        sprite.playerId = playerData.id;

        const nameContainer = new PlayerNameContainer(
            this,
            playerData.x,
            playerData.y,
            playerData.name,
            playerData.level
        );

        this.players[playerData.id] = {
            sprite,
            nameContainer,
            playerId: playerData.id
        };
    }

    updatePlayerInGame(playerData) {
        const player = this.players[playerData.id];
        if (player) {
            player.name = playerData.name;
            player.sprite.setPosition(playerData.x, playerData.y);
            player.nameContainer.setPosition(playerData.x, playerData.y);
        } else {
            this.addNewPlayerToGame(playerData);
        }
    }

    removePlayerFromGame(characterId) {
        const player = this.players[characterId];
        if (player) {
            player.sprite.destroy();
            player.nameContainer.destroy();
            delete this.players[characterId];
        }
    }

    playMusic() {
        const music = this.sound.add('backgroundMusic');
        music.play({ loop: true, volume: 0.025 });
    }

    update() {
        this.updateCursorPosition();
        this.updatePlayerMovement();
        this.updateOtherPlayers();
    }

    updateCursorPosition() {
        if (this.cursorText) {
            const pointer = this.input.activePointer;
            this.cursorText.setText(`X: ${pointer.worldX} Y: ${pointer.worldY}`);
        }
    }

    updatePlayerMovement() {
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
                this.playerNameContainer.setPosition(this.player.x, this.player.y);
            }

            SocketService.updatePlayerPosition({
                id: this.characterId,
                x: this.player.x,
                y: this.player.y,
                name: this.playerName
            });
        }
    }

    updateOtherPlayers() {
        Object.values(this.players).forEach(player => {
            if (player.nameContainer && player.sprite) {
                player.nameContainer.setPosition(player.sprite.x, player.sprite.y);
            }
        });
    }
}

export default MainScene; 