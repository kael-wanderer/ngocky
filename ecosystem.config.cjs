module.exports = {
  apps: [
    {
      name: 'ngocky-api',
      cwd: __dirname,
      script: 'npm',
      args: 'run dev:api',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'ngocky-web',
      cwd: __dirname,
      script: 'npm',
      args: 'run dev:web',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
