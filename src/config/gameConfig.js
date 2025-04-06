export const GAME_CONFIG = {
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
            debug: process.env.NODE_ENV === 'development'
        }
    }
};

export const SOCKET_CONFIG = {
    port: 3000,
    url: 'http://localhost'
};

export const PLAYER_CONFIG = {
    speed: 160,
    startPosition: {
        x: 688,
        y: 231
    }
};

export const UI_CONFIG = {
    chat: {
        width: 300,
        height: 200,
        padding: 1,
        inputHeight: 30
    },
    inventory: {
        slotSize: 65,
        padding: 10,
        cols: 5,
        rows: 4
    }
}; 