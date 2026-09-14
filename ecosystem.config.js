module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './apps/server',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      windowsHide: true,
      autorestart: true,
      watch: false,
    },
    {
      name: 'frontend',
      cwd: './apps/mini-app',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      windowsHide: true,
      autorestart: true,
      watch: false,
    },
  ],
};