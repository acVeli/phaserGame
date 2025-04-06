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

        // Initialisation des contrôles du clavier
        this.cursors = this.input.keyboard.createCursorKeys();
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
        // Écoute des nouveaux joueurs
        SocketService.onPlayerJoined(playerData => {
            console.log('Nouveau joueur connecté:', playerData);
            if (playerData.id !== this.characterId) {
                this.addNewPlayerToGame(playerData);
            }
        });

        // Écoute des déconnexions
        SocketService.onPlayerLeft(characterId => {
            console.log('Joueur déconnecté:', characterId);
            this.removePlayerFromGame(characterId);
        });
        
        // Écoute des mises à jour de position
        SocketService.onPlayerPositionUpdate((data) => {
            console.log('Mise à jour position:', data);
            if (data.id !== this.characterId) {
                this.updatePlayerInGame(data);
            }
        });

        // Demande initiale des joueurs connectés
        SocketService.socket.emit('requestAllPlayers');
        SocketService.socket.on('allPlayers', players => {
            console.log('Liste des joueurs connectés reçue:', players);
            players.forEach(playerData => {
                if (playerData.id !== this.characterId) {
                    console.log('Ajout du joueur existant:', playerData);
                    this.addNewPlayerToGame(playerData);
                }
            });
        });

        // Écoute des mises à jour d'or
        SocketService.socket.on('gold', gold => {
            this.playerGold = gold.amount;
            if (this.inventory.isActive) {
                this.inventory.updateGoldDisplay();
            }
        });

        // Demande des derniers messages et de l'or
        SocketService.socket.emit('getLastMessages');
        SocketService.socket.emit('getGold', this.characterId);
    }

    setupInputEvents() {
        this.input.on('pointerdown', (pointer) => {
            // Ne pas permettre le mouvement si l'inventaire est ouvert
            if (this.isInventoryActive) {
                return;
            }

            if (this.player) {
                const startX = this.player.x;
                const startY = this.player.y;
                const targetX = pointer.x;
                const targetY = pointer.y;
                
                // Envoyer uniquement les points de départ et d'arrivée
                SocketService.updatePlayerPosition({
                    id: this.characterId,
                    startX,
                    startY,
                    targetX,
                    targetY
                });
                
                // Démarrer le déplacement local
                this.startSmoothMovement(startX, startY, targetX, targetY);
            }
        });
    }

    startSmoothMovement(startX, startY, targetX, targetY) {
        this.moving = true;
        this.player.setVelocity(0, 0);
        
        // Calculer la distance totale
        const distanceX = targetX - startX;
        const distanceY = targetY - startY;
        const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        // Calculer la durée du déplacement (en ms)
        const duration = (totalDistance / this.speed) * 1000;
        
        // Créer une tween pour un mouvement fluide
        this.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                if (this.playerNameContainer) {
                    this.playerNameContainer.setPosition(this.player.x, this.player.y);
                }
            },
            onComplete: () => {
                this.moving = false;
                this.player.setVelocity(0, 0);
                if (this.playerNameContainer) {
                    this.playerNameContainer.setPosition(this.player.x, this.player.y);
                }
            }
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

        // Demander la liste des joueurs après un court délai pour s'assurer que la connexion est établie
        setTimeout(() => {
            console.log('Demande de la liste des joueurs après initialisation');
            SocketService.socket.emit('requestAllPlayers');
        }, 1000);
    }

    addNewPlayerToGame(playerData) {
        console.log('Ajout du joueur:', playerData);
        if (this.players[playerData.id]) {
            console.log('Joueur déjà existant, mise à jour');
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
            playerId: playerData.id,
            name: playerData.name
        };

        console.log('Joueur ajouté avec succès');
    }

    updatePlayerInGame(playerData) {
        console.log('Mise à jour du joueur:', playerData);
        const player = this.players[playerData.id];
        if (player) {
            player.name = playerData.name;
            
            // Si nous avons des points de départ et d'arrivée
            if (playerData.startX !== undefined && playerData.startY !== undefined) {
                // Arrêter tout mouvement en cours
                if (player.movementTween) {
                    player.movementTween.stop();
                }
                
                // Démarrer un nouveau mouvement fluide
                player.movementTween = this.tweens.add({
                    targets: player.sprite,
                    x: playerData.targetX,
                    y: playerData.targetY,
                    duration: (Math.sqrt(
                        Math.pow(playerData.targetX - playerData.startX, 2) + 
                        Math.pow(playerData.targetY - playerData.startY, 2)
                    ) / this.speed) * 1000,
                    ease: 'Linear',
                    onUpdate: () => {
                        if (player.nameContainer) {
                            player.nameContainer.setPosition(player.sprite.x, player.sprite.y);
                        }
                    },
                    onComplete: () => {
                        if (player.nameContainer) {
                            player.nameContainer.setPosition(player.sprite.x, player.sprite.y);
                        }
                    }
                });
            } else {
                // Fallback pour les anciennes mises à jour de position
                const lerpFactor = 0.2;
                player.sprite.x = Phaser.Math.Linear(
                    player.sprite.x,
                    playerData.x,
                    lerpFactor
                );
                player.sprite.y = Phaser.Math.Linear(
                    player.sprite.y,
                    playerData.y,
                    lerpFactor
                );
                player.nameContainer.setPosition(player.sprite.x, player.sprite.y);
            }
        } else {
            console.log('Joueur non trouvé, création');
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
        // Cette fonction n'est plus nécessaire car le mouvement est géré par les tweens
        // Nous la gardons vide pour la compatibilité
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