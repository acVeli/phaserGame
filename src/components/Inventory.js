import SocketService from '../services/SocketService';
import { UI_CONFIG } from '../config/gameConfig';

class Inventory {
    constructor(scene, characterId) {
        this.scene = scene;
        this.characterId = characterId;
        this.isActive = false;
        this.config = UI_CONFIG.inventory;
        this.items = [];
        this.setup();
    }

    setup() {
        this.createContainers();
        this.createSlots();
        this.setupEventListeners();
        this.loadInventory();
        this.containers.main.setVisible(false);
        this.containers.equipment.setVisible(false);
    }

    createContainers() {
        // Container principal
        this.containers = {
            main: this.scene.add.container(640, 360),
            equipment: this.scene.add.container(990, 360),
            modal: this.scene.add.container(640, 360)
        };

        // Arrière-plans
        const mainBg = this.scene.add.rectangle(0, 0, 450, 400, 0x333333);
        const equipBg = this.scene.add.rectangle(0, 0, 200, 400, 0x333333);
        mainBg.setAlpha(0.8);
        equipBg.setAlpha(0.8);

        this.containers.main.add(mainBg);
        this.containers.equipment.add(equipBg);

        // Titre
        const title = this.scene.add.text(0, -170, 'Inventaire', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffffff'
        }).setOrigin(0.5);
        this.containers.main.add(title);

        // Bouton de fermeture
        const closeButton = this.scene.add.text(200, -190, 'X', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffffff'
        });
        closeButton.setInteractive();
        closeButton.on('pointerdown', () => {
            // Empêcher la propagation en retournant false
            return false;
        });
        closeButton.on('pointerup', () => {
            this.toggle();
        });
        this.containers.main.add(closeButton);

        // Configuration des profondeurs
        Object.values(this.containers).forEach(container => container.setDepth(1));
    }

    createSlots() {
        this.slots = [];
        const startY = -120;

        for (let i = 0; i < this.config.cols * this.config.rows; i++) {
            const x = ((i % this.config.cols) - Math.floor(this.config.cols/2)) * 
                     (this.config.slotSize + this.config.padding);
            const y = startY + (Math.floor(i / this.config.cols)) * 
                     (this.config.slotSize + this.config.padding);
            
            const slot = this.scene.add.rectangle(x, y, this.config.slotSize, this.config.slotSize, 0x666666);
            slot.setStrokeStyle(2, 0x999999);
            this.containers.main.add(slot);
            this.slots.push(slot);
        }
    }

    setupEventListeners() {
        SocketService.onInventoryUpdate(inventory => {
            this.items = inventory.items;
            this.updateDisplay();
        });

        this.scene.input.keyboard.on('keydown-I', () => {
            if (!this.scene.isChatActive) {
                this.toggle();
            }
        });
    }

    loadInventory() {
        SocketService.getInventory(this.characterId);
    }

    updateDisplay() {
        // Nettoyer les anciens items
        this.containers.main.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Image) {
                child.destroy();
            }
        });

        // Afficher les nouveaux items
        this.items.forEach((item, index) => {
            if (index < this.slots.length) {
                const slot = this.slots[index];
                const itemSprite = this.scene.add.image(slot.x, slot.y, 'item' + item.id)
                    .setDisplaySize(this.config.slotSize, this.config.slotSize);
                
                itemSprite.setInteractive();
                this.setupItemInteractions(itemSprite, item);
                this.containers.main.add(itemSprite);
            }
        });

        this.updateGoldDisplay();
    }

    setupItemInteractions(itemSprite, item) {
        itemSprite.on('pointerover', () => {
            this.showItemTooltip(item, itemSprite);
        });

        itemSprite.on('pointerout', () => {
            this.hideItemTooltip();
        });
    }

    showItemTooltip(item, itemSprite) {
        const tooltipText = this.scene.add.text(0, 0, 
            `${item.name}\n\n${item.description}`, {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: 180 }
            }
        ).setOrigin(0.5);

        const padding = 10;
        const tooltipBg = this.scene.add.rectangle(
            0, 0,
            tooltipText.width + padding * 2,
            tooltipText.height + padding * 2,
            0x000000
        ).setAlpha(0.8);

        this.containers.modal
            .add([tooltipBg, tooltipText])
            .setPosition(
                itemSprite.x + this.containers.main.x + 130,
                itemSprite.y + this.containers.main.y
            )
            .setVisible(true);
    }

    hideItemTooltip() {
        this.containers.modal.removeAll(true);
        this.containers.modal.setVisible(false);
    }

    updateGoldDisplay() {
        if (this.goldText) {
            this.goldText.destroy();
        }
        if (this.goldIcon) {
            this.goldIcon.destroy();
        }

        this.goldIcon = this.scene.add.image(-205, 180, 'gold_pouch')
            .setScale(0.5);
        this.goldText = this.scene.add.text(-190, 170, `Or: ${this.scene.playerGold}`, {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffffff'
        });

        this.containers.main.add([this.goldIcon, this.goldText]);
    }

    toggle() {
        this.isActive = !this.isActive;
        this.containers.main.setVisible(this.isActive);
        this.containers.equipment.setVisible(this.isActive);
        
        // Informer la scène que l'inventaire est ouvert/fermé
        this.scene.isInventoryActive = this.isActive;
        
        if (this.isActive) {
            this.loadInventory();
        } else {
            this.hideItemTooltip();
        }
    }

    destroy() {
        Object.values(this.containers).forEach(container => container.destroy());
    }
}

export default Inventory; 