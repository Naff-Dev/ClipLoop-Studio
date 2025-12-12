const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    extraResource: [
      './resources/ffmpeg'  // hanya folder ffmpeg yang dibundle
    ]
  },

  makers: [
    // WINDOWS INSTALLER (.exe)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'naffdev_cliploop_studio'
      }
    },

    // WINDOWS PORTABLE (.zip)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    },

    // LINUX MAKERS (biarkan kosong kalau tidak dipakai)
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
