class PlayerNameContainer {
    constructor(scene, x, y, name, level) {
        this.scene = scene;
        this.container = scene.add.container(x, y - 40);
        this.create(name, level);
    }

    create(name, level) {
        // Création du fond
        const text = `${name} Lvl: ${level}`;
        this.nameText = this.scene.add.text(0, 0, text, {
            font: '16px Arial',
            fill: '#ffffff',
            padding: { x: 5, y: 2 }
        }).setOrigin(0.5);

        // Création du background
        this.background = this.scene.add.rectangle(
            0,
            0,
            this.nameText.width + 10,
            20,
            0x333333
        ).setAlpha(0.7).setOrigin(0.5);

        // Ajout des éléments au container
        this.container.add([this.background, this.nameText]);
    }

    setPosition(x, y) {
        this.container.setPosition(x, y - 40);
    }

    updateText(name, level) {
        const text = `${name} Lvl: ${level}`;
        this.nameText.setText(text);
        this.background.width = this.nameText.width + 10;
    }

    destroy() {
        this.container.destroy();
    }
}

export default PlayerNameContainer; 