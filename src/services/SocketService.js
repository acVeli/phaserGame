import { SOCKET_CONFIG } from '../config/gameConfig';

class SocketService {
    constructor() {
        this.socket = io(`${SOCKET_CONFIG.url}:${SOCKET_CONFIG.port}`);
        this.setupBaseListeners();
    }

    setupBaseListeners() {
        this.socket.on("connect", () => {
            console.log('Connecté au serveur');
        });

        this.socket.on("connect_error", (err) => {
            console.log(`Erreur de connexion: ${err.message}`);
        });
    }

    // Méthodes d'authentification
    checkNameForLogin(name) {
        this.socket.emit('checkNameForLogin', name);
    }

    checkNameForRegister(name) {
        this.socket.emit('checkNameForRegister', name);
    }

    // Méthodes de gestion du joueur
    updatePlayerPosition(playerData) {
        this.socket.emit('updatePlayer', playerData);
    }

    getPlayerPosition(characterId) {
        this.socket.emit('getPlayerPosition', characterId);
    }

    // Méthodes de gestion de l'inventaire
    getInventory(characterId) {
        this.socket.emit('getInventory', characterId);
    }

    getGold(characterId) {
        this.socket.emit('getGold', characterId);
    }

    // Méthodes de chat
    sendChatMessage(message, playerName) {
        this.socket.emit('chat message', message, playerName);
    }

    // Méthodes d'écoute des événements
    onPlayerJoined(callback) {
        this.socket.on('playerJoined', callback);
    }

    onPlayerLeft(callback) {
        this.socket.on('playerLeft', callback);
    }

    onChatMessage(callback) {
        this.socket.on('chat message', callback);
    }

    onInventoryUpdate(callback) {
        this.socket.on('inventory', callback);
    }

    onGoldUpdate(callback) {
        this.socket.on('gold', callback);
    }

    onNameCheckedForLogin(callback) {
        this.socket.on('nameCheckedForLogin', callback);
    }

    onNameCheckedForRegister(callback) {
        this.socket.on('nameCheckedForRegister', callback);
    }

    onRegistrationSuccess(callback) {
        this.socket.on('registrationSuccess', callback);
    }

    onCharacterReceived(callback) {
        this.socket.on('character', callback);
    }

    // Méthodes utilitaires
    removeListener(event) {
        this.socket.off(event);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Export une instance unique du service
export default new SocketService(); 