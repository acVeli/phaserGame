import BaseScene from './BaseScene';
import SocketService from '../services/SocketService';

class LoginScene extends BaseScene {
    constructor() {
        super({ key: 'LoginScene' });
        this.errorMessages = [];
        this.createButton = null;
        this.currentName = '';
    }

    create() {
        this.initSocket();
        this.createUI();
        this.setupSocketListeners();
    }

    createUI() {
        // Titre
        this.add.text(640, 200, 'Bienvenue sur Terzawa', {
            fontSize: '32px',
            fill: '#fff'
        }).setOrigin(0.5);

        // Input du nom
        const nameInput = this.add.dom(640, 300, 'input', {
            type: 'text',
            placeholder: 'Entrez votre nom',
            style: 'width: 200px; padding: 10px;'
        }).setOrigin(0.5);
        nameInput.setName('nameInput');

        // Bouton de jeu
        const playButton = this.add.text(640, 400, 'Jouer', {
            fontSize: '24px',
            fill: '#0f0'
        })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => this.handlePlayButton(nameInput.node.value));
    }

    setupSocketListeners() {
        SocketService.socket.off('nameCheckedForLogin');
        SocketService.socket.off('nameCheckedForRegister');
        SocketService.socket.off('registrationSuccess');
        SocketService.socket.off('character');

        SocketService.socket.on('nameCheckedForLogin', character => 
            this.handleLoginCheck(character));
        SocketService.socket.on('nameCheckedForRegister', isNameValid => 
            this.handleRegisterCheck(isNameValid));
        SocketService.socket.on('registrationSuccess', character => 
            this.handleRegistrationSuccess(character));
        SocketService.socket.on('character', character => 
            this.handleCharacterReceived(character));
    }

    handlePlayButton(name) {
        this.clearErrorMessages();
        if (name.trim() === '') {
            this.displayErrorMessage('Veuillez entrer un nom', 500);
            return;
        }
        this.currentName = name;
        SocketService.checkNameForLogin(name);
    }

    handleLoginCheck(character) {
        if (character) {
            SocketService.socket.emit('getCharacter', character.name || character);
        } else {
            this.displayMultipleErrorMessages([
                'Personnage non trouvé',
                'Si vous n\'avez pas de personnage, veuillez en créer un.'
            ]);
            this.displayCreateButton();
        }
    }

    handleRegisterCheck(isNameValid) {
        if (isNameValid) {
            SocketService.socket.emit('createCharacter', { name: this.currentName });
        } else {
            this.displayMultipleErrorMessages([
                'Le nom de personnage est déjà utilisé ou invalide',
                'Entrez un autre nom et veuillez ne pas utiliser d\'espace ou de caractères spéciaux.',
                'Le nom doit être composé de 1 à 16 caractères alphanumériques.'
            ]);
        }
    }

    handleRegistrationSuccess(character) {
        if (!character) {
            this.displayErrorMessage('Erreur lors de la création du personnage', 500);
            return;
        }
        SocketService.socket.emit('giveStartingItems', character.insertedId);
        SocketService.socket.emit('giveStartingGold', character.insertedId);
        this.startGame(this.currentName, character.insertedId, 1, true);
    }

    handleCharacterReceived(character) {
        if (character) {
            this.startGame(character.name, character._id, character.level, false, true);
        }
    }

    startGame(playerName, characterId, level, registered = false, loggedIn = false) {
        this.scene.start('MainScene', {
            playerName,
            characterId,
            level,
            registered,
            loggedIn
        });
    }

    displayMultipleErrorMessages(messages) {
        this.clearErrorMessages();
        let y = 500;
        messages.forEach(message => {
            this.errorMessages.push(this.displayErrorMessage(message, y));
            y += 50;
        });
    }

    displayCreateButton() {
        this.createButton = this.add.text(640, 600, 'Créer un personnage', {
            fontSize: '24px',
            fill: '#0f0'
        })
            .setOrigin(0.5)
            .setInteractive()
            .on('pointerdown', () => {
                this.clearErrorMessages();
                SocketService.checkNameForRegister(this.currentName);
            });
    }

    clearErrorMessages() {
        this.errorMessages.forEach(message => message.destroy());
        this.errorMessages = [];
        if (this.createButton) {
            this.createButton.destroy();
            this.createButton = null;
        }
    }
}

export default LoginScene; 