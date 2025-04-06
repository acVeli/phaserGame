import { SOCKET_CONFIG } from '../config/gameConfig';

class SocketService {
    constructor() {
        this.socket = io('http://localhost:3000'); // Port du serveur Node.js
        this.setupBaseListeners();
    }

    setupBaseListeners() {
        this.socket.on('connect', () => {
            console.log('Connecté au serveur Socket.io');
            // Émettre la demande des joueurs une fois connecté
            this.socket.emit('requestAllPlayers');
        });

        this.socket.on('disconnect', () => {
            console.log('Déconnecté du serveur Socket.io');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Erreur de connexion Socket.io:', error);
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
        console.log('Envoi de la position:', playerData);
        this.socket.emit('updatePlayer', playerData);
    }

    getPlayerPosition(characterId) {
        this.socket.emit('getPlayerPosition', characterId);
    }

    onPlayerPositionUpdate(callback) {
        console.log('Configuration de l\'écouteur de position');
        this.socket.on('playerPositionUpdate', (data) => {
            console.log('Réception de la position:', data);
            callback(data);
        });
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
        console.log('Configuration de l\'écouteur de connexion');
        this.socket.on('playerJoined', (data) => {
            console.log('Nouveau joueur connecté:', data);
            callback(data);
        });
    }

    onPlayerLeft(callback) {
        console.log('Configuration de l\'écouteur de déconnexion');
        this.socket.on('playerLeft', (data) => {
            console.log('Joueur déconnecté:', data);
            callback(data);
        });
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

    requestAllPlayers() {
        console.log('Demande de la liste des joueurs');
        this.socket.emit('requestAllPlayers');
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