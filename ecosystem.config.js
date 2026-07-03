module.exports = {
  apps: [{
    name: 'backend',
    cwd: __dirname,
    script: 'app.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
  }],
};
