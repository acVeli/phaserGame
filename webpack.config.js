// webpack.config.js
const path = require('path');

module.exports = {
    entry: './src/main.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }
        ]
    },
    externals: {
        phaser: 'Phaser',
        'socket.io-client': 'io'
    },
    devServer: {
        static: {
            directory: path.join(__dirname, '/'),
        },
        port: 8080,
        hot: true,
        devMiddleware: {
            publicPath: '/dist/',
            writeToDisk: true
        }
    }
};
    
