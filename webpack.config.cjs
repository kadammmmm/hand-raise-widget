const path = require('path');

module.exports = [
  {
    name: 'agent',
    mode: 'production',
    entry: './src/hand-raise-agent.js',
    output: {
      filename: 'agent.js',
      path: path.resolve(__dirname, 'dist'),
      iife: true
    },
    resolve: { extensions: ['.js'] }
  },
  {
    name: 'supervisor',
    mode: 'production',
    entry: './src/hand-raise-supervisor.js',
    output: {
      filename: 'supervisor.js',
      path: path.resolve(__dirname, 'dist'),
      iife: true
    },
    resolve: { extensions: ['.js'] }
  },
  {
    name: 'supervisor-alert',
    mode: 'production',
    entry: './src/hand-raise-supervisor-alert.js',
    output: {
      filename: 'supervisor-alert.js',
      path: path.resolve(__dirname, 'dist'),
      iife: true
    },
    resolve: { extensions: ['.js'] }
  }
];
