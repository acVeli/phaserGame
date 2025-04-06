import SocketService from '../services/SocketService';

class Chat {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            width: config.width || 300,
            height: config.height || 200,
            padding: config.padding || 1,
            inputHeight: config.inputHeight || 30,
            position: config.position || { x: 1, y: 693 }
        };
        
        this.isActive = false;
        this.currentInput = '';
        this.setup();
    }

    setup() {
        this.createChatBox();
        this.createMessagesContainer();
        this.createInput();
        this.setupEventListeners();
        this.loadLastMessages();
    }

    createChatBox() {
        this.chatBox = this.scene.add.rectangle(
            this.config.padding,
            this.scene.game.config.height - this.config.padding,
            this.config.width,
            this.config.height,
            0x333333
        )
            .setOrigin(0, 1)
            .setAlpha(0.7);
    }

    createMessagesContainer() {
        const containerHeight = this.config.height - this.config.inputHeight - this.config.padding * 3;
        this.messagesContainer = this.scene.add.container(
            this.config.padding,
            this.scene.game.config.height - this.config.height - this.config.padding
        );

        this.chatMessages = this.scene.add.text(0, 0, '', {
            font: '14px Arial',
            fill: '#ffffff',
            wordWrap: { width: this.config.width - this.config.padding * 2 },
            padding: { x: 5, y: 5 }
        });

        const mask = this.scene.add.graphics()
            .fillRect(
                this.config.padding,
                this.scene.game.config.height - this.config.height - this.config.padding,
                this.config.width - this.config.padding * 2,
                containerHeight
            );

        this.messagesContainer.add(this.chatMessages);
        this.messagesContainer.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));

        this.scrollIcon = this.scene.add.image(
            this.chatBox.x + this.config.width - this.config.padding - 15,
            this.chatBox.y - this.config.padding - 15,
            'scroll-icon'
        )
            .setOrigin(0.5)
            .setAlpha(0.7)
            .setScale(0.4)
            .setScrollFactor(0)
            .setVisible(false);
    }

    createInput() {
        this.chatInput = this.scene.add.text(
            this.config.position.x,
            this.config.position.y,
            '',
            {
                font: '14px Arial',
                fill: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 5, y: 5 },
                fixedWidth: 270
            }
        ).setOrigin(0, 0);

        this.sendButton = this.scene.add.image(285, 710, 'send-icon')
            .setScale(0.5)
            .setOrigin(0.5, 0.75)
            .setInteractive()
            .on('pointerdown', () => this.sendMessage());
    }

    setupEventListeners() {
        this.scene.input.keyboard.on('keydown', this.handleKeydown.bind(this));
        
        SocketService.onChatMessage((msg, playerName) => {
            this.addMessage(msg, playerName);
        });

        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.chatMessages.height > this.config.height - this.config.inputHeight - this.config.padding * 3) {
                this.chatMessages.y -= deltaY;
                this.chatMessages.y = Phaser.Math.Clamp(
                    this.chatMessages.y,
                    -(this.chatMessages.height - (this.config.height - this.config.inputHeight - this.config.padding * 3)),
                    0
                );
                this.updateScrollIcon();
            }
        });
    }

    handleKeydown(event) {
        if (event.key === 'Enter') {
            if (!this.isActive) {
                this.toggleChat();
            } else {
                this.sendMessage();
            }
        } else if (this.isActive) {
            this.handleInput(event);
        }
    }

    handleInput(event) {
        if (event.key === 'Backspace' && this.currentInput.length > 0) {
            this.currentInput = this.currentInput.slice(0, -1);
        } else if (event.key.length === 1) {
            this.currentInput += event.key;
        }
        this.chatInput.setText(this.currentInput);
    }

    toggleChat() {
        this.isActive = !this.isActive;
        this.chatInput.setBackgroundColor(
            this.isActive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)'
        );
        this.scene.isChatActive = this.isActive;
    }

    sendMessage() {
        if (this.currentInput) {
            SocketService.sendChatMessage(this.currentInput, this.scene.playerName);
            this.currentInput = '';
            this.chatInput.setText('');
        }
        this.toggleChat();
    }

    addMessage(message, playerName) {
        const newMessage = `${playerName}: ${message}\n`;
        const currentMessages = this.chatMessages.text.split('\n');
        
        if (currentMessages.length >= 20) {
            currentMessages.shift();
        }
        currentMessages.push(newMessage.trim());
        
        this.chatMessages.setText(currentMessages.join('\n'));

        if (this.chatMessages.height > this.config.height - this.config.inputHeight - this.config.padding * 3) {
            this.chatMessages.y = -(this.chatMessages.height - (this.config.height - this.config.inputHeight - this.config.padding * 3));
            this.updateScrollIcon();
        }
    }

    updateScrollIcon() {
        const isVisible = this.chatMessages.height > this.config.height - this.config.inputHeight - this.config.padding * 3;
        this.scrollIcon.setVisible(isVisible);

        if (isVisible) {
            const scrollPercentage = Math.abs(this.chatMessages.y) / 
                (this.chatMessages.height - (this.config.height - this.config.inputHeight - this.config.padding * 3));
            const iconY = this.chatBox.y - this.config.height + this.config.padding + 15 + 
                scrollPercentage * (this.config.height - this.config.inputHeight - this.config.padding * 3 - 30);
            this.scrollIcon.setPosition(this.scrollIcon.x, iconY);
        }
    }

    loadLastMessages() {
        SocketService.socket.emit('getLastMessages');
        SocketService.socket.on('lastMessages', (messages) => {
            messages.forEach(message => {
                this.addMessage(message.message, message.playerName);
            });
        });
    }

    destroy() {
        this.chatBox.destroy();
        this.messagesContainer.destroy();
        this.chatInput.destroy();
        this.sendButton.destroy();
        this.scrollIcon.destroy();
    }
}

export default Chat; 