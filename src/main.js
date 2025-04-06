import { GAME_CONFIG } from './config/gameConfig';
import LoginScene from './scenes/LoginScene';
import MainScene from './scenes/MainScene';

class Game extends Phaser.Game {
    constructor() {
        super(GAME_CONFIG);
        this.scene.add('LoginScene', LoginScene);
        this.scene.add('MainScene', MainScene);
        this.scene.start('LoginScene');
    }
}

window.onload = () => {
    new Game();
}; 