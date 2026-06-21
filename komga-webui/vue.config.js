// vue.config.js
module.exports = {
  // with './' the dev server cannot load any arbitrary path
  // with '/' the prod build generates some url(/fonts…) calls in the css chunks, which doesn't work with a servlet context path
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',

  pluginOptions: {
    i18n: {
      locale: 'en',
      fallbackLocale: 'en',
      localeDir: 'locales',
      enableInSFC: false,
    },
  },

  devServer: {
    allowedHosts: 'all',
    client: {
      webSocketURL: 'ws://0.0.0.0:8081/ws',
    },
    // Proxy backend calls through the dev server itself instead of hardcoding an absolute
    // backend URL (e.g. via VUE_APP_KOMGA_API_URL=http://localhost:25600): that hardcoded
    // form only works when the browser is on the same machine, since "localhost" resolves
    // client-side. Proxying keeps the browser on a single origin (whatever host/IP it used
    // to reach this dev server) and lets webpack-dev-server (running on the same machine as
    // the backend) forward to it server-side, so it works from any device on the network.
    proxy: {
      '/api': { target: 'http://localhost:25600', changeOrigin: true },
      '/sse': { target: 'http://localhost:25600', changeOrigin: true, ws: true },
      '/actuator': { target: 'http://localhost:25600', changeOrigin: true },
    },
  },

  // custom rule for readium and r2d2bc css that needs to be made available, but untouched
  configureWebpack: {
    module: {
      rules: [
        {
          test: [
            /readium\/.*\.css.resource$/,
            /r2d2bc\/.*\.css.resource$/,
          ],
          type: 'asset/resource',
          generator: {
            filename: 'css/[hash].css[query]',
          },
        },
      ],
    },
  },
}
