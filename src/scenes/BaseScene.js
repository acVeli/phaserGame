import SocketService from '../services/SocketService';

class BaseScene extends Phaser.Scene {
    constructor(config) {
        super(config);
        this.socket = null;
    }

    initSocket() {
        this.socket = SocketService.socket;
        this.setupBaseSocketListeners();
    }

    setupBaseSocketListeners() {
        this.socket.on('errorMessage', (error) => {
            console.error('Erreur:', error);
            this.displayErrorMessage(error, 500);
        });
    }

    displayErrorMessage(message, y) {
        return this.add.text(640, y, message, { 
            fontSize: '24px', 
            fill: '#f00',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);
    }

    clearContainer(container) {
        if (container) {
            container.removeAll(true);
        }
    }

    // Méthodes utilitaires pour les assets
    loadCommonAssets() {
        // Assets communs à toutes les scènes
        this.load.setBaseURL(window.location.origin);
        this.load.crossOrigin = 'anonymous';
    }

    // Méthodes utilitaires pour l'UI
    createButton(x, y, text, config = {}) {
        const button = this.add.text(x, y, text, {
            fontSize: config.fontSize || '24px',
            fill: config.fill || '#0f0',
            backgroundColor: config.backgroundColor,
            padding: config.padding || { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive();

        if (config.callback) {
            button.on('pointerdown', config.callback);
        }

        return button;
    }

    // Méthodes utilitaires pour le debug
    debugLog(...args) {
        if (process.env.NODE_ENV === 'development') {
            console.log(...args);
        }
    }

    debugRect(x, y, width, height, color = 0xff0000) {
        if (process.env.NODE_ENV === 'development') {
            return this.add.rectangle(x, y, width, height, color)
                .setStrokeStyle(1, 0xffffff)
                .setAlpha(0.3);
        }
        return null;
    }
}

export default BaseScene; 