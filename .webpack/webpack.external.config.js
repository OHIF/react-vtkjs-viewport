// Configurations to support some packages with any sort of missing bundle configuration

// Configure vtk rules
function configureVtkRules() {
  return [
    {
      issuer: /vtk\.js\//,
      test: /\.glsl$/i,
      loader: 'shader-loader',
    },
    {
      issuer: /vtk\.js\//,
      test: /\.css$/,
      exclude: /\.module\.css$/,
      use: [
        { loader: 'style-loader' },
        { loader: 'css-loader' },
        { loader: 'postcss-loader' },
      ],
    },
    {
      issuer: /vtk\.js\//,
      test: /\.module\.css$/,
      use: [
        { loader: 'style-loader' },
        {
          loader: 'css-loader',
          options: {
            localIdentName: '[name]-[local]_[sha512:hash:base64:5]',
            modules: true,
          },
        },
        { loader: 'postcss-loader' },
      ],
    },
    {
      issuer: /vtk\.js\//,
      test: /\.svg$/,
      use: [{ loader: 'raw-loader' }],
    },
    {
      issuer: /vtk\.js\//,
      test: /\.worker\.js$/,
      use: [
        { loader: 'worker-loader', options: { inline: true, fallback: false } },
      ],
    },
  ];
}
exports.default = {
  moduleRules: configureVtkRules(),
};
